/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export interface MobiusSocketConfig {
  wssResponseTimeout: number;
  backoffTimeMax: number;
  backoffTimeReset: number;
  initialConnectionMaxRetries: number;
  maxRetries: number;
  forceCloseDelay: number;
  dedupCacheMaxSize: number;
}

const mobiusSocketConfig: MobiusSocketConfig = {
  /** Milliseconds to wait for websocket request/response messages, including auth. */
  wssResponseTimeout: 10000,
  /** Maximum milliseconds between connection attempts. */
  backoffTimeMax: 32000,
  /** Initial milliseconds between connection attempts. */
  backoffTimeReset: 1000,
  /** Maximum number of retries for the initial connect() flow before rejecting. */
  initialConnectionMaxRetries: 0,
  /** Maximum number of retries for reconnect attempts. 0 means unlimited. */
  maxRetries: 0,
  /** Milliseconds to wait for a close frame before forcing closure. */
  forceCloseDelay: 2000,
  /** Maximum eventIds retained in the dedup cache to suppress duplicate async_event messages. */
  dedupCacheMaxSize: 1000,
};

export default {
  mobiusSocket: mobiusSocketConfig,
};
