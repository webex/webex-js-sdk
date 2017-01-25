const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const plugins = [
  new webpack.optimize.DedupePlugin(),
  new webpack.optimize.UglifyJsPlugin({
    sourceMap: true,
    compress: {
      warnings: false
    }
  }),
  new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
  new HtmlWebpackPlugin({
    hash: true,
    minify: {
      collapseWhitespace: false,
      removeComments: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      sortAttributes: true,
      sortClassName: true
    },
    template: path.resolve(__dirname, `..`, `src/demo/index.html`)
  })
];

module.exports = require(`./webpack.base`)({
  entry: `./demo/app.js`,
  devtool: `source-map`,
  debug: false,
  output: {
    filename: `bundle.js`,
    path: path.resolve(__dirname, `..`, `dist`, `demo`),
    sourceMapFilename: `[file].map`
  },
  plugins,
  env: {
    CISCOSPARK_ACCESS_TOKEN: ``,
    TO_PERSON_EMAIL: ``,
    TO_PERSON_ID: ``
  }
});
