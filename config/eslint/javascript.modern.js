const get = (options = {}) => {
  const {packageName} = options;

  return {
    overrides: [
      {
        extends: ['airbnb-base'],
        env: {
          es6: true,
        },
        files: ['*.js'],
        plugins: ['eslint-plugin-jsdoc'],
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
