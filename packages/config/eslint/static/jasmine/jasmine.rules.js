const rules = {
  'jasmine/no-spec-dupes': ['error', 'branch'],
  'jasmine/no-suite-dupes': ['error', 'branch'],
  'import/no-extraneous-dependencies': [
    'off',
    {
      devDependencies: [
        '*.spec.*',
        '*.test.*',
      ],
    },
  ],
};

module.exports = rules;
