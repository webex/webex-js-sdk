/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

export default {
  maxAppLevelRedirects: 10,
  maxAuthenticationReplays: 1,
  maxReconnectAttempts: 1,
  trackingIdPrefix: `spark-js-sdk`,
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
      scope: process.env.CISCOSPARK_SCOPE || process.env.COMMON_IDENTITY_SCOPE || process.env.SCOPE,
      service: `spark`,
      revokeUrl: `https://idbroker.webex.com/idb/oauth2/v1/revoke`,
      tokenUrl: `https://idbroker.webex.com/idb/oauth2/v1/access_token`
    },
    logoutUri: `https://idbroker.webex.com/idb/saml2/jsp/doSSO.jsp`,
    samlUrl: `https://idbroker.webex.com/idb/token`
  }
};
