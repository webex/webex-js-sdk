

/* eslint camelcase: [0] */

module.exports = {
  local: {
    ChromeHeadless: {},
    FirefoxHeadless: {}
  },

  sauce: {
    // Reminder: the first item in this object is used by pipeline builds
    sl_chrome_45_macOS_High_Sierra: {
      base: 'SauceLabs',
      platform: 'macOS 10.15',
      browserName: 'Chrome',
      version: '45'
    },
    sl_chrome_46_win7: {
      base: 'SauceLabs',
      platform: 'Windows 7',
      browserName: 'Chrome',
      version: '46'
    }
  }
};
