const webSocketConfig = {
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

export default webSocketConfig;
