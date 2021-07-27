/* eslint-disable no-console, require-jsdoc */
/* global browser: false */

const path = require('path');
const os = require('os');
const {createServer} = require('http');

const dotenv = require('dotenv');
const glob = require('glob');
const uuidv4 = require('uuid/v4');
const handler = require('serve-handler');
const webpack = require('webpack');

dotenv.config();
dotenv.config({path: '.env.default'});

const webpackConfig = require('./webpack.config')();

require('@babel/register')({
  only: [
    './packages/node_modules/**/*.js'
  ],
  sourceMaps: true
});

const PORT = process.env.PORT || 8000;
const CI = !!(process.env.JENKINS || process.env.CIRCLECI || process.env.CI || process.env.SAUCE);

exports.config = {
  //
  // ====================
  // Runner Configuration
  // ====================
  //
  // WebdriverIO allows it to run your tests in arbitrary locations (e.g. locally or
  // on a remote machine).
  runner: 'local',
  //
  // =================
  // Service Providers
  // =================
  // WebdriverIO supports Sauce Labs, Browserstack, Testing Bot and LambdaTest (other cloud providers
  // should work too though). These services define specific user and key (or access key)
  // values you need to put in here in order to connect to these services.
  //
  user: process.env.SAUCE_USERNAME,
  key: process.env.SAUCE_ACCESS_KEY,
  //
  // If you run your tests on Sauce Labs you can specify the region you want to run your tests
  // in via the `region` property. Available short handles for regions are `us` (default) and `eu`.
  // These regions are used for the Sauce Labs VM cloud and the Sauce Labs Real Device Cloud.
  // If you don't provide the region it will default for the `us`
  region: 'us',
  //
  // ==================
  // Specify Test Files
  // ==================
  // Define which test specs should run. The pattern is relative to the directory
  // from which `wdio` was called. Notice that, if you are calling `wdio` from an
  // NPM script (see https://docs.npmjs.com/cli/run-script) then the current working
  // directory is where your package.json resides, so `wdio` will be called from there.
  //
  featureFlags: {
    specFiltering: true
  },
  specs: [
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
  maxInstances: 1,
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
      capabilities: {
        browserName: 'safari',
        'webkit:WebRTC': {
          DisableInsecureMediaCapture: true
        },
        ...(!CI && {
          'safari.options': {
            technologyPreview: !!CI
          }
        }),
        ...(CI && {
          'sauce:options': {
            screenResolution: '1600x1200',
            extendedDebugging: true
          }
        })
      }
    },
    ...(CI ? {
      browserChrome: {
        capabilities: {
          browserName: 'MicrosoftEdge',
          'ms:edgeOptions': {
            args: [
              '--disable-features=WebRtcHideLocalIpsWithMdns',
              '--use-fake-device-for-media-stream',
              '--use-fake-ui-for-media-stream'
            ]
          },
          ...(CI && {
            platformName: 'Windows 10',
            'sauce:options': {
              screenResolution: '1600x1200',
              extendedDebugging: true
            }
          })
        }
      }
    } : {
      browserChrome: {
        capabilities: {
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
              extendedDebugging: true,
              capturePerformance: true,
              crmuxdriverVersion: 'beta'
            }
          })
        }
      }
    })
  } : {
    browserFirefox: {
      capabilities: {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          ...(CI ? {
            args: [
              '-start-debugger-server',
              '9222'
            ],
            prefs: {
              'devtools.chrome.enabled': true,
              'devtools.debugger.prompt-connection': false,
              'devtools.debugger.remote-enabled': true,
              'dom.webnotifications.enabled': false,
              'media.webrtc.hw.h264.enabled': true,
              'media.getusermedia.screensharing.enabled': true,
              'media.navigator.permission.disabled': true,
              'media.navigator.streams.fake': true,
              'media.peerconnection.video.h264_enabled': true
            }
          } : {
            prefs: {
              'dom.webnotifications.enabled': false,
              'media.webrtc.hw.h264.enabled': true,
              'media.getusermedia.screensharing.enabled': true,
              'media.navigator.permission.disabled': true,
              'media.navigator.streams.fake': true,
              'media.peerconnection.video.h264_enabled': true
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
      capabilities: {
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
            extendedDebugging: true,
            capturePerformance: true,
            crmuxdriverVersion: 'beta'
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
  //
  // Level of logging verbosity: trace | debug | info | warn | error | silent
  logLevel: 'error',
  //
  // Set specific log levels per logger
  // use 'silent' level to disable logger
  // logLevels: {
  //   webdriver: 'info',
  //   '@wdio/applitools-service': 'info'
  // },
  //
  // Warns when a deprecated command is used
  deprecationWarnings: !CI,
  //
  // Enables colors for log output.
  coloredLogs: true,
  //
  // If you only want to run your tests until a specific amount of tests have failed use
  // bail (default is 0 - don't bail, run all tests).
  bail: 1,
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
    ['sauce', {
      sauceConnect: true,
      sauceConnectOpts: {
        noSslBumpDomains: [
          'idbroker.webex.com',
          'idbrokerbts.webex.com',
          '127.0.0.1',
          'localhost',
          '*.wbx2.com',
          '*.ciscospark.com'
        ],
        tunnelDomains: [
          '127.0.0.1',
          'localhost'
        ],
        logfile: './sauce.log',
        tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER || uuidv4()
      }
    }]
  ] : [
    ['selenium-standalone', {
      installArgs: {
        // Latest Version of Selenium
        version: '3.141.59'
      }
    }]
  ],
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
  reporters: [
    'spec',
    ['junit', {
      outputDir: './reports/junit/wdio'
    }]
  ],
  //
  // Options to be passed to Mocha.
  // See the full list at http://mochajs.org/
  mochaOpts: {
    // reminder: mocha-steps seems to make tests flaky on Sauce Labs
    require: ['@babel/register'],
    timeout: 80000,
    ui: 'bdd',
    retry: 3
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
   */
  async onPrepare(config, capabilities) {
    await webpack(webpackConfig, (err, stats) => {
      if (err || stats.hasErrors()) {
        throw new Error(err.details);
      }

      console.log(stats.toString({
        colors: true,
        modules: false,
        warnings: false
      }));

      createServer((request, response) =>
        // You pass two more arguments for config and middleware
        // More details here: https://github.com/vercel/serve-handler#options
        handler(request, response, {
          public: './packages/node_modules/samples',
          cleanUrls: true,
          trailingSlash: true
        }))
        .listen(PORT, () => {
          console.info(`Static Sever running at http://localhost:${PORT}\n`);
        });
    });

    const defs = [
      capabilities.browserFirefox.capabilities,
      capabilities.browserChrome.capabilities
    ];

    const build = process.env.BUILD_NUMBER || `local-${process.env.USER}-wdio-${Date.now()}`;

    defs.forEach((d) => {
      if (CI) {
        d['sauce:options'].build = build;

        d.browserVersion = d.browserVersion || 'latest';
        d.platformName = d.platformName || 'macOS 10.15';
        d['sauce:options'].seleniumVersion = '3.141.59';
      }
      else {
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
    /* eslint-disable global-require */
    require('./wdio.helpers.d/alerts');
    require('./wdio.helpers.d/assertions');
    require('./wdio.helpers.d/set-value');
    require('./wdio.helpers.d/wait-for-specific-text');
    /* eslint-enable global-require */

    // Size is based on a common resolution that both Windows and Mac support on Saucelabs
    if (CI) {
      browser.maximizeWindow();
    }
    browser.url(this.baseUrl);
  }
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
   * @param {*} test
   * @param {*} context
   */
  // afterTest(test, context, {passed}) {
  // }
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
  // onComplete(exitCode) {
  // }
};
