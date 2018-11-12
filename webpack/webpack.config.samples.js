const path = require('path');

const merge = require('webpack-merge');
const dotenv = require('dotenv');

const baseConfig = require('./webpack.config.base.js');
const devConfig = require('./webpack.config.dev.js');

dotenv.config();

module.exports = () => {
  if (process.env.NODE_ENV !== 'production') {
    const context = path.resolve(__dirname, '..', 'packages', 'node_modules');
    return merge(baseConfig, devConfig, {
      mode: process.env.NODE_ENV || 'development',
      context,
      entry: 'ciscospark/src/index.js',
      devServer: {
        contentBase: path.resolve(context, 'samples')
      }
    });
  }
  return baseConfig;
};
