const rules = {
  'import/extensions': 'off',
  'import/no-extraneous-dependencies': [
    'off',
    {
      devDependencies: [
        './*.*',
      ],
    },
  ],
  'import/no-relative-packages': 'off',
  'import/prefer-default-export': 'off',
  'max-len': [
    'error', {
      code: 120,
    },
  ],
  indent: [
    'error',
    2,
  ],
  'jsdoc/require-jsdoc': 'error',
};

module.exports = rules;
