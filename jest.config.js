'use strict';

var path = require('path');

module.exports = {
  testPathPattern: /.*.test.js/,
  coverage: process.env.COVERAGE,
  config: {
    coverageDirectory: './reports/coverage-final/' + process.env.PACKAGE,
    coverageReporters: [
      'json',
      'text'
    ],
    coveragePathIgnorePatterns: ['setup-jasmine-env.js'],
    setupTestFrameworkScriptFile: path.join(__dirname, 'setup-jasmine-env.js')
  },
  rootDir: path.join(process.env.PACKAGE, 'src'),
  verbose: true
};
