module.exports = {
  root: true,
  ignorePatterns: ['*.d.ts'],
  env: {
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-console': 'off',
    'no-plusplus': 'off',
  },
};
