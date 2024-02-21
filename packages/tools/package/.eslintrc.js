const { javascript, jest, typescript } = require('../../../config/eslint');
const definition = require('./package.json');

const config = {
  root: true,
  env: {
    node: true,
  },
  overrides: [
    ...javascript.modern({ packageName: definition.name }).overrides,
    ...jest.modern({ packageName: definition.name }).overrides,
    ...typescript.modern({ packageName: definition.name }).overrides,
  ],
};

module.exports = config;
