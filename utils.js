'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fs = require('fs');

const defaultTestsRootFolder = 'tests'; // default test folder used for tests

function getTestsFolder(testsRootFolder) {
  return testsRootFolder || defaultTestsRootFolder;
}

function getTestFilePath(funcName, testsRootFolder) {
  return path.join(getTestsFolder(testsRootFolder), `${funcName.replace(/.*\//g, '')}.js`);
}

// getTestFiles. If no functions provided, returns all files
function getTestFiles(funcs) {
  return new BbPromise((resolve) => {
    const funcNames = Object.keys(funcs);
    const resFuncs = funcs;
    if (funcNames && funcNames.length > 0) {
      funcNames.forEach((val) => {
        resFuncs[val].mochaPlugin = {
          testPath: getTestFilePath(val),
        };
      });
      return resolve(resFuncs);
    }
    return resolve({});
  });
}

// Create the test folder
function createTestFolder(testsRootFolder) {
  return new BbPromise((resolve, reject) => {
    const testsFolder = getTestsFolder(testsRootFolder);
    fs.exists(testsFolder, (exists) => {
      if (exists) {
        return resolve(testsFolder);
      }
      fs.mkdir(testsFolder, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(testsFolder);
      });
      return null;
    });
  });
}

function getTemplateFromFile(templateFilenamePath) {
  return fs.readFileSync(templateFilenamePath, 'utf-8');
}

function funcNameFromPath(filePath) {
  const data = path.parse(filePath);

  return data.name;
}

function setEnv(params) {
  const myParams = params;
  if (myParams) {
    // Do the magic here
  }
  return null;
  // Serverless does not seem to have any logic with regards to variables yet.
  // let vars = Object.keys(params);
  // vars.forEach((val, idx) => {
  //   process.env[val] = params[val];
  // });
}

module.exports = {
  getTestFilePath,
  getTestFiles,
  createTestFolder,
  getTemplateFromFile,
  funcNameFromPath,
  setEnv,
};
