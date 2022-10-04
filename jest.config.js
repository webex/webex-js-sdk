const {forEach} = require('lodash');

const packages = [
  '@webex/common',
  '@webex/common-evented',
  '@webex/common-timers',
  '@webex/helper-html',
  '@webex/helper-image',
  '@webex/http-core',
  '@webex/internal-plugin-avatar',
  '@webex/internal-plugin-board',
  '@webex/internal-plugin-calendar',
  '@webex/internal-plugin-conversation',
  '@webex/internal-plugin-device',
  '@webex/internal-plugin-dss',
  '@webex/internal-plugin-ediscovery',
  '@webex/internal-plugin-encryption',
  '@webex/internal-plugin-feature',
  '@webex/internal-plugin-flag',
  '@webex/internal-plugin-llm',
  '@webex/internal-plugin-locus',
  '@webex/internal-plugin-lyra',
  '@webex/internal-plugin-mercury',
  '@webex/internal-plugin-metrics',
  '@webex/internal-plugin-presence',
  '@webex/internal-plugin-search',
  '@webex/internal-plugin-support',
  '@webex/internal-plugin-team',
  '@webex/internal-plugin-user',
  '@webex/internal-plugin-voicea',
  '@webex/internal-plugin-wdm',
  '@webex/jsdoctrinetest',
  '@webex/plugin-attachment-actions',
  '@webex/plugin-authorization',
  '@webex/plugin-authorization-browser',
  '@webex/plugin-authorization-browser-first-party',
  '@webex/plugin-authorization-node',
  '@webex/plugin-device-manager',
  '@webex/plugin-logger',
  '@webex/plugin-meetings',
  '@webex/plugin-memberships',
  '@webex/plugin-messages',
  '@webex/plugin-people',
  '@webex/plugin-rooms',
  '@webex/plugin-team-memberships',
  '@webex/plugin-teams',
  '@webex/plugin-webhooks',
  '@webex/recipe-private-web-client',
  '@webex/storage-adapter-local-forage',
  '@webex/storage-adapter-local-storage',
  '@webex/storage-adapter-session-storage',
  '@webex/storage-adapter-spec',
  '@webex/test-helper-appid',
  '@webex/test-helper-automation',
  '@webex/test-helper-chai',
  '@webex/test-helper-file',
  '@webex/test-helper-make-local-url',
  '@webex/test-helper-mocha',
  '@webex/test-helper-mock-web-socket',
  '@webex/test-helper-mock-webex',
  '@webex/test-helper-refresh-callback',
  '@webex/test-helper-retry',
  '@webex/test-helper-server',
  '@webex/test-helper-test-users',
  '@webex/test-users',
  '@webex/webex-core',
  '@webex/webex-server',
  '@webex/webrtc',
  '@webex/xunit-with-logs',
  'webex'
];

const packagesWithSetup = [
  '@webex/plugin-meetings'
];

const jestProject = [];

packages.forEach((packageName) => {
  const config = {
    transform: {
      '\\.[jt]sx?$': ['babel-jest', {rootMode: 'upward'}],
    },
    preset: 'ts-jest',
    testEnvironment: 'node',
    displayName: packageName,

    testMatch: [
      `<rootDir>/packages/${packageName}/test/unit/**/!(lib|fixture)/*.[jt]s`
    ]
  };

  if (packagesWithSetup.includes(packageName)) {
    config.setupFiles = [`<rootDir>/packages/${packageName}/jest.setup.js`];
  }

  jestProject.push(config);
});


module.exports = {
  clearMocks: true,
  rootDir: './',
  testEnvironment: 'jsdom',
  collectCoverage: true,
  coverageReporters: ['lcov', 'cobertura'],
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {rootMode: 'upward'}],
  },
  projects: jestProject,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './coverage/junit',
        outputName: 'coverage-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html',
        filename: 'jest-result.html',
      },
    ],
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testResultsProcessor: 'jest-junit',
};
