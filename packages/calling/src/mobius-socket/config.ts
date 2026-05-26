/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export interface MobiusSocketConfig {
  /** Milliseconds to wait for websocket request/response messages, including auth. */
  wssResponseTimeout: number;
  /** Maximum milliseconds between connection attempts. */
  backoffTimeMax: number;
  /** Initial milliseconds between connection attempts. */
  backoffTimeReset: number;
  /** Maximum number of retries for the initial connect() flow before rejecting. */
  initialConnectionMaxRetries: number;
  /** Maximum number of retries for reconnect attempts. 0 means unlimited. */
  maxRetries: number;
  /** Milliseconds to wait for a close frame before forcing closure. */
  forceCloseDelay: number;
  /** Maximum eventIds retained in the dedup cache to suppress duplicate async_event messages. */
  dedupCacheMaxSize: number;
}

const mobiusSocketConfig: MobiusSocketConfig = {
  wssResponseTimeout: 10000,
  backoffTimeMax: 32000,
  backoffTimeReset: 1000,
  initialConnectionMaxRetries: 0,
  maxRetries: 3,
  forceCloseDelay: 2000,
  dedupCacheMaxSize: 1000,
};

export default {
  mobiusSocket: mobiusSocketConfig,
};
