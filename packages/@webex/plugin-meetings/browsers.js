/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// eslint-disable-next-line strict

/* eslint camelcase: [0] */
module.exports = function createBrowsers() {
  if (process.env.SC_TUNNEL_IDENTIFIER || process.env.SAUCE) {
    return {
      sl_chrome_latest_macOS_Catalina: {
        base: 'SauceLabs',
        platform: 'macOS 10.15',
        browserName: 'Chrome',
        version: 'latest',
        extendedDebugging: true,
        'goog:chromeOptions': {
          args: [
            '--disable-features=WebRtcHideLocalIpsWithMdns',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
        flags: [
          '--disable-features=WebRtcHideLocalIpsWithMdns',
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
        ],
      },
      sl_edge_latest_Win_10: {
        base: 'SauceLabs',
        platform: 'Windows 10',
        browserName: 'MicrosoftEdge',
        version: 'latest',
        extendedDebugging: true,
        'ms:edgeOptions': {
          args: [
            '--disable-features=WebRtcHideLocalIpsWithMdns',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
      // sl_firefox_latest_linux: {
      //   base: 'SauceLabs',
      //   platform: 'Linux',
      //   browserName: 'firefox',
      //   version: 'latest'
      // }
      sl_safari_latest_macOS_Catalina: {
        base: 'SauceLabs',
        platform: 'macOS 10.15',
        browserName: 'Safari',
        version: 'latest',
        'webkit:WebRTC': {
          DisableInsecureMediaCapture: true,
        },
      },
      sl_firefox_macOS_Catalina: {
        base: 'SauceLabs',
        platform: 'macOS 10.15',
        browserName: 'Firefox',
        extendedDebugging: true,
        'moz:firefoxOptions': {
          args: ['-start-debugger-server', '9222'],
          prefs: {
            'devtools.chrome.enabled': true,
            'devtools.debugger.prompt-connection': false,
            'devtools.debugger.remote-enabled': true,
            'dom.webnotifications.enabled': false,
            'media.webrtc.hw.h264.enabled': true,
            'media.getusermedia.screensharing.enabled': true,
            'media.navigator.permission.disabled': true,
            'media.navigator.streams.fake': true,
            'media.peerconnection.video.h264_enabled': true,
          },
        },
      },
      // sl_firefox_latest_win7: {
      //   base: `SauceLabs`,
      //   platform: `Windows 7`,
      //   browserName: `firefox`,
      // }
    };
  }

  return {
    firefox_h264: {
      base: 'FirefoxHeadless',
      prefs: {
        'dom.webnotifications.enabled': false,
        'media.webrtc.hw.h264.enabled': true,
        'media.getusermedia.screensharing.enabled': true,
        'media.navigator.permission.disabled': true,
        'media.navigator.streams.fake': true,
        'media.peerconnection.video.h264_enabled': true,
      },
    },
    ChromeH264: {
      base: 'ChromeHeadless',
      flags: [
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
  };
};
