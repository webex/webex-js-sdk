const ignorePatterns = require('./ignore-patterns');
const overrides = require('./overrides');
const rules = require('./rules');
const settings = require('./settings');

const config = {
  root: true,
  env: {
    browser: true,
    node: true,
    jest: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    sourceType: 'module',
    requireConfigFile: true,
  },
  globals: {
    PACKAGE_VERSION: false,
    WebSocket: false,
  },
  plugins: ['import', 'eslint-plugin-tsdoc', 'jest', 'prettier', 'chai-friendly'],
  extends: [
    'eslint:recommended',
    './rules/index.js',
    'airbnb-base',
    'plugin:import/typescript',
    'plugin:import/recommended',
    'plugin:prettier/recommended',
  ],
  ignorePatterns,
  overrides,
  rules,
  settings,
};

module.exports = config;
