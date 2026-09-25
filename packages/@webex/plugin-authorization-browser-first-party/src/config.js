/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export const getClientAuthenticationOptions = (config) => {
  if (config.clientType === 'public') {
    return {
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

    refreshCallback(webex, token) {
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
