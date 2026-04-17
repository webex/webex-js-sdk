/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const mobiusSocketConfig = {
  /**
   * Milliseconds to wait for websocket request/response messages, including auth.
   * @type {number}
   */
  wssResponseTimeout:
    process.env.MOBIUS_SOCKET_RESPONSE_TIMEOUT ||
    process.env.MOBIUS_SOCKET_AUTH_RESPONSE_TIMEOUT ||
    10000,
  /**
   * Maximum milliseconds between connection attempts
   * @type {Number}
   */
  backoffTimeMax: process.env.MOBIUS_SOCKET_BACKOFF_TIME_MAX || 32000,
  /**
   * Initial milliseconds between connection attempts
   * @type {Number}
   */
  backoffTimeReset: process.env.MOBIUS_SOCKET_BACKOFF_TIME_RESET || 1000,
  /**
   * Maximum number of retries for the initial connect() flow before rejecting.
   * @type {Number}
   */
  initialConnectionMaxRetries: process.env.MOBIUS_SOCKET_INITIAL_CONNECTION_MAX_RETRIES || 2,
  /**
   * Maximum number of retries for reconnect attempts after the socket has connected once.
   * A value of 0 means unlimited reconnect retries.
   * @type {Number}
   */
  maxRetries: process.env.MOBIUS_SOCKET_MAX_RETRIES || 0,
  /**
   * Milliseconds to wait for a close frame before declaring the socket dead and
   * discarding it
   * @type {number}
   */
  forceCloseDelay: process.env.MOBIUS_SOCKET_FORCE_CLOSE_DELAY || 2000,
  /**
   * When logging out, use default reason which can trigger a reconnect,
   * or set to something else, like `done (permanent)` to prevent reconnect
   * @type {String}
   */
  beforeLogoutOptionsCloseReason: process.env.MOBIUS_SOCKET_LOGOUT_REASON || 'done (forced)',
};

export default {
  mobiusSocket: mobiusSocketConfig,
};
