/* eslint-disable */

'use strict';

module.exports = function() {
  var browsers = {
    local: {
      Firefox: {},
      ChromeH264: {
        base: 'Chrome',
        flags: [
          '--enable-features=WebRTC-H264WithOpenH264FFmpeg',
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream'
        ]
      }
    },

    sauce: {
      // Reminder: the first item in this object is used by pipeline builds
      // FIXME getUserMedia hangs on osx and windows firefox when run on sauce
      // labs
      sl_firefox_latest_linux: {
        base: 'SauceLabs',
        platform: 'Linux',
        browserName: 'firefox',
        version: 'latest'
      },
      // sl_firefox_latest_osx11: {
      //   base: 'SauceLabs',
      //   platform: 'OS X 10.11',
      //   browserName: 'firefox',
      //   version: 'latest'
      // },
      // sl_firefox_latest_win7: {
      //   base: 'SauceLabs',
      //   platform: 'Windows 7',
      //   browserName: 'firefox',
      //   version: 'latest'
      // }
    }
  };

  return browsers;
};
