const rules = {
  'comma-dangle': ['error', 'only-multiline'],
  quotes: [
    'error',
    'single',
    {
      avoidEscape: true,
    },
  ],
  'tsdoc/syntax': 'warn',
  'object-curly-spacing': 0,
  indent: 'off',
  'import/prefer-default-export': 0,
  'jest/no-hooks': [
    'error',
    {
      allow: ['afterAll', 'afterEach', 'beforeAll', 'beforeEach'],
    },
  ],
  'jest/lowercase-name': 0,
  'jest/require-hook': 0,
  'import/extensions': [
    'error',
    'ignorePackages',
    {
      js: 'never',
      ts: 'never',
    },
  ],
  'no-console': [
    'error',
    {
      allow: ['warn', 'error'],
    },
  ],
  'func-style': [
    'warn',
    'declaration',
    {
      allowArrowFunctions: true,
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ForInStatement',
      message:
        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
    },
    {
      selector: 'LabeledStatement',
      message:
        'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
    },
    {
      selector: 'WithStatement',
      message:
        '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
    },
  ],
  'max-len': [
    'error',
    {
      code: 100,
      tabWidth: 2,
      ignoreComments: true,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    },
  ],
  'accessor-pairs': [
    'error',
    {
      setWithoutGet: true,
      getWithoutSet: false,
      enforceForClassMembers: true,
    },
  ],
  'prettier/prettier': [
    'error',
    {
      printWidth: 100,
      bracketSameLine: true,
      singleQuote: true,
      tabWidth: 2,
      semi: true,
      trailingComma: 'es5',
      bracketSpacing: false,
    },
  ],
  'no-dupe-keys': 'error',
  'no-dupe-class-members': 'error',
  'newline-after-var': 0,
  'newline-before-return': 'error',
  'lines-around-directive': 'error',
  'no-useless-call': 'error',
  'operator-linebreak': 'off',
  'no-underscore-dangle': 0,
  'no-param-reassign': 0,
  'max-classes-per-file': 0,
  'import/no-import-module-exports': 0,
  '@typescript-eslint/no-unused-vars': 1,
  'no-use-before-define': 1,
  'no-restricted-exports': 1,
  'import/no-unresolved': 1, // fix this on a later PR
  'import/no-cycle': 1, // TODO: Fix this in a later PR
  'class-methods-use-this': 1, // TODO: Fix this in a later PR
  'import/no-extraneous-dependencies': 1, // TODO: Fix this in a later PR
};

module.exports = rules;
