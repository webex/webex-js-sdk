/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var Authorization = require('./authorization');
var cloneDeep = require('lodash.clonedeep');
var grantErrors = require('./grant-errors');
var makeStateDataType = require('./make-state-data-type');
var oneFlight = require('../../util/one-flight');
var pick = require('lodash.pick');
var retry = require('../../util/retry');
var SparkBase = require('../../lib/spark-base');
var Token = require('./token');

function resolveWithResponseBody(res) {
  return res.body;
}

/**
 * @class
 * @extends {SparkBase}
 */
var CredentialsBase = SparkBase.extend({
  dataTypes: {
    authorization: makeStateDataType(Authorization, 'authorization').dataType,
    token: makeStateDataType(Token, 'token').dataType
  },

  derived: {
    canRefresh: {
      deps: ['authorization.canRefresh'],
      fn: function canRefresh() {
        return !!(this.authorization && this.authorization.canRefresh);
      }
    },

    isAuthenticated: {
      deps: ['authorization.isAuthenticated'],
      fn: function isAuthenticated() {
        return !!(this.authorization && this.authorization.isAuthenticated);
      }
    },

    isAuthenticating: {
      deps: [
        'authorization.isRefreshing',
        '_isAuthenticating'
      ],
      fn: function isAuthenticating() {
        return this._isAuthenticating || (this.authorization && this.authorization.isRefreshing);
      }
    },

    isExpired: {
      deps: ['authorization.isExpired'],
      fn: function isExpired() {
        return !!(this.authorization && this.authorization.isExpired);
      }
    }
  },

  namespace: 'Credentials',

  props: {
    authorization: makeStateDataType(Authorization, 'authorization').prop,
    clientAuthorization: makeStateDataType(Token, 'token').prop,
    name: {
      setOnce: true,
      type: 'string'
    },
    orgId: {
      setOnce: true,
      type: 'string'
    }
  },

  session: {
    _isAuthenticating: {
      default: false,
      type: 'boolean'
    },
    password: 'string',
    previousAuthorization: makeStateDataType(Authorization, 'authorization').prop
  },

  authenticate: oneFlight('authenticate', function authenticate(options) {
    this._isAuthenticating = true;
    options = options || {};

    if (this.isAuthenticated && !this.canRefresh && !this.isExpired && !options.force) {
      return Promise.resolve();
    }

    if (options.code) {
      this.logger.info('credentials: auth code received, exchanging for access_token');
      return this.requestAuthorizationCodeGrant(options)
        .then(onSuccess.bind(this));
    }

    if (this.canRefresh) {
      this.logger.info('credentials: refreshable, refreshing');
      return this.refresh(options);
    }

    this.set(pick(options, 'name', 'orgId', 'password'));

    if (this.name && this.orgId && this.password) {
      this.logger.info('credentials: machine credentials received, authenticating');
      return this.requestSamlExtensionGrant(options)
        .then(onSuccess.bind(this))
        .catch(onFailure.bind(this));
    }

    this._isAuthenticating = false;

    return Promise.reject(new Error('not enough parameters to authenticate'));

    function onSuccess(res) {
      this._isAuthenticating = false;
      return res;
    }

    function onFailure(res) {
      this._isAuthenticating = false;
      throw res;
    }
  }),

  getAuthorization: oneFlight('getAuthorization', function getAuthorization(scopes) {
    if (this.isAuthenticated) {
      if (this.isExpired) {
        if (this.canRefresh) {
          return this.refresh()
            .then(function getTokenString() {
              return this.authorization.getToken(scopes);
            }.bind(this))
            .then(function returnTokenString(token) {
              return token.toString();
            });
        }

        return Promise.reject(new Error('Access token has expired or cannot be refreshed'));
      }

      return this.authorization.getToken(scopes)
        .then(function returnTokenString(token) {
          return token.toString();
        });
    }

    return Promise.reject(new Error('not authenticated'));
  }),

  getClientAuthorization: oneFlight('getClientCredentialsAuthorization', function getClientCredentialsAuthorization() {
    var promise;
    if (!this.clientAuthorization || !this.clientAuthorization.isAuthenticated || this.clientAuthorization.isExpired) {
      promise = this.requestClientCredentialsGrant();
    }
    else {
      promise = Promise.resolve();
    }

    return promise
      .then(function returnCredentialsString() {
        return this.clientAuthorization.toString();
      }.bind(this));
  }),

  initialize: function initialize(attrs, options) {
    SparkBase.prototype.initialize.call(this, attrs, options);
    this._dataTypes = cloneDeep(this._dataTypes);
    Object.keys(this._dataTypes).forEach(function bindSetter(key) {
      var dataType = this._dataTypes[key];
      if (dataType.set) {
        dataType.set = dataType.set.bind(this);
      }
    }.bind(this));
  },

  logout: function logout() {
    if (this.authorization) {
      this.authorization.revoke();
    }

    if (this.previousAuthorization) {
      this.previousAuthorization.revoke();
    }
  },

  /**
   * Refreshes credentials with a refresh token
   * @param {Object} options
   * @param {Object} options.force If true, refresh the token even if the token
   * appears unexpired
   * @returns {Promise} Resolves when credentials have been refreshed
   */
  refresh: oneFlight('refresh', function refresh(options) {
    this.logger.info('credentials: refresh requested');

    options = options || {};

    if (!options.force && !this.authorization.isExpired) {
      this.logger.info('credentials: authorization not expired, not refreshing');
      return Promise.resolve();
    }

    this.logger.info('credentials: refreshing');

    return this.authorization.refresh(options)
      .catch(this._handleRefreshFailure.bind(this));
  }),

  requestAuthorizationCodeGrant: oneFlight('requestAuthorizationCodeGrant', function requestAuthorizationCodeGrant(options) {
    this.logger.info('credentials: requesting authorization code grant');

    options = options || {};
    options.scope = options.scope || this.config.oauth.scope;
    if (!options.code) {
      return Promise.reject(new Error('`options.code` is required'));
    }

    return this.request({
      method: 'POST',
      api: 'oauth',
      resource: 'access_token',
      form: {
        grant_type: 'authorization_code',
        redirect_uri: this.config.oauth.redirect_uri,
        code: options.code,
        self_contained_token: true
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then(this._processNormalGrant.bind(this))
      .catch(function processGrantError(res) {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        var ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  }),

  requestClientCredentialsGrant: oneFlight('requestClientCredentialsGrant', function requestClientCredentialsGrant(options) {
    this.logger.info('credentials: requesting client credentials grant');

    options = options || {};
    options.scope = options.scope || this.config.oauth.scope;

    return this.request({
      method: 'POST',
      api: 'oauth',
      resource: 'access_token',
      form: {
        grant_type: 'client_credentials',
        // Right now, admin is the only service that needs Client Credentials,
        // so we'll hard code that here. long term, we'll want to keep track of
        // scope used to request a specific token and (potentially) specify
        // scope as an options passed to Clinet#request so it can pick the right
        // token.
        scope: 'webexsquare:admin',
        self_contained_token: true
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then(function processSimpleGrant(res) {
        return new Token(res.body, {parent: this});
      })
      .then(this._processClientCredentialsGrant.bind(this))
      .catch(function processGrantError(res) {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        var ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  }),

  requestSamlExtensionGrant: oneFlight('requestSamlExtensionGrant', retry(function requestSamlExtensionGrant(options) {
    options = options || {};
    options.scope = options.scope || this.config.oauth.scope;

    this.logger.info('credentials: requesting SAML extension grant');

    return this._getSamlBearerToken(options)
      .then(this._getOauthBearerToken.bind(this, options))
      .then(this._processNormalGrant.bind(this))
      .catch(function processGrantError(res) {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        var ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  })),

  /**
   * Converts a CI SAML Bearer Token to an OAuth Bearer Token.
   * @param {Object} options
   * @param {Object} options.scope
   * @param {Object} samlData Response body from the CI SAML endpoint.
   * @private
   * @return {Promise} Resolves with the bot's credentials.
   */
  _getOauthBearerToken: oneFlight('_getOauthBearerToken', function _getOauthBearerToken(options, samlData) {
    this.logger.info('credentials: exchanging SAML Bearer Token for OAuth Bearer Token');

    return this.request({
      method: 'POST',
      api: 'oauth',
      resource: 'access_token',
      form: {
        /* eslint camelcase: [0] */
        grant_type: 'urn:ietf:params:oauth:grant-type:saml2-bearer',
        assertion: samlData.BearerToken,
        scope: options.scope,
        self_contained_token: true
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    });
  }),

  /**
   * Retrieves a CI SAML Bearer Token
   * @private
   * @return {Promise} Resolves with an Object containing a `BearerToken` and an
   * `AccountExpires`
   */
  _getSamlBearerToken: oneFlight('_getSamlBearerToken', function _getSamlBearerToken() {
    this.logger.info('credentials: requesting SAML Bearer Token');

    if (!this.orgId) {
      return Promise.reject(new Error('`this.orgId` is required'));
    }

    if (!this.name) {
      return Promise.reject(new Error('`this.name` is required'));
    }

    if (!this.password) {
      return Promise.reject(new Error('`this.password` is required'));
    }

    return this.request({
      method: 'POST',
      api: 'saml',
      resource: this.orgId + '/v2/actions/GetBearerToken/invoke',
      body: pick(this, 'name', 'password'),
      shouldRefreshAccessToken: false
    })
    // TODO consider handling a 401 error separately from other errors
    .then(resolveWithResponseBody);
  }),

  _handleRefreshFailure: function _handleRefreshFailure(res) {
    if (res.error && res.error === 'invalid_request') {
      this.unset('authorization');
    }

    throw res;
  },

  _processNormalGrant: function _processNormalGrant(res) {
    this.logger.info('credentials: received grant');
    this.authorization = new Authorization(res.body, {parent: this});
  },

  _processClientCredentialsGrant: function _processClientCredentialsGrant(authorization) {
    this.logger.info('credentials: received client credentials');

    // If we ever use client credentials for more requests that
    // /users/email/verify, we should clean up old client creds, but at this
    // point, I choose to believe usage is low enough that it doesn't impact CI.
    this.clientAuthorization = authorization;
  }
});

module.exports = CredentialsBase;
