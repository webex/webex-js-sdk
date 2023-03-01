const env = require('./core.env');
const ignorePatterns = require('./core.ignore-patterns');
const rules = require('./core.rules');
const settings = require('./core.settings');

const config = {
  extends: [
    'airbnb-base',
  ],
  env,
  ignorePatterns,
  plugins: [
    'eslint-plugin-jsdoc',
  ],
  rules,
  settings,
};

module.exports = config;
