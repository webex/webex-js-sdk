const { javascript, jest, typescript } = require('../../../config/eslint');

const config = {
  root: true,
  env: {
    node: true,
  },
  overrides: [
    ...javascript.modern.overrides,
    ...jest.modern.overrides,
    ...typescript.modern.overrides,
  ],
};

module.exports = config;
