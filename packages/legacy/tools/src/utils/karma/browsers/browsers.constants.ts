const CHROME_COMMON = {
  flags: [
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
  'goog:chromeOptions': {
    args: [
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
};

const FIREFOX_COMMON = {
  prefs: {
    'dom.webnotifications.enabled': false,
    'media.webrtc.hw.h264.enabled': true,
    'media.getusermedia.screensharing.enabled': true,
    'media.navigator.permission.disabled': true,
    'media.navigator.streams.fake': true,
    'media.peerconnection.video.h264_enabled': true,
  },
  'moz:firefoxOptions': {
    prefs: {
      'dom.webnotifications.enabled': false,
      'media.webrtc.hw.h264.enabled': true,
      'media.getusermedia.screensharing.enabled': true,
      'media.navigator.permission.disabled': true,
      'media.navigator.streams.fake': true,
      'media.peerconnection.video.h264_enabled': true,
    },
  },
};

const CHROME = {
  HEADED: {
    Chrome_H264: {
      base: 'Chrome',
      ...CHROME_COMMON,
    },
  },
  HEADLESS: {
    ChromeHeadless_H264: {
      base: 'ChromeHeadless',
      ...CHROME_COMMON,
    },
  },
};

const FIREFOX = {
  HEADED: {
    Firefox_H264: {
      base: 'Firefox',
      ...FIREFOX_COMMON,
    },
  },
  HEADLESS: {
    FirefoxHeadless_H264: {
      base: 'FirefoxHeadless',
      ...FIREFOX_COMMON,
    },
  },
};

const CONSTANTS = {
  CHROME,
  CHROME_COMMON,
  FIREFOX,
  FIREFOX_COMMON,
};

export default CONSTANTS;
