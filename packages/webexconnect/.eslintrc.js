module.exports = {
  root: true,
  env: { browser: true, serviceworker: true, es6: true },
  parserOptions: { ecmaVersion: 2022 },
  globals: {
    $: 'readonly',
    jQuery: 'readonly',
  },
  rules: {
    'no-var': 'off',
    'prefer-const': 'off',
    'vars-on-top': 'off',
    'no-underscore-dangle': 'off',
    'func-names': 'off',
  },
};
