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
  wssResponseTimeout: 10000,
  backoffTimeMax: 32000,
  backoffTimeReset: 1000,
  initialConnectionMaxRetries: 0,
  maxRetries: 0,
  forceCloseDelay: 2000,
  dedupCacheMaxSize: 1000,
};

export default {
  mobiusSocket: mobiusSocketConfig,
};
