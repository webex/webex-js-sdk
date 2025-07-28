const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'src/app.js'),
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.scss'],
    fallback: {
      fs: false,
      process: require.resolve('process/browser'),
      crypto: require.resolve('crypto-browserify'),
      querystring: require.resolve('querystring-es3'),
      os: require.resolve('os-browserify/browser'),
      stream: require.resolve('stream-browserify'),
      vm: require.resolve('vm-browserify'),
      util: require.resolve('util/'),
      url: require.resolve('url/'),
      module: false,
      exports: false,
    },
    alias: {
      // Main webex aliases - these work because they're designed for bundling
      '@webex/common': path.resolve(__dirname, '../@webex/common/src'),
      '@webex/common-timers': path.resolve(__dirname, '../@webex/common-timers/src'),
      webex: path.resolve(__dirname, '../webex/src'),
      'webex/calling': path.resolve(__dirname, '../webex/src/calling.js'),
      'webex/meetings': path.resolve(__dirname, '../webex/src/meetings.js'),
      'webex/package': path.resolve(__dirname, '../webex/package.json'),

      // Calling package - this works because it's designed for this setup
      '@webex/calling': path.resolve(__dirname, '../calling/src'),

      // Plugin-Encryption specific packages for HMR
      '@webex/plugin-encryption': path.resolve(__dirname, '../@webex/plugin-encryption/src'),
      '@webex/internal-plugin-encryption': path.resolve(
        __dirname,
        '../@webex/internal-plugin-encryption/src'
      ),

      // Core dependencies for encryption
      '@webex/webex-core': path.resolve(__dirname, '../@webex/webex-core/src'),
      '@webex/http-core': path.resolve(__dirname, '../@webex/http-core/src'),

      // Additional packages that webex/src might import
      '@webex/plugin-cc': path.resolve(__dirname, '../@webex/plugin-cc/src'),
      '@webex/plugin-logger': path.resolve(__dirname, '../@webex/plugin-logger/src'),
      '@webex/plugin-authorization': path.resolve(__dirname, '../@webex/plugin-authorization/src'),
      '@webex/plugin-meetings': path.resolve(__dirname, '../@webex/plugin-meetings/src'),
      '@webex/internal-plugin-device': path.resolve(
        __dirname,
        '../@webex/internal-plugin-device/src'
      ),
      '@webex/internal-plugin-mercury': path.resolve(
        __dirname,
        '../@webex/internal-plugin-mercury/src'
      ),
      '@webex/storage-adapter-local-storage': path.resolve(
        __dirname,
        '../@webex/storage-adapter-local-storage/src'
      ),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
      filename: 'index.html',
      inject: true,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /(node_modules)/,
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, '../@webex'),
          path.resolve(__dirname, '../calling/src'),
          path.resolve(__dirname, '../webex/src'),
        ],
        use: {
          loader: 'babel-loader',
          options: {
            configFile: path.resolve(__dirname, '../../babel.config.json'),
          },
        },
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /(node_modules)/,
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, '../@webex'),
          path.resolve(__dirname, '../calling/src'),
          path.resolve(__dirname, '../webex/src'),
        ],
        use: {
          loader: 'babel-loader',
          options: {
            configFile: path.resolve(__dirname, '../../babel.config.json'),
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  stats: {
    warningsFilter: [/sass-loader/],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
    publicPath: '/',
  },
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'src'),
        publicPath: '/',
      },
      {
        directory: path.join(__dirname, 'src/calling'),
        publicPath: '/calling/',
      },
      {
        directory: path.join(__dirname, 'src/plugin-encryption'),
        publicPath: '/plugin-encryption/',
      },
      {
        directory: path.join(__dirname, 'src/contact-center'),
        publicPath: '/contact-center/',
      },
      {
        directory: path.join(__dirname, 'src/browser-socket'),
        publicPath: '/browser-socket/',
      },
      {
        directory: path.join(__dirname, 'src/browser-read-status'),
        publicPath: '/browser-read-status/',
      },
      {
        directory: path.join(__dirname, 'src/browser-plugin-meetings'),
        publicPath: '/browser-plugin-meetings/',
      },
      {
        directory: path.join(__dirname, 'src/browser-auth'),
        publicPath: '/browser-auth/',
      },
    ],
    compress: true,
    port: 3000,
    hot: true,
    open: false,
    historyApiFallback: true,
    client: {
      overlay: {
        errors: false,
        warnings: false,
      },
    },
    devMiddleware: {
      writeToDisk: true,
    },
  },
};
