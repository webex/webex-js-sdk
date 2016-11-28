'use strict';

var path = require('path');

var options = {
  testPathPattern: '.*.test.js',
  coverage: process.env.COVERAGE,
  config: {
    coverageDirectory: './reports/coverage-final/' + process.env.PACKAGE,
    coverageReporters: [
      'json',
      'text'
    ],
    setupFiles: ['<rootDir>/test/env-script.js'],
    coveragePathIgnorePatterns: ['setup-jasmine-env.js'],
    setupTestFrameworkScriptFile: path.join(__dirname, 'setup-jasmine-env.js'),
    moduleNameMapper: {
      '^.+\\.(css|less)$': '<rootDir>/test/style-mock.js',
      '^.+\\.(gif|ttf|eot|svg)$': '<rootDir>/test/file-mock.js'
    },
    rootDir: path.join('packages', process.env.PACKAGE)
  },
  verbose: true
};

if (process.env.CI || process.env.JENKINS_URL) {
  options.runInBand = true;
}

module.exports = options;
