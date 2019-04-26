'use strict';

const Serverless = require('serverless');
const execSync = require('child_process').execSync;
const path = require('path');
const fse = require('fs-extra');
const expect = require('chai').expect;
const testUtils = require('./testUtils');

const serverless = new Serverless();
serverless.init();
const serverlessExec = path.join(serverless.config.serverlessPath, '..', 'bin', 'serverless');

describe('integration with options in stage prod', () => {
  before(() => {
    // create temporary directory and copy test service there
    process.env.MOCHA_PLUGIN_TEST_DIR = path.join(__dirname);
    const tmpDir = testUtils.getTmpDirPath();
    fse.mkdirsSync(tmpDir);
    fse.copySync(path.join(process.env.MOCHA_PLUGIN_TEST_DIR, 'test-service-options'), tmpDir);
    process.chdir(tmpDir);
    execSync(`ln -s ${process.env.MOCHA_PLUGIN_TEST_DIR}/../node_modules ${tmpDir}/`);
  });

  it('should contain test params in cli info', () => {
    const test = execSync(`${serverlessExec}`);
    const result = new Buffer(test, 'base64').toString();
    expect(result).to.have.string(
      'create test ................... Create mocha tests for service / function'
    );
    expect(result).to.have.string(
      'create function ............... Create a function into the service'
    );
    expect(result).to.have.string(
      'invoke test ................... Invoke test(s)'
    );
  });

  it('should create test for hello function', () => {
    const test = execSync(`${serverlessExec} create test --function hello --stage prod`);
    const result = new Buffer(test, 'base64').toString();
    expect(result).to.have.string(
      'serverless-mocha-plugin: created test/hello.js'
    );
  });

  it('should create function goodbye with 2 http endpoints', () => {
    const test = execSync(
      `${serverlessExec}` +
      ' create function --function goodbye --handler goodbye/index.handler ' +
      '--httpEvent "post event" --httpEvent "get event" --stage prod'
    );
    const result = new Buffer(test, 'base64').toString();
    expect(result).to.have.string(
      'Add http event \'post event\''
    );
    expect(result).to.have.string(
      'Add http event \'get event\''
    );
    expect(result).to.have.string(
      'serverless-mocha-plugin: created test/goodbye.js'
    );
  });

  it('should run tests successfully in stage prod', () => {
    // change test files to use local proxy version of mocha plugin
    testUtils.replaceTextInFile(
      path.join('test', 'hello.js'),
      'require(\'serverless-mocha-plugin\')',
      'require(\'../.serverless_plugins/serverless-mocha-plugin/index.js\')'
    );
    testUtils.replaceTextInFile(
      path.join('test', 'goodbye.js'),
      'require(\'serverless-mocha-plugin\')',
      'require(\'../.serverless_plugins/serverless-mocha-plugin/index.js\')'
    );
    const test = execSync(`${serverlessExec} invoke test --stage prod`);
    const result = new Buffer(test, 'base64').toString();
    expect(result).to.have.string(
      'goodbye\n    ✓ implement tests here'
    );

    expect(result).to.have.string(
      'hello\n    ✓ implement tests here'
    );

    expect(result).to.have.string(
      '2 passing'
    );
  });

  it('should run tests successfully against built package', () => {
    // change test files to use local proxy version of mocha plugin
    // These have been done earlier
    execSync(`${serverlessExec} webpack -o testBuild --stage prod`);

    const test = execSync(`${serverlessExec} invoke test --stage prod --root testBuild`);
    const result = new Buffer(test, 'base64').toString();

    expect(result).to.have.string(
      'Run tests against code under \'testBuild\''
    );
    expect(result).to.have.string(
      'goodbye\n    ✓ implement tests here'
    );

    expect(result).to.have.string(
      'hello\n    ✓ implement tests here'
    );

    expect(result).to.have.string(
      '2 passing'
    );
  });

  it('should limit tests to run with --grep option', () => {
    const test = execSync(`${serverlessExec} invoke test --grep goodbye --stage prod`);
    const result = new Buffer(test, 'base64').toString();
    expect(result).to.have.string(
      'goodbye\n    ✓ implement tests here'
    );

    expect(result).to.have.string(
      '1 passing'
    );
  });
});
