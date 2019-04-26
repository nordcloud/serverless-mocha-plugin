'use strict';

const expect = require('chai').expect;
const path = require('path');
const fse = require('fs-extra');
const MochaPlugin = require('../index');

describe('mochaPlugin', () => {
  before(() => {
    const tmp = path.join(__dirname, '../', 'tmp');
    fse.mkdirsSync(tmp);
    process.chdir(tmp);
  });

  it('checks that commands exists', () => {
    const mochaPlugin = new MochaPlugin({}, {});
    const commands = Object.keys(mochaPlugin.commands);
    expect(commands).to.eql(['create', 'invoke']);
  });

  it('checks hooks exists', () => {
    const mochaPlugin = new MochaPlugin({}, {});
    const hooks = Object.keys(mochaPlugin.hooks);
    expect(hooks).to.eql([
      'create:test:test',
      'invoke:test:invoke',
      'create:function:function',
      'create:function:test',
    ]);
  });
});
