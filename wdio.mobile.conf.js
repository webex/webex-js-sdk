/* eslint-disable no-console */
/* global browser: false */

require('babel-register');

const path = require('path');

const dotenv = require('dotenv');
const glob = require('glob');
const sauceConnectLauncher = require('sauce-connect-launcher');
const uuidv4 = require('uuid/v4');

const SauceService = require('./tooling/wdio-sauce-service');

dotenv.config();
dotenv.config({path: '.env.default'});

// Webdriver is only called for testing samples so force integration URLs w/ Webpack
const webpackConfig = require('./webpack.config')();

require('babel-register')({
  only: [
    './packages/node_modules/**/*.js'
  ],
  sourceMaps: true
});

const PORT = process.env.PORT || 8000;
const LOCALHOST_ALIAS = process.env.LOCALHOST_ALIAS || 'localhostalias';

exports.config = {
  protocol: 'https',
  host: 'us1-manual.app.testobject.com',
  port: 443,
  path: '/wd/hub',
  //
  // ==================
  // Specify Test Files
  // ==================
  // Define which test specs should run. The pattern is relative to the directory
  // from which `wdio` was called. Notice that, if you are calling `wdio` from an
  // NPM script (see https://docs.npmjs.com/cli/run-script) then the current working
  // directory is where your package.json resides, so `wdio` will be called from there.
  //
  specs: [
    './wdio.helpers.d/**/*.js',
    './packages/node_modules/{*,*/*}/test/wdio/spec/**/*.js'
  ],
  suites: glob
    .sync('**/package.json', {cwd: './packages/node_modules'})
    .map((p) => path.dirname(p))
    .reduce((suites, p) => {
      suites[p] = [
        `./packages/node_modules/${p}/test/wdio/spec/**/*.js`
      ];

      return suites;
    }, {}),
  //
  // ============
  // Capabilities
  // ============
  // Define your capabilities here. WebdriverIO can run multiple capabilities at the same
  // time. Depending on the number of capabilities, WebdriverIO launches several test
  // sessions. Within your capabilities you can overwrite the spec and exclude options in
  // order to group specific specs to a specific capability.
  //
  // First, you can define how many instances should be started at the same time. Let's
  // say you have 3 different capabilities (Chrome, Firefox, and Safari) and you have
  // set maxInstances to 1; wdio will spawn 3 processes. Therefore, if you have 10 spec
  // files and you set maxInstances to 10, all spec files will get tested at the same time
  // and 30 processes will get spawned. The property handles how many capabilities
  // from the same test should run tests.
  //
  maxInstances: 10,
  //
  // If you have trouble getting all important capabilities together, check out the
  // Sauce Labs platform configurator - a great tool to configure your capabilities:
  // https://docs.saucelabs.com/reference/platforms-configurator
  //
  capabilities: {
    browserSpock: {
      desiredCapabilities: {
        deviceName: 'iPhone.*',
        platformVersion: '13',
        platformName: 'iOS',
        newCommandTimeout: '90'
      }
    },
    browserMccoy: {
      desiredCapabilities: {
        deviceName: 'Samsung Galaxy.*',
        platformVersion: '9',
        platformName: 'Android',
        newCommandTimeout: '90',
        'goog:chromeOptions': {
          w3c: false
        }
      }
    }
  },
  //
  // ===================
  // Test Configurations
  // ===================
  // Define all options that are relevant for the WebdriverIO instance here
  //
  // By default WebdriverIO commands are executed in a synchronous way using
  // the wdio-sync package. If you still want to run your tests in an async way
  // e.g. using promises you can set the sync option to false.
  sync: true,
  //
  // Level of logging verbosity: silent | verbose | command | data | result | error
  logLevel: 'error',
  //
  // Warns when a deprecated command is used
  //
  // Enables colors for log output.
  coloredLogs: true,
  //
  // If you only want to run your tests until a specific amount of tests have failed use
  // bail (default is 0 - don't bail, run all tests).
  bail: 0,
  //
  // Saves a screenshot to a given path if a command fails.
  screenshotPath: './reports/screenshots/',
  //
  // Set a base URL in order to shorten url command calls. If your url parameter starts
  // with "/", then the base url gets prepended.
  baseUrl: `http://${LOCALHOST_ALIAS}:${PORT}/`,
  //
  // Default timeout for all waitFor* commands.
  waitforTimeout: 15000,
  //
  // Default timeout in milliseconds for request
  // if Selenium Grid doesn't send response
  connectionRetryTimeout: 90000,
  //
  // Default request retries count
  connectionRetryCount: 3,
  //
  // Debugging
  debug: !process.env.CI,
  //
  // Initialize the browser instance with a WebdriverIO plugin. The object should have the
  // plugin name as key and the desired plugin options as properties. Make sure you have
  // the plugin installed before running any tests. The following plugins are currently
  // available:
  // WebdriverCSS: https://github.com/webdriverio/webdrivercss
  // WebdriverRTC: https://github.com/webdriverio/webdriverrtc
  // Browserevent: https://github.com/webdriverio/browserevent
  // plugins: {
  //     webdrivercss: {
  //         screenshotRoot: 'my-shots',
  //         failedComparisonsRoot: 'diffs',
  //         misMatchTolerance: 0.05,
  //         screenWidth: [320,480,640,1024]
  //     },
  //     webdriverrtc: {},
  //     browserevent: {}
  // },
  //
  // Test runner services
  // Services take over a specific job you don't want to take care of. They enhance
  // your test setup with almost no effort. Unlike plugins, they don't add new
  // commands. Instead, they hook themselves up into the test process.
  services: [
    SauceService,
    'static-server',
    'webpack'
  ],
  staticServerFolders: [
    {mount: '/', path: './packages/node_modules/samples'},
    {mount: '/', path: '.'}
  ],
  staticServerPort: PORT,
  webpackConfig,
  //
  // Framework you want to run your specs with.
  // The following are supported: Mocha, Jasmine, and Cucumber
  // see also: http://webdriver.io/guide/testrunner/frameworks.html
  //
  // Make sure you have the wdio adapter package for the specific framework installed
  // before running any tests.
  framework: 'mocha',
  //
  // Test reporter for stdout.
  // The only one supported by default is 'dot'
  // see also: http://webdriver.io/guide/testrunner/reporters.html
  reporters: ['spec', 'junit'],
  reporterOptions: {
    junit: {
      outputDir: './reports/junit/wdio'
    }
  },
  //
  // Options to be passed to Mocha.
  // See the full list at http://mochajs.org/
  mochaOpts: {
    // reminder: mocha-steps seems to make tests flaky on Sauce Labs
    timeout: 80000,
    ui: 'bdd'
  },
  //
  // =====
  // Hooks
  // =====
  // WebdriverIO provides several hooks you can use to interfere with the test process in order to enhance
  // it and to build services around it. You can either apply a single function or an array of
  // methods to it. If one of them returns with a promise, WebdriverIO will wait until that promise got
  // resolved to continue.
  /**
   * Gets executed once before all workers get launched.
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @returns {Promise}
   */
  onPrepare(config, capabilities) {
    const buildNumber = process.env.BUILD_NUMBER || `local-${process.env.USER}-wdio-${Date.now()}`;
    const tunnelIdentifier = process.env.SC_TUNNEL_IDENTIFIER || uuidv4();
    // const tunnelIdentifier = 'my_tunnel';

    Object.keys(capabilities).forEach((browser) => {
      capabilities[browser].desiredCapabilities.testobject_api_key = process.env.TESTOBJECT_API_KEY;
      capabilities[browser].desiredCapabilities.tunnelIdentifier = tunnelIdentifier;
      capabilities[browser].desiredCapabilities.build = buildNumber;
      capabilities[browser].desiredCapabilities.appiumVersion = '1.15.0';
    });

    return new Promise((resolve, reject) => sauceConnectLauncher({
      username: process.env.SAUCE_USERNAME,
      accessKey: process.env.SAUCE_RDC_ACCESS_KEY,
      x: 'https://us1.api.testobject.com/sc/rest/v1',
      noSslBumpDomains: [
        'idbroker.webex.com',
        'idbrokerbts.webex.com',
        'localhostalias',
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
        'localhostalias',
        '127.0.0.1',
        'localhost'
      ],
      verbose: true,
      tunnelIdentifier,
      // retry to establish a tunnel multiple times. (optional)
      connectRetries: 3,
      // time to wait between connection retries in ms. (optional)
      connectRetryTimeout: 2000,
      // retry to download the sauce connect archive multiple times. (optional)
      downloadRetries: 4,
      // time to wait between download retries in ms. (optional)
      downloadRetryTimeout: 1000
    }, (err, sauceConnectProcess) => {
      if (err) {
        return reject(err);
      }

      this.sauceConnectProcess = sauceConnectProcess;
      console.log('Started Sauce Connect process');

      return resolve();
    }));
  },
  /**
   * Gets executed just before initialising the webdriver session and test framework. It allows you
   * to manipulate configurations depending on the capability or spec.
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that are to be run
   */
  // beforeSession: function (config, capabilities, specs) {
  // },
  /**
   * Gets executed before test execution begins. At this point you can access to all global
   * variables like `browser`. It is the perfect place to define custom commands.
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that are to be run
   */
  // before(capabilities, specs) {
  // }
  //
  /**
   * Hook that gets executed before the suite starts
   * @param {Object} suite suite details
   */
  // beforeSuite: function (suite) {
  // },
  /**
   * Hook that gets executed _before_ a hook within the suite starts (e.g. runs before calling
   * beforeEach in Mocha)
   */
  // beforeHook: function () {
  // },
  /**
   * Hook that gets executed _after_ a hook within the suite starts (e.g. runs after calling
   * afterEach in Mocha)
   */
  // afterHook: function () {
  // },
  /**
   * Function to be executed before a test (in Mocha/Jasmine) or a step (in Cucumber) starts.
   * @param {Object} test test details
   */
  // beforeTest: function (test) {
  // },
  /**
   * Runs before a WebdriverIO command gets executed.
   * @param {String} commandName hook command name
   * @param {Array} args arguments that command would receive
   */
  // beforeCommand: function (commandName, args) {
  // },
  /**
   * Runs after a WebdriverIO command gets executed
   * @param {String} commandName hook command name
   * @param {Array} args arguments that command would receive
   * @param {Number} result 0 - command success, 1 - command error
   * @param {Object} error error object if any
   */
  // afterCommand: function (commandName, args, result, error) {
  // },
  /**
   * Function to be executed after a test (in Mocha/Jasmine) or a step (in Cucumber) starts.
   * @param {Object} test test details
   * @returns {undefined}
   */
  afterTest(test) {
    if (!test.passed) {
      try {
        const logTypes = browser.logTypes();

        Object.keys(logTypes).forEach((browserId) => {
          console.log(logTypes[browserId].value);
          if (logTypes[browserId].value.includes('browser')) {
            const logs = browser.select(browserId).log('browser');

            if (logs.value.length) {
              console.error(`Test ${test.fullTitle} failed with the following log output from browser ${browserId}`);
              console.error(logs
                .value
                .map((v) => `> ${v.message}`)
                .join('\n'));
            }
            else {
              console.error(`Test ${test.fullTitle} failed but no logs were produced by browser ${browserId}`);
            }
          }
          else {
            console.error(`${test.fullTitle} failed but browser ${browserId} doesn't support log collection`);
          }
        });
      }
      catch (error) {
        console.error(`${test.fullTitle} failed but browser doesn't support log collection`);
      }
    }
  },
  /**
   * Hook that gets executed after the suite has ended
   * @param {Object} suite suite details
   */
  // afterSuite: function (suite) {
  // },
  /**
   * Gets executed after all tests are done. You still have access to all global variables from
   * the test.
   * @param {Number} result 0 - test pass, 1 - test fail
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that ran
   */
  // after: function (result, capabilities, specs) {
  // },
  /**
   * Gets executed right after terminating the webdriver session.
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that ran
   */
  // afterSession: function (config, capabilities, specs) {
  // },
  /**
   * Gets executed after all workers got shut down and the process is about to exit. It is not
   * possible to defer the end of the process using a promise.
   * @param {Object} exitCode 0 - success, 1 - fail
   * @returns {Promise}
   */
  onComplete() {
    if (!this.sauceConnectProcess) {
      return;
    }

    console.log('Closed Sauce Connect process');

    // eslint-disable-next-line consistent-return
    return new Promise((resolve) => this.sauceConnectProcess.close(resolve));
  }
};
