/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export interface MobiusSocketConfig {
  wssResponseTimeout: string | number;
  backoffTimeMax: string | number;
  backoffTimeReset: string | number;
  initialConnectionMaxRetries: string | number;
  maxRetries: string | number;
  forceCloseDelay: string | number;
  beforeLogoutOptionsCloseReason: string;
  dedupCacheMaxSize: string | number;
}

const mobiusSocketConfig: MobiusSocketConfig = {
  /**
   * Milliseconds to wait for websocket request/response messages, including auth.
   * Type: string | number
   */
  wssResponseTimeout:
    process.env.MOBIUS_SOCKET_RESPONSE_TIMEOUT ||
    process.env.MOBIUS_SOCKET_AUTH_RESPONSE_TIMEOUT ||
    10000,
  /**
   * Maximum milliseconds between connection attempts
   * Type: string | number
   */
  backoffTimeMax: process.env.MOBIUS_SOCKET_BACKOFF_TIME_MAX || 32000,
  /**
   * Initial milliseconds between connection attempts
   * Type: string | number
   */
  backoffTimeReset: process.env.MOBIUS_SOCKET_BACKOFF_TIME_RESET || 1000,
  /**
   * Maximum number of retries for the initial connect() flow before rejecting.
   * Type: string | number
   */
  initialConnectionMaxRetries: process.env.MOBIUS_SOCKET_INITIAL_CONNECTION_MAX_RETRIES || 0,
  /**
   * Maximum number of retries for reconnect attempts after the socket has connected once.
   * A value of 0 means unlimited reconnect retries.
   * Type: string | number
   */
  maxRetries: process.env.MOBIUS_SOCKET_MAX_RETRIES || 0,
  /**
   * Milliseconds to wait for a close frame before declaring the socket dead and
   * discarding it
   * Type: string | number
   */
  forceCloseDelay: process.env.MOBIUS_SOCKET_FORCE_CLOSE_DELAY || 2000,
  /**
   * When logging out, use default reason which can trigger a reconnect,
   * or set to something else, like `done (permanent)` to prevent reconnect
   * Type: string
   */
  beforeLogoutOptionsCloseReason: process.env.MOBIUS_SOCKET_LOGOUT_REASON || 'done (forced)',
  /**
   * Maximum number of eventIds to retain in the dedup cache for suppressing
   * duplicate async_event messages retransmitted by the server.
   * Type: string | number
   */
  dedupCacheMaxSize: process.env.MOBIUS_SOCKET_DEDUP_CACHE_MAX_SIZE || 1000,
};

export default {
  mobiusSocket: mobiusSocketConfig,
};
