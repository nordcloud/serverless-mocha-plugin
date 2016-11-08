/**
 * serverless-mocha-plugin
 * - a plugin for TDD with serverless
 */

const path = require('path');
const fs = require('fs');
const lambdaWrapper = require('lambda-wrapper');
const Mocha = require('mocha');
const chai = require('chai');
const ejs = require('ejs');
const utils = require('./utils');
const BbPromise = require('bluebird');

const templateFilename = path.join('templates', 'test-template.ejs');

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
              'test',
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
              },
            },
          },
        },
      },
      invoke: {
        usage: 'Invoke mocha tests for service / function',
        commands: {
          test: {
            usage: 'Invoke test(s)',
            lifecycleEvents: [
              'test',
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
                required: false,
              },
              'reporter-options': {
                usage: 'Options for mocha reporter',
                shortcut: 'O',
                required: false,
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'create:test:test': () => {
        BbPromise.bind(this)
        .then(this.createTest);
      },
      'invoke:test:test': () => {
        BbPromise.bind(this)
        .then(this.runTests);
      },
    };
  }

  runTests() {
    const myModule = this;
    const funcName = this.options.f || this.options.function || [];
    const testFileMap = {};
    const mocha = new Mocha({
      timeout: 6000,
    });

    const stage = this.options.stage;
    const region = this.options.region;

    this.serverless.service.load({
      stage,
      region,
    })
    .then((inited) => {
      myModule.serverless.environment = inited.environment;

      myModule.getFunctions(funcName)
      .then(utils.getTestFiles)
      .then((funcs) => {
        const funcNames = Object.keys(funcs);
        if (funcNames.length === 0) {
          return myModule.serverless.cli.log('No tests to run');
        }
        funcNames.forEach((func) => {
          myModule.setEnvVars(func, {
            stage,
            region,
          });

          testFileMap[func] = funcs[func];

          mocha.addFile(funcs[func].mochaPlugin.testPath);
        });

        const reporter = myModule.options.reporter;

        if (reporter !== undefined) {
          const reporterOptions = {};
          if (myModule.options['reporter-options'] !== undefined) {
            myModule.options['reporter-options'].split(',').forEach((opt) => {
              const L = opt.split('=');
              if (L.length > 2 || L.length === 0) {
                throw new Error(`invalid reporter option "${opt}"`);
              } else if (L.length === 2) {
                reporterOptions[L[0]] = L[1];
              } else {
                reporterOptions[L[0]] = true;
              }
            });
          }
          mocha.reporter(reporter, reporterOptions);
        }

        mocha.run((failures) => {
          process.on('exit', () => {
            process.exit(failures);  // exit with non-zero status if there were failures
          });
        })
        .on('suite', (suite) => {
          const testFuncName = utils.funcNameFromPath(suite.file);
          const func = testFileMap[testFuncName];

          if (func) {
            myModule.setEnvVars(func, {
              stage,
              region,
            });
          }
        });
        return null;
      }, (error) => myModule.serverless.cli.log(error)
      );
    });
  }

  createTest() {
    const funcName = this.options.f || this.options.function;
    const myModule = this;

    utils.createTestFolder().then((testFolder) => {
      const testFilePath = utils.getTestFilePath(funcName);
      const func = myModule.serverless.service.functions[funcName];
      const handlerParts = func.handler.split('.');
      const funcPath = (`${handlerParts[0]}.js`).replace(/\\/g, '/');
      const funcCall = handlerParts[1];

      fs.exists(testFilePath, (exists) => {
        if (exists) {
          myModule.serverless.cli.log(`Test file ${testFilePath} already exists`);
          return (new Error(`File ${testFilePath} already exists`));
        }

        let templateFilenamePath = path.join(testFolder, templateFilename);
        fs.exists(templateFilenamePath, (exists2) => {
          if (!exists2) {
            templateFilenamePath = path.join(__dirname, templateFilename);
          }
          const templateString = utils.getTemplateFromFile(templateFilenamePath);

          const content = ejs.render(templateString, {
            functionName: funcName,
            functionPath: funcPath,
            handlerName: funcCall,
          });

          fs.writeFile(testFilePath, content, (err) => {
            if (err) {
              myModule.serverless.cli.log(`Creating file ${testFilePath} failed: ${err}`);
              return new Error(`Creating file ${testFilePath} failed: ${err}`);
            }
            return myModule.serverless.cli.log(`serverless-mocha-plugin: created ${testFilePath}`);
          });
        });
        return null;
      });
    });
  }

  // Helper functions

  getFunctions(funcNames) {
    const myModule = this;
    let funcList = funcNames;

    return new BbPromise((resolve) => {
      const funcObjs = {};
      const allFuncs = myModule.serverless.service.functions;
      if (typeof funcNames === 'string') {
        funcList = [funcNames];
      }

      if (funcNames.length === 0) {
        return resolve(allFuncs);
      }

      let func;
      funcNames.forEach((funcName) => {
        func = allFuncs[funcName];
        if (func) {
          funcObjs[funcName] = func;
        } else {
          myModule.serverless.cli.log(`Warning: Could not find function '${funcName}'.`);
        }
      });
      resolve(funcObjs);

      return null;
    });
  }

  // SetEnvVars
  setEnvVars(funcName, options) {
    if (this.serverless.environment) {
      utils.setEnv(this.serverless.environment.vars);
      if (options.stage) {
        utils.setEnv(this.serverless.environment.stages[options.stage].vars);
        if (options.region) {
          utils.setEnv(this.serverless.environment.stages[options.stage]
          .regions[options.region].vars);
        }
      }
    }
  }

}

module.exports = mochaPlugin;
module.exports.lambdaWrapper = lambdaWrapper;
module.exports.chai = chai;
