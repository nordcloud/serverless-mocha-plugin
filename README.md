# Serverless Mocha Plugin

[![Build Status](https://travis-ci.org/SC5/serverless-mocha-plugin.svg?branch=master)](https://travis-ci.org/SC5/serverless-mocha-plugin)

A Serverless Plugin for the [Serverless Framework](http://www.serverless.com) which
adds support for test driven development using [mocha](https://mochajs.org/)

**THIS PLUGIN REQUIRES SERVERLESS V1.0 BETA OR NEWER!**

## Introduction

This plugins does the following:

* It provides commands to create and run tests manually
* It provides a command to create a function, which automatically also creates a test

## Installation

In your service root, run:

```bash
npm install --save-dev serverless-mocha-plugin
```

Add the plugin to `serverless.yml`:

```yml
plugins:
    - serverless-mocha-plugin
```

## Usage

### Creating functions

Functions (and associated tests) can be created using the command

```
sls create function -f functionName --handler handler
```
 
e.g.

```
sls create function -f myFunction --handler functions/myFunction/index.handler
```

creates a new function `myFunction` into `serverless.yml` with a code template for
the handler in `functions/myFunction/index.js` and a Javascript function `module.exports.handler` 
as the entrypoint for the Lambda function. A test template is also created into `test/myFunction.js`. Optionally tests can be created to specific folder using `--path` or `-p` switch, e.g. 

```
sls create function -f myFunction --handler functions/myFunction/index.handler --path tests
```

### Creating tests

Functions can also be added manually using the mocha-create command

```
sls create test -f functionName
```

If you want to run the tests against the real Lambda functions, you can pass the liveFunction object to wrapper.init().

```
  wrapper.init(liveFunction);
```

NOTE: Live running does not currently work. Waiting for serverless 1.0 to finalize / have required env variables available

### Running tests

Tests can be run directly using Mocha (in which case it needs to be installed to your project or globally)
or using the "invoke test" command

```
sls invoke test [--stage stage] [--region region] [-f function1] [-f function2] [...]
```

To use a mocha reporter (e.g. json), use the -R switch. Reporter options can be passed with the -O switch.

If no function names are passed to "invoke test", all tests are run from the test/ directory

The default timeout for tests is 6 seconds. In case you need to apply a different timeout, that can be done in the test file 
using using this.timeout(milliseconds) in the define, after, before or it -blocks.

To run test in specific folder use `--path` or `-p` switch.

### Using own template for a test file

The templates to use for new function Files can be determined with the custom `testTemplate` configuration in `serverless.yml`

```
custom:
  serverless-mocha-plugin:
    testTemplate: templates/myTest.js
```

Currently, there are three variables available for use in the template:

- functionName - name of the function
- functionPath - path to the function
- handlerName - the name of the handler function

If you'd like to get more information on the template engine, you check documentation of the [EJS project](http://ejs.co/).

### Using own template for function file

The templates to use for new function Files can be determined with the custom `functionTemplate` configuration in `serverless.yml`

```
custom:
  serverless-mocha-plugin:
    functionTemplate: templates/myFunction.js
```



## Release History (1.x)

* 2016/12/21 - v1.3.2 - Fix population of environment variables
* 2016/11/28 - v1.3.1 - Added support for environment variables in Serverless 1.2
* 2016/11/09 - v1.2.0 - Added ability to add function / test templates
* 2016/11/09 - v1.1.0 - Added function create command.
* 2016/09/23 - v1.0.2 - Bugfixes, configurable test timeouts
* 2016/08/15 - v1.0.0 - Preliminary version for Serverless 1.0

## License

Copyright (c) 2016 [SC5](http://sc5.io/), licensed for users and contributors under MIT license.
https://github.com/SC5/serverless-mocha-plugin/blob/master/LICENSE


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/SC5/serverless-mocha-plugin/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
