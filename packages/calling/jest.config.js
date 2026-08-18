const config = require('@webex/jest-config-legacy');

const path = require('path');

const jestConfig = {
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
      branches: 80,
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
    'src/SDKConnector': {
      lines: 60,
      functions: 55,
      statements: 60,
    },
    'src/CallHistory': {
      statements: 55,
      functions: 75,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['clover', 'json', 'lcov'],
  transformIgnorePatterns: [
    '/node_modules/(?!(@webex/internal-media-core|@webex/media-helpers|@webex/test-helper-mock-web-socket|@webex/common-timers)/)/',
  ],
  testMatch: ['<rootDir>/src/**/*.test.[jt]s'],
  moduleNameMapper: {
    '^uuid$': 'uuid',
    '^@webex/media-helpers$': '<rootDir>/../../node_modules/@webex/media-helpers/src/index.ts',
    '^@webex/internal-plugin-metrics$': '<rootDir>/test/mocks/internal-plugin-metrics-stub.js',
    '^@webex/internal-plugin-device$': '<rootDir>/test/mocks/empty-stub.js',
    '^@webex/internal-plugin-feature$': '<rootDir>/test/mocks/empty-stub.js',
    '^@webex/(test-helper-[^/]+)$': '<rootDir>/../../node_modules/@webex/$1/src/index.js',
    '^@webex/common$': '<rootDir>/../../node_modules/@webex/common/src/index.js',
    '^@webex/common-timers$': '<rootDir>/../../node_modules/@webex/common-timers/src/index.ts',
  },
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

module.exports = {...config, ...jestConfig};
