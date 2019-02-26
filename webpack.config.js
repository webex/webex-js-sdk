const path = require('path');

const dotenv = require('dotenv');
const DotenvPlugin = require('dotenv-webpack');
const glob = require('glob');
const {DefinePlugin, EnvironmentPlugin} = require('webpack');

dotenv.config();
dotenv.config({path: '.env.default'});

module.exports = (env = '') => ({
  entry: './packages/node_modules/ciscospark',
  mode: env === 'production' ? 'production' : 'development',
  output: {
    filename: 'bundle.js',
    library: 'ciscospark',
    libraryTarget: 'var',
    path: __dirname,
    sourceMapFilename: '[file].map'
  },
  devtool: env === 'production' ? 'source-map' : 'cheap-module-source-map',
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
    ...(env === 'production'
      ? [
        new EnvironmentPlugin({
          CISCOSPARK_LOG_LEVEL: 'log',
          DEBUG: '',
          NODE_ENV: 'production'
        }),
        // This allows overwriting of process.env
        new DefinePlugin({
          'process.env': {
            // Use production URLs with samples
            ACL_SERVICE_URL: JSON.stringify('https://acl-a.wbx2.com/acl/api/v1'),
            ATLAS_SERVICE_URL: JSON.stringify('https://atlas-a.wbx2.com/admin/api/v1'),
            CONVERSATION_SERVICE: JSON.stringify('https://conv-a.wbx2.com/conversation/api/v1'),
            ENCRYPTION_SERVICE_URL: JSON.stringify('https://encryption-a.wbx2.com'),
            HYDRA_SERVICE_URL: JSON.stringify('https://api.ciscospark.com/v1'),
            IDBROKER_BASE_URL: JSON.stringify('https://idbroker.webex.com'),
            IDENTITY_BASE_URL: JSON.stringify('https://identity.webex.com'),
            WDM_SERVICE_URL: JSON.stringify('https://wdm-a.wbx2.com/wdm/api/v1'),
            WHISTLER_API_SERVICE_URL: JSON.stringify('https://whistler-prod.onint.ciscospark.com/api/v1')
          }
        })
      ]
      : [
        new DotenvPlugin({
          path: './.env',
          defaults: !(process.env.CI || process.env.JENKINS) // load '.env.defaults' as the default values if empty and not in CI.
        }),
        // Environment Plugin doesn't override already defined Environment Variables (i.e. DotENV)
        new EnvironmentPlugin({
          CISCOSPARK_LOG_LEVEL: 'log',
          DEBUG: '',
          NODE_ENV: 'development',
          // The follow environment variables are specific to our continuous
          // integration process and should not be used in general
          // Also, yes, CONVERSATION_SERVICE does not end in URL
          CONVERSATION_SERVICE: process.env.CONVERSATION_SERVICE_URL || 'https://conv-a.wbx2.com/conversation/api/v1',
          WDM_SERVICE_URL: 'https://wdm-a.wbx2.com/wdm/api/v1',
          HYDRA_SERVICE_URL: 'https://api.ciscospark.com/v1',
          ATLAS_SERVICE_URL: 'https://atlas-a.wbx2.com/admin/api/v1',
          AUTHORIZE_URL: 'https://idbrokerbts.webex.com',
          IDBROKER_BASE_URL: 'https://idbrokerbts.webex.com',
          IDENTITY_BASE_URL: 'https://identitybts.webex.com'
        })
      ]
    )
  ]
});
