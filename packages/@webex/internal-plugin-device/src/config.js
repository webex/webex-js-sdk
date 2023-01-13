import {inBrowser, deviceType} from '@webex/common';

export default {
  device: {
    /**
     * The duration to wait for the catalog to populate in seconds.
     *
     * @type {number}
     */
    canRegisterWaitDuration: 10,

    /**
     * The default configuration group when sending registration requests.
     *
     * @type {Object}
     */
    defaults: {
      /**
       * The default body configuration of registration requests.
       *
       * @type {Object}
       */
      body: {
        name:
          (typeof process.title === 'string' ? process.title.trim() : undefined) ||
          (inBrowser && 'browser') ||
          'javascript',
        deviceType: deviceType.WEB,
        model: 'web-js-sdk',
        localizedModel: 'webex-js-sdk',
        systemName: 'WEBEX_JS_SDK',
        systemVersion: '1.0.0',
      },
    },

    /**
     * When true, the **wdm** service will enforce an inactivity duration.
     *
     * @type {boolean}
     */
    enableInactivityEnforcement: false,

    /**
     * When true, the device registration will include a ttl value of
     * {@link config.device.ephemeralDeviceTTL} and refresh on an interval of
     * {@link config.device.ephemeralDeviceTTL} / 2 + 60 seconds.
     *
     * @type {boolean}
     */
    ephemeral: false,

    /**
     * The ttl value to include in device registration if
     * {@link config.device.ephemeral} is true. Measured in seconds.
     *
     * @type {boolean}
     */
    ephemeralDeviceTTL: 30 * 60,
  },
};
