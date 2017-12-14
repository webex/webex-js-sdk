const {package: packageName, coverage} = require('yargs').argv

const config = {
  'plugins': [
    './tooling/babel-plugin-inject-package-version',
    ['babel-plugin-transform-builtin-extend', {
      'globals': ['Error']
    }],
    'transform-decorators-legacy',
    'transform-class-properties',
    'transform-export-extensions',
    'lodash',
    'transform-runtime'
  ],
  'presets': [
    ['env', {
      'targets': {
        'browsers': [
          'last 2 versions',
          'safari >= 7'
        ]
      }
    }]
  ],
  'sourceMaps': true
};

if (coverage && packageName) {
  config.plugins.push([
    'istanbul', {
      'include': [
        `packages/node_modules/${packageName}/dist/**`,
        `packages/node_modules/${packageName}/src/**`
      ],
      'exclude': [
        // This prevent's istanbul's default exclude from omitting all of our
        // code
        `!packages/node_modules/**`
      ]
    }
  ]);
}

module.exports = config;
