/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Authorization from '../authorization';
import {base64, oneFlight, retry} from '@ciscospark/common';
import {clone, has, get, isObject, pick} from 'lodash';
import grantErrors from '../grant-errors';
import querystring from 'querystring';
import SparkPlugin from '../../../lib/spark-plugin';
import {waitForValue} from '../../../lib/storage';

/**
 * Helper. Returns just the response body
 * @param {http.IncomingMessage} res
 * @returns {Object}
 */
function resolveWithResponseBody(res) {
  return res.body;
}

/**
 * Helper. Converts a response body into an Authorization object
 * @param {http.IncomingMessage} res
 * @returns {Authorization}
 */
function processGrant(res) {
  return new Authorization(res.body);
}

export default {
  derived: {
    canRefresh: {
      deps: [`authorization.canRefresh`],
      fn() {
        if (this.config.requestJWT) {
          return true;
        }
        /* eslint camelcase: [0] */
        return Boolean(this.config.oauth.client_id && this.config.oauth.client_secret && this.authorization && this.authorization.canRefresh);
      }
    },
    isAuthenticated: {
      deps: [`authorization.isAuthenticated`],
      fn() {
        return Boolean(this.authorization && this.authorization.isAuthenticated);
      }
    },
    isAuthenticating: {
      deps: [
        `authorization.isRefreshing`,
        `_isAuthenticating`
      ],
      fn() {
        return this._isAuthenticating || this.authorization && this.authorization.isRefreshing;
      }
    },
    isExpired: {
      deps: [`authorization.isExpired`],
      fn() {
        return Boolean(this.authorization && this.authorization.isExpired);
      }
    }
  },

  namespace: `Credentials`,

  props: {
    authorization: {
      type: `state`
    },
    clientAuthorization: {
      type: `state`
    },
    name: {
      setOnce: true,
      type: `string`
    },
    orgId: {
      setOnce: true,
      type: `string`
    }
  },

  session: {
    _isAuthenticating: {
      default: false,
      type: `boolean`
    },
    password: `string`,
    previousAuthorization: {
      type: `state`
    }
  },

  authenticate(...args) {
    return this.authorize(...args);
  },

  authorize(options) {
    /* eslint no-invalid-this: [0] */
    this._isAuthenticating = true;
    options = options || {};
    if (options.code) {
      this.logger.info(`credentials: auth code received, exchanging for access_token`);
      return this.requestAuthorizationCodeGrant(options)
        .then((res) => {
          this._isAuthenticating = false;
          return res;
        });
    }

    if (options.jwt) {
      return this.requestAccessTokenFromJwt(options)
        .then((res) => {
          this._isAuthenticating = false;
          return res;
        });
    }

    if (this.canRefresh) {
      this.logger.info(`credentials: refreshable, refreshing`);
      return this.refresh(options)
        .then((res) => {
          this._isAuthenticating = false;
          return res;
        });
    }

    this.set(pick(options, `name`, `orgId`, `password`));

    if (this.name && this.orgId && this.password) {
      this.logger.info(`credentials: machine credentials received, authenticating`);
      return this.requestSamlExtensionGrant(options)
        .then((res) => {
          this._isAuthenticating = false;
          return res;
        })
        .catch((res) => {
          this._isAuthenticating = false;
          return Promise.reject(res);
        });
    }


    this._isAuthenticating = false;
    return Promise.reject(new Error(`not enough parameters to authenticate`));
  },

  @oneFlight
  @waitForValue(`authorization`)
  getAuthorization() {
    if (this.isAuthenticated) {
      if (this.isExpired) {
        if (this.canRefresh) {
          return this.refresh()
            .then(() => this.authorization.toString());
        }

        return Promise.reject(new Error(`Access token has expired or cannot be refreshed`));
      }

      return Promise.resolve(this.authorization.toString());
    }

    return Promise.reject(new Error(`not authenticated`));
  },

  @oneFlight
  @waitForValue(`clientAuthorization`)
  getClientCredentialsAuthorization() {
    let promise;
    if (!this.clientAuthorization || !this.clientAuthorization.isAuthenticated || this.clientAuthorization.isExpired) {
      promise = this.requestClientCredentialsGrant();
    }
    else {
      promise = Promise.resolve();
    }

    return promise
      .then(() => this.clientAuthorization.toString());
  },

  /**
   * @returns {Promise}
   */
  logout() {
    return Promise.all([
      `authorization`,
      `previousAuthorization`
    ].map((key) => {
      if (this[key]) {
        return this[key].revoke()
          .then(() => this.unset(key))
          .then(() => this.boundedStorage.del(key))
          .catch((reason) => {
            this.logger.error(`credentials: ${key} revocation falied`, reason);
          });
      }
      return Promise.resolve();
    }));
  },

  /**
   * Refreshes credentials with a refresh token
   * @param {Object} options
   * @param {Object} options.force If true, refresh the token even if the token
   * appears unexpired
   * @returns {Promise} Resolves when credentials have been refreshed
   */
  @oneFlight
  refresh(options) {
    /* eslint no-invalid-this: [0] */
    this.logger.info(`credentials: refresh requested`);

    options = options || {};

    if (!options.force && !get(this, `authorization.isExpired`)) {
      this.logger.info(`credentials: authorization not expired, not refreshing`);
      return Promise.resolve();
    }

    this.logger.info(`credentials: refreshing`);

    if (this.config.requestJWT) {
      this.logger.info(`credentials: request new jwt`);
      return this.config.requestJWT()
        .then((jwt) => this.requestAccessTokenFromJwt(jwt));
    }

    return this.authorization.refresh(options)
      .then(this._pushAuthorization.bind(this))
      .catch(this._handleRefreshFailure.bind(this));
  },

  @oneFlight
  requestAccessTokenFromJwt(options) {
    this.logger.info(`credentials: exchanging jwt for access token`);
    return this.spark.request({
      method: `POST`,
      // I'm not thrilled by directly referencing the hydra service url, but
      // since the spark-core credentials plugin is on the march toward
      // deprecation, I think it's tolerable for now.
      uri: `${this.config.hydraServiceUrl}/jwt/login`,
      headers: {
        authorization: options.jwt
      }
    })
      .then((res) => ({
        body: {
          access_token: res.body.token,
          token_type: `Bearer`,
          expires_in: res.body.expiresIn
        }
      }))
      .then(processGrant)
      .then(this._pushAuthorization.bind(this));
  },

  @oneFlight
  requestAuthorizationCodeGrant(options) {
    const vars = {
      'oauth.client_id': `CLIENT_ID`,
      'oauth.client_secret': `CLIENT_SECRET`,
      'oauth.redirect_uri': `REDIRECT_URI`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    /* eslint camelcase: [0] */
    this.logger.info(`credentials: requesting authorization code grant`);

    options = options || {};
    options.scope = options.scope || this.config.oauth.scope;

    if (!options.code) {
      return Promise.reject(new Error(`\`options.code\` is required`));
    }

    return this.request({
      method: `POST`,
      uri: this.config.oauth.tokenUrl,
      form: {
        grant_type: `authorization_code`,
        redirect_uri: this.config.oauth.redirect_uri,
        code: options.code
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then(processGrant)
      .then(this._pushAuthorization.bind(this))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  @oneFlight
  requestClientCredentialsGrant(options) {
    const vars = {
      'oauth.client_id': `CLIENT_ID`,
      'oauth.client_secret': `CLIENT_SECRET`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    this.logger.info(`credentials: requesting client credentials grant`);

    options = options || {};
    // Right now, admin is the only service that needs Client Credentials,
    // so we`ll hard code that here. long term, we`ll want to keep track of
    // scope used to request a specific token and (potentially) specify
    // scope as an options passed to Clinet#request so it can pick the right
    // token.
    options.scope = options.scope || `webexsquare:admin`;

    return this.request({
      method: `POST`,
      uri: this.config.oauth.tokenUrl,
      form: {
        grant_type: `client_credentials`,
        scope: options.scope,
        shouldRefreshAccessToken: false
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      }
    })
      .then(processGrant)
      .then(this._pushClientCredentialsAuthorization.bind(this))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  @oneFlight
  @retry
  requestSamlExtensionGrant(options) {
    options = options || {};
    options.scope = options.scope || this.config.oauth.scope;

    this.logger.info(`credentials: requesting SAML extension grant`);

    return this._getSamlBearerToken(options)
      .then(this._getOauthBearerToken.bind(this, options))
      .then(processGrant)
      .then(this._pushAuthorization.bind(this))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  set(key, value) {
    let attrs;
    if (isObject(key)) {
      attrs = key;
    }
    else {
      attrs = {};
      attrs[key] = value;
    }

    [
      `authorization`,
      `clientAuthorization`,
      `previousAuthorization`
    ].forEach((propName) => {
      if (attrs[propName]) {
        if (!(attrs[propName] instanceof Authorization)) {
          attrs[propName] = new Authorization(attrs[propName]);
        }
        attrs[propName].parent = this;
      }
    });

    /* eslint prefer-rest-params: [0] */
    return Reflect.apply(SparkPlugin.prototype.set, this, arguments);
  },

  buildLogoutUrl(options) {
    // eslint doesn't yet handle nested strings quite right
    /* eslint quotes: [0] */
    return `${this.config.logoutUri}?${querystring.stringify(Object.assign({
      goto: this.config.oauth.redirect_uri,
      cisService: this.config.oauth.service
    }, options))}`;
  },

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
      throw new Error('if specified, `options.state` must be an object');
    }

    if (!parameters.response_type) {
      throw new Error('`options.response_type` is required');
    }

    fields.forEach((key) => {
      if (key in this.config.oauth) {
        if (key === `service`) {
          parameters.cisService = this.config.oauth[key];
        }
        else {
          parameters[key] = this.config.oauth[key];
        }
      }
      else {
        throw new Error(`\`${key}\` is required`);
      }
    }, this);

    // Some browser aparently don't parse nested querystrings very well, so
    // we'll additionally base64url-encode the state
    parameters.state = base64.toBase64Url(querystring.stringify(parameters.state));
    return `${this.config.oauth.authorizationUrl}?${querystring.stringify(parameters)}`;
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
      'oauth.client_id': `CLIENT_ID`,
      'oauth.client_secret': `CLIENT_SECRET`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    return this.request({
      method: `POST`,
      uri: this.config.oauth.tokenUrl,
      form: {
        /* eslint camelcase: [0] */
        grant_type: `urn:ietf:params:oauth:grant-type:saml2-bearer`,
        assertion: samlData.BearerToken,
        scope: options.scope
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    });
  },

  /**
   * Retrieves a CI SAML Bearer Token
   * @private
   * @return {Promise} Resolves with an Object containing a `BearerToken` and an
   * `AccountExpires`
   */
   @oneFlight
  _getSamlBearerToken() {
    this.logger.info(`credentials: requesting SAML Bearer Token`);

    if (!this.orgId) {
      return Promise.reject(new Error(`\`this.orgId\` is required`));
    }

    if (!this.name) {
      return Promise.reject(new Error(`\`this.name\` is required`));
    }

    if (!this.password) {
      return Promise.reject(new Error(`\`this.password\` is required`));
    }

    return this.request({
      method: `POST`,
      uri: `${this.config.samlUrl}/${this.orgId}/v2/actions/GetBearerToken/invoke`,
      body: pick(this, `name`, `password`),
      shouldRefreshAccessToken: false
    })
      .then(resolveWithResponseBody);
  },

  _handleRefreshFailure(res) {
    if (res.error && res.error === 'invalid_request') {
      this.logger.warn('token refresh failed: ', res.errorDescription);
      this.unset('authorization');
    }

    return Promise.reject(res);
  },

  _pushClientCredentialsAuthorization(authorization) {
    this.logger.info('credentials: received client credentials');

    this.clientAuthorization = authorization;
  },

  _pushAuthorization(authorization) {
    this.logger.info('credentials: received authorization');

    const previousAuthorization = this.previousAuthorization;
    this.previousAuthorization = this.authorization;
    this.authorization = authorization;

    if (previousAuthorization) {
      previousAuthorization.revoke();
    }
  }
};
