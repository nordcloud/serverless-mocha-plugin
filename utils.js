'use strict';
const BbPromise = require('bluebird'),
    path  = require('path'),
    fs        = require('fs');

const testFolder = 'test'; // Folder used my mocha for tests
const templateFilename = 'sls-mocha-plugin-template.ejs';

// getTestFiles. If no functions provided, returns all files
function getTestFiles(funcs) {
  return new BbPromise(function(resolve, reject) {
    var funcNames = Object.keys(funcs);
    if (funcNames && (funcNames.length > 0)) {
      funcNames.forEach(function(val, idx) {
        funcs[val].mochaPlugin = {
          testPath:  getTestFilePath(val)
        };
      });
      return resolve(funcs);
    }
    return resolve({});
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

function getTemplateFromFile(templateFilenamePath) {
  return fs.readFileSync(templateFilenamePath, 'utf-8');
}

function getTestFilePath(funcName) {
  return path.join(testFolder, `${funcName.replace(/.*\//g, '')}.js`);
}

function funcNameFromPath(filePath) {
  let data = path.parse(filePath);

  return data.name;
}

function setEnv(params) {
  return null;
  // Serverless does not seem to have any logic with regards to variables yet.
  
  //let vars = Object.keys(params);
  //vars.forEach((val, idx) => {
  //  process.env[val] = params[val];
  //});
}

module.exports = {
  getTestFilePath: getTestFilePath,
  getTestFiles: getTestFiles,
  createTestFolder: createTestFolder,
  getTemplateFromFile: getTemplateFromFile,
  funcNameFromPath: funcNameFromPath,
  setEnv: setEnv
}