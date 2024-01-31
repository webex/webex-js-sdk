const config = {
  collectCoverageFrom: ['./dist/module/**/*.*'],
  coverageDirectory: './dist/docs/coverage',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

module.exports = config;
