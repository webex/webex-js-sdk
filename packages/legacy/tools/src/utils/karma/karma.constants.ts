/**
 * Core configuration Object for Karma.
 *
 * @public
 */
const CONFIG = {
  basePath: '.',
  browserDisconnectTimeout: 5 * 60 * 1000,
  browserDisconnectTolerance: 3,
  browserify: {
    debug: true,
    extensions: ['.ts', '.js'],
    transform: [
      'babelify',
      'envify',
    ],
  },
  browserNoActivityTimeout: 8 * 60 * 1000,
  captureTimeout: 0,
  colors: true,
  concurrency: 4,
  failOnEmptyTestSuite: false,
  frameworks: ['browserify', 'mocha', 'chai'],
  hostname: 'localhost',
  logLevel: process.env.KARMA_LOG_LEVEL || 'INFO',
  browserConsoleLogOptions: {
    level: 'warn',
  },
  client: {
    captureConsole: true,
    mocha: {
      bail: true,
      retries: 0,
      timeout: 30000,
    },
  },
  mochaReporter: {
    ignoreSkipped: true,
  },
  port: 9001,
  preprocessors: {
    './**': ['browserify'],
  },
  proxies: {},
  reporters: ['mocha'],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
