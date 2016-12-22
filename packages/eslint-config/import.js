'use strict';

module.exports = {
  extends: './es2015.js',
  parser: 'babel-eslint',
  plugins: [
    'import'
  ],
  //
  // Import Plugin
  // https://www.npmjs.com/package/eslint-plugin-import
  //

  //
  // Import Plugin/Static analysis
  //
  'import/no-unresolved': [
    2
  ],
  'import/named': [
    2
  ],
  'import/default': [
    2
  ],
  'import/namespace': [
    2
  ],
  'import/no-restricted-paths': [
    0
  ],
  'import/no-absolute-path': [
    2
  ],
  'import/no-dynamic-require': [
    2
  ],
  // I feel like no-internal-modules is a best practice, but it's a bit of work
  // for us to adhere to it right now.
  'import/no-internal-modules': [
    0
  ],
  'import/no-webpack-loader-syntax': [
    2
  ],
  //
  // Import Plugin/Helpful warnings
  //
  'import/export': [
    2
  ],
  'import/no-named-as-default': [
    2
  ],
  'import/no-named-as-default-member': [
    2
  ],
  'import/no-deprecated': [
    2
  ],
  'import/no-extraneous-dependencies': [
    2
  ],
  'import/no-mutable-exports': [
    2
  ],
  //
  // Import Plugin/Module systems
  //
  'import/unambiguous': [
    0
  ],
  'import/no-commonjs': [
    2
  ],
  'import/no-amd': [
    2
  ],
  'import/no-nodejs-modules': [
    0
  ],
  //
  // Import Plugin/Style guide
  //
  'import/first': [
    2
  ],
  'import/no-duplicates': [
    2
  ],
  'import/no-namespace': [
    2
  ],
  'import/extensions': [
    2
  ],
  'import/order': [
    // 2
    0
  ],
  'import/newline-after-import': [
    2
  ],
  'import/prefer-default-export': [
    2
  ],
  'import/max-dependencies': [
    0
  ],
  // no-unassigned-import seems like the 'right' way to do things, but would
  // actually break the plugin system
  'import/no-unassigned-import': [
    0
  ],
  'import/no-named-default': [
    2
  ]
};
