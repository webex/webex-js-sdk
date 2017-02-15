/* eslint-disable */
'use strict';

/* eslint camelcase: [0] */

var browsers = {
  local: {
    Chrome: {}
  },

  sauce: {
    // Reminder: the first item in this object is used by pipeline builds
    sl_chrome_latest_osx11: {
      base: 'SauceLabs',
      platform: 'OS X 10.11',
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
    sl_firefox_latest_osx11: {
      base: 'SauceLabs',
      platform: 'OS X 10.11',
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
};

if (process.env.BROWSER) {
  browsers.local = {};
  browsers.local[process.env.BROWSER] = {};
}

try {
  // Check if the package generated a browsers package dynamically. This is
  // necessary when the package needs to e.g. use FirefoxProfile to manipulate
  // the browser environment
  browsers = require('./packages/' + process.env.PACKAGE + '/browsers.processed.js')(browsers);
}
catch (error) {
  if (error.code !== `MODULE_NOT_FOUND`) {
    throw error;
  }
  try {
    browsers = require('./packages/' + process.env.PACKAGE + '/browsers.js')(browsers);
  }
  catch (error2) {
    if (error2.code !== `MODULE_NOT_FOUND`) {
      throw error2;
    }
    // ignore
  }
}

if (process.env.PIPELINE) {
  var keys = Object.keys(browsers.sauce);
  var key = keys[0];
  var sauce = browsers.sauce;
  browsers.sauce = {};
  browsers.sauce[key] = sauce[key];
}

module.exports = browsers;
