module.exports = {
  env: {
    node: true
  },
  plugins: [
    'mocha'
  ],
  rules: {
    'mocha/no-exclusive-tests': 'error'
  }
};
