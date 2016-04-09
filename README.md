# Serverless Mocha Plugin

A Serverless Plugin for the [Serverless Framework](http://www.serverless.com) which
adds support for test driven development using [mocha](https://mochajs.org/) 

**THIS PLUGIN REQUIRES SERVERLESS V0.5 OR HIGHER!**

## Introduction

This plugins does the following:

* It will create test files when creating new serverless functions

* It provides commands to create and run tests manually

## Installation

In your project root, run:

```bash
npm install --save serverless-mocha-plugin
```

Add the plugin to `s-project.json`:

```json
"plugins": [
  "serverless-mocha-plugin"
]
```

## Usage

### Creating tests

When the plug-in is installed, tests are automatically created to the test/ directory
when creating new functions (only when using node 4.3 runtime).

Functions can also be added manually using the mocha-create command

```
sls function mocha-create functionName
```

### Running tests

Tests can be run directly using Mocha (in which case it needs to be installed to your project or globally)
or using the mocha-run command

```
sls function mocha-run [function1] [function2] [...]
```

If no function names are passed to mocha-run, all tests are run from the test/ directory

## Release History

* 2016/04/09 - v0.5.0 - Initial version of module for serverless 0.5.*

## License

Copyright (c) 2016 [SC5](http://sc5.io/), licensed for users and contributors under MIT license.
https://github.com/SC5/serverless-mocha-plugin/blob/master/LICENSE


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/SC5/serverless-mocha-plugin/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
