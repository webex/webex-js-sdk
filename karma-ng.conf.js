'use strict';

var path = require('path');

module.exports = function(config) {
  var pkg = require('./packages/' + process.env.PACKAGE + '/package');
  /* eslint complexity: [0] */
  var browsers = require('./browsers-ng');
  var launchers = Object.keys(browsers).reduce(function(launchers, browserType) {
    if (browserType === 'local') {
      return launchers;
    }

    Object.keys(browsers[browserType]).forEach(function(browserKey) {
      launchers[browserKey] = browsers[browserType][browserKey];
    });

    return launchers;
  }, {});

  var srcPath = path.join('packages', process.env.PACKAGE, 'src', '**', '*.js');
  var integrationTestPath = path.join('packages', process.env.PACKAGE, 'test', 'integration', 'spec', '**', '*.js');
  var unitTestPath = path.join('packages', process.env.PACKAGE, 'test', 'unit', 'spec', '**', '*.js');

  var preprocessors = {};
  preprocessors[srcPath] = ['browserify'];
  preprocessors[integrationTestPath] = ['browserify'];
  preprocessors[unitTestPath] = ['browserify'];

  var cfg = {
    basePath: '.',

    browserDisconnectTimeout: 10000,

    browserDisconnectTolerance: 3,

    browsers: process.env.SC_TUNNEL_IDENTIFIER ? Object.keys(launchers) : Object.keys(browsers.local),

    browserify: {
      debug: true,
      watch: true,
      transform: [
        'babelify',
        'envify'
      ]
    },

    browserNoActivityTimeout: 240000,

    // Inspired by Angular's karma config as recommended by Sauce Labs
    captureTimeout: 0,

    colors: !process.env.XUNIT,

    customLaunchers: launchers,

    files: (function() {
      var files = [
        integrationTestPath,
        unitTestPath
      ];
      return files;
    }()),

    frameworks: [
      'browserify',
      'mocha'
    ],

    hostname: '127.0.0.1',

    client: {
      mocha: {
        // TODO figure out how to report retries
        retries: (process.env.JENKINS || process.env.CI) ? 1 : 0,
        timeout: 30000
      }
    },

    mochaReporter: {
      // Hide the skipped tests on jenkins to more easily see which tests failed
      ignoreSkipped: true
    },

    port: parseInt(process.env.KARMA_PORT) || 9001,

    preprocessors: preprocessors,

    proxies: {
      '/fixtures/': 'http://127.0.0.1:' + process.env.FIXTURE_PORT + '/',
      '/upload': 'http://127.0.0.1:' + process.env.FIXTURE_PORT + '/upload'
    },

    reporters: [
      'mocha'
    ],

    singleRun: !process.env.KARMA_DEBUG
  };

  if (process.env.COVERAGE && process.env.COVERAGE !== 'undefined') {
    cfg.coverageReporter = {
      reporters: [{
        type: 'json',
        dir: 'reports/coverage/' + process.env.PACKAGE
      }]
    };

    cfg.browserify.transform.unshift(['browserify-istanbul', {
      ignore: ['test-helper*/**', '**/dist/**'],
      instrumenter: require('isparta')
    }]);

    cfg.reporters.push('coverage');
  }

  if (process.env.SC_TUNNEL_IDENTIFIER) {
    cfg.sauceLabs = {
      build: process.env.BUILD_NUMBER || ('local-' + process.env.USER + '-' + process.env.PACKAGE + '-' + Date.now()),
      startConnect: false,
      testName: pkg.name + ' (karma)',
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER
    };
    cfg.reporters.push('saucelabs');
  }

  if (process.env.XUNIT) {
    cfg.junitReporter = {
      outputFile: 'karma-' + process.env.PACKAGE + '.xml',
      outputDir: process.env.XUNIT_DIR || 'reports/junit',
      suite: process.env.PACKAGE,
      useBrowserName: true
    };

    cfg.reporters.push('junit');
  }

  try {
    cfg = require('./packages/' + process.env.PACKAGE + '/karma.conf.js')(cfg);
  }
  catch (error) {
    // ignore
  }

  config.set(cfg);
};
