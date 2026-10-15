const path = require('path');
const fs = require('fs');
const { BannerPlugin } = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

const imiClientSrc = fs.readFileSync(path.resolve(__dirname, 'src/IMIClient.js'), 'utf8');
const versionMatch = imiClientSrc.match(/JS_SDK_VERSION = "(\d+\.\d+\.\d+\.\d+)"/);
const js_sdk_version = versionMatch ? versionMatch[1] : 'unknown';

const RESERVED_NAMES = [
  'IMI', 'CryptoJS', 'JS_SDK_VERSION', 'ICMessage', 'ICAttachment', 'ICConfig',
  'ICTopic', 'ICFormField', 'ICInteractiveData', 'ICFormTemplateAttachment',
  'ICDeviceProfile', 'ICThread', 'Paho', 'MQTT',
];

module.exports = {
  target: ['web'],
  mode: 'production',
  entry: {
    'webex-connect-sdk': ['./src/aes.js', './src/IMIClient.js'],
    sw: ['./src/mqttws31.js', './sw/sw.js'],
  },
  output: {
    filename: '[name].min.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  devtool: 'source-map',
  plugins: [
    new BannerPlugin({ banner: `IMIConnect JS SDK v${js_sdk_version}\n` }),
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        exclude: /src\/aes\.js$/,
        extractComments: false,
        terserOptions: {
          warnings: false,
          mangle: { keep_fnames: true, keep_classnames: true, reserved: RESERVED_NAMES },
        },
      }),
    ],
  },
};
