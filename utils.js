'use strict';

const path = require('path');
const fs = require('fs');

const defaultTestsRootFolder = 'test'; // default test folder used for tests

function getTestsFolder(testsRootFolder) {
  return testsRootFolder || defaultTestsRootFolder;
}

function getTestFilePath(funcName, testsRootFolder) {
  return path.join(getTestsFolder(testsRootFolder), `${funcName.replace(/.*\//g, '')}.js`);
}

function traverseTestFolder(testFolder, prefix) {
  const funcFiles = [];
  const dirContents = fs.readdirSync(testFolder);

  dirContents.forEach((val) => {
    const stats = fs.statSync(path.join(testFolder, val));
    if (stats.isFile()) {
      funcFiles.push(prefix ? path.join(prefix, val) : val);
    } else {
      const subContents = traverseTestFolder(
        path.join(testFolder, val), prefix ? path.join(prefix, val) : val
      );
      subContents.forEach((subval) => {
        funcFiles.push(subval);
      });
    }
  });
  return funcFiles;
}

// getTestFiles. Returns all test files, attaches to functions
function getTestFiles(funcs, testFolder, funcList) {
  const funcFiles = traverseTestFolder(testFolder);
  const resFuncs = {};
  if (funcFiles.length > 0) {
    funcFiles.forEach((val) => {
      if (path.extname(val) === '.js') {
        const base = path.basename(val).replace(/.js$/, '');
        // Create test for non-functions only if no funcList
        if (funcs[base] || funcList.length === 0) {
          resFuncs[base] = funcs[base] || { };

          resFuncs[base].mochaPlugin = {
            testPath: path.join(getTestsFolder(testFolder), val),
          };
        }
      }
    });
  }
  return resFuncs;
}

// Create the test folder
function createTestFolder(testsRootFolder) {
  const testsFolder = getTestsFolder(testsRootFolder);
  const exists = fs.existsSync(testsFolder);
  if (exists) {
    return testsFolder;
  }
  fs.mkdirSync(testsFolder);
  return testsFolder;
}

function getTemplateFromFile(templateFilenamePath) {
  return fs.readFileSync(templateFilenamePath, 'utf-8');
}

function funcNameFromPath(filePath) {
  const data = path.parse(filePath);

  return data.name;
}

function setEnv(serverless, funcName) {
  const serviceVars = serverless.service.provider.environment || {};
  let functionVars = {};
  if (funcName && serverless.service.functions[funcName]) {
    functionVars = serverless.service.functions[funcName].environment || {};
  }
  return Object.assign(
    process.env,
    serviceVars,
    functionVars
  );
}

module.exports = {
  getTestsFolder,
  getTestFilePath,
  getTestFiles,
  createTestFolder,
  getTemplateFromFile,
  funcNameFromPath,
  setEnv,
};
