

/* eslint camelcase: [0] */

module.exports = {
  local: {
    ChromeHeadless: {},
    FirefoxHeadless: {}
  },

  sauce: {
    // Reminder: the first item in this object is used by pipeline builds
    sl_chrome_45_osx9: {
      base: 'SauceLabs',
      platform: 'OS X 10.9',
      browserName: 'chrome',
      version: '45'
    },
    sl_chrome_46_win7: {
      base: 'SauceLabs',
      platform: 'Windows 7',
      browserName: 'chrome',
      version: '46'
    }
  }
};
