module.exports = {
  env: {
    es6: true
  },
  extends: `./es5.js`,
  parserOptions: {
    ecmaVersion: 2015,
    sourceType: `module`
  },
  parser: `babel-eslint`,
  plugins: [
    `import`
  ],
  rules: {
    //
    // Strict Mode
    // http://eslint.org/docs/rules/#strict-mode
    //
    strict: [
      // No need because modules force strict mode
      2,
      `never`
    ],
    //
    // Stylistic Issues
    // http://eslint.org/docs/rules/#stylistic-issues
    //
    "require-jsdoc": [
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
      `backtick`
    ],
    "arrow-body-style": [
      2,
      `as-needed`
    ],
    "arrow-parens": [
      2,
      `always`
    ],
    "arrow-spacing": [
      2,
      {
        after: true,
        before: true
      }
    ],
    "constructor-super": [
      2
    ],
    // There seems to be a bug in generator-star-spacing; it should be
    // [2, {"before": false, "after": true}]
    "generator-star-spacing": [
      0
    ],
    "no-class-assign": [
      2
    ],
    "no-confusing-arrow": [
      2
    ],
    "no-const-assign": [
      2
    ],
    "no-dupe-class-members": [
      2
    ],
    "no-new-symbol": [
      2
    ],
    "no-this-before-super": [
      2
    ],
    "no-useless-constructor": [
      2
    ],
    "no-var": [
      2
    ],
    "object-shorthand": [
      2
    ],
    "prefer-arrow-callback": [
      2
    ],
    "prefer-const": [
      2
    ],
    "prefer-reflect": [
      2
    ],
    "prefer-rest-params": [
      2
    ],
    "prefer-spread": [
      2
    ],
    "prefer-template": [
      2
    ],
    "require-yield": [
      2
    ],
    "template-curly-spacing": [
      2,
      `never`
    ],
    "yield-star-spacing": [
      2,
      `after`
    ],
    //
    // Import Plugin
    // https://www.npmjs.com/package/eslint-plugin-import
    //

    //
    // Import Plugin/Static analysis
    //
    "import/no-unresolved": [
      2
    ],
    "import/named": [
      2
    ],
    "import/default": [
      2
    ],
    "import/namespace": [
      2
    ],
    "import/no-restricted-paths": [
      0
    ],
    "import/no-absolute-path": [
      2
    ],
    "import/no-dynamic-require": [
      2
    ],
    // I feel like no-internal-modules is a best practice, but it's a bit of work
    // for us to adhere to it right now.
    "import/no-internal-modules": [
      0
    ],
    "import/no-webpack-loader-syntax": [
      2
    ],
    //
    // Import Plugin/Helpful warnings
    //
    "import/export": [
      2
    ],
    "import/no-named-as-default": [
      2
    ],
    "import/no-named-as-default-member": [
      2
    ],
    "import/no-deprecated": [
      2
    ],
    "import/no-extraneous-dependencies": [
      2
    ],
    "import/no-mutable-exports": [
      2
    ],
    //
    // Import Plugin/Module systems
    //
    "import/unambiguous": [
      2
    ],
    "import/no-commonjs": [
      2
    ],
    "import/no-amd": [
      2
    ],
    "import/no-nodejs-modules": [
      0
    ],
    //
    // Import Plugin/Style guide
    //
    "import/first": [
      2
    ],
    "import/no-duplicates": [
      2
    ],
    "import/no-namespace": [
      2
    ],
    "import/extensions": [
      2
    ],
    "import/order": [
      2
    ],
    "import/newline-after-import": [
      2
    ],
    "import/prefer-default-export": [
      2
    ],
    "import/max-dependencies": [
      0
    ],
    // no-unassigned-import seems like the "right" way to do things, but would
    // actually break the plugin system
    "import/no-unassigned-import": [
      0
    ],
    "import/no-named-default": [
      2
    ]
  }
};
