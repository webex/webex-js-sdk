/* eslint quotes: [2, "single"] */
/* eslint no-var: [0] */
/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* eslint camelcase: [0] */

const dotenv = require('dotenv');
const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const InlineEnviromentVariablesPlugin = require('inline-environment-variables-webpack-plugin');

const cssnext = require('postcss-cssnext');

// Need to use dotenv because grunt env runs after this file has been loaded
try {
  dotenv.config({
    path: path.join(__dirname, '..', '..', '..', '.env')
  });
}
catch (reason) {
  // Log errors for debugging. Grunt will fail silently if there are errors in webpack.base
  console.error(reason);
}

module.exports = (options) => ({
  context: path.resolve(__dirname, '..', 'src'),
  entry: options.entry,
  output: Object.assign({
    filename: 'bundle.js',
    path: path.resolve(__dirname, '..', 'dist'),
    sourceMapFilename: '[file].map'
  }, options.output),
  debug: options.debug || false,
  devtool: options.devtool,
  plugins: options.plugins.concat([
    new InlineEnviromentVariablesPlugin(process.env),
    new ExtractTextPlugin('[name].css'),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV)
      }
    })
  ]),
  stats: {
    children: false
  },
  target: 'web',
  resolve: {
    modules: ['devMain'],
    packageAlias: ['browser']
  },
  postcss: () => [
    cssnext({
      browsers: ['last 2 versions', 'IE > 10']
    })
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules|dist/,
        query: options.babelQuery
      },
      {
        test: /\.css$/,
        exclude: [/node_modules/],
        loader: ExtractTextPlugin.extract(
          'style-loader',
          'css-loader?camelCase&modules&localIdentName=[local]--[hash:base64:5]&importLoaders=1!postcss-loader'
        )
      },
      {
        // Do not transform vendor's CSS with CSS-modules
        test: /\.css$/,
        include: [/node_modules/],
        loaders: ['style-loader', 'css-loader']
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.woff$/,
        // Inline small woff files and output them below font/.
        // Set mimetype just in case.
        loader: 'file-loader',
        query: {
          name: 'fonts/[hash].[ext]',
          mimetype: 'application/font-woff'
        }
      },
      {
        test: /\.ttf$|\.otf$|\.eot$|\.svg$/,
        loader: 'file-loader',
        query: {
          name: 'fonts/[hash].[ext]'
        }
      },
      {
        test: /.*\.(gif|png|jpg)$/,
        loaders: [
          'file?name=[name].[ext]',
          'image-webpack?{optimizationLevel: 7, interlaced: false, pngquant:{quality: "65-90", speed: 4}, mozjpeg: {quality: 65}}'
        ]
      }
    ]
  },
  node: {
    fs: 'empty'
  }
});
