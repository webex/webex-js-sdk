/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {MemoryStoreAdapter} from './';

export default {
  maxAppLevelRedirects: 10,
  maxAuthenticationReplays: 1,
  maxReconnectAttempts: 1,
  trackingIdPrefix: `spark-js-sdk`,
  trackingIdSuffix: ``,
  AlternateLogger: undefined,
  credentials: {
    /**
     * @description Indicates whether this application should use the Implicit
     * Grant flow (public client) or Authorization Code Grant flow (confidential client)
     * one of 'public' or 'confidential'
     * @type {string}
     */
    clientType: `public`,
    oauth: {
      authorizationUrl: `https://idbroker.webex.com/idb/oauth2/v1/authorize`,
      client_id: process.env.CISCOSPARK_CLIENT_ID || process.env.COMMON_IDENTITY_CLIENT_ID || process.env.CLIENT_ID,
      client_secret: process.env.CISCOSPARK_CLIENT_SECRET || process.env.COMMON_IDENTITY_CLIENT_SECRET || process.env.CLIENT_SECRET,
      redirect_uri: process.env.CISCOSPARK_REDIRECT_URI || process.env.COMMON_IDENTITY_REDIRECT_URI || process.env.REDIRECT_URI,
      scope: process.env.CISCOSPARK_SCOPE || process.env.CISCOSPARK_SCOPES || process.env.COMMON_IDENTITY_SCOPE || process.env.SCOPE,
      service: `spark`,
      revokeUrl: `https://idbroker.webex.com/idb/oauth2/v1/revoke`,
      tokenUrl: `https://idbroker.webex.com/idb/oauth2/v1/access_token`
    },
    logoutUri: `https://idbroker.webex.com/idb/oauth2/v1/logout`,
    samlUrl: `https://idbroker.webex.com/idb/token`,
    hydraServiceUrl: process.env.HYDRA_SERVICE_URL || `https://api.ciscospark.com/v1`
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
