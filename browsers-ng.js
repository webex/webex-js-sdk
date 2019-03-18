/* eslint-disable */
'use strict';

/* eslint camelcase: [0] */

module.exports = function(packageName, argv) {
  let browsers;
  if (process.env.SC_TUNNEL_IDENTIFIER) {
    browsers = {
      // Reminder: the first item in this object is used by pipeline builds
      sl_chrome_latest_osx13: {
        base: 'SauceLabs',
        platform: 'OS X 10.13',
        browserName: 'chrome',
        version: 'latest',
        extendedDebugging: true
      },
      sl_chrome_latest_win7: {
        base: 'SauceLabs',
        platform: 'Windows 7',
        browserName: 'chrome',
        version: 'latest',
        extendedDebugging: true
      },
      sl_firefox_latest_osx13: {
        base: 'SauceLabs',
        platform: 'OS X 10.13',
        browserName: 'firefox',
        version: 'latest',
        extendedDebugging: true
      },
      sl_firefox_latest_win7: {
        base: 'SauceLabs',
        platform: 'Windows 7',
        browserName: 'firefox',
        version: 'latest',
        extendedDebugging: true
      },
      sl_firefox_latest_linux: {
        base: 'SauceLabs',
        platform: 'Linux',
        browserName: 'firefox',
        version: 'latest'
        // extendedDebugging: true // linux latest only runs firefox 45 for some reason
      },
      sl_edge_latest_win10: {
        base: 'SauceLabs',
        platform: 'Windows 10',
        browserName: 'MicrosoftEdge',
        version: 'latest'
      },
      sl_safari_latest_osx13: {
        base: 'SauceLabs',
        platform: 'macOS 10.13',
        browserName: 'safari',
        version: 'latest'
      }
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
  else {
    browsers = {
      Chrome: {}
    };
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
