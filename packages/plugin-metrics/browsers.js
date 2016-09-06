/* eslint-disable */

'use strict';

// There's a bug in Firefox < 48.0.2 (which is all that's available on sauce
// right now) which prevents lolex from functioning corectly

module.exports = function() {
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
      }
    }
  };

  return browsers;
}
