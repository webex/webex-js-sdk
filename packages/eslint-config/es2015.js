'use strict';

module.exports = {
  env: {
    es6: true
  },
  extends: './es5.js',
  parserOptions: {
    ecmaVersion: 2015,
    sourceType: 'module'
  },
  rules: {
    //
    // Strict Mode
    // http://eslint.org/docs/rules/#strict-mode
    //
    strict: [
      // No need because modules force strict mode
      2,
      'never'
    ],
    //
    // Stylistic Issues
    // http://eslint.org/docs/rules/#stylistic-issues
    //
    'require-jsdoc': [
      2,
      {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true
        }
      }
    ],
    //
    // ECMAScript 6
    // http://eslint.org/docs/rules/#ecmascript-6
    //
    quotes: [
      2,
      'backtick'
    ],
    'arrow-body-style': [
      2,
      'as-needed'
    ],
    'arrow-parens': [
      2,
      'always'
    ],
    'arrow-spacing': [
      2,
      {
        after: true,
        before: true
      }
    ],
    'constructor-super': [
      2
    ],
    // There seems to be a bug in generator-star-spacing; it should be
    // [2, {'before': false, 'after': true}]
    'generator-star-spacing': [
      0
    ],
    'no-class-assign': [
      2
    ],
    'no-confusing-arrow': [
      2
    ],
    'no-const-assign': [
      2
    ],
    'no-dupe-class-members': [
      2
    ],
    'no-new-symbol': [
      2
    ],
    'no-this-before-super': [
      2
    ],
    'no-useless-constructor': [
      2
    ],
    'no-var': [
      2
    ],
    'object-shorthand': [
      2
    ],
    'prefer-arrow-callback': [
      2
    ],
    'prefer-const': [
      2
    ],
    'prefer-reflect': [
      2
    ],
    'prefer-rest-params': [
      2
    ],
    'prefer-spread': [
      2
    ],
    'prefer-template': [
      2
    ],
    'require-yield': [
      2
    ],
    'template-curly-spacing': [
      2,
      'never'
    ],
    'yield-star-spacing': [
      2,
      'after'
    ]
  }
};
