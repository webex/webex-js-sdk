// eslint-disable-next-line strict
'use strict';
const path = require(`path`);

module.exports = function(config) {
  const pkg = require(`./packages/${process.env.PACKAGE}/package`);
  /* eslint complexity: [0] */
  const browsers = require(`./browsers-ng`);
  const launchers = process.env.SC_TUNNEL_IDENTIFIER ? browsers.sauce : browsers.local;
  const srcPath = path.join(`packages`, process.env.PACKAGE, `src`, `**`, `*.js`);
  const integrationTestPath = path.join(`packages`, process.env.PACKAGE, `test`, `integration`, `spec`, `**`, `*.js`);
  const unitTestPath = path.join(`packages`, process.env.PACKAGE, `test`, `unit`, `spec`, `**`, `*.js`);

  const preprocessors = {};
  preprocessors[srcPath] = [`browserify`];
  preprocessors[integrationTestPath] = [`browserify`];
  preprocessors[unitTestPath] = [`browserify`];

  let cfg = {
    basePath: `.`,

    browserDisconnectTimeout: 10000,

    browserDisconnectTolerance: 3,

    browsers: process.env.SC_TUNNEL_IDENTIFIER ? Object.keys(launchers) : Object.keys(browsers.local),

    browserify: {
      debug: true,
      watch: true,
      transform: [
        `babelify`,
        `envify`
      ]
    },

    browserNoActivityTimeout: 240000,

    // Inspired by Angular's karma config as recommended by Sauce Labs
    captureTimeout: 0,

    colors: !process.env.XUNIT,

    concurrency: 3,

    customLaunchers: launchers,

    files: (function() {
      const files = [
        integrationTestPath,
        unitTestPath
      ];
      return files;
    }()),

    frameworks: [
      `browserify`,
      `mocha`
    ],

    hostname: `127.0.0.1`,

    client: {
      mocha: {
        // TODO figure out how to report retries
        retries: process.env.JENKINS || process.env.CI ? 1 : 0,
        timeout: 30000
      }
    },

    mochaReporter: {
      // Hide the skipped tests on jenkins to more easily see which tests failed
      ignoreSkipped: true
    },

    port: parseInt(process.env.KARMA_PORT) || 9001,

    preprocessors,

    proxies: {
      '/fixtures/': `http://127.0.0.1:${process.env.FIXTURE_PORT}/`,
      '/upload': `http://127.0.0.1:${process.env.FIXTURE_PORT}/upload`
    },

    reporters: [
      `mocha`
    ],

    singleRun: !process.env.KARMA_DEBUG,

    // video and screenshots add on the request of sauce labs support to help
    // diagnose test user creation timeouts
    recordVideo: true,
    recordScreenshots: true
  };

  if (process.env.COVERAGE && process.env.COVERAGE !== `undefined`) {
    cfg.coverageReporter = {
      reporters: [{
        type: `json`,
        dir: `reports/coverage/${process.env.PACKAGE}`
      }]
    };

    cfg.browserify.transform.unshift([`browserify-istanbul`, {
      ignore: [`test-helper*/**`, `**/dist/**`],
      instrumenter: require(`isparta`)
    }]);

    cfg.reporters.push(`coverage`);
  }

  if (process.env.SC_TUNNEL_IDENTIFIER) {
    cfg.sauceLabs = {
      build: process.env.BUILD_NUMBER || `local-${process.env.USER}-${process.env.PACKAGE}-${Date.now()}`,
      startConnect: false,
      testName: `${pkg.name} (karma)`,
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER,
      recordScreenshots: true,
      recordVideo: true
    };
    cfg.reporters.push(`saucelabs`);
  }

  if (process.env.XUNIT) {
    cfg.junitReporter = {
      outputFile: `karma-${process.env.PACKAGE}.xml`,
      outputDir: process.env.XUNIT_DIR || `reports/junit`,
      suite: process.env.PACKAGE,
      useBrowserName: true,
      recordScreenshots: true,
      recordVideo: true
    };

    cfg.reporters.push(`junit`);
  }

  try {
    cfg = require(`./packages/${process.env.PACKAGE}/karma.conf.js`)(cfg);
  }
  catch (error) {
    // ignore
  }

  config.set(cfg);
};
