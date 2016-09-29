/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {base64, makeStateDataType, oneFlight, retry, tap, whileInFlight} from '@ciscospark/common';
import {grantErrors, SparkPlugin} from '@ciscospark/spark-core';
import TokenCollection from '../token-collection';
import Token from '../token';
import {filterScope, sortScope} from '../scope';
import {clone, has, isObject, pick} from 'lodash';
import {persist, waitForValue} from '@ciscospark/spark-core';
import {deprecated} from 'core-decorators';
import querystring from 'querystring';

export const apiScope = filterScope(`spark:kms`, process.env.CISCOSPARK_SCOPE);

export default {
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

  derived: {
    canAuthorize: {
      cache: false,
      deps: [
        `supertoken`,
        `supertoken.canAuthorize`,
        `canRefresh`
      ],
      fn() {
        // Note that Token#canAuthorize and Credentials#canAuthorize have
        // separate rules. Credentials can still be used to authorize as long as
        // they can be refreshed.
        return Boolean(this.supertoken && this.supertoken.canAuthorize || this.canRefresh);
      }
    },
    canRefresh: {
      cache: false,
      deps: [
        `supertoken`,
        `supertoken.canRefresh`
      ],
      fn() {
        return Boolean(this.supertoken && this.supertoken.canRefresh);
      }
    }
  },

  collections: {
    userTokens: TokenCollection
  },

  namespace: `Credentials`,

  /**
   * Constructs a logout URL
   * @returns {string}
   */
  buildLogoutUrl() {
    return `${this.config.logoutUri}?${querystring.stringify({
      type: `logout`,
      goto: this.config.redirect_uri,
      service: this.config.service
    })}`;
  },

  /**
   * Constructs an oauth login url
   * @param {Object} options
   * @param {string} options.response_type
   * @param {Object} options.state
   * @returns {string}
   */
  buildOAuthUrl(options) {
    /* eslint camelcase: [0] */
    const fields = [
      `client_id`,
      `redirect_uri`,
      `scope`,
      `service`
    ];

    const parameters = clone(options);

    parameters.state = parameters.state || {};
    if (!isObject(parameters.state)) {
      throw new Error(`if specified, \`options.state\` must be an object`);
    }

    if (!parameters.response_type) {
      throw new Error(`\`options.response_type\` is required`);
    }

    fields.forEach((key) => {
      if (key in this.config.oauth) {
        parameters[key] = this.config.oauth[key];
      }
      else {
        throw new Error(`\`${key}\` is required`);
      }
    }, this);

    // Some browsers apparently don't parse nested querystrings very well, so
    // we'll additionally base64url-encode the state
    parameters.state = base64.toBase64Url(querystring.stringify(parameters.state));
    return `${this.config.oauth.authorizationUrl}?${querystring.stringify(parameters)}`;
  },

  /**
   * Gets a token with the specified scope
   * @param {string} scope
   * @returns {Token}
   */
  @waitForValue(`@`)
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

  /**
   * @see {@link Credentials#getUserToken()}
   */
  @deprecated(`Please use getUserToken`)
  getAuthorization(...args) {
    return this.getUserToken(...args);
  },

  @persist(`@`)
  initialize(...args) {
    return Reflect.apply(SparkPlugin.prototype.initialize, this, args);
  },

  @waitForValue(`@`)
  logout() {
    return Promise.all(this.userTokens.map((token) => token.revoke()
      .catch((reason) => this.logger.warn(`credentials: token revocation failed for ${token.scope}, ignoring`, reason))))
      .then(() => this.userTokens.reset())
      .then(() => this.supertoken.revoke())
      .catch((reason) => this.logger.warn(`credentials: token revocation failed for supertoken, ignoring`, reason))
      .then(() => this.supertoken.unset())
      .then(() => this.boundedStorage.del(`@`));
  },

  /**
   * Refreshes the supertoken and redownscopes the child tokens
   * @returns {Promise}
   */
  @whileInFlight(`isRefreshing`)
  @oneFlight
  @waitForValue(`@`)
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
   * @param {Object} options
   * @param {Object} options.code
   * @returns {Promise}
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
   * @param {Object} options
   * @param {Object} options.scope
   * @returns {Promise<Token>}
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
   * @param {Object} options
   * @param {string} options.scope
   * @param {string} options.name
   * @param {string} options.orgId
   * @param {string} options.password
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

  /**
   * Contains the parsing logic to handle all the possible cached credentials
   * formats
   * @param {Object} attrs
   * @param {Object} options
   * @returns {mixed}
   */
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
   * @param {string} options.scope
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
      service: `oauth`,
      resource: `access_token`,
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
   * @param {Object} options
   * @param {string} options.name
   * @param {string} options.orgId
   * @param {string} options.password
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
      service: `saml`,
      resource: `${options.orgId}/v2/actions/GetBearerToken/invoke`,
      body: pick(options, `name`, `password`),
      shouldRefreshAccessToken: false
    })
      .then((res) => res.body);
  },

  /**
   * @param {Token} supertoken
   * @param {string} scope
   * @param {Error} reason
   * @private
   * @returns {Promise<Token>}
   */
  _handleDownscopeFailure(supertoken, scope, reason) {
    this.logger.error(`credentials: failed to downscope new supertoken to ${scope}`, reason);
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
    return Promise.resolve(new Token(Object.assign({scope}, supertoken.serialize()), {parent: this}));
  },

  /**
   * @param {Token} supertoken
   * @returns {Promise}
   */
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
};
