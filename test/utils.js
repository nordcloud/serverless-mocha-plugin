'use strict';

const expect = require('chai').expect;
const path = require('path');
const fse = require('fs-extra');
const utils = require('../utils.js');

describe('utils', () => {
  before(() => {
    const tmp = path.join(__dirname, '../', 'tmp');
    fse.mkdirsSync(tmp);
    process.chdir(tmp);
  });

  it('tests getTestFilePath for handler', () => {
    const testFilePath = utils.getTestFilePath('handler');
    expect(testFilePath).to.be.equal('test/handler.js');
  });

  it('tests getTestFilePath for folder/handler', () => {
    const testFilePath = utils.getTestFilePath('folder/handler');
    expect(testFilePath).to.be.equal('test/handler.js');
  });

  it('tests getTestFilePath for handler in custom folder', () => {
    const testFilePath = utils.getTestFilePath('handler', 'custom');
    expect(testFilePath).to.be.equal('custom/handler.js');
  });

  it('tests getTestFilePath for folder/handler in custom folder', () => {
    const testFilePath = utils.getTestFilePath('folder/handler', 'custom');
    expect(testFilePath).to.be.equal('custom/handler.js');
  });

  it('gets template from a file', () => {
    const expectedTemplate = fse.readFileSync('../templates/test-template.ejs', 'utf-8');
    const template = utils.getTemplateFromFile('../templates/test-template.ejs');
    expect(template).to.be.equal(expectedTemplate);
  });

  it('tests default createTestFolder', () =>
    utils.createTestFolder().then((folder) => {
      expect(folder).to.be.equal('test');
    })
  );

  it('tests default createTestFolder (exists)', () =>
    utils.createTestFolder().then((folder) => {
      expect(folder).to.be.equal('test');
    })
  );

  it('tests custom createTestFolder', () =>
    utils.createTestFolder('custom').then((folder) => {
      expect(folder).to.be.equal('custom');
    })
  );

  it('tests funcNameFromPath', () => {
    const functionName = utils.funcNameFromPath('path/to/functionName.js');
    expect(functionName).to.be.equal('functionName');
  });

  it('tests setEnv', () => {
    const env = utils.setEnv([{ param: 'param' }]);
    expect(env).to.be.equal(null);
  });
});
