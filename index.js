'use strict';

/**
 * serverless-mocha-plugin
 * - a plugin for TDD with serverless
 */

const path  = require('path'),
  fs        = require('fs'),
  lambdaWrapper = require('lambda-wrapper'),
  Mocha = require('mocha'),
  chai = require('chai'),
  ejs = require('ejs'),
  utils = require('./utils.js'),
  BbPromise = require('bluebird'); // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)

const testFolder = 'test'; // Folder used my mocha for tests
const templateFilename = 'sls-mocha-plugin-template.ejs';

class mochaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      create: {
        usage: 'Create mocha tests for service / function',
        commands: {
          test: {
            usage: 'Create test',
            lifecycleEvents: [
              'test'
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
              }
            }
          }
        }
      },
      invoke: {
        usage: 'Invoke mocha tests for service / function',
        commands: {
          test: {
            usage: 'Invoke test(s)',
            lifecycleEvents: [
              'test'
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: false,
              },
              reporter: {
                usage: 'Mocha reporter to use',
                shortcut: 'R',
                required: false
              },
              "reporter-options": {
                usage: 'Options for mocha reporter',
                shortcut: 'O',
                required: false
              }
            }
          }
        }
      }
    };

    this.hooks = {
      'create:test:test': () => {
          BbPromise.bind(this)
          .then(this.createTest);
      },
      'invoke:test:test': () => {
          BbPromise.bind(this)
          .then(this.runTests);
      }
    }
  }

  runTests() {
    let _this = this;
    let funcName = this.options.f || this.options.function || [];
    let testFileMap = {};
    let mocha = new Mocha({timeout: 6000});

    let stage = this.options.stage;
    let region = this.options.region;
    
    this.serverless.service.load({
      stage: stage,
      region: region
    })
    .then( (inited) => {
      _this.serverless.environment = inited.environment;

      _this.getFunctions(funcName)
      .then(utils.getTestFiles)
      .then((funcs) => {
        let funcNames = Object.keys(funcs);
        if (funcNames.length === 0) {
          return _this.serverless.cli.log("No tests to run");
        }
        funcNames.forEach(function(func) {
          _this.setEnvVars(func, {
            stage: stage,
            region: region
          });
          
          testFileMap[func] = funcs[func];

          mocha.addFile(funcs[func].mochaPlugin.testPath);
        })

        var reporter = _this.options.reporter;
        
        if ( reporter !== undefined) {
          var reporterOptions = {};
          if (_this.options["reporter-options"] !== undefined) {
            _this.options["reporter-options"].split(",").forEach(function(opt) {
              var L = opt.split("=");
              if (L.length > 2 || L.length === 0) {
                throw new Error("invalid reporter option '" + opt + "'");
              } else if (L.length === 2) {
                reporterOptions[L[0]] = L[1];
              } else {
                reporterOptions[L[0]] = true;
              }
            });
          }
          mocha.reporter(reporter, reporterOptions)
        }

        mocha.run(function(failures){
          process.on('exit', function () {
            process.exit(failures);  // exit with non-zero status if there were failures
          });
        })
          .on('suite', function(suite) {            
            let funcName = utils.funcNameFromPath(suite.file);
            let func = testFileMap[funcName];

            if (func) {
              _this.setEnvVars(func, {
                stage: stage,
                region: region
              });
            }
          })
          .on('end', (e) => {
            
          });
      }, function(error) {
        return _this.serverless.cli.log(error);
      });
    });    
  }

  createTest() {
    let funcName = this.options.f || this.options.function;
    let _this = this;

    utils.createTestFolder().then(function(testFolder) {
      let testFilePath = utils.getTestFilePath(funcName);
      let servicePath = _this.serverless.config.servicePath;
      let func = _this.serverless.service.functions[funcName];
      let handlerParts = func.handler.split('.');
      let funcPath = (handlerParts[0] + '.js').replace(/\\/g, "/");
      let funcCall = handlerParts[1];

      fs.exists(testFilePath, function (exists) {
        if (exists) {
          _this.serverless.cli.log(`Test file ${testFilePath} already exists`)
          return (new Error(`File ${testFilePath} already exists`));
        }

        let templateFilenamePath = path.join(testFolder, templateFilename);
        fs.exists(templateFilenamePath, function (exists) {
          if (! exists) {
            templateFilenamePath = path.join(__dirname, templateFilename);
          }
          let templateString = utils.getTemplateFromFile(templateFilenamePath);

          let content = ejs.render(templateString, {
            'functionName': funcName,
            'functionPath': funcPath,
            'handlerName': funcCall
          });

          fs.writeFile(testFilePath, content, function(err) {
            if (err) {
              _this.serverless.cli.log(`Creating file ${testFilePath} failed: ${err}`);
              return new Error(`Creating file ${testFilePath} failed: ${err}`);
            }

            return _this.serverless.cli.log(`serverless-mocha-plugin: created ${testFilePath}`);
          });
        });
      });
    });
  }

  // Helper functions
  
  getFunctions(funcNames) {
    let _this = this;
    
    return new BbPromise(function(resolve, reject) {
      let funcObjs = {};
      let allFuncs = _this.serverless.service.functions;
      if (typeof(funcNames) === 'string') {
        funcNames = [ funcNames ];
      }

      if (funcNames.length === 0) {
        let sFuncs = allFuncs;

        return resolve(sFuncs);
      }

      let func;
      funcNames.forEach(function(funcName, idx) {
        func = allFuncs[funcName];
        if (func) {
          funcObjs[funcName] = func;
        } else {
          _this.serverless.cli.log(`Warning: Could not find function '${funcName}'.`);
        }
      });
      resolve(funcObjs);
    });
  }

  // SetEnvVars
  setEnvVars(funcName, options) {
    if (this.serverless.environment) {
      utils.setEnv(this.serverless.environment.vars);
      if (options.stage) {
        utils.setEnv(this.serverless.environment.stages[options.stage].vars);
        if (options.region) {
          utils.setEnv(this.serverless.environment.stages[options.stage].regions[options.region].vars);
        }
      }
    }
  }
}
  
module.exports = mochaPlugin;
module.exports.lambdaWrapper = lambdaWrapper;
module.exports.chai = chai;
