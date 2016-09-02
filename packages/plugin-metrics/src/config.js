/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

export default {
  metrics: {
    appType: typeof window === `undefined` ? `nodejs` : `browser`,
    batcherWait: 500,
    batcherMaxCalls: 50,
    batcherMaxWait: 1500,
    batcherRetryPlateau: 32000
  }
};
