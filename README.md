# Serverless Mocha Plugin

[![Build Status](https://travis-ci.org/nordcloud/serverless-mocha-plugin.svg?branch=master)](https://travis-ci.org/nordcloud/serverless-mocha-plugin)

A Serverless Plugin for the [Serverless Framework](http://www.serverless.com) which
adds support for test driven development using [mocha](https://mochajs.org/)

**THIS PLUGIN REQUIRES SERVERLESS V1!**

More familiar with Jest? Use [serverless-jest-plugin](https://github.com/sc5/serverless-jest-plugin).

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
the handler in `functions/myFunction/index.js` and a Javascript function `module.exports.handler` as the entrypoint for the Lambda function. A test template is also created into `test/myFunction.js`. Optionally tests can be created to specific folder using `--path` or `-p` switch, e.g. 

```
sls create function -f myFunction --handler functions/myFunction/index.handler --path tests
```

To create an http event for the lambda, add the --httpEvent parameter, i.e.

```
sls create function -f myFunction --handler functions/myFunction/index.handler --httpEvent "[httpVerb] [relativePath]"
```

e.g.

```
sls create function -f myFunction --handler functions/myFunction/index.handler --httpEvent "post myResource" --httpEvent "get myResource"
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

NOTE: Live running does not currently work. Need to finalize / have required env variables available

### Running tests

Tests can be run directly using the "invoke test" command. This also initializes the environment variables based on your serverless.yml file and the SERVERLESS_TEST_ROOT variable that defines the root for the code to be tested.

```
sls invoke test [--stage stage] [--region region] [-t timeout] [-f function1] [-f function2] [...]
```

To use a mocha reporter (e.g. json), use the -R switch. Reporter options can be passed with the -O switch.

If no function names are passed to "invoke test", all tests are run from the test/ directory and subdirectories.

The default timeout for tests is 6 seconds. In case you need to apply a different timeout, that can be done in the test file 
using using .timeout(milliseconds) with the define, after, before or it -blocks. e.g.
```
  it('implement tests here', () => {
    ...
  }).timeout(xxx);
```

To run test in specific folder use `--path` or `-p` switch.

To run tests live against the actual deployed Lambdas, use the '--live' or '-l' switch. Please note that this will work only for tests created with module version 1.4 or higher.

To run tests e.g. against built artefacts that reside in some other directory, use the '--root' or '-r' switch. e.g.
```
  sls webpack -o testBuild
  sls invoke test -r testBuild
  rm -rf testBuild
```


### Using own template for a test file

The templates to use for new function Files can be determined with the custom `testTemplate` configuration in `serverless.yml`

```yaml
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

```yaml
custom:
  serverless-mocha-plugin:
    functionTemplate: templates/myFunction.js
```

### Running commands before / after tests

The plugin can be configured to run commands before / after the tests. This is done by setting preTestCommands and postTestCommands in the plugin configuration.

For example, start serverless-offline before tests and stop it after tests using the following configuration:

```yaml
custom:
  serverless-mocha-plugin:
    preTestCommands: 
      - bash startOffline.sh
    postTestCommands:
      - bash stopOffline.sh
```

Sample startOffline.sh:
```
TMPFILE=/var/tmp/offline$$.log
if [ -f .offline.pid ]; then
    echo "Found file .offline.pid. Not starting."
    exit 1
fi

serverless offline 2>1 > $TMPFILE &
PID=$!
echo $PID > .offline.pid

while ! grep "Offline listening" $TMPFILE
do sleep 1; done

rm $TMPFILE
```

Sample stopOffline.sh
```
kill `cat .offline.pid`
rm .offline.pid
```

### Usage with [babel register](https://babeljs.io/docs/en/babel-register)

If you use mocha with [babel compiler](https://github.com/mochajs/mocha/wiki/compilers-deprecation) e.g. `sls invoke test --compilers js:@babel/register` \
Babel configuration can be determined with the custom `babelOptions` configuration in serverless.yml

```
custom:
  serverless-mocha-plugin:
    babelOptions:
      presets: [["@babel/env", { "targets": { "node": "8.10" }, "shippedProposals": true, "useBuiltIns": "usage" }]]
      plugins:
        - ["@babel/plugin-transform-runtime"]
```
## Release History (1.x)

* 2019/04/02 - v1.10.0 - add timeout parameter
                         add babel options
* 2018/12/15 - v1.9.1 - fix to work with serverless 1.33 and later
* 2018/09/16 - v1.9.0 - add support for --exit option
* 2018/04/03 - v1.8.0 - add support for Node 8
* 2017/09/10 - v1.7.0 - ability to run scripts before / after tests
* 2017/09/09 - v1.6.0 - also run tests from subfolders of test
* 2017/07/11 - v1.4.1 - Add option --root for running tests on e.g. webpack build results residing in other directories,
                        add option --httpEvent to create http events when creating functions
* 2017/07/09 - v1.4.0 - Add --live switch, 
                        add --grep switch, 
                        verify that the test runtime matches the service runtime,
                        upgrade lambda-wrapper (returns exceptions as errors)
* 2016/12/21 - v1.3.2 - Fix population of environment variables
* 2016/11/28 - v1.3.1 - Added support for environment variables in Serverless 1.2
* 2016/11/09 - v1.2.0 - Added ability to add function / test templates
* 2016/11/09 - v1.1.0 - Added function create command.
* 2016/09/23 - v1.0.2 - Bugfixes, configurable test timeouts
* 2016/08/15 - v1.0.0 - Preliminary version for Serverless 1.0

## License

Copyright (c) 2017 [Nordcloud](https://nordcloud.com/), licensed for users and contributors under MIT license.
https://github.com/nordcloud/serverless-mocha-plugin/blob/master/LICENSE
