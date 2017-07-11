// Proxy
const path = require('path');
const webpackDir = path.join(process.env.MOCHA_PLUGIN_TEST_DIR, '../', 'node_modules', 'serverless-webpack');
module.exports = require(webpackDir);