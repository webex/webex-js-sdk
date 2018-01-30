/* eslint-disable func-names */
/* eslint-disable global-require */
/* eslint-disable require-jsdoc */

// eslint-disable-next-line strict
'use strict';

const path = require(`path`);
const makeBrowsers = require(`./browsers-ng`);
/* eslint-disable global-require */

module.exports = function configureKarma(config) {
  config.set(makeConfig(process.env.PACKAGE));
};

module.exports.makeConfig = makeConfig;
function makeConfig(packageName, argv) {
  const pkg = require(`./packages/node_modules/${packageName}/package`);
  /* eslint complexity: [0] */
  const launchers = makeBrowsers(packageName, argv);
  const integrationTestPath = path.join(`packages`, `node_modules`, packageName, `test`, `integration`, `spec`, `**`, `*.js`);
  const unitTestPath = path.join(`packages`, `node_modules`, packageName, `test`, `unit`, `spec`, `**`, `*.js`);

  const preprocessors = {
    'packages/**': [`browserify`]
  };

  const files = [
    `node_modules/babel-polyfill/dist/polyfill.js`
  ];

  if (!argv || argv.unit) {
    files.push(unitTestPath);
  }
  if (!argv || argv.integration) {
    files.push(integrationTestPath);
  }

  let cfg = {
    basePath: `.`,

    browserDisconnectTimeout: 20000,

    // Allow the browser to disconnect up to 5 times. Something about
    // plugin-phone and Firefox causes the suite to hang regularly. Restarting
    // the browser seems to fix it, so we need to allow a largish number of
    // restarts.
    browserDisconnectTolerance: 5,

    browsers: Object.keys(launchers),

    browserify: {
      debug: true,
      watch: argv && argv.karmaDebug,
      transform: [
        `babelify`,
        `envify`
      ]
    },

    browserConsoleLogOptions: {
      terminal: !(process.env.JENKINS || process.env.CI)
    },

    // Restart the browser if it stops sending output for a minutes. This goes
    // hand-in-hand with the high disconnect tolerance to deal with Firefox
    // hanging on the plugin-phone suite.
    browserNoActivityTimeout: 1 * 60 * 1000,

    // Inspired by Angular's karma config as recommended by Sauce Labs
    captureTimeout: 0,

    colors: !(argv && argv.xunit),

    concurrency: 3,

    customLaunchers: launchers,

    files,

    frameworks: [
      `browserify`,
      `mocha`
    ],

    hostname: `localhost`,

    client: {
      mocha: {
        bail: argv.bail,
        // TODO figure out how to report retries
        retries: process.env.JENKINS || process.env.CI ? 1 : 0,
        timeout: 30000,
        grep: argv && argv.grep[0]
      }
    },

    mochaReporter: {
      // Hide the skipped tests on jenkins to more easily see which tests failed
      ignoreSkipped: true
    },

    port: parseInt(process.env.KARMA_PORT, 10) || 9001,

    preprocessors,

    proxies: {
      '/fixtures/': `http://localhost:${process.env.FIXTURE_PORT}/`,
      '/upload': `http://localhost:${process.env.FIXTURE_PORT}/upload`
    },

    reporters: [
      `mocha`
    ],

    singleRun: !(argv && argv.karmaDebug),

    // video and screenshots add on the request of sauce labs support to help
    // diagnose test user creation timeouts
    recordVideo: true,
    recordScreenshots: true
  };

  if (process.env.COVERAGE && process.env.COVERAGE !== `undefined`) {
    cfg.coverageReporter = {
      instrumenters: {isparta: require(`isparta`)},
      instrumenter: {
        '**/*.js': `isparta`
      },
      // includeAllSources: true,
      // instrumenterOptions: {
      //   coverageVariable: makeCoverageVariable(packageName)
      // },
      reporters: [{
        type: `json`,
        dir: `reports/coverage/intermediate/${packageName}`
      }]
    };

    // cfg.browserify.transform.unshift([`browserify-istanbul`, {
    //   instrumenter: require(`isparta`),
    //   defaultIgnore: false
    // }]);

    cfg.reporters.push(`coverage`);
  }

  if (process.env.SC_TUNNEL_IDENTIFIER) {
    cfg.sauceLabs = {
      build: process.env.BUILD_NUMBER || `local-${process.env.USER}-${packageName}-${Date.now()}`,
      startConnect: false,
      testName: `${pkg.name} (karma)`,
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER,
      recordScreenshots: true,
      recordVideo: true
    };
    cfg.reporters.push(`saucelabs`);
  }

  if (argv && argv.xunit) {
    cfg.junitReporter = {
      outputFile: `${packageName}.xml`,
      outputDir: `reports/junit/karma`,
      suite: packageName,
      useBrowserName: true,
      recordScreenshots: true,
      recordVideo: true
    };

    cfg.reporters.push(`junit`);
  }

  try {
    cfg = require(`./packages/node_modules/${packageName}/karma.conf.js`)(cfg);
  }
  catch (error) {
    // ignore
  }

  return cfg;
}
