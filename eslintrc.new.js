module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    requireConfigFile: true,
  },
  globals: {
    PACKAGE_VERSION: false,
    WebSocket: false,
  },
  plugins: ['@typescript-eslint', 'import', 'eslint-plugin-tsdoc', 'jest'],
  extends: [
    'airbnb-base',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
  ],
  rules: {
    'comma-dangle': ['error', 'only-multiline'],
    quotes: [
      'error',
      'single',
      {
        avoidEscape: true,
      },
    ],
    'tsdoc/syntax': 'error',
    'object-curly-spacing': 0,
    'no-shadow': 0,
    '@typescript-eslint/no-shadow': ['error'],
    indent: 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
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
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['*.config*.*', '**/*test.*', '**/testUtils/*.*'],
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
    'no-dupe-keys': 'error',
    'no-dupe-class-members': 'error',
    'newline-after-var': 'error',
    'newline-before-return': 'error',
    'lines-around-directive': 'error',
    'no-useless-call': 'error',
    'operator-linebreak': 'off',
  },

  settings: {
    'import/core-modules': ['chai', 'sinon'],
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
        paths: ['src'],
      },
    },
    typescript: {},
  },
  overrides: [
    {
      files: ['packages/**/*.js'],
      rules: {
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
      },
    },
    {
      files: ['packages/**/test/**/*.js', 'packages/**/*-spec/**/*.js'],
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
  ],
  ignorePatterns: [
    '**/build/**/*.*',
    './packages/**/dist/**/*.*',
    'docs/^(?!examples)/*.*',
    '*.typegen.ts',
    './packages/webex/umd/**',
  ],
};
