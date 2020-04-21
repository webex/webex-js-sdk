const path = require('path');
const fs = require('fs');

const merge = require('webpack-merge');

module.exports = merge({
  devServer: {
    https: true,
    key: fs.readFileSync(path.resolve(__dirname, 'localhost.key')),
    cert: fs.readFileSync(path.resolve(__dirname, 'localhost.crt')),
    disableHostCheck: true,
    port: 8000,
    stats: {
      colors: true,
      hash: false,
      version: false,
      timings: false,
      assets: true,
      chunks: false,
      modules: false,
      reasons: false,
      children: false,
      source: false,
      errors: true,
      errorDetails: true,
      warnings: true,
      publicPath: false
    }
  }
});
