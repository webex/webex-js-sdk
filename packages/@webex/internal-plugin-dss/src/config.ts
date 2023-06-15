/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */

export default {
  dss: {
    /**
     * Debounce wait (ms) before sending a dss request (gap between lookups that will trigger a request)
     * @type {Number}
     */
    batcherWait: 50,

    /**
     * Maximum queue size before sending a dss request
     * @type {Number}
     */
    batcherMaxCalls: 50,

    /**
     * Debounce max wait (ms) before sending a dss request (time from first lookup that will trigger a request)
     * @type {Number}
     */
    batcherMaxWait: 150,
  },
};
