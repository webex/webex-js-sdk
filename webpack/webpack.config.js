const path = require('path');

const merge = require('webpack-merge');
const dotenv = require('dotenv');

const baseConfig = require('./webpack.config.base.js');
const devConfig = require('./webpack.config.dev.js');

dotenv.config();

module.exports = (env) => {
  if (process.env.PACKAGE || (env && env.package)) {
    if (process.env.NODE_ENV !== 'production') {
      // TODO: Passing --env.package is not working for some reason.
      const packageName = process.env.PACKAGE || env.package;
      const context = path.resolve(__dirname, '..', 'packages', 'node_modules', packageName);

      return merge(baseConfig, devConfig, {
        mode: process.env.NODE_ENV || 'development',
        context,
        entry: env.entry || './src/index.js',
        devServer: {
          contentBase: path.resolve(context, 'sample')
        },
        node: {
          fs: 'empty'
        }
      });
    }

    return baseConfig;
  }
  throw new Error('Please specify a package');
};
