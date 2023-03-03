const config = {
  branches: 80,
  checkCoverage: true,
  clean: true,
  exclude: [
    '*.config.*',
    '**/test/**/*.*',
  ],
  functions: 80,
  lines: 80,
  perFile: true,
  reportDir: './test/coverage',
  statements: 80,
  tempDir: './test/coverage/temp',
};

module.exports = config;
