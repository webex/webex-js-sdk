

/* eslint camelcase: [0] */

module.exports = {
  local: {
    Chrome: {}
  },

  sauce: {
    // Reminder: the first item in this object is used by pipeline builds
    sl_chrome_45_osx9: {
      base: 'SauceLabs',
      platform: 'OS X 10.9',
      browserName: 'chrome',
      version: '45'
    },
    // sl_firefox_40_osx9: {
    //   base: 'SauceLabs',
    //   platform: 'OS X 10.9',
    //   browserName: 'firefox',
    //   version: '40'
    // },
    // // FIXME Safari 8 still makes the test suite run too slowly
    // // sl_safari_8_osx10: {
    // //   base: 'SauceLabs',
    // //   platform: 'OS X 10.10',
    // //   browserName: 'safari',
    // //   version: '8'
    // // },
    sl_chrome_46_win7: {
      base: 'SauceLabs',
      platform: 'Windows 7',
      browserName: 'chrome',
      version: '46'
    }
    // sl_firefox_41_win7: {
    //   base: 'SauceLabs',
    //   platform: 'Windows 7',
    //   browserName: 'firefox',
    //   version: '41'
    // },
    // sl_firefox_41_linux: {
    //   base: 'SauceLabs',
    //   platform: 'Linux',
    //   browserName: 'firefox',
    //   version: 41
    // }
  }
};
