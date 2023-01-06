/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Refreshes an access token
 * @param {Webex} webex
 * @param {Token} token
 * @returns {Object}
 */
export default function refreshCallback(webex, token) {
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
    .then(({body}) => body);
  /* eslint-enable camelcase */
}
