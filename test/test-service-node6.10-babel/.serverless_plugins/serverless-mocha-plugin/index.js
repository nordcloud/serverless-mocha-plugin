// Proxy
const path = require('path');
const mochaDir = path.join(process.env.MOCHA_PLUGIN_TEST_DIR, '../', 'index.js');
module.exports = require(mochaDir);