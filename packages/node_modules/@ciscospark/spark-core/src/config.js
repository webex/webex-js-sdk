/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {MemoryStoreAdapter} from './lib/storage';

const IDBROKER_BASE_URL = process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com';

export default {
  maxAppLevelRedirects: 10,
  maxAuthenticationReplays: 1,
  maxReconnectAttempts: 1,
  onBeforeLogout: [],
  trackingIdPrefix: 'spark-js-sdk',
  trackingIdSuffix: '',
  AlternateLogger: undefined,
  credentials: {
    /**
     * This is the authorization url displayed on the
     * {@link developer portal|https://developer.ciscospark.com}
     * @type {string}
     */
    authorizationString: process.env.CISCOSPARK_AUTHORIZATION_STRING || process.env.AUTHORIZATION_STRING,
    /**
     * Authorization URL which prompts for user's password. Inferred from
     * {@link config.credentials.authorizationString}
     * @type {string}
     */
    authorizeUrl: process.env.AUTHORIZE_URL || `${IDBROKER_BASE_URL}/idb/oauth2/v1/authorize`,
    // TODO does hydra also have an access_token endpoint?
    /**
     * Token URL used for token refresh and auth code exchange
     * @type {string}
     */
    tokenUrl: process.env.TOKEN_URL || `${IDBROKER_BASE_URL}/idb/oauth2/v1/access_token`,
    revokeUrl: process.env.REVOKE_URL || `${IDBROKER_BASE_URL}/idb/oauth2/v1/revoke`,
    /**
     * URL to load when the app logs out
     * @type {string}
     */
    logoutUrl: `${IDBROKER_BASE_URL}/idb/oauth2/v1/logout`,
    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    client_id: process.env.CISCOSPARK_CLIENT_ID || process.env.COMMON_IDENTITY_CLIENT_ID || process.env.CLIENT_ID,
    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    client_secret: process.env.CISCOSPARK_CLIENT_SECRET || process.env.COMMON_IDENTITY_CLIENT_SECRET || process.env.CLIENT_SECRET,
    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    redirect_uri: process.env.CISCOSPARK_REDIRECT_URI || process.env.COMMON_IDENTITY_REDIRECT_URI || process.env.REDIRECT_URI,
    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    scope: process.env.CISCOSPARK_SCOPE || process.env.CISCOSPARK_SCOPES || process.env.COMMON_IDENTITY_SCOPE || process.env.SCOPE,
    /**
     * Controls the UI of the CI login page.
     * @private
     * @type {string}
     */
    cisService: 'spark'
  },
  device: {
    preDiscoveryServices: {
      hydraServiceUrl: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1'
    }
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
