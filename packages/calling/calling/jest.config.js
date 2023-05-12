const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  // Clear mocks in between tests by default
  clearMocks: true,
  collectCoverage: true,
  // TODO: Increase thresholds to 85% as project is maintained
  // TODO: remove the thresholds for individual files.
  coverageThreshold: {
    global: {
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
    },
    'src/Events/impl': {
      lines: 80,
      functions: 65,
      statements: 80,
    },
    'src/Logger': {
      lines: 75,
      functions: 85,
      statements: 75,
    },
    'src/Voicemail': {
      lines: 40,
      functions: 30,
      statements: 40,
    },
    'src/Hooks': {
      lines: 50,
      functions: 0,
      statements: 50,
    },
    'src/SDKConnector': {
      lines: 60,
      functions: 60,
      statements: 60,
    },
    'src/CallHistory': {
      statements: 55,
      functions: 75,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['clover', 'json', 'lcov'],
  transformIgnorePatterns: ['/node_modules/(?!(@webex/internal-media-core)/)'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage/junit',
        outputName: 'coverage-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './coverage',
        filename: 'jest-report.html',
        openReport: false,
      },
    ],
  ],
  rootDir: path.resolve(__dirname),
  setupFilesAfterEnv: ['<rootDir>/jest-preload.js', '<rootDir>/jest.expectExtensions.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testResultsProcessor: 'jest-junit',
};
