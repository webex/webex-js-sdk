/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export const getClientAuthenticationOptions = (config) => {
  if (config.clientType === 'public') {
    return {
      addAuthHeader: false,
      form: {
        client_id: config.client_id,
      },
    };
  }

  return {
    auth: {
      user: config.client_id,
      pass: config.client_secret,
      sendImmediately: true,
    },
  };
};

export default {
  credentials: {
    /**
     * Controls how the OAuth client authenticates with the token endpoint.
     * Public clients send their client ID in the request form. Confidential
     * clients use HTTP Basic authentication with their client secret.
     * @private
     * @type {string}
     */
    clientType: 'public',

    /**
     * @param {Webex} webex
     * @param {Token} token
     * @param {Object} [options={}]
     * @param {string} [options.scope] Scope to request on refresh, if same or narrower than existing scope
     * @param {string} [options.upgradeScope] Scope to request on refresh, if broader than existing scope
     * @returns {Promise<Object>}
     */
    refreshCallback(webex, token, {scope, upgradeScope} = {}) {
      /* eslint-disable camelcase */
      const {form: clientForm = {}, ...clientAuthentication} = getClientAuthenticationOptions(
        token.config
      );

      return webex
        .request({
          method: 'POST',
          uri: token.config.tokenUrl,
          form: {
            grant_type: 'refresh_token',
            redirect_uri: token.config.redirect_uri,
            refresh_token: token.refresh_token,
            ...(scope && {scope}),
            ...(upgradeScope && {upgrade_scope: upgradeScope}),
            ...clientForm,
          },
          ...clientAuthentication,
          shouldRefreshAccessToken: false,
        })
        .then((res) => res.body);
      /* eslint-enable camelcase */
    },
  },
};
