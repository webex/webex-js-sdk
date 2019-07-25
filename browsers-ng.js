/* eslint-disable */
/* eslint camelcase: [0] */

module.exports = function (packageName, argv) {
  let browsers = argv.karmaDebug ? {
    Chrome: {},
    Firefox: {}
  } : {
      // Default Local Browsers
      ChromeHeadless: {},
      FirefoxHeadless: {}
    };

  if (process.env.SC_TUNNEL_IDENTIFIER || process.env.CI || process.env.CIRCLECI || process.env.SAUCE) {
    browsers = {
      ...(!argv.browsers && !argv.os ? {
        // Reminder: the first item in this object is used by pipeline builds
        sl_chrome_latest_macOS_High_Sierra: {
          base: 'SauceLabs',
          platform: 'macOS 10.13',
          browserName: 'Chrome',
          version: 'latest',
          extendedDebugging: true
        },
        sl_chrome_latest_win10: {
          base: 'SauceLabs',
          platform: 'Windows 10',
          browserName: 'Chrome',
          version: 'latest',
          extendedDebugging: true
        },
        sl_firefox_latest_macOS_High_Sierra: {
          base: 'SauceLabs',
          platform: 'macOS 10.13',
          browserName: 'Firefox',
          version: 'latest',
          extendedDebugging: true,
          'moz:firefoxOptions': {
            args: [
              '-start-debugger-server',
              '9222'
            ],
            prefs: {
              'devtools.chrome.enabled': true,
              'devtools.debugger.prompt-connection': false,
              'devtools.debugger.remote-enabled': true
            }
          }
        },
        sl_firefox_latest_win10: {
          base: 'SauceLabs',
          platform: 'Windows 10',
          browserName: 'Firefox',
          version: 'latest',
          extendedDebugging: true,
          'moz:firefoxOptions': {
            args: [
              '-start-debugger-server',
              '9222'
            ],
            prefs: {
              'devtools.chrome.enabled': true,
              'devtools.debugger.prompt-connection': false,
              'devtools.debugger.remote-enabled': true
            }
          }
        },
        sl_edge_latest_win10: {
          base: 'SauceLabs',
          platform: 'Windows 10',
          browserName: 'MicrosoftEdge',
          version: 'latest'
        },
        sl_safari_latest_macOS_High_Sierra: {
          base: 'SauceLabs',
          platform: 'macOS 10.13',
          browserName: 'Safari',
          version: 'latest'
        },
        // sl_firefox_latest_linux: {
        //   base: 'SauceLabs',
        //   platform: 'Linux',
        //   browserName: 'Firefox',
        //   version: 'latest'
        // }
      } : {
          ...((!argv.browsers ||
            argv.browsers.includes('chrome') ||
            argv.browsers.includes('defaults') ||
            argv.browsers.includes('default')) && {
              // If "mac" is specified or nothing is specified
              ...((!argv.os || argv.os.includes('mac')) && {
                sl_chrome_latest_macOS_High_Sierra: {
                  base: 'SauceLabs',
                  platform: 'macOS 10.13',
                  browserName: 'Chrome',
                  version: 'latest',
                  extendedDebugging: true,
                },
              }),
              // If "windows" is specified or nothing is specified
              ...((!argv.os ||
                (argv.os.includes('win') || argv.os.includes('windows'))) && {
                  sl_chrome_latest_win10: {
                    base: 'SauceLabs',
                    platform: 'Windows 10',
                    browserName: 'Chrome',
                    version: 'latest',
                    extendedDebugging: true,
                  },
                }),
            }),

          // Firefox or defaults is specified
          ...((!argv.browsers ||
            argv.browsers.includes('firefox') ||
            argv.browsers.includes('defaults') ||
            argv.browsers.includes('default')) && {
              ...((!argv.os || argv.os.includes('mac')) && {
                sl_firefox_latest_macOS_High_Sierra: {
                  base: 'SauceLabs',
                  platform: 'macOS 10.13',
                  browserName: 'Firefox',
                  version: 'latest',
                  extendedDebugging: true,
                  'moz:firefoxOptions': {
                    args: [
                      '-start-debugger-server',
                      '9222'
                    ],
                    prefs: {
                      'devtools.chrome.enabled': true,
                      'devtools.debugger.prompt-connection': false,
                      'devtools.debugger.remote-enabled': true
                    }
                  }
                },
              }),
              ...((!argv.os ||
                (argv.os.includes('win') || argv.os.includes('windows'))) && {
                  sl_firefox_latest_win10: {
                    base: 'SauceLabs',
                    platform: 'Windows 10',
                    browserName: 'Firefox',
                    version: 'latest',
                    extendedDebugging: true,
                    'moz:firefoxOptions': {
                      args: [
                        '-start-debugger-server',
                        '9222'
                      ],
                      prefs: {
                        'devtools.chrome.enabled': true,
                        'devtools.debugger.prompt-connection': false,
                        'devtools.debugger.remote-enabled': true
                      }
                    }
                  },
                }),
            }),

          // If Safari is specified or "mac" is specified or no argv.os is specified
          ...(((argv.os && argv.os.includes('mac')) ||
            (argv.browsers && argv.browsers.includes('safari'))) && {
              sl_safari_latest_macOS_High_Sierra: {
                base: 'SauceLabs',
                platform: 'macOS 10.13',
                browserName: 'Safari',
                version: 'latest',
              },
            }),

          ...(((argv.os &&
            (argv.os.includes('win') || argv.os.includes('windows'))) ||
            (argv.browsers && argv.browsers.includes('edge'))) && {
              sl_edge_latest_win10: {
                base: 'SauceLabs',
                platform: 'Windows 10',
                browserName: 'MicrosoftEdge',
                version: 'latest',
              },
            }),

          ...(((argv.os &&
            (argv.os.includes('win') || argv.os.includes('windows'))) ||
            (argv.browsers &&
              (argv.browsers.includes('ie') ||
                argv.browsers.includes('internet explorer')))) && {
              sl_ie_latest_win7: {
                base: 'SauceLabs',
                platform: 'Windows 7',
                browserName: 'Internet Explorer',
                version: 'latest',
              },
            }),

          ...(argv.os &&
            argv.browsers &&
            argv.os.includes('linux') &&
            argv.browsers.includes('firefox') && {
              sl_firefox_latest_linux: {
                base: 'SauceLabs',
                platform: 'Linux',
                browserName: 'Firefox',
                version: 'latest',
              },
            }),
        })
    }

    // Filters out extra browsers that aren't specified by the user
    // `--mac` includes [chrome, firefox, safari]
    // If use wants chrome and firefox only on mac it filters out safari
    if (argv.os && argv.browsers) {
      Object.keys(browsers).forEach(browser =>
        argv.browsers.some(item => browser.includes(item)) ?
          browser :
          delete browsers[browser]
      );
    }

    try {
      // Check if the package generated a browsers package dynamically. This is
      // necessary when the package needs to e.g. use FirefoxProfile to manipulate
      // the browser environment
      browsers = require('./packages/node_modules/' + packageName + '/browsers.processed.js')(browsers);
    }
    catch (error) {
      if (error.code !== `MODULE_NOT_FOUND`) {
        throw error;
      }
      try {
        browsers = require('./packages/node_modules/' + packageName + '/browsers.js')(browsers);
      }
      catch (error2) {
        if (error2.code !== `MODULE_NOT_FOUND`) {
          throw error2;
        }
        // ignore
      }
    }
  }

  try {
    browsers = require(`./packages/node_modules/${packageName}/browsers.js`)(browsers);
  }
  catch (err) {
    if (err.code !== `MODULE_NOT_FOUND`) {
      throw err;
    }
  }

  if (process.env.PIPELINE) {
    var keys = Object.keys(browsers);
    return {
      [keys[0]]: browsers[keys[0]]
    }
  }

  // Limit browsers via env variable
  if (process.env.BROWSER) {
    const browserName = process.env.BROWSER.toUpperCase();
    const filteredBrowsers = {};
    Object.keys(browsers).forEach((browserId) => {
      const browser = browsers[browserId]
      if ((browser.base && browser.base.toUpperCase() === browserName) || (browser.browserName && browser.browserName.toUpperCase() === browserName)) {
        filteredBrowsers[browserId] = browser;
      }
    });
    if (Object.keys(filteredBrowsers).length === 0) {
      throw new Error('No matching browsers found.');
    }
    return filteredBrowsers;
  }

  return browsers;
}
