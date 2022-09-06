/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {MemoryStoreAdapter} from './lib/storage';
import CredentialsConfig from './credentials-config';

export default {
  maxAppLevelRedirects: 10,
  maxLocusRedirects: 5,
  maxAuthenticationReplays: 1,
  maxReconnectAttempts: 1,
  onBeforeLogout: [],
  trackingIdPrefix: 'webex-js-sdk',
  trackingIdSuffix: '',
  AlternateLogger: undefined,
  credentials: new CredentialsConfig(),
  fedramp: process.env.ENABLE_FEDRAMP || false,
  services: {
    /**
     * A list of services that are available prior to catalog collection.
     *
     * @type {Object}
     */
    discovery: {
      /**
       * The hydra discovery url.
       *
       * @type {string}
       */
      hydra: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',

      /**
       * The u2c discovery url
       *
       * @type {string}
       */
      u2c: process.env.U2C_SERVICE_URL || 'https://u2c.wbx2.com/u2c/api/v1'
    },

    /**
     * When true, considers all urls in `allowedDomains` as safe for auth tokens
     *
     * @type {boolean}
     */
    validateDomains: true,

    /**
     * services that don't need auth validation
     */

    servicesNotNeedValidation: [
      'webex-appapi-service'
    ],

    /**
     * Contains a list of allowed domain host addresses.
     *
     * @type {Array<string>}
     */
    allowedDomains: [
      'wbx2.com',
      'ciscospark.com',
      'webex.com',
      'webexapis.com',
      'broadcloudpbx.com',
      'broadcloud.eu',
      'broadcloud.com.au',
      'broadcloudpbx.net'
    ]
  },
  device: {
    preDiscoveryServices: {
      hydra: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',
      hydraServiceUrl: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1'
    },
    validateDomains: true,
    // It is okay to pass the auth token to the following domains:
    whitelistedServiceDomains: [
      'wbx2.com',
      'ciscospark.com',
      'webex.com'
    ]
  },
  metrics: {
    type: ['behavioral', 'operational']
  },
  payloadTransformer: {
    predicates: [],
    transforms: []
  },
  storage: {
    boundedAdapter: MemoryStoreAdapter,
    unboundedAdapter: MemoryStoreAdapter
  }
};
