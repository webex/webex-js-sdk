const merge = require('webpack-merge');

module.exports = merge({
  devServer: {
    https: true,
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
