/* eslint-disable */
var dotenv = require('dotenv');
var path = require('path');
var webpack = require('webpack');

// Note that webpack is intended to be invoked via grunt during, plugins
// need to be installed in the example-phone package, but loaders need to be
// installed in the root package.
var InlineEnviromentVariablesPlugin = require('inline-environment-variables-webpack-plugin');

// Need to use dotenv because grunt env runs after this file has been loaded
dotenv.config({
  path: path.join(__dirname, '..', '..', '.env')
});

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  context: __dirname,
  entry: [
    './src/scripts/main.js'
  ],
  output: {
    filename: 'app/bundle.js',
    path: path.resolve(__dirname, '../../docs'),
    sourceMapFilename: '[file].map'
  },
  debug: process.env.NODE_ENV !== 'production',
  devtool: 'sourcemap',
  plugins: [
    new InlineEnviromentVariablesPlugin(process.env),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        sequences: false,
        properties: false,
        dead_code: true,
        drop_debugger: false,
        unsafe: false,
        unsafe_comps: false,
        conditionals: false,
        comparisons: false,
        evaluate: false,
        booleans: false,
        loops: false,
        unused: false,
        hoist_funs: false,
        hoist_vars: false,
        if_return: false,
        join_vars: false,
        cascade: false,
        warnings: true,
        negate_iife: false,
        pure_getters: false,
        pure_funcs: null,
        drop_console: false,
        keep_fargs: true,
        keep_fnames: true,
        passes: 1
      },
      beautify: false,
      mangle: false
    })
  ],
  resolve: {
    // Add "devMain" to the packageMains defaults so we can load src instead of
    // dist (so far, haven't found a better way)
    packageMains: ["devMain", "webpack", "browser", "web", "browserify", ["jam", "main"], "main"],
    // Make sure we use browser overrides (why doesn't webpack do this by
    // default?)
    packageAlias: ['browser']
  },
  resolveLoader: {
    // Make sure the local node_modules directory is always available to provide
    // loader plugins (again, why doesn't babel do this by default?)
    root: path.resolve(__dirname, 'node_modules')
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules|dist/,
        include: path.resolve(__dirname, '..'),
        query: {
          cacheDirectory: true
        }
      }
    ]
  }
}
