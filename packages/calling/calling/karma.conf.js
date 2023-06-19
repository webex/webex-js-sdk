/* eslint-disable valid-jsdoc */
// eslint-disable-next-line
const typescriptTransform = require('karma-typescript-es6-transform');
// eslint-disable-next-line
process.env.CHROME_BIN = require('puppeteer')
  .executablePath();

// Karma configuration
/**
 * Karma config.
 *
 * @param config -.
 */

/**
 * .
 *
 * @param config
 */
export default (config) => {
  const {SAUCE, SAUCE_USERNAME, SAUCE_ACCESS_KEY, TEST_TIMEOUT, BUILD_NUMBER, NODE_ENV} =
    process.env;

  const browsers = ['chrome'];
  const appName = 'web-calling-sdk';
  const environment = NODE_ENV || 'dev';
  const buildNumber = BUILD_NUMBER || new Date().toUTCString();
  const buildName = `${appName}-tests-${environment}#${buildNumber}`;
  const useSauceConnect = SAUCE === 'true';
  const timeout = TEST_TIMEOUT || 60000;

  const sharedSauceOptions = {
    screenResolution: '1600x1200',
    extendedDebugging: true,
    capturePerformance: true,
  };

  const firefoxOptions = {
    prefs: {
      'devtools.chrome.enabled': true,
      'devtools.debugger.prompt-connection': false,
      'devtools.debugger.remote-enabled': true,
      'dom.webnotifications.enabled': false,
      'media.webrtc.hw.h264.enabled': true,
      'media.getusermedia.screensharing.enabled': true,
      'media.navigator.permission.disabled': true,
      'media.navigator.streams.fake': true,
      'media.peerconnection.video.h264_enabled': true,
    },
  };

  const chromeOptions = {
    args: [
      'start-maximized',
      'disable-infobars',
      'ignore-gpu-blacklist',
      'test-type',
      'disable-gpu',
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--enable-experimental-web-platform-features',
      '--allow-insecure-localhost',
      '--unsafely-treat-insecure-origin-as-secure',
    ],
  };

  const localLaunchers = {
    chrome: {
      base: 'ChromeHeadless',
      flags: [
        '--no-sandbox',
        '--disable-web-security',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
    firefox: {
      base: 'Firefox',
      flags: firefoxOptions.prefs,
    },
    safari: {
      base: 'Safari',
      flags: {
        'webkit:WebRTC': {
          DisableInsecureMediaCapture: true,
        },
      },
    },
  };

  const sauceLaunchers = {
    sl_chrome_mac11: {
      base: 'SauceLabs',
      browserName: 'chrome',
      browserVersion: 'latest',
      platformName: 'macOS 11',
      'goog:chromeOptions': chromeOptions,
      'sauce:options': {
        ...sharedSauceOptions,
        tags: ['w3c-chrome'],
      },
    },
    sl_chrome_win10: {
      base: 'SauceLabs',
      browserName: 'chrome',
      browserVersion: 'latest',
      platformName: 'Windows 10',
      'goog:chromeOptions': chromeOptions,
      'sauce:options': {
        ...sharedSauceOptions,
        tags: ['w3c-chrome'],
      },
    },
    sl_safari_mac11: {
      base: 'SauceLabs',
      browserName: 'Safari',
      browserVersion: 'latest',
      platformName: 'macOS 11',
      'sauce:options': {
        ...sharedSauceOptions,
        tags: ['w3c-safari'],
      },
    },
    sl_firefox_mac11: {
      base: 'SauceLabs',
      browserName: 'firefox',
      browserVersion: 'latest',
      platformName: 'macOS 11',
      'moz:firefoxOptions': firefoxOptions,
      'sauce:options': {
        ...sharedSauceOptions,
        tags: ['w3c-firefox'],
      },
    },
    sl_firefox_win10: {
      base: 'SauceLabs',
      browserName: 'firefox',
      browserVersion: 'latest',
      platformName: 'Windows 10',
      'moz:firefoxOptions': firefoxOptions,
      'sauce:options': {
        ...sharedSauceOptions,
        tags: ['w3c-firefox'],
      },
    },
  };

  const customLaunchers = {...localLaunchers, ...sauceLaunchers};

  if (useSauceConnect && !SAUCE_USERNAME && !SAUCE_ACCESS_KEY) {
    // eslint-disable-next-line no-console
    console.log('Make sure the SAUCE_USERNAME and SAUCE_ACCESS_KEY environment variables are set.');
    process.exit(1);
  }

  const files = ['src/**/*.ts'];

  const karmaConfig = {
    basePath: '.',
    frameworks: ['mocha', 'chai', 'karma-typescript'],
    files,
    preprocessors: {
      'src/**/*.ts': ['karma-typescript'],
    },
    exclude: [],
    reporters: ['junit', 'karma-typescript', 'saucelabs', 'mocha', 'coverage'],
    port: 9876,
    logLevel: config.DEBUG,
    autoWatch: false,
    customLaunchers,
    browsers: useSauceConnect ? Object.keys(sauceLaunchers) : browsers,
    singleRun: true,
    concurrency: Infinity,
    timeout,
    captureTimeout: 120000,
    client: {
      mocha: {
        // timeout: 10000,
      },
    },
    karmaTypescriptConfig: {
      tsconfig: './tsconfig.json',
      compilerOptions: {
        allowJs: true,
        module: 'commonjs',
        resolveJsonModule: false,
      },
      bundlerOptions: {
        debug: true,
        addNodeGlobals: false,
        entrypoints: config.integration ? /\.integration-test\.ts/i : /\.test\.ts$/i,
        transforms: [typescriptTransform()],
      },
      coverageOptions: {
        exclude: [/\.(d|spec|test)\.ts$/i],
      },
    },
    sauceLabs: {
      build: buildName,
      recordScreenshots: true,
      recordVideo: true,
      tags: ['web-calling-sdk'],
      testName: `${config.integration ? 'Integration Tests' : 'Unit Tests'}`,
      connectOptions: {
        logfile: './sauce.log',
        noSslBumpDomains: [
          'idbroker.webex.com',
          'idbrokerbts.webex.com',
          '127.0.0.1',
          'localhost',
          '*.wbx2.com',
          '*.ciscospark.com',
        ],
        tunnelDomains: ['127.0.0.1', 'localhost'],
      },
    },
    coverageReporter: {
      type: 'html',
      dir: 'coverage',
    },
    junitReporter: {
      outputDir: 'coverage',
      outputFile: 'junit.xml',
    },
  };

  config.set(karmaConfig);
};
