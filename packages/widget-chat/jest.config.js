var path = require('path');

module.exports = {
  testPathPattern: /.*.test.js/,
  coverage: process.env.COVERAGE,
  config: {
    coverageDirectory: path.join(__dirname, '.coverage')
  },
  verbose: true
};
