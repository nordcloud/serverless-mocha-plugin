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
  Path = require('path'),
  BbPromise = require('bluebird'); // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)

const testFolder = 'test'; // Folder used my mocha for tests

module.exports = function(S) { // Always pass in the ServerlessPlugin Class

  /**
   * Adding/Manipulating Serverless classes
   * - You can add or manipulate Serverless classes like this
   */

  S.classes.Project.newStaticMethod     = function() { console.log("A new method!"); };
  S.classes.Project.prototype.newMethod = function() { S.classes.Project.newStaticMethod(); };

  /**
   * Extending the Plugin Class
   * - Here is how you can add custom Actions and Hooks to Serverless.
   * - This class is only required if you want to add Actions and Hooks.
   */

  class PluginBoilerplate extends S.classes.Plugin {

    /**
     * Constructor
     * - Keep this and don't touch it unless you know what you're doing.
     */

    constructor() {
      super();
      this.name = 'io.sc5.mocha';
    }

    /**
     * Register Actions
     * - function mocha-create
     */

    registerActions() {

      S.addAction(this._createAction.bind(this), {
        handler:       '_createAction',
        description:   'Create mocha test for function',
        context:       'function',
        contextAction: 'mocha-create',
        options:       [{ // These must be specified in the CLI like this "-option true" or "-o true"
        }],
        parameters: [ // Use paths when you multiple values need to be input (like an array).  Input looks like this: "serverless custom run module1/function1 module1/function2 module1/function3.  Serverless will automatically turn this into an array and attach it to evt.options within your plugin
          {
            parameter: 'paths',
            description: 'Path to function to test. If not defined, test all functions.',
            position: '0->' // Can be: 0, 0-2, 0->  This tells Serverless which params are which.  3-> Means that number and infinite values after it.
          }
        ]
      });

      S.addAction(this._runAction.bind(this), {
        handler:       '_runAction',
        description:   'Create mocha test for function',
        context:       'function',
        contextAction: 'mocha-run',
        options:       [          {
            option:      'region',
            shortcut:    'r',
            description: 'region you want to run your function in'
          },
          {
            option:      'stage',
            shortcut:    's',
            description: 'stage you want to run your function in'
          },
          {
            option:      'reporter',
            shortcut:    'R',
            description: 'specify the reporter to use'
          },
          {
            option:      'reporter-options',
            shortcut:    'O',
            description: 'reporter-specific options'
          }],
        parameters: [ // Use paths when you multiple values need to be input (like an array).  Input looks like this: "serverless custom run module1/function1 module1/function2 module1/function3.  Serverless will automatically turn this into an array and attach it to evt.options within your plugin
          {
            parameter: 'paths',
            description: 'Path to function to test. If not defined, test all functions.',
            position: '0->' // Can be: 0, 0-2, 0->  This tells Serverless which params are which.  3-> Means that number and infinite values after it.
          }
        ]
      });

      return BbPromise.resolve();
    }

    /**
     * Register Hooks
     * -  function create (post) creates mocha test file
     */

    registerHooks() {
      S.addHook(this._hookPostFuncCreate.bind(this), {
        action: 'functionCreate',
        event:  'post'
      });

      return BbPromise.resolve();
    }

    /**
     * Custom action serverless function mocha-create functioName
     */

    _createAction(evt) {
      if (S.getProject().getFunction(evt.options.paths[0]) === undefined) {
        return new BbPromise(function(resolve, reject) {
          reject(`MochaPluginError: Function ${evt.options.paths[0]} does not exist in your project`);
        });
      }

      return createTest(evt.options.paths[0]);
    }

    /**
     * Custom action serverless function mocha-create functioName
     */

    _runAction(evt) {
      return new BbPromise(function(resolve, reject) {
          let funcName = evt.options.paths;
          let mocha = new Mocha({timeout: 5000});
          //This could pose as an issue if several functions share a common ENV name but different values.

          let stage = evt.options.stage || S.getProject().getAllStages()[0].name;
          let region = evt.options.region || S.getProject().getAllRegions(stage)[0].name;

          SetEnvVars(evt.options.paths, {
            stage: stage,
            region: region
          });

          getFilePaths(evt.options.paths)
          .then(function(paths) {
              paths.forEach(function(path,idx) {
                mocha.addFile(path);
              })
              var reporter = evt.options.reporter;
              if ( reporter !== null) {
                var reporterOptions = {};
                if (evt.options["reporter-options"] !== null) {
                  evt.options["reporter-options"].split(",").forEach(function(opt) {
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
              });
          }, function(error) {

            return reject(error);
          });
      });
    }
    /**
     * Hook for creating the mocha test placeholder after function creation
     */

    _hookPostFuncCreate(evt) {
      // TODO: only run with runtime node4.3
      if (evt.options.runtime != 'nodejs4.3') {
        console.log(evt.options.runtime);
        return;
      }
      let parsedPath = path.parse(evt.options.path);
      let funcName = parsedPath.base;

      return createTest(funcName);
    }
  }

  //Set environment variables
  function SetEnvVars(paths, config) {
    paths.forEach(function(path, idx){
      var funcName = Path.basename(path, '.js');
      var func = S.getProject().getFunction(funcName).toObjectPopulated(config);
      var envVars = func.environment;
      var fields = Object.keys(envVars);

      for (var key in fields) {
        process.env[fields[key]] = envVars[fields[key]];
      }
    });
  }

  // Create the test folder
  function createTestFolder() {
      return new BbPromise(function(resolve, reject) {

        fs.exists(testFolder, function(exists) {
            if (exists) {
                return resolve(testFolder);
            }
            fs.mkdir(testFolder, function(err) {
                if (err) {
                    return reject(err);
                }
                return resolve(testFolder);
            })
        })
      });
  }

  // Create the test file (and test folder)

  function createTest(funcName) {
    return createTestFolder().then(function(testFolder) {
      return new BbPromise(function(resolve, reject) {
        let funcFilePath = testFilePath(funcName);
        let projectPath = S.getProject().getRootPath();
        let funcFullPath = S.getProject().getFunction(funcName).getRootPath();
        let funcPath = path.relative(projectPath, funcFullPath).replace(/\\/g, "/");

        fs.exists(funcFilePath, function (exists) {
           if (exists) {
               return reject(new Error(`File ${funcFilePath} already exists`));
           }
           fs.writeFile(funcFilePath, newTestFile(funcName, funcPath), function(err) {
               if (err) {
                   return reject(new Error(`Creating file ${funcFilePath} failed: ${err}`));
               }
               console.log(`serverless-mocha-plugin: created ${funcFilePath}`);
               return resolve(funcFilePath);
           })
        });
      });
    });
  }

  // getTestFiles. If no functions provided, returns all files
  function getFilePaths(funcs) {
    return new BbPromise(function(resolve, reject) {
        var paths = [];

        if (funcs && (funcs.length > 0)) {
            funcs.forEach(function(val, idx) {
                paths.push(testFilePath(val));
            });
            return resolve(paths);
        }
        // No funcs provided, list all test files
        fs.readdirSync(testFolder).filter(function(file){
          // Only keep the .js files
          return file.substr(-3) === '.js';
        }).forEach(function(file) {
            paths.push(path.join(testFolder, file));
        });
        return resolve(paths);
    });
  };

  // Returns the path to a function's test file
  function testFilePath(funcName) {
      return path.join(testFolder, `${funcName.replace(/.*\//g, '')}.js`);
  }

  function newTestFile(funcName, funcPath) {
      return `'use strict';
// tests for ${funcName}
// Generated by serverless-mocha-plugin

const mod         = require('../${funcPath}/handler.js');
const mochaPlugin = require('serverless-mocha-plugin');
const wrapper     = mochaPlugin.lambdaWrapper;
const expect      = mochaPlugin.chai.expect;

describe('${funcName}', () => {
  it('implement tests here', (done) => {
    wrapper.init(mod);
    wrapper.run({}, (err, response) => {
      done('no tests implemented');
    });
  });
});
`;

  }
  // Export Plugin Class
  return PluginBoilerplate;
};

module.exports.lambdaWrapper = lambdaWrapper;
module.exports.chai = chai;
