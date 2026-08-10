/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export default {
  credentials: {
    /**
     * Enables retention of the automatic startup authorization-code grant outcome.
     * @type {boolean}
     */
    enableInitialAuthorizationCodeGrantOutcomeTracking: false,
    /**
     * Controls whether {@link Authorization#initiateLogin()} requests a token
     * or an auth code. Anything other than 'confidential' will be treated as
     * 'public'
     * @private
     * @type {string}
     */
    clientType: 'public',

    /**
     * Exchanges a refresh token for a new token bundle.
     * @param {Webex} webex
     * @param {Token} token
     * @returns {Promise<Object>}
     */
    refreshCallback(webex, token) {
      /* eslint-disable camelcase */
      return webex
        .request({
          method: 'POST',
          uri: token.config.tokenUrl,
          form: {
            grant_type: 'refresh_token',
            redirect_uri: token.config.redirect_uri,
            refresh_token: token.refresh_token,
          },
          auth: {
            user: token.config.client_id,
            pass: token.config.client_secret,
            sendImmediately: true,
          },
          shouldRefreshAccessToken: false,
        })
        .then((res) => res.body);
      /* eslint-enable camelcase */
    },
  },
};
