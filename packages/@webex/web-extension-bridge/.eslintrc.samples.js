/*!
 * Standalone config for the samples under `docs/samples/`. The repo-root ESLint
 * config ignores `docs/**`, and AC5 requires the security rules to cover the
 * samples too, so `test:style` lints them with `--no-eslintrc -c` against this file.
 */

const securityRules = require('./eslint-security-rules');

const config = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    serviceworker: true,
    webextensions: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script',
  },
  globals: {
    WebExtensionBridge: 'readonly',
    WebExtensionBridgeBackground: 'readonly',
    WebExtensionBridgeClient: 'readonly',
  },
  rules: {
    ...securityRules,
    'no-undef': 'error',
    'no-unused-vars': 'error',
  },
};

module.exports = config;
