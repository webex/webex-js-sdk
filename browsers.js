

/* eslint camelcase: [0] */

module.exports = {
  local: {
    ChromeHeadless: {},
    FirefoxHeadless: {}
  },

  sauce: {
    // Reminder: the first item in this object is used by pipeline builds
    sl_chrome_45_osx13: {
      base: 'SauceLabs',
      platform: 'macOS 10.13',
      browserName: 'chrome',
      version: '45'
    },
    // sl_firefox_40_osx13: {
    //   base: 'SauceLabs',
    //   platform: 'macOS 10.13',
    //   browserName: 'firefox',
    //   version: '40'
    // },
    // // FIXME Safari 8 still makes the test suite run too slowly
    // // sl_safari_8_osx13: {
    // //   base: 'SauceLabs',
    // //   platform: 'macOS 10.13',
    // //   browserName: 'safari',
    // //   version: '8'
    // // },
    // // FIXME spec/client/device.js makes IE run really slowly
    // // sl_ie_10_win7: {
    // //   base: 'SauceLabs',
    // //   platform: 'Windows 7',
    // //   browserName: 'internet explorer',
    // //   version: '10'
    // // },
    // // sl_ie_11_win7: {
    // //   base: 'SauceLabs',
    // //   platform: 'Windows 7',
    // //   browserName: 'internet explorer',
    // //   version: '11'
    // // },
    sl_chrome_46_win7: {
      base: 'SauceLabs',
      platform: 'Windows 7',
      browserName: 'chrome',
      version: '46'
    }
  }
};
