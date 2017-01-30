const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const postcssReporter = require('postcss-reporter');


const plugins = [
  new HtmlWebpackPlugin({
    template: 'index.html'
  })
];

module.exports = require(`./webpack.base`)({
  entry: `./app.js`,
  output: {
    filename: `bundle.js`,
    chunkFilename: `bundle.chunk.js`
  },
  plugins,
  devtool: `eval-source-map`,
  postcss: [postcssReporter],
  debug: true
});
