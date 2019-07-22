/* eslint-disable func-names */
/* eslint-disable global-require */
/* eslint-disable require-jsdoc */
/* eslint-disable import/no-dynamic-require */

// eslint-disable-next-line strict


const path = require('path');

const uuidv4 = require('uuid/v4');
const {flatten} = require('lodash');

const makeBrowsers = require('./browsers-ng');
/* eslint-disable global-require */

const CI = (process.env.SC_TUNNEL_IDENTIFIER || process.env.CI || process.env.CIRCLECI || process.env.SAUCE);

module.exports = function configureKarma(config) {
  config.set(makeConfig(process.env.PACKAGE));
};

module.exports.makeConfig = makeConfig;
function makeConfig(packageName, argv) {
  // In case incoming argument is ['Chrome', 'Firefox', 'Safari,ie']
  // Cleanup and return ['Chrome', 'Firefox' 'Safari', 'ie']
  argv.browsers = argv.browsers && flatten(
    argv.browsers.map((browser) => (browser.includes(',') ? browser.toLowerCase().split(',') : browser.toLowerCase()))
  );
  argv.os = argv.os && flatten(
    argv.os.map((os) => (os.includes(',') ? os.toLowerCase().split(',') : os.toLowerCase()))
  );

  const pkg = require(`./packages/node_modules/${packageName}/package`);
  /* eslint complexity: [0] */
  const launchers = makeBrowsers(packageName, argv);
  const integrationTestPath = path.join('packages', 'node_modules', packageName, 'test', 'integration', 'spec', '**', '*.js');
  const unitTestPath = path.join('packages', 'node_modules', packageName, 'test', 'unit', 'spec', '**', '*.js');

  const browsers = () => {
    // Also Karma's/Webdriver's `browserNames` are case-sensitive
    // Reformat since we made `argv.browsers` lowercase earlier
    // so it plays nice with Karma/Webdriver
    const format = (browser) => {
      if (browser.includes('headless')) {
        // `firefoxheadless` -> `firefoxHeadless`
        browser = browser.replace('headless', 'Headless');
      }

      // `chrome` -> `Chrome`
      return browser.charAt(0).toUpperCase() + browser.slice(1);
    };

    // If argv.browsers includes `defaults` as one of it's "params"
    // return a new array with the package's default browsers and the one's the user has specified
    // i.e. ['ChromeHeadless', 'FirefoxHeadless', (<- defaults) 'Safari', 'IE' (<- user specified)]
    if (argv.browsers.includes('defaults') || argv.browsers.includes('default')) {
      return [
        ...Object.keys(launchers),
        ...argv.browsers
          .filter((item) => item !== 'defaults' && item !== 'default')
          .map(format)
      ];
    }

    // If `defaults` isn't supplied then return the user specified browsers
    return argv.browsers.map(format);
  };

  const preprocessors = {
    'packages/**': ['browserify']
  };

  const files = [
    'node_modules/babel-polyfill/dist/polyfill.js'
  ];

  if (!argv || argv.unit) {
    files.push(unitTestPath);
  }
  if (!argv || argv.integration) {
    files.push(integrationTestPath);
  }

  let cfg = {
    basePath: '.',

    browserDisconnectTimeout: 5 * 60 * 1000,

    // Allow the browser to disconnect up to 5 times. Something about
    // plugin-phone and Firefox causes the suite to hang regularly. Restarting
    // the browser seems to fix it, so we need to allow a largish number of
    // restarts.
    browserDisconnectTolerance: 3,

    browsers: argv.browsers && !CI ? browsers() : Object.keys(launchers),

    browserify: {
      debug: true,
      watch: argv && argv.karmaDebug,
      transform: [
        'babelify',
        'envify'
      ]
    },

    // Restart the browser if it stops sending output for a minutes. This goes
    // hand-in-hand with the high disconnect tolerance to deal with Firefox
    // hanging on the plugin-phone suite.
    browserNoActivityTimeout: 8 * 60 * 1000,

    // Inspired by Angular's karma config as recommended by Sauce Labs
    captureTimeout: 0,

    colors: true,

    concurrency: 4,

    customLaunchers: launchers,

    failOnEmptyTestSuite: false, // allow empty or skipped specs (like calendar) to not make karma fail

    files,

    frameworks: [
      'browserify',
      'mocha',
      'chai'
    ],

    hostname: 'localhost',

    client: {
      captureConsole: true,
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
      'mocha'
    ],

    singleRun: !(argv && argv.karmaDebug),

    // video and screenshots add on the request of sauce labs support to help
    // diagnose test user creation timeouts
    recordVideo: true,
    recordScreenshots: true
  };

  if (process.env.COVERAGE && process.env.COVERAGE !== 'undefined') {
    cfg.coverageReporter = {
      instrumenters: {isparta: require('isparta')},
      instrumenter: {
        '**/*.js': 'isparta'
      },
      // includeAllSources: true,
      // instrumenterOptions: {
      //   coverageVariable: makeCoverageVariable(packageName)
      // },
      reporters: [{
        type: 'json',
        dir: `reports/coverage/intermediate/${packageName}`
      }]
    };

    // cfg.browserify.transform.unshift([`browserify-istanbul`, {
    //   instrumenter: require(`isparta`),
    //   defaultIgnore: false
    // }]);

    cfg.reporters.push('coverage');
  }

  if (CI) {
    cfg.transports = ['websocket', 'polling'];

    cfg.sauceLabs = {
      build: process.env.BUILD_NUMBER || `local-${process.env.USER}-${packageName}-${Date.now()}`,
      testName: `${pkg.name || packageName} (karma)`,
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER || uuidv4(),
      recordScreenshots: true,
      recordVideo: true,
      public: 'team',
      startConnect: true,
      connectOptions: {
        noSslBumpDomains: [
          'idbroker.webex.com',
          'idbrokerbts.webex.com',
          '127.0.0.1',
          'localhost',
          '*.wbx2.com',
          '*.ciscospark.com'
        ],
        tunnelDomains: [
          'whistler-prod.onint.ciscospark.com',
          'whistler.onint.ciscospark.com',
          'internal-testing-services.wbx2.com',
          'calendar-whistler.onint.ciscospark.com',
          '127.0.0.1',
          'localhost'
        ],
        verbose: true,
        // retry to establish a tunnel multiple times. (optional)
        connectRetries: 3,
        // time to wait between connection retries in ms. (optional)
        connectRetryTimeout: 2000,
        // retry to download the sauce connect archive multiple times. (optional)
        downloadRetries: 4,
        // time to wait between download retries in ms. (optional)
        downloadRetryTimeout: 1000
      }
    };

    cfg.junitReporter = {
      outputFile: `${packageName}.xml`,
      outputDir: 'reports/junit/karma',
      suite: packageName,
      useBrowserName: true,
      recordScreenshots: true,
      recordVideo: true
    };

    cfg.reporters.push('saucelabs');
    cfg.reporters.push('junit');
  }

  try {
    cfg = require(`./packages/node_modules/${packageName}/karma.conf.js`)(cfg);
  }
  catch (error) {
    // ignore
  }

  return cfg;
}
