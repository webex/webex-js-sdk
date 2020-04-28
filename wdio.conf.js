/* eslint-disable no-console, require-jsdoc */
/* global browser: false */

require('babel-register');

const path = require('path');
const os = require('os');

const dotenv = require('dotenv');
const glob = require('glob');
const uuidv4 = require('uuid/v4');

dotenv.config();
dotenv.config({path: '.env.default'});

const {inject} = require('./tooling/lib/openh264');
// Webdriver is only called for testing samples so force integration URLs w/ Webpack
const webpackConfig = require('./webpack.config')();

require('babel-register')({
  only: [
    './packages/node_modules/**/*.js'
  ],
  sourceMaps: true
});

const PORT = process.env.PORT || 8000;
const CI = !!(process.env.JENKINS || process.env.CIRCLECI || process.env.CI || process.env.SAUCE);

exports.config = {
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
  // If CI && Safari run Safari + Edge
  // If just Safari run Safari + Chrome
  // If not Safari run Firefox + Chrome
  capabilities: process.env.SAFARI ? {
    browserFirefox: {
      desiredCapabilities: {
        browserName: 'Safari',
        'webkit:WebRTC': {
          DisableInsecureMediaCapture: true
        },
        ...(!CI && {
          'safari.options': {
            technologyPreview: !!CI
          }
        }),
        ...(CI && {
          platform: 'macOS 10.14',
          version: '12',
          'sauce:options': {
            screenResolution: '1600x1200',
            extendedDebugging: true
          }
        })
      }
    },
    ...(CI ? {
      browserChrome: {
        desiredCapabilities: {
          browserName: 'MicrosoftEdge',
          'ms:edgeOptions': {
            args: [
              '--disable-features=WebRtcHideLocalIpsWithMdns',
              '--use-fake-device-for-media-stream',
              '--use-fake-ui-for-media-stream'
            ]
          },
          ...(CI && {
            platform: 'Windows 10',
            'sauce:options': {
              screenResolution: '1600x1200',
              extendedDebugging: true
            }
          })
        }
      }
    } : {
      browserChrome: {
        desiredCapabilities: {
          browserName: 'chrome',
          'goog:chromeOptions': {
            args: [
              '--disable-features=WebRtcHideLocalIpsWithMdns',
              '--use-fake-device-for-media-stream',
              '--use-fake-ui-for-media-stream'
            ]
          },
          ...(CI && {
            'sauce:options': {
              screenResolution: '1600x1200',
              extendedDebugging: true
            }
          })
        }
      }
    })
  } : {
    browserFirefox: {
      desiredCapabilities: {
        browserName: 'Firefox',
        'moz:firefoxOptions': {
          ...(CI ? {
            args: [
              '-start-debugger-server',
              '9222'
            ],
            prefs: {
              'devtools.chrome.enabled': true,
              'devtools.debugger.prompt-connection': false,
              'devtools.debugger.remote-enabled': true
            }
          } : {
            prefs: {
              'dom.webnotifications.enabled': false,
              'media.getusermedia.screensharing.enabled': true,
              'media.navigator.permission.disabled': true,
              'media.navigator.streams.fake': true
            }
          })
        },
        ...(CI && {
          'sauce:options': {
            screenResolution: '1600x1200',
            extendedDebugging: true
          }
        })
      }
    },
    browserChrome: {
      desiredCapabilities: {
        browserName: 'Chrome',
        'goog:chromeOptions': {
          args: [
            '--disable-features=WebRtcHideLocalIpsWithMdns',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream'
          ]
        },
        ...(CI && {
          'sauce:options': {
            screenResolution: '1600x1200',
            extendedDebugging: true
          }
        })
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
  deprecationWarnings: !CI,
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
  baseUrl: `http://localhost:${PORT}/`,
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
  debug: !CI,
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
  services: CI ? [
    'sauce',
    'static-server',
    'webpack'
  ] : [
    'selenium-standalone',
    'static-server',
    'webpack'
  ],
  staticServerFolders: [
    {mount: '/', path: './packages/node_modules/samples'},
    {mount: '/', path: '.'}
  ],
  staticServerPort: PORT,
  webpackConfig,
  // Set selenium and geckodriver versions only for local dev
  // Saucelabs should handle this automatically
  ...(!CI && {
    seleniumInstallArgs: {
      // Latest Version of Selenium
      version: '3.141.59',
      drivers: {
        firefox: {
          // Latest Version of geckodriver (default version is 0.23.0)
          version: '0.26.0'
        }
      }
    }
  }),
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
  reporters: CI ? ['spec', 'junit'] : ['spec'],
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
    const defs = [
      capabilities.browserFirefox.desiredCapabilities,
      capabilities.browserChrome.desiredCapabilities
    ];

    const build = process.env.BUILD_NUMBER || `local-${process.env.USER}-wdio-${Date.now()}`;

    defs.forEach((d) => {
      if (CI) {
        d.build = build;
        // Set the base to SauceLabs so that inject() does its thing.
        d.base = 'SauceLabs';

        d.version = d.version || 'latest';
        d.platform = d.platform || 'macOS 10.15';
        d.seleniumVersion = d.seleniumVersion || '3.141.59';
      }
      else {
        // Copy the base over so that inject() does its thing.
        d.base = d.browserName;
        d.platformName = () => {
          switch (os.type()) {
            case 'Darwin':
              return 'mac';
            case 'Window_NT':
              return 'windows';
            case 'Linux':
              return 'Linux';
            default:
              return os.type();
          }
        };
      }
    });

    // The openh264 profile seems to break tests locally; run the tests twice
    // and the plugin should download automatically.
    return CI ? inject(defs) : Promise.resolve()
      .then(() => {
        // Remove the base because it's not actually a selenium property
        defs.forEach((d) => Reflect.deleteProperty(d, 'base'));
      });
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
  // eslint-disable-next-line no-unused-vars
  before(capabilities, specs) {
    // Size is based on a common resolution that both Windows and Mac support on Saucelabs
    browser.windowHandleSize({
      width: 1600,
      height: 1200
    });
  },
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
   */
  // onComplete: function(exitCode) {
  // }
  ...(CI && {
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,
    sauceConnect: true,
    sauceConnectOpts: {
      detached: true,
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
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER || uuidv4(),
      port: process.env.SAUCE_CONNECT_PORT || 4445,
      // retry to establish a tunnel multiple times. (optional)
      connectRetries: 3,
      // time to wait between connection retries in ms. (optional)
      connectRetryTimeout: 2000,
      // retry to download the sauce connect archive multiple times. (optional)
      downloadRetries: 4,
      // time to wait between download retries in ms. (optional)
      downloadRetryTimeout: 1000
    }
  })
};
