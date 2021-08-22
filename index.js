'use strict';

/**
 * serverless-mocha-plugin
 * - a plugin for TDD with Serverless Framework
 */

const path = require('path');
const lambdaWrapper = require('lambda-wrapper');
const Mocha = require('mocha');
const chai = require('chai');
const ejs = require('ejs');
const fse = require('fs-extra');
const fs = require('fs');
const BbPromise = require('bluebird');
const yamlEdit = require('yaml-edit');
const { execSync } = require('child_process');
const utils = require('./utils');

const testTemplateFile = path.join('templates', 'test-template.ejs');
const functionTemplateFile = path.join('templates', 'function-template.ejs');

const validFunctionRuntimes = [
  'aws-nodejs8.10',
  'aws-nodejs10.x',
  'aws-nodejs12.x',
];

const humanReadableFunctionRuntimes = `${validFunctionRuntimes
  .map(template => `"${template}"`).join(', ')}`;

class mochaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      create: {
        commands: {
          test: {
            usage: 'Create mocha tests for service / function',
            lifecycleEvents: [
              'test',
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
                type: 'string',
              },
              path: {
                usage: 'Path for the tests',
                shortcut: 'p',
                type: 'string',
              },
            },
          },
          function: {
            usage: 'Create a function into the service',
            lifecycleEvents: [
              'function',
              'test',
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
                type: 'string',
              },
              handler: {
                usage: 'Handler for the function (e.g. --handler my-function/index.handler)',
                required: true,
                type: 'string',
              },
              path: {
                usage: 'Path for the tests (e.g. --path tests)',
                shortcut: 'p',
                type: 'string',
              },
              httpEvent: {
                usage: 'Add an http endpoint (e.g. --httpEvent "verb relative-path")',
                type: 'string',
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
              'invoke',
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                type: 'string',
              },
              reporter: {
                usage: 'Mocha reporter to use',
                shortcut: 'R',
                type: 'string',
              },
              'reporter-options': {
                usage: 'Options for mocha reporter',
                shortcut: 'O',
                type: 'string',
              },
              grep: {
                usage: 'Run only matching tests',
                shortcut: 'G',
                type: 'string',
              },
              live: {
                usage: 'Run the Lambda function in AWS',
                shortcut: 'l',
                type: 'boolean',
              },
              root: {
                usage: 'Service root for running tests',
                type: 'string',
              },
              path: {
                usage: 'Path for the tests for running tests in other than default "test" folder',
                type: 'string',
              },
              compilers: {
                usage: 'Compiler to use on Mocha',
                type: 'string',
              },
              timeout: {
                usage: 'Timeout to wait for Mocha',
                shortcut: 't',
                type: 'string',
              },
              exit: {
                usage: 'force shutdown of the event loop after test run',
                type: 'boolean',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'create:test:test': this.createTest.bind(this),
      'invoke:test:invoke': this.runTests.bind(this),
      'create:function:function': this.createFunction.bind(this),
      'create:function:test': this.createTest.bind(this),
      // 'create:function:create'
    };
  }

  // Run pre/postTest scriprs
  runScripts(testStage) {
    const myModule = this;
    return new Promise((succeed) => {
      const cmds = myModule.config[testStage] || [];
      cmds.forEach((cmd) => {
        this.serverless.cli.log(`Run command: ${cmd}`);
        const cmdOut = execSync(cmd);
        if (process.env.SLS_DEBUG) {
          const output = cmdOut.toString();
          this.serverless.cli.log(output);
        }
      });
      succeed();
    });
  }

  runTests() {
    return new Promise((resolve) => {
      const myModule = this;
      const funcOption = this.options.f || this.options.function || [];
      const testsPath = this.options.p || this.options.path || utils.getTestsFolder();
      const testFileMap = {};
      const mocha = new Mocha({
        timeout: this.options.t || this.options.timeout || 6000,
      });

      const { stage } = this.options;
      const { region } = this.options;

      let funcNames = [];
      if (typeof funcOption === 'string') {
        funcNames = [funcOption];
      } else if (funcOption.length > 0) {
        funcNames = funcOption;
      }

      const inited = this.serverless.service;
      myModule.config = (inited.custom || {})['serverless-mocha-plugin'] || {};
      // Verify that the service runtime matches with the current runtime
      let { runtime } = inited.provider;
      // Fix the real version for node10
      if (runtime) {
        runtime = runtime.replace('.x', '');
      }

      let nodeVersion;
      if (typeof process.versions === 'object') {
        nodeVersion = process.versions.node;
      } else {
        nodeVersion = process.versions;
      }
      nodeVersion = nodeVersion.replace(/\.[^.]*$/, '');

      const versionValidator = (providerRuntime, currentNodeVersion) => {
        if (providerRuntime === 'nodejs10.x') {
          return currentNodeVersion.match(/^v?(\d+)\.\d+/)[1] !== '10';
        }
        return `nodejs${currentNodeVersion}` !== providerRuntime;
      };

      if (versionValidator(inited.provider.runtime, nodeVersion)) {
        let errorMsg = `Tests being run with nodejs${nodeVersion}, `;
        errorMsg = `${errorMsg} service is using ${runtime}.`;
        errorMsg = `${errorMsg} Tests may not be reliable.`;

        this.serverless.cli.log(errorMsg);
      }

      myModule.serverless.environment = inited.environment;

      myModule.runScripts('preTestCommands')
        .then(() => {
          const svcFuncs = myModule.getFunctions(funcNames);
          const funcs = utils.getTestFiles(svcFuncs, testsPath, funcNames);

          // Run the tests that were actually found
          funcNames = Object.keys(funcs);
          if (funcNames.length === 0) {
            return myModule.serverless.cli.log('No tests to run');
          }

          funcNames.forEach((func) => {
            if (funcs[func].mochaPlugin) {
              if (funcs[func].handler) {
                // Map only functions
                testFileMap[func] = funcs[func];
                utils.setEnv(this.serverless, func);
              } else {
                utils.setEnv(this.serverless);
              }

              const { testPath } = funcs[func].mochaPlugin;

              if (fs.existsSync(testPath)) {
                mocha.addFile(testPath);
              }
            }

            const { reporter } = myModule.options;

            if (reporter !== undefined) {
              const reporterOptions = {};
              if (myModule.options['reporter-options'] !== undefined) {
                myModule.options['reporter-options'].split(',').forEach((opt) => {
                  const L = opt.split('=');
                  if (L.length > 2 || L.length === 0) {
                    throw new Error(`invalid reporter option "${opt}"`);
                  } else if (L.length === 2) {
                    const [name, value] = L;
                    reporterOptions[name] = value;
                  } else {
                    reporterOptions[L[0]] = true;
                  }
                });
              }
              mocha.reporter(reporter, reporterOptions);
            }

            if (myModule.options.grep) {
              mocha.grep(myModule.options.grep);
            }

            // set the SERVERLESS_TEST_ROOT variable to define root for tests
            let rootFolder = this.serverless.config.servicePath;

            if (myModule.options.root) {
              rootFolder = myModule.options.root;
              myModule.serverless.cli.log(`Run tests against code under '${rootFolder}'`);
            }

            // Use full paths to ensure that the code is correctly required in tests
            if (!path.isAbsolute(rootFolder)) {
              const currDir = process.cwd();
              rootFolder = path.join(currDir, rootFolder);
            }

            /* eslint-disable dot-notation */
            process.env['SERVERLESS_TEST_ROOT'] = rootFolder;

            if (myModule.options.live) {
              process.env['SERVERLESS_MOCHA_PLUGIN_LIVE'] = true;
              process.env['SERVERLESS_MOCHA_PLUGIN_REGION'] = region || inited.provider.region;
              process.env['SERVERLESS_MOCHA_PLUGIN_SERVICE'] = inited.service;
              process.env['SERVERLESS_MOCHA_PLUGIN_STAGE'] = stage || inited.provider.stage;
            } else {
              // Set the `IS_LOCAL` env variable to match the `sls invoke local` environment.
              process.env['IS_LOCAL'] = true;
            }
            /* eslint-enable dot-notation */

            const { compilers } = myModule.options;
            if (typeof compilers !== 'undefined') {
              myModule.options.compilers.split(',').filter(e => e !== '').forEach((c) => {
                // Splitting only to preserve backwards
                // compatibility.
                const split = c.split(/:(.+)/);
                const ext = split[0];
                let mod = split[1] || ext;

                if (mod[0] === '.') {
                  mod = path.join(process.cwd(), mod);
                }

                const babelModules = ['babel-register', '@babel/register'];
                const babelConf = ((this.serverless.service.custom || {})['serverless-mocha-plugin'] || {}).babelOptions; // eslint-disable-line max-len
                if (babelModules.includes(mod) && babelConf) {
                  /* eslint-disable import/no-dynamic-require */
                  require(mod)(babelConf); // eslint-disable-line global-require
                  /* eslint-enable import/no-dynamic-require */
                } else {
                  /* eslint-disable import/no-dynamic-require */
                  require(mod); // eslint-disable-line global-require
                  /* eslint-enable import/no-dynamic-require */
                }
              });
            }
            return null;
          }, error => myModule.serverless.cli.log(error));
          let runnerFailures = 0;
          mocha.run((failures) => {
            process.on('exit', () => {
              myModule.runScripts('postTestCommands')
                // exit with non-zero status if there were failures
                .then(() => process.exit(failures));
            });
            if (myModule.options.exit) {
              process.exit(failures);
            }
          }).on('test', (suite) => {
            const testFuncName = utils.funcNameFromPath(suite.file);
            // set env only for functions
            if (testFileMap[testFuncName]) {
              utils.setEnv(myModule.serverless, testFuncName);
            } else {
              utils.setEnv(myModule.serverless);
            }
          }).on('fail', () => {
            runnerFailures += 1;
          }).on('end', () => {
            resolve();
            if (myModule.options.exit) {
              process.exit(runnerFailures > 0 ? 1 : 0);
            }
          });
          return null;
        });
    });
  }

  createTest() {
    const funcName = this.options.f || this.options.function;
    const testsRootFolder = this.options.p || this.options.path || 'test';
    const myModule = this;

    const testsFolder = utils.createTestFolder(testsRootFolder);

    const testFilePath = utils.getTestFilePath(funcName, testsFolder);
    if (fs.existsSync(testFilePath)) {
      myModule.serverless.cli.log(`Test file ${testFilePath} already exists`);
      return (new Error(`File ${testFilePath} already exists`));
    }
    const func = myModule.serverless.service.functions[funcName];
    const handlerParts = func.handler.split('.');
    const funcPath = (`${handlerParts[0]}.js`).replace(/\\/g, '/');
    const handler = handlerParts[handlerParts.length - 1];

    let templateFilenamePath = '';

    if (this.serverless.service.custom
      && this.serverless.service.custom['serverless-mocha-plugin']
      && this.serverless.service.custom['serverless-mocha-plugin'].testTemplate) {
      templateFilenamePath = path.join(this.serverless.config.servicePath,
        this.serverless.service.custom['serverless-mocha-plugin'].testTemplate);
    }
    if ((!templateFilenamePath) || (!fs.existsSync(templateFilenamePath))) {
      templateFilenamePath = path.join(__dirname, testTemplateFile);
    }

    const templateString = utils.getTemplateFromFile(templateFilenamePath);

    const content = ejs.render(templateString, {
      functionName: funcName,
      functionPath: funcPath,
      handlerName: handler,
    });

    const err = fs.writeFileSync(testFilePath, content);
    if (err) {
      myModule.serverless.cli.log(`Creating file ${testFilePath} failed: ${err}`);
      return new Error(`Creating file ${testFilePath} failed: ${err}`);
    }
    return myModule.serverless.cli.log(`serverless-mocha-plugin: created ${testFilePath}`);
  }

  // Helper functions

  getFunctions(funcList) {
    const myModule = this;
    const funcObjs = {};
    const allFuncs = myModule.serverless.service.functions;

    if (funcList.length === 0) {
      return allFuncs;
    }

    let func;
    funcList.forEach((funcName) => {
      func = allFuncs[funcName];
      if (func) {
        funcObjs[funcName] = func;
      } else {
        myModule.serverless.cli.log(`Warning: Could not find function '${funcName}'.`);
      }
    });
    return (funcObjs);
  }

  createAWSNodeJSFuncFile(handlerPath) {
    const handlerInfo = path.parse(handlerPath);
    const handlerDir = path.join(this.serverless.config.servicePath, handlerInfo.dir);
    const handlerFile = `${handlerInfo.name}.js`;
    const handlerFunction = handlerInfo.ext.replace(/^\./, '');
    let templateFile = path.join(__dirname, functionTemplateFile);

    if (this.serverless.service.custom
      && this.serverless.service.custom['serverless-mocha-plugin']
      && this.serverless.service.custom['serverless-mocha-plugin'].functionTemplate) {
      templateFile = path.join(this.serverless.config.servicePath,
        this.serverless.service.custom['serverless-mocha-plugin'].functionTemplate);
    }

    const templateText = fse.readFileSync(templateFile).toString();
    const jsFile = ejs.render(templateText, {
      handlerFunction,
    });

    const filePath = path.join(handlerDir, handlerFile);

    this.serverless.utils.writeFileDir(filePath);
    if (this.serverless.utils.fileExistsSync(filePath)) {
      const errorMessage = [
        `File "${filePath}" already exists. Cannot create function.`,
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }
    if (fs.writeFileSync(path.join(handlerDir, handlerFile), jsFile)) {
      this.serverless.cli.log(`Creating file ${handlerFile} failed`);
      return new Error(`Creating file ${handlerFile} failed`);
    }
    this.serverless.cli.log(`Created function file "${path.join(handlerDir, handlerFile)}"`);
    return BbPromise.resolve();
  }

  createFunctionTest() {
    const plugin = this;
    return plugin.createFunction()
      .then(plugin.createTest);
  }

  createFunction() {
    this.serverless.cli.log('Generating function...');
    const functionName = this.options.function;
    const { handler } = this.options;

    const serverlessYmlFilePath = path
      .join(this.serverless.config.servicePath, 'serverless.yml');

    const serverlessYmlFileContent = fse
      .readFileSync(serverlessYmlFilePath).toString();

    return this.serverless.yamlParser.parse(serverlessYmlFilePath)
      .then((config) => {
        const runtime = [config.provider.name, config.provider.runtime].join('-');

        if (validFunctionRuntimes.indexOf(runtime) < 0) {
          const errorMessage = [
            `Provider / Runtime "${runtime}" is not supported.`,
            ` Supported runtimes are: ${humanReadableFunctionRuntimes}.`,
          ].join('');
          throw new this.serverless.classes.Error(errorMessage);
        }

        const ymlEditor = yamlEdit(serverlessYmlFileContent);

        if (ymlEditor.hasKey(`functions.${functionName}`)) {
          const errorMessage = [
            `Function "${functionName}" already exists. Cannot create function.`,
          ].join('');
          throw new this.serverless.classes.Error(errorMessage);
        }

        const funcDoc = {};
        const funcData = { handler };
        if (this.options.httpEvent) {
          let events = [];
          if (typeof this.options.httpEvent === 'string') {
            events = [
              this.options.httpEvent,
            ];
          } else {
            events = this.options.httpEvent;
          }
          funcData.events = [];

          events.forEach((val) => {
            this.serverless.cli.log(`Add http event '${val}'`);

            funcData.events.push({
              http: val,
            });
          });
        }
        this.serverless.service.functions[functionName] = funcData;
        funcDoc[functionName] = funcData;

        if (ymlEditor.insertChild('functions', funcDoc)) {
          const errorMessage = [
            `Could not find functions in ${serverlessYmlFilePath}`,
          ].join('');
          throw new this.serverless.classes.Error(errorMessage);
        }

        fse.writeFileSync(serverlessYmlFilePath, ymlEditor.dump());
        if (validFunctionRuntimes.includes(runtime)) {
          return this.createAWSNodeJSFuncFile(handler);
        }

        throw new this.serverless.classes.Error(`Unknown runtime ${runtime}`);
      });
  }
}

module.exports = mochaPlugin;
module.exports.lambdaWrapper = lambdaWrapper;
module.exports.chai = chai;
module.exports.initLiveModule = (modName) => {
  const functionName = [
    process.env.SERVERLESS_MOCHA_PLUGIN_SERVICE,
    process.env.SERVERLESS_MOCHA_PLUGIN_STAGE,
    modName,
  ].join('-');

  return {
    region: process.env.SERVERLESS_MOCHA_PLUGIN_REGION,
    lambdaFunction: functionName,
  };
};
const { initLiveModule } = module.exports;

module.exports.getWrapper = (modName, modPath, handler) => {
  let wrapped;
  // TODO: make this fetch the data from serverless.yml

  if (process.env.SERVERLESS_MOCHA_PLUGIN_LIVE) {
    const mod = initLiveModule(modName);
    wrapped = lambdaWrapper.wrap(mod);
  } else {
    /* eslint-disable import/no-dynamic-require */
    /* eslint-disable global-require */
    const mod = require(process.env.SERVERLESS_TEST_ROOT + modPath);
    /* eslint-enable global-require */
    /* eslint-enable import/no-dynamic-require */
    wrapped = lambdaWrapper.wrap(mod, {
      handler,
    });
  }
  return wrapped;
};
