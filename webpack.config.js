const glob = require(`glob`);
const path = require(`path`);

module.exports = {
  entry: `./packages/node_modules/ciscospark`,
  output: {
    filename: `bundle.js`,
    library: `ciscospark`,
    libraryTarget: `var`,
    path: __dirname,
    sourceMapFilename: `[file].map`
  },
  devtool: `source-map`,
  devServer: {
    disableHostCheck: true,
    port: 8000
  },
  resolve: {
    alias: glob
      .sync(`**/package.json`, {cwd: `./packages/node_modules`})
      .map((p) => path.dirname(p))
      .reduce((alias, packageName) => {
        // Always use src as the entry point for local files so that we have the
        // best opportunity for treeshaking; also makes developing easier since
        // we don't need to manually rebuild after changing code.
        alias[`./packages/node_modules/${packageName}`] = path.resolve(__dirname, `./packages/node_modules/${packageName}/src/index.js`);
        alias[`${packageName}`] = path.resolve(__dirname, `./packages/node_modules/${packageName}/src/index.js`);
        return alias;
      }, {})
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: /packages\/node_modules/,
        use: {
          loader: `babel-loader`
        }
      }
    ]
  }
};
