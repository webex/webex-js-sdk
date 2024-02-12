const get = (options = {}) => {
  const {packageName} = options;

  return {
    overrides: [
      {
        extends: ['airbnb-base', 'plugin:jest/recommended'],
        env: {
          es6: true,
          'jest/globals': true,
        },
        files: ['test/**/*.test.js'],
        plugins: ['jest'],
        rules: {
          'jest/no-disabled-tests': 'error',
          'jest/no-focused-tests': 'error',
          'jest/no-identical-title': 'error',
          'jest/prefer-expect-assertions': 'off',
          'jest/prefer-to-have-length': 'warn',
          'jest/valid-expect': 'error',
          'import/extensions': 'off',
          'import/no-extraneous-dependencies': 'off',
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
          indent: ['error', 2],
        },
        settings: {
          'import/extensions': ['.js'],
          'import/resolver': {
            node: {
              extensions: ['.js'],
            },
          },
        },
      },
    ],
  };
};

module.exports = get;
