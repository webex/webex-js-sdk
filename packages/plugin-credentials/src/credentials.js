/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {makeStateDataType, oneFlight, retry, tap, whileInFlight} from '@ciscospark/common';
import {grantErrors, SparkPlugin} from '@ciscospark/spark-core';
import TokenCollection from './token-collection';
import Token from './token';
import {filterScope, sortScope} from './scope';
import {has, isObject, pick} from 'lodash';

export const apiScope = filterScope(`spark:kms`, process.env.CISCOSPARK_SCOPE);

// TODO browser implementation
// TODO automation tests

const Credentials = SparkPlugin.extend({
  dataTypes: {
    token: makeStateDataType(Token, `token`).dataType
  },

  props: {
    supertoken: makeStateDataType(Token, `token`).prop
  },

  session: {
    isAuthenticating: {
      default: false,
      type: `boolean`
    },
    isRefreshing: {
      default: false,
      type: `boolean`
    }
  },

  collections: {
    userTokens: TokenCollection
  },

  namespace: `Credentials`,

  /**
   * Gets a token with the specified scope
   */
  getUserToken(scope) {
    // Note: this behaves much like oneFlight, but doesn't return a unique
    // promise. Since it recursively calls iteself, oneFlight is problematic.
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.once(`change:isRefreshing`, () => {
          resolve(this.getUserToken(scope));
        });
      });
    }

    if (this.isAuthenticating) {
      return new Promise((resolve) => {
        this.once(`change:isAuthenticating`, () => {
          resolve(this.getUserToken(scope));
        });
      });
    }

    if (!scope) {
      scope = apiScope;
    }

    scope = sortScope(scope);

    const token = this.userTokens.get(scope);

    if (!token) {
      return this.supertoken.downscope(scope)
        .catch((reason) => this._handleDownscopeFailure(this.supertoken, scope, reason))
        .then(tap((t) => this.userTokens.add(t)));
    }

    return Promise.resolve(token);
  },

  _handleDownscopeFailure(supertoken, scope, reason) {
    this.logger.error(`credentials: failed to downscope new supertoken to ${scope}`, reason);
    // TODO do this with a grant error comparison
    if (reason && reason.body && reason.body.reason === `invalid_request`) {
      this.spark.measure(`splitTokenError`, {
        statusCode: reason.statusCode,
        statusMessage: reason.statusMessage,
        error: reason.body.error,
        errorDescription: reason.body.error_description
      });
      return Promise.reject(reason);
    }

    this.logger.error(`credentials: falling back to supertoken for ${scope}`);
    return Promise.resolve(this.supertoken);
  },

  getAuthorization(...args) {
    return this.getUserToken(...args);
  },

  /**
   *
   */
  @whileInFlight(`isRefreshing`)
  @oneFlight
  refresh() {
    this.logger.info(`credentials: refresh requested`);

    const supertoken = this.supertoken;

    const tokens = this.userTokens;
    this.userTokens = new TokenCollection();
    this.unset(`supertoken`);
    return supertoken.refresh()
      .then(tap(() => {
        tokens.forEach((token) => {
          this.logger.info(`credentials: revoking token for ${token.scope}`);
          token.revoke();
        });
      }))
      .then((st) => this._receiveSupertoken(st));
  },

  /**
   * Exchanges an authorization code for an access token
   */
  @whileInFlight(`isAuthenticating`)
  @oneFlight
  requestAuthorizationCodeGrant(options) {
    this.logger.info(`credentials: requesting authorization code grant`);

    options = options || {};

    if (!options.code) {
      return Promise.reject(new Error(`\`options.code\` is required`));
    }

    return this.spark.request({
      method: `POST`,
      api: `oauth`,
      resource: `access_token`,
      form: {
        grant_type: `authorization_code`,
        redirect_uri: this.config.redirect_uri,
        code: options.code,
        self_contained_token: true
      },
      auth: {
        user: this.config.client_id,
        pass: this.config.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then((res) => new Token(res.body, {parent: this}))
      .then((token) => this._receiveSupertoken(token))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  /**
   * Exchanges oauth config for a client credentials access token
   */
  @whileInFlight(`isAuthenticating`)
  @oneFlight
  requestClientCredentialsGrant(options) {
    const vars = {
      client_id: `CLIENT_ID`,
      client_secret: `CLIENT_SECRET`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    this.logger.info(`credentials: requesting client credentials grant`);

    options = options || {};
    options.scope = options.scope || `webexsquare:admin`;

    return this.spark.request({
      method: `POST`,
      api: `oauth`,
      resource: `access_token`,
      form: {
        grant_type: `client_credentials`,
        scope: options.scope,
        self_contained_token: true
      },
      auth: {
        user: this.config.client_id,
        pass: this.config.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then((res) => new Token(res.body, {parent: this}))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  /**
   * Exchanges an orgId/password/name triple for an access token. If you're
   * considering using this method, you're almost certainly interested in "bots"
   * rather than "machine accounts". See the developer portal for more
   * information.
   */
  @whileInFlight(`isAuthenticating`)
  @oneFlight
  @retry()
  requestSamlExtensionGrant(options) {
    options = options || {};
    options.scope = options.scope || this.config.scope;

    this.logger.info(`credentials: requesting SAML extension grant`);

    return this._getSamlBearerToken(options)
      .then((samlToken) => this._getOauthBearerToken(options, samlToken))
      .then((token) => this._receiveSupertoken(token))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  set(attrs, options) {
    if (isObject(attrs)) {
      if (attrs.access_token) {
        attrs = {
          supertoken: attrs
        };
      }

      if (attrs.authorization) {
        attrs = attrs.authorization;
      }

      attrs.userTokens = attrs.userTokens || [];

      if (attrs.apiToken) {
        attrs.userTokens.push(attrs.apiToken);
        Reflect.deleteProperty(attrs, `apiToken`);
      }

      if (attrs.kmsToken) {
        attrs.userTokens.push(attrs.kmsToken);
        Reflect.deleteProperty(attrs, `kmsToken`);
      }
    }

    return Reflect.apply(SparkPlugin.prototype.set, this, [attrs, options]);
  },

  /**
   * Converts a CI SAML Bearer Token to an OAuth Bearer Token.
   * @param {Object} options
   * @param {Object} options.scope
   * @param {Object} samlData Response body from the CI SAML endpoint.
   * @private
   * @return {Promise} Resolves with the bot's credentials.
   */
   @oneFlight
  _getOauthBearerToken(options, samlData) {
    this.logger.info(`credentials: exchanging SAML Bearer Token for OAuth Bearer Token`);

    const vars = {
      client_id: `CLIENT_ID`,
      client_secret: `CLIENT_SECRET`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    return this.spark.request({
      method: `POST`,
      uri: this.config.tokenUrl,
      form: {
        /* eslint camelcase: [0] */
        grant_type: `urn:ietf:params:oauth:grant-type:saml2-bearer`,
        assertion: samlData.BearerToken,
        scope: options.scope
      },
      auth: {
        user: this.config.client_id,
        pass: this.config.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then((res) => new Token(res.body, {parent: this}));
  },

  /**
   * Retrieves a CI SAML Bearer Token
   * @private
   * @return {Promise} Resolves with an Object containing a `BearerToken` and an
   * `AccountExpires`
   */
   @oneFlight
  _getSamlBearerToken(options) {
    this.logger.info(`credentials: requesting SAML Bearer Token`);

    if (!options.orgId) {
      return Promise.reject(new Error(`\`options.orgId\` is required`));
    }

    if (!options.name) {
      return Promise.reject(new Error(`\`options.name\` is required`));
    }

    if (!options.password) {
      return Promise.reject(new Error(`\`options.password\` is required`));
    }

    return this.spark.request({
      method: `POST`,
      uri: `{this.config.samlUrl}/${options.orgId}/v2/actions/GetBearerToken/invoke`,
      body: pick(options, `name`, `password`),
      shouldRefreshAccessToken: false
    })
      .then((res) => res.body);
  },

  _receiveSupertoken(supertoken) {
    const scopes = [
      `spark:kms`,
      apiScope
    ];

    return Promise.all(scopes.map((scope) => supertoken.downscope(scope)
      .catch((reason) => this._handleDownscopeFailure(supertoken, scope, reason))
    ))
    .then((newTokens) => {
      this.supertoken = supertoken;
      this.userTokens.add(newTokens);
    });
  }
});

export default Credentials;
