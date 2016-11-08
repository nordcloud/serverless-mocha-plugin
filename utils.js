const BbPromise = require('bluebird');
const path = require('path');
const fs = require('fs');

const testFolder = 'test'; // Folder used my mocha for tests

function getTestFilePath(funcName) {
  return path.join(testFolder, `${funcName.replace(/.*\//g, '')}.js`);
}

// getTestFiles. If no functions provided, returns all files
function getTestFiles(funcs) {
  return new BbPromise((resolve) => {
    const funcNames = Object.keys(funcs);
    const resFuncs = funcs;
    if (funcNames && (funcNames.length > 0)) {
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
function createTestFolder() {
  return new BbPromise((resolve, reject) => {
    fs.exists(testFolder, (exists) => {
      if (exists) {
        return resolve(testFolder);
      }
      fs.mkdir(testFolder, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(testFolder);
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
