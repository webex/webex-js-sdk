/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export default {
  encryption: {
    joseOptions: {
      compact: true,
      contentAlg: 'A256GCM',
      protect: '*'
    },

    /**
     * Initial timeout before contacting KMS with a new request
     * @type {Number}
     */
    kmsInitialTimeout: 6000,

    /**
     * Maximum timeout before negotiating a new ECDH key
     * and contacting KMS with a new request
     * @type {Number}
     */
    kmsMaxTimeout: 32000,

    /**
     * Maximum timeout after negotiating several ECDH keys
     * @type {Number}
     */
    ecdhMaxTimeout: 32000 * 3,

    /**
     * Debounce wait before sending a kms request
     * @type {Number}
     */
    batcherWait: 50,

    /**
     * Maximum queue size before sending a kms request
     * @type {Number}
     */
    batcherMaxCalls: 50,

    /**
     * Debounce max wait before sending a kms metric
     * @type {Number}
     */
    batcherMaxWait: 150
  }
};
