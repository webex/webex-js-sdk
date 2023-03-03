module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    jest: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    sourceType: 'module',
    requireConfigFile: true,
  },
  globals: {
    PACKAGE_VERSION: false,
    WebSocket: false,
  },
  plugins: ['import', 'eslint-plugin-tsdoc', 'jest', 'prettier', 'chai-friendly'],
  extends: [
    'eslint:recommended',
    './eslintrules/index.js',
    'airbnb-base',
    'plugin:import/typescript',
    'plugin:import/recommended',
    'plugin:prettier/recommended',
  ],
  overrides: [
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

  ignorePatterns: [
    '**/build/**/*.*',
    './packages/**/dist/**/*.*',
    'docs/^(?!examples)/*.*',
    './packages/webex/umd/**',
    'tooling/*',
    '**/test/**/*',
    'docs/**',
    '*.json',
    // Files with decorator
    'authorization.js',
    'kms.js',
    'webex-core.js',
    'ediscovery.js',
    'CHANGELOG.md',
    '*.json',
    '**/*.json',
    '*.lock',
    // end decorator
  ],
};
