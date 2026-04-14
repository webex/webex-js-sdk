/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const mobiusSocketConfig = {
  /**
   * Milliseconds to wait for the auth websocket response before declaring auth failed
   * @type {number}
   */
  authResponseTimeout: process.env.MOBIUS_SOCKET_AUTH_RESPONSE_TIMEOUT || 10000,
  /**
   * Milliseconds to wait for a request/response style websocket message.
   * @type {number}
   */
  wssResponseTimeout: process.env.MOBIUS_SOCKET_RESPONSE_TIMEOUT || 10000,
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
