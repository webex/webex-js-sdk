import Mercury from '@webex/internal-plugin-mercury';

export const mercuryConfig = {
  /**
   * Milliseconds between pings sent up the socket
   * @type {number}
   */
  pingInterval: process.env.MERCURY_PING_INTERVAL || 15000,
  /**
   * Milliseconds to wait for a pong before declaring the connection dead
   * @type {number}
   */
  pongTimeout: process.env.MERCURY_PONG_TIMEOUT || 14000,
  /**
   * Maximum milliseconds between connection attempts
   * @type {Number}
   */
  backoffTimeMax: process.env.MERCURY_BACKOFF_TIME_MAX || 32000,
  /**
   * Initial milliseconds between connection attempts
   * @type {Number}
   */
  backoffTimeReset: process.env.MERCURY_BACKOFF_TIME_RESET || 1000,
  /**
   * Milliseconds to wait for a close frame before declaring the socket dead and
   * discarding it
   * @type {[type]}
   */
  forceCloseDelay: process.env.MERCURY_FORCE_CLOSE_DELAY || 2000,
  /**
   * When logging out, use default reason which can trigger a reconnect,
   * or set to something else, like `done (permanent)` to prevent reconnect
   * @type {String}
   */
  beforeLogoutOptionsCloseReason: process.env.MERCURY_LOGOUT_REASON || 'done (forced)',

  /**
   * Whether or not to authorize the websocket connection with the user's token
   *
   */
  authorizationRequired: false,
  /**
   * Whether or not to acknowledge the messenges received from the websocket
   *
   */
  acknowledgementRequired: false,
};

const CCMercury = Mercury.extend({
  /**
   * @instance
   * @memberof CCMercury
   * @private
   * @type {string}
   */
  webSocketUrl: undefined,

  /**
   * @instance
   * @memberof CCMercury
   * @private
   * @type {string}
   */
  binding: undefined,

  /**
   * @instance
   * @memberof CCMercury
   * @private
   * @type {string}
   */
  datachannelUrl: undefined,

  /**
   * updates the Mercury config
   * @private
   * @type {string}
   */
  updateConfig(config) {
    Object.keys(config).forEach((key) => {
      this.config[key] = config[key];
    });
  },

  initialize() {
    this.updateConfig(mercuryConfig);
  },

  // TODO: this will be moved to a separate file in request module/file
  /**
   * Register to the websocket
   * @param {object} params
   * @param {string} params.datachannelUrl
   * @param {object} params.body
   * @returns {Promise<void>}
   */
  subscribeNotifications({
    datachannelUrl,
    body,
  }: {
    datachannelUrl: string;
    body: object;
  }): Promise<void> {
    return this.request({
      method: 'POST',
      url: datachannelUrl,
      body,
    })
      .then((res) => {
        this.webSocketUrl = res.body.webSocketUrl;
        this.binding = res.body.subscriptionId;
      })
      .catch((error) => {
        this.logger.error(`Error connecting to websocket: ${error}`);
        throw error;
      });
  },

  /**
   * Register and connect to the websocket
   * @param {object} params
   * @param {string} params.datachannelUrl
   * @param {object} params.body
   * @returns {Promise<void>}
   */
  establishConnection({
    datachannelUrl,
    body,
  }: {
    datachannelUrl: string;
    body: object;
  }): Promise<void> {
    return this.subscribeNotifications({datachannelUrl, body}).then(() => {
      if (!datachannelUrl) return undefined;
      this.datachannelUrl = datachannelUrl;

      return this.connect(this.webSocketUrl);
    });
  },

  /**
   * Tells if LLM socket is connected
   * @returns {boolean} connected
   */
  isConnected(): boolean {
    return this.connected;
  },

  /**
   * Tells if LLM socket is binding
   * @returns {string} binding
   */
  getBinding(): string {
    return this.binding;
  },

  /**
   * Get data channel URL for the connection
   * @returns {string} data channel Url
   */
  getDatachannelUrl(): string {
    return this.datachannelUrl;
  },

  /**
   * Disconnects websocket connection
   * @returns {Promise<void>}
   */
  disconnectLLM(): Promise<void> {
    return this.disconnect().then(() => {
      this.locusUrl = undefined;
      this.datachannelUrl = undefined;
      this.binding = undefined;
      this.webSocketUrl = undefined;
    });
  },
});

export default CCMercury;
