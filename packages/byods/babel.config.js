const babelConfigLegacy = require('@webex/babel-config-legacy');

babelConfigLegacy.presets = [
  [
    '@babel/preset-env',
    {
      targets: {
        node: 'current',
      },
    },
  ],
  '@babel/preset-typescript',
];
babelConfigLegacy.plugins = ['@babel/plugin-transform-private-methods'];
module.exports = babelConfigLegacy;
