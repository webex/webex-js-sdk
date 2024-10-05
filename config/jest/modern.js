const config = {
  collectCoverageFrom: ['./dist/module/**/*.*'],
  coverageDirectory: './docs/coverage',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  restoreMocks: true,
};

module.exports = config;
