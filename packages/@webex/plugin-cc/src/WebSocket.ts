import Mercury from '@webex/internal-plugin-mercury';
import {HTTP_METHODS} from './types';

export const webSocketConfig = {
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

class WebSocket extends Mercury {
  /**
   * @instance
   * @memberof WebSocket
   * @private
   * @type {string}
   */
  private webSocketUrl: string;

  /**
   * @instance
   * @memberof WebSocket
   * @private
   * @type {string}
   */
  private subscriptionId: string;

  /**
   * @instance
   * @memberof WebSocket
   * @private
   * @type {string}
   */
  private datachannelUrl: string;

  constructor(options: object = {}) {
    super(options);
    Mercury.prototype.initialize(this, options);
  }

  /**
   * Updates the Mercury config
   * @private
   * @type {string}
   */
  private updateConfig(config: Record<string, any>): void {
    Object.keys(config).forEach((key) => {
      this.config[key] = config[key];
    });
  }

  initialize(): void {
    this.updateConfig(webSocketConfig);
  }

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
      method: HTTP_METHODS.POST,
      url: datachannelUrl,
      body,
    })
      .then((res) => {
        this.webSocketUrl = res.body.webSocketUrl;
        this.subscriptionId = res.body.subscriptionId;
      })
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Subscribe and connect to the websocket
   * @param {object} params
   * @param {string} params.datachannelUrl
   * @param {object} params.body
   * @returns {Promise<void>}
   */
  subscribeAndConnect({
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
  }

  /**
   * Tells if WebSocket socket is connected
   * @returns {boolean} connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the subscriptionId for the connection
   * @returns {string} subscriptionId
   */
  getSubscriptionId(): string | undefined {
    return this.subscriptionId;
  }

  /**
   * Get data channel URL for the connection
   * @returns {string} data channel Url
   */
  getDatachannelUrl(): string | undefined {
    return this.datachannelUrl;
  }

  /**
   * Disconnects websocket connection
   * @returns {Promise<void>}
   */
  disconnectWebSocket(): Promise<void> {
    return this.disconnect().then(() => {
      this.datachannelUrl = undefined;
      this.subscriptionId = undefined;
      this.webSocketUrl = undefined;
    });
  }
}

export default WebSocket;
