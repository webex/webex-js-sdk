/**
 * Default configuration for the Webex Contact Center SDK.
 *
 * @public
 * @example
 * import config from './config';
 * const allowMultiLogin = config.cc.allowMultiLogin;
 * @ignore
 */
export default {
  /**
   * Contact Center configuration options.
   * @public
   */
  cc: {
    /**
     * Whether to allow multiple logins from different devices.
     * @type {boolean}
     * @default false
     */
    allowMultiLogin: false,
    /**
     * Whether to automatically attempt relogin on connection loss.
     * @type {boolean}
     * @default true
     */
    allowAutomatedRelogin: true,
    /**
     * The type of client making the connection.
     * @type {string}
     * @default 'WebexCCSDK'
     */
    clientType: 'WebexCCSDK',
    /**
     * Whether to enable keep-alive messages.
     * @type {boolean}
     * @default false
     */
    isKeepAliveEnabled: false,
    /**
     * Whether to force registration.
     * @type {boolean}
     * @default true
     */
    force: true,
    /**
     * Metrics configuration for the client.
     * @public
     */
    metrics: {
      /**
       * Name of the client for metrics.
       * @type {string}
       * @default 'WEBEX_JS_SDK'
       */
      clientName: 'WEBEX_JS_SDK',
      /**
       * Type of client for metrics.
       * @type {string}
       * @default 'WebexCCSDK'
       */
      clientType: 'WebexCCSDK',
    },
  },
};
