/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {has} from 'lodash';

import DEFAULT_KMS_CAROOTS from './kms-default-caroots';

/**
 * lodash merge combines arrays by index, so an explicit encryption.caroots
 * override (including []) would otherwise retain default root entries.
 *
 * @param {Object} webexConfig merged webex config object
 * @param {Object} [overrideConfig] config passed to initialize/setConfig
 * @returns {void}
 */
export function applyEncryptionConfigOverrides(webexConfig, overrideConfig = {}) {
  if (!webexConfig?.encryption) {
    return;
  }

  if (has(overrideConfig, 'encryption.caroots')) {
    webexConfig.encryption.caroots = overrideConfig.encryption.caroots;
  }
}

export default {
  encryption: {
    /**
     * PEM (base64 DER) encoded CA certificates trusted to sign the KMS
     * static-key certificate chain. KMS validation fails closed when this
     * list is empty; deployments MUST provide the Webex KMS issuing roots.
     * @type {Array<string>}
     */
    caroots: DEFAULT_KMS_CAROOTS,

    joseOptions: {
      compact: true,
      contentAlg: 'A256GCM',
      protect: '*',
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
    batcherMaxWait: 150,
  },
};
