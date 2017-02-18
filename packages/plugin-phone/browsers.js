// eslint-disable-next-line strict
'use strict';

/* eslint camelcase: [0] */
const path = require(`path`);
module.exports = function createBrowsers() {
  const browsers = {
    local: {
      firefox_h264: {
        base: `Firefox`,
        profile: path.join(__dirname, `../../.tmp/selenium/mac`)
      },
      ChromeH264: {
        base: `Chrome`,
        flags: [
          `--use-fake-device-for-media-stream`,
          `--use-fake-ui-for-media-stream`
        ]
      }
    },
    sauce: {
      sl_chrome_latest_osx11: {
        base: `SauceLabs`,
        platform: `OS X 10.11`,
        browserName: `chrome`,
        version: `latest`,
        chromeOptions: {
          args: [
            `--use-fake-device-for-media-stream`,
            `--use-fake-ui-for-media-stream`
          ]
        }
      }
      // sl_firefox_latest_linux: {
      //   base: `SauceLabs`,
      //   platform: `Linux`,
      //   browserName: `firefox`,
      //   version: `latest`
      // }
      // For reasons not presently clear, getUserMedia hangs in Firefox latest
      // on mac and windows. We have a ticket open with Sauce to find out why
      // sl_firefox_latest_osx11: {
      //   base: `SauceLabs`,
      //   platform: `OS X 10.11`,
      //   browserName: `firefox`,
      //   version: `latest`
      // }
      // sl_firefox_latest_win7: {
      //   base: `SauceLabs`,
      //   platform: `Windows 7`,
      //   browserName: `firefox`,
      //   version: `latest`
      // }
    }
  };

  return browsers;
};
