const rules = require('./jasmine.rules');

const config = {
  overrides: [
    {
      env: {
        jasmine: true,
      },
      extends: [
        'airbnb-base',
        'plugin:jasmine/recommended',
      ],
      files: [
        '*.spec.*',
        '*.test.*',
      ],
      plugins: [
        'eslint-plugin-jasmine',
      ],
      rules,
    },
  ],
};

module.exports = config;
