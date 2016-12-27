'use strict';

const fse = require('fs-extra');
const os = require('os');
const crypto = require('crypto');
const path = require('path');

const replaceTextInFile = (filePath, subString, newSubString) => {
  const fileContent = fse.readFileSync(filePath).toString();
  fse.writeFileSync(filePath, fileContent.replace(subString, newSubString));
};

const getTmpDirPath = () => path.join(os.tmpdir(),
  'tmpdirs-serverless-mocha-plugin',
  'serverless-mocha-plugin',
  crypto.randomBytes(8).toString('hex'));

module.exports = {
  replaceTextInFile,
  getTmpDirPath,
};
