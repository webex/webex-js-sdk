const config = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    '@webex/eslint-config/core',
    '@webex/eslint-config/jasmine',
    '@webex/eslint-config/typescript',
  ],
};

module.exports = config;
