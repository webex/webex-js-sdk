const rules = require('./typescript.rules');
const settings = require('./typescript.settings');

const config = {
  overrides: [
    {
      extends: [
        'airbnb-base',
        'airbnb-typescript/base',
      ],
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
      },
      plugins: [
        'eslint-plugin-tsdoc',
      ],
      rules,
      settings,
    },
  ],
};

module.exports = config;
