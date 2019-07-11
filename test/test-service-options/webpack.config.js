const path = require('path');
const slsw = require('serverless-webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const nodeExternals = require('webpack-node-externals');


module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  mode: process.env.NODE_ENV,
  module: {
    rules: [
      { test: /\.json/, loader: 'json-loader' },
    ],
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: '.env' },
    ]),
  ],
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
  },
  externals: [nodeExternals()],
};
