/* eslint-disable */
'use strict';

/* eslint camelcase: [0] */

module.exports = function(packageName, argv) {
  let browsers;
  if (process.env.SC_TUNNEL_IDENTIFIER) {
    browsers = {
      // Reminder: the first item in this object is used by pipeline builds
      sl_chrome_latest_osx12: {
        base: 'SauceLabs',
        platform: 'OS X 10.12',
        browserName: 'chrome',
        version: 'latest'
      },
      sl_chrome_latest_win7: {
        base: 'SauceLabs',
        platform: 'Windows 7',
        browserName: 'chrome',
        version: 'latest'
      },
      sl_firefox_latest_linux: {
        base: 'SauceLabs',
        platform: 'Linux',
        browserName: 'firefox',
        version: 'latest'
      },
      sl_firefox_latest_osx12: {
        base: 'SauceLabs',
        platform: 'OS X 10.12',
        browserName: 'firefox',
        version: 'latest'
      },
      sl_firefox_latest_win7: {
        base: 'SauceLabs',
        platform: 'Windows 7',
        browserName: 'firefox',
        version: 'latest'
      },
      // Safari has serious issues with sauce labs
      // IE 10 fails because too many libraries use const
      sl_ie_11_win7: {
        base: 'SauceLabs',
        platform: 'Windows 7',
        browserName: 'internet explorer',
        version: '11'
      }
      // TODO add edge
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

  return browsers;
}
