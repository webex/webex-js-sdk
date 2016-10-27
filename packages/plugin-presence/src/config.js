/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  presence: {
    batcherWait: 100,
    batcherMaxCalls: 50,
    batcherMaxWait: 1500,

    /**
     * @description Milliseconds a cached presence is considered valid
     * @type {number}
     */
    cacheExpiration: 30 * 1000
  }
};
