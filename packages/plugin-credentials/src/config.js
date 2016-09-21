/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  credentials: {
    clientType: `public`,

    // eslint-disable-next-line camelcase
    client_id: process.env.CISCOSPARK_CLIENT_ID,
    // eslint-disable-next-line camelcase
    client_secret: process.env.CISCOSPARK_CLIENT_SECRET,
    // eslint-disable-next-line camelcase
    redirect_uri: process.env.CISCOSPARK_REDIRECT_URI,
    scope: process.env.CISCOSPARK_SCOPE,
    service: `spark`,

    logoutUri: process.env.CISCOSPARK_LOGOUT_URI || `https://idbroker.webex.com/idb/saml2/jsp/doSSO.jsp`
  },
  device: {
    preDiscoveryServices: {
      oauthServiceUrl: process.env.OAUTH_SERVICE_URL || `https://idbroker.webex.com/idb/oauth2/v1`,
      samlServiceUrl: process.env.SAML_SERVICE_URL || `https://idbroker.webex.com/idb/token`
    }
  }
};
