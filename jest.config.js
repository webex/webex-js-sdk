'use strict';

var path = require('path');

module.exports = {
  testPathPattern: '.*.test.js',
  coverage: process.env.COVERAGE,
  config: {
    coverageDirectory: './reports/coverage-final/' + process.env.PACKAGE,
    coverageReporters: [
      'json',
      'text'
    ],
    coveragePathIgnorePatterns: ['setup-jasmine-env.js'],
    setupTestFrameworkScriptFile: path.join(__dirname, 'setup-jasmine-env.js'),
    moduleNameMapper: {
      '^.+\\.(css|less)$': '<rootDir>/test/styleMock.js',
      '^.+\\.(gif|ttf|eot|svg)$': '<rootDir>/test/fileMock.js'
    },
    rootDir: path.join('packages', process.env.PACKAGE)
  },
  verbose: true
};
