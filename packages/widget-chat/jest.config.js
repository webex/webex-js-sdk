/* eslint-disable */
var path = require('path');

module.exports = {
  testPathPattern: `.*.test.js`,
  coverage: process.env.COVERAGE,
  config: {
    coverageDirectory: path.join(__dirname, '.coverage'),
    coveragePathIgnorePatterns: ['setup-jasmine-env.js'],
    setupTestFrameworkScriptFile: path.join(__dirname, 'setup-jasmine-env.js'),
    moduleNameMapper: {
      "^.+\\.(css|less)$": `<rootDir>/test/styleMock.js`,
      "^.+\\.(gif|ttf|eot|svg)$": `<rootDir>/test/fileMock.js`
    }
  },
  verbose: true
};
