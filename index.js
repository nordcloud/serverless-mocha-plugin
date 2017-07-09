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
const utils = require('./utils');
const BbPromise = require('bluebird');
const yamlEdit = require('yaml-edit');

const testTemplateFile = path.join('templates', 'test-template.ejs');
const functionTemplateFile = path.join('templates', 'function-template.ejs');

const validFunctionRuntimes = [
  'aws-nodejs4.3',
  'aws-nodejs6.10',
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
              },
              path: {
                usage: 'Path for the tests',
                shortcut: 'p',
              },
            },
          },
          function: {
            usage: 'Create a function into the service',
            lifecycleEvents: [
              'create',
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
              },
              handler: {
                usage: 'Handler for the function (e.g. --handler my-function/index.handler)',
                required: true,
              },
              path: {
                usage: 'Path for the tests (e.g. --path tests)',
                shortcut: 'p',
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
              },
              reporter: {
                usage: 'Mocha reporter to use',
                shortcut: 'R',
              },
              'reporter-options': {
                usage: 'Options for mocha reporter',
                shortcut: 'O',
              },
              path: {
                usage: 'Path for the tests for running tests in other than default "test" folder',
              },
              compilers: {
                usage: 'Compiler to use on Mocha',
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
      'create:function:create': () => {
        BbPromise.bind(this)
          .then(this.createFunction)
          .then(this.createTest);
      },
    };
  }

  runTests() {
    const myModule = this;
    const funcName = this.options.f || this.options.function || [];
    const testsPath = this.options.p || this.options.path || utils.getTestsFolder();
    const testFileMap = {};
    const mocha = new Mocha({
      timeout: 6000,
    });

    const stage = this.options.stage;
    const region = this.options.region;
    
    // set the SERVERLESS_TEST_ROOT variable to define root for tests
    process.env['SERVERLESS_TEST_ROOT'] = this.serverless.config.servicePath;

    this.serverless.service.load({
      stage,
      region,
    })
      .then((inited) => {
        // Verify that the service runtime matches with the current runtime 
        let nodeVersion = (typeof(process.versions) === 'object')? process.versions.node : process.versions;
        nodeVersion = nodeVersion.replace(/\.[^.]*$/,'');
        if (`nodejs${nodeVersion}`!== inited.provider.runtime) {
          this.serverless.cli.log(`Tests being run with nodejs${nodeVersion}, service is using ${inited.provider.runtime}. Tests may not be reliable.`);
        }

        myModule.serverless.environment = inited.environment;
        const vars = new myModule.serverless.classes.Variables(myModule.serverless);
        vars.populateService(this.options)
          .then(() => myModule.getFunctions(funcName))
          .then(utils.getTestFiles)
          .then((funcs) => {
            const funcNames = Object.keys(funcs);
            if (funcNames.length === 0) {
              return myModule.serverless.cli.log('No tests to run');
            }
            funcNames.forEach((func) => {
              utils.setEnv(this.serverless, func);
              const testPath = path.join(testsPath, `${func}.js`);
              if (fse.existsSync(testPath)) {
                testFileMap[func] = funcs[func];
                mocha.addFile(testPath);
              }
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

            const compilers = myModule.options.compilers;
            if (typeof compilers !== 'undefined') {
              const extensions = ['js'];
              myModule.options.compilers.split(',').filter(e => e !== '').forEach(c => {
                const split = c.split(/:(.+)/);
                const ext = split[0];
                let mod = split[1];

                if (mod[0] === '.') {
                  mod = path.join(process.cwd(), mod);
                }
                require(mod); // eslint-disable-line global-require
                extensions.push(ext);
              });
            }

            mocha.run((failures) => {
              process.on('exit', () => {
                process.exit(failures);  // exit with non-zero status if there were failures
              });
            })
              .on('test', (suite) => {
                const testFuncName = utils.funcNameFromPath(suite.file);
                const func = testFileMap[testFuncName];
                if (func) {
                  utils.setEnv(myModule.serverless, funcName);
                }
              });
            return null;
          }, error => myModule.serverless.cli.log(error));
      });
  }

  createTest() {
    const funcName = this.options.f || this.options.function;
    const testsRootFolder = this.options.p || this.options.path;
    const myModule = this;

    utils.createTestFolder(testsRootFolder).then(() => {
      const testFilePath = utils.getTestFilePath(funcName, testsRootFolder);
      const func = myModule.serverless.service.functions[funcName];
      const handlerParts = func.handler.split('.');
      const funcPath = (`${handlerParts[0]}.js`).replace(/\\/g, '/');
      const handler = handlerParts[handlerParts.length - 1];

      fse.exists(testFilePath, (exists) => {
        if (exists) {
          myModule.serverless.cli.log(`Test file ${testFilePath} already exists`);
          return (new Error(`File ${testFilePath} already exists`));
        }

        let templateFilenamePath = '';

        if (this.serverless.service.custom &&
          this.serverless.service.custom['serverless-mocha-plugin'] &&
          this.serverless.service.custom['serverless-mocha-plugin'].testTemplate) {
          templateFilenamePath = path.join(this.serverless.config.servicePath,
            this.serverless.service.custom['serverless-mocha-plugin'].testTemplate);
        }

        fse.exists(templateFilenamePath, (exists2) => {
          if (!exists2) {
            templateFilenamePath = path.join(__dirname, testTemplateFile);
          }
          const templateString = utils.getTemplateFromFile(templateFilenamePath);

          const content = ejs.render(templateString, {
            functionName: funcName,
            functionPath: funcPath,
            handlerName: handler,
          });

          fse.writeFile(testFilePath, content, (err) => {
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
      funcList.forEach((funcName) => {
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

  createAWSNodeJSFuncFile(handlerPath) {
    const handlerInfo = path.parse(handlerPath);
    const handlerDir = path.join(this.serverless.config.servicePath, handlerInfo.dir);
    const handlerFile = `${handlerInfo.name}.js`;
    const handlerFunction = handlerInfo.ext.replace(/^\./, '');
    let templateFile = path.join(__dirname, functionTemplateFile);

    if (this.serverless.service.custom &&
      this.serverless.service.custom['serverless-mocha-plugin'] &&
      this.serverless.service.custom['serverless-mocha-plugin'].functionTemplate) {
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
    fse.writeFileSync(path.join(handlerDir, handlerFile), jsFile);

    this.serverless.cli.log(`Created function file "${path.join(handlerDir, handlerFile)}"`);
    return BbPromise.resolve();
  }

  createFunction() {
    this.serverless.cli.log('Generating function...');
    const functionName = this.options.function;
    const handler = this.options.handler;

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
        funcDoc[functionName] = this.serverless.service.functions[functionName] = {
          handler,
        };

        if (ymlEditor.insertChild('functions', funcDoc)) {
          const errorMessage = [
            `Could not find functions in ${serverlessYmlFilePath}`,
          ].join('');
          throw new this.serverless.classes.Error(errorMessage);
        }

        fse.writeFileSync(serverlessYmlFilePath, ymlEditor.dump());

        if (runtime === 'aws-nodejs4.3' || runtime === 'aws-nodejs6.10') {
          return this.createAWSNodeJSFuncFile(handler);
        }

        return BbPromise.resolve();
      });
  }
}

module.exports = mochaPlugin;
module.exports.lambdaWrapper = lambdaWrapper;
module.exports.chai = chai;
