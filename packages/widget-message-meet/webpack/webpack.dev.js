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
    filename: `[name].js`,
    chunkFilename: `[name].chunk.js`
  },
  plugins,
  devtools: `cheap-module-eval-source-map`,
  postcss: [postcssReporter],
  debug: true
});
