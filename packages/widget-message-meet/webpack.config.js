/* eslint quotes: [2, "single"] */
/* eslint no-var: [0] */
/* eslint camelcase: [0] */

var dotenv = require('dotenv');
var path = require('path');
var webpack = require('webpack');
// Note that webpack is intended to be invoked via grunt, plugins
// need to be installed in the example-phone package, but loaders need to be
// installed in the root package.
var InlineEnviromentVariablesPlugin = require('inline-environment-variables-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

// PostCSS plugins
const cssnext = require('postcss-cssnext');
const postcssReporter = require('postcss-reporter');

// Need to use dotenv because grunt env runs after this file has been loaded
try {
  dotenv.config({
    path: path.join(__dirname, '..', '..', '.env')
  });
}
catch (reason) {
  // do nothing; this'll happen on jenkins, but we'll get the values from the
  // environment, so it's ok
}

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  context: __dirname,
  entry: [
    './src/app.js'
  ],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    sourceMapFilename: '[file].map'
  },
  debug: process.env.NODE_ENV !== 'production',
  devtool: 'sourcemap',
  plugins: [
    new InlineEnviromentVariablesPlugin(process.env),
    new webpack.optimize.UglifyJsPlugin(),
    new ExtractTextPlugin('[name].css'),
    new HtmlWebpackPlugin({
      hash: true,
      // inject: 'head',
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        sortAttributes: true,
        sortClassName: true
      },
      template: path.resolve(__dirname, './src/index.html')
    })
  ],
  postcss: () => [
    cssnext({
      browsers: ['last 2 versions', 'IE > 10']
    }),
    postcssReporter()
  ],
  resolve: {
    // Add "devMain" to the packageMains defaults so we can load src instead of
    // dist (so far, haven't found a better way)
    packageMains: ['devMain', 'webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
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
      }, {
        // Transform our own .css files with PostCSS and CSS-modules
        test: /\.css$/,
        exclude: [/node_modules/],
        loader: ExtractTextPlugin.extract(
          'style-loader',
          'css-loader?camelCase&modules&localIdentName=[local]--[hash:base64:5]&importLoaders=1!postcss-loader'
        )
      }, {
        // Do not transform vendor's CSS with CSS-modules
        test: /\.css$/,
        include: [/node_modules/],
        loaders: ['style-loader', 'css-loader']
      }, {
        test: /\.json$/,
        loader: 'url'
      },
      {
        test: /\.woff$/,
        // Inline small woff files and output them below font/.
        // Set mimetype just in case.
        loader: 'file',
        query: {
          name: 'fonts/[hash].[ext]',
          mimetype: 'application/font-woff'
        },
        include: path.resolve(__dirname, '..')
      },
      {
        test: /\.png$|\.jpg$/,
        loader: 'url'
      },
      {
        test: /\.ttf$|\.otf$|\.eot$|\.svg$/,
        loader: 'file',
        query: {
          name: 'fonts/[hash].[ext]'
        },
        include: path.resolve(__dirname, '..')
      }
    ]
  },
  node: {
    fs: 'empty'
  }
};
