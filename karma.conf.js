'use strict';

var pkg = require('./package');

module.exports = function(config) {
  var browsers = require('./browsers');
  var launchers = Object.keys(browsers).reduce(function(launchers, browserType) {
    if (browserType === 'local') {
      return launchers;
    }

    Object.keys(browsers[browserType]).forEach(function(browserKey) {
      launchers[browserKey] = browsers[browserType][browserKey];
    });

    return launchers;
  }, {});

  var cfg = {
    basePath: '.',

    browserDisconnectTimeout: 10000,

    browsers: process.env.SC_TUNNEL_IDENTIFIER ? Object.keys(launchers) : Object.keys(browsers.local),

    browserDisconnectTolerance: 3,

    browserify: {
      debug: true,
      watch: true,
      transform: [
        'envify'
      ]
    },

    browserNoActivityTimeout: 240000,

    // Inspired by Angular's karma config as recommended by Sauce Labs
    captureTimeout: 0,

    colors: !process.env.XUNIT,

    customLaunchers: launchers,

    files: [
      'test/unit/spec/**/*.js',
      'test/integration/spec/**/*.js'
    ],

    frameworks: [
      'browserify',
      'mocha'
    ],

    hostname: '127.0.0.1',

    client: {
      mocha: {
        retries: (process.env.JENKINS || process.env.CI) ? 1 : 0,
        timeout: 30000
      }
    },

    mochaReporter: {
      // Hide the skipped tests on jenkins to more easily see which tests failed
      ignoreSkipped: true
    },

    port: parseInt(process.env.KARMA_PORT) || 9001,

    preprocessors: {
      'src/**/*.js': ['browserify'],
      'test/unit/spec/**/*.js': ['browserify'],
      'test/integration/spec/**/*.js': ['browserify']
    },

    proxies: {
      '/fixtures/': 'http://127.0.0.1:' + process.env.FIXTURE_PORT + '/',
      '/upload': 'http://127.0.0.1:' + process.env.FIXTURE_PORT + '/upload'
    },

    reporters: [
      'mocha'
    ],

    singleRun: true
  };

  if (process.env.COVERAGE && process.env.COVERAGE !== 'undefined') {
    cfg.coverageReporter = {
      reporters: [{
        type: 'json',
        dir: 'reports/coverage/legacy'
      }]
    };

    cfg.browserify.transform.push('browserify-istanbul');

    cfg.reporters.push('coverage');
  }

  if (process.env.SC_TUNNEL_IDENTIFIER) {
    cfg.sauceLabs = {
      build: process.env.BUILD_NUMBER || ('local-' + process.env.USER + '-' + Date.now()),
      startConnect: false,
      testName: pkg.name + ' (karma)',
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER
    };
    cfg.reporters.push('saucelabs');
  }

  if (process.env.XUNIT) {
    cfg.junitReporter = {
      outputFile: 'karma-legacy.xml',
      outputDir: process.env.XUNIT_DIR || 'reports/junit',
      suite: 'karma-legacy',
      useBrowserName: true
    };

    cfg.reporters.push('junit');
  }

  config.set(cfg);
};
