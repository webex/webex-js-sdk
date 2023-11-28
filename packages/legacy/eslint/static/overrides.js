const overrides = [
  {
    files: ['*.ts'],
    parser: '@typescript-eslint/parser',
    extends: [
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
    ],
    plugins: ['@typescript-eslint'],
    rules: {
      'default-case': 0,
      'no-undef': 'off',
      'react/prop-types': 'off',
      'no-shadow': 0, // should be disabled for ts files as typescript/no-shadow covers it
      '@typescript-eslint/no-shadow': 2,
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'import/prefer-default-export': 'warn',
      'newline-after-var': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'lines-between-class-members': ['error', 'always', {exceptAfterSingleLine: true}],
      'tsdoc/syntax': 'off', // Todo: remove this before merging pr
      'valid-jsdoc': [
        'error',
        {
          prefer: {
            arg: 'param',
            argument: 'param',
            return: 'returns',
            virtual: 'abstract',
            fires: 'emits',
          },
          requireParamDescription: false,
          requireReturn: true,
          requireReturnType: true,
          requireReturnDescription: false,
        },
      ],
      'require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: true,
          },
        },
      ],
    },
  },
  {
    files: ['*.js'],
    rules: {
      '@typescript-eslint/no-var-requires': 1,
      'valid-jsdoc': [
        'error',
        {
          prefer: {
            arg: 'param',
            argument: 'param',
            return: 'returns',
            virtual: 'abstract',
            fires: 'emits',
          },
          requireParamDescription: false,
          requireReturn: true,
          requireReturnType: true,
          requireReturnDescription: false,
        },
      ],
      'require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: true,
          },
        },
      ],
      'tsdoc/syntax': 'off',
      'class-methods-use-this': 0,
      'no-multi-assign': 0,
      'no-promise-executor-return': 0,
      'no-restricted-exports': 0,
    },
  },
  {
    files: ['packages/**/test/**/*.[tj]s', 'packages/**/*-spec/**/*.[tj]s'],
    env: {
      mocha: true,
    },
    rules: {
      'func-names': 0,
      'no-invalid-this': 0,
      'require-jsdoc': 0,
    },
  },
  {
    files: ['wdio.helpers.d/**/*.js', 'docs/samples/**/test/wdio/**/*.js'],
    globals: {
      browser: false,
      browserFirefox: false,
      browserChrome: false,
      $: false,
      $$: false,
      step: false,
      describe: false,
      before: false,
      beforeAll: false,
      beforeEach: false,
      after: false,
      afterAll: false,
      afterEach: false,
      it: false,
    },
  },
  {
    files: ['packages/@webex/xunit-with-logs'],
    rules: {
      'func-names': 0,
      'no-console': 0,
    },
  },
  {
    files: ['packages/**/bin-*/**'],
    rules: {
      'no-sync': 0,
    },
  },
];

module.exports = overrides;
