const securityRules = require('./eslint-security-rules');

const config = {
  root: true,
  extends: ['@webex/eslint-config-legacy'],
  rules: {
    ...securityRules,
    'no-console': 'error',
    // Matches the repo-root config, which applies these only to `*.js`. In
    // TypeScript the signature is the type declaration; a second copy in JSDoc has
    // nothing checking it and drifts.
    'valid-jsdoc': 'off',
    'require-jsdoc': 'off',
    // A constructor holding only TypeScript parameter properties is not useless.
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',
    // `void promise` is how this package marks a deliberately un-awaited call, which
    // matters in fire-and-forget paths where an unhandled rejection would surface in
    // the host page's console.
    'no-void': ['error', {allowAsStatement: true}],
  },
};

module.exports = config;
