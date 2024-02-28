const get = (options = {}) => {
  const {packageName} = options;

  return {
    overrides: [
      {
        extends: ['airbnb-base', 'airbnb-typescript/base'],
        files: ['*.ts'],
        parser: '@typescript-eslint/parser',
        parserOptions: {
          project: './tsconfig.json',
        },
        plugins: ['eslint-plugin-tsdoc'],
        rules: {
          'import/extensions': 'off',
          'import/no-relative-packages': 'off',
          'import/no-unresolved': ['error', {ignore: [packageName]}],
          'import/prefer-default-export': 'off',
          'jsdoc/require-jsdoc': 'error',
          'max-len': [
            'error',
            {
              code: 120,
            },
          ],
          'tsdoc/syntax': 'error',
        },
        settings: {
          'import/extensions': ['.ts'],
          'import/resolver': {
            node: {
              extensions: ['.ts'],
            },
          },
        },
      },
    ],
  };
};

module.exports = get;
