/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

export default {
  user: {
    /**
     * Debounce wait before requesting a UUID
     * @type {Number}
     */
    batchWait: 500,

    /**
     * Maximum queue size before requesting a UUID
     * @type {Number}
     */
    batchMaxCalls: 100,

    /**
     * Debounce max wait before requesting a UUID
     * @type {Number}
     */
    batchMaxWait: 1500
  }
};
