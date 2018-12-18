const path = require('path');

const dotenv = require('dotenv');
const glob = require('glob');
const {EnvironmentPlugin} = require('webpack');

dotenv.config();
dotenv.config({path: '.env.default'});

module.exports = {
  entry: './packages/node_modules/ciscospark',
  mode: 'development',
  output: {
    filename: 'bundle.js',
    library: 'ciscospark',
    libraryTarget: 'var',
    path: __dirname,
    sourceMapFilename: '[file].map'
  },
  devtool: 'source-map',
  devServer: {
    https: true,
    disableHostCheck: true,
    port: 8000,
    contentBase: './packages/node_modules/samples'
  },
  node: {
    fs: 'empty'
  },
  resolve: {
    alias: glob
      .sync('**/package.json', {cwd: './packages/node_modules'})
      .map((p) => path.dirname(p))
      .reduce((alias, packageName) => {
        // Always use src as the entry point for local files so that we have the
        // best opportunity for treeshaking; also makes developing easier since
        // we don't need to manually rebuild after changing code.
        alias[`./packages/node_modules/${packageName}`] = path.resolve(
          __dirname,
          `./packages/node_modules/${packageName}/src/index.js`
        );
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
          loader: 'babel-loader'
        }
      }
    ]
  },
  plugins: [
    new EnvironmentPlugin({
      CISCOSPARK_LOG_LEVEL: 'log',
      DEBUG: '',
      NODE_ENV: process.env.NODE_ENV || 'development',
      // The follow environment variables are specific to our continuous
      // integration process and should not be used in general
      // Also, yes, CONVERSATION_SERVICE does not end in URL
      CONVERSATION_SERVICE:
        process.env.CONVERSATION_SERVICE
        || process.env.CONVERSATION_SERVICE_URL
        || 'https://conv-a.wbx2.com/conversation/api/v1',
      WDM_SERVICE_URL: process.env.WDM_SERVICE_URL || 'https://wdm-a.wbx2.com/wdm/api/v1',
      HYDRA_SERVICE_URL: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',
      ATLAS_SERVICE_URL: process.env.ATLAS_SERVICE_URL || 'https://atlas-a.wbx2.com/admin/api/v1'
    })
  ]
};
