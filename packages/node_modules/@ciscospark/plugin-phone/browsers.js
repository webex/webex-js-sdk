/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

// eslint-disable-next-line strict


/* eslint camelcase: [0] */
module.exports = function createBrowsers() {
  if (process.env.SC_TUNNEL_IDENTIFIER) {
    return {
      sl_chrome_latest_osx12: {
        base: 'SauceLabs',
        platform: 'OS X 10.12',
        browserName: 'chrome',
        version: 'latest',
        chromeOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream'
          ]
        }
      },
      // sl_firefox_latest_linux: {
      //   base: `SauceLabs`,
      //   platform: `Linux`,
      //   browserName: `firefox`,
      //   version: `latest`
      // }
      sl_firefox_latest_osx12: {
        base: 'SauceLabs',
        platform: 'OS X 10.12',
        browserName: 'firefox',
        version: 'latest'
      }
      // sl_firefox_latest_win7: {
      //   base: `SauceLabs`,
      //   platform: `Windows 7`,
      //   browserName: `firefox`,
      //   version: `latest`
      // }
    };
  }
  return {
    firefox_h264: {
      base: 'Firefox'
    },
    ChromeH264: {
      base: 'Chrome',
      flags: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream'
      ]
    }
  };
};
