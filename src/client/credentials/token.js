/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

var assign = require('lodash.assign');
var grantErrors = require('./grant-errors');
var oneFlight = require('../../util/one-flight');
var pick = require('lodash.pick');
var SparkBase = require('../../lib/spark-base');

function processGrantError(res) {
  if (res.statusCode !== 400) {
    return Promise.reject(res);
  }

  var ErrorConstructor = grantErrors.select(res.body.error);
  return Promise.reject(new ErrorConstructor(res._res || res));
}

var Token = SparkBase.extend({
  namespace: 'Credentials',

  props: {
    access_token: 'string',
    expires: 'number',
    expires_in: 'number',
    refresh_token: 'string',
    refresh_token_expires: 'number',
    refresh_token_expires_in: 'number',
    token_type: 'string'
  },

  session: {
    isRefreshing: {
      default: false,
      type: 'boolean'
    },
    previousToken: {
      type: 'any'
    }
  },

  derived: {
    canRefresh: {
      deps: ['refresh_token'],
      fn: function canRefresh() {
        return !!this.refresh_token;
      }
    },

    isAuthenticated: {
      deps: [
        'access_token',
        'refresh_token'
      ],
      fn: function isAuthenticated() {
        return !!(this.access_token || this.refresh_token);
      }
    },

    isExpired: {
      cache: false,
      deps: [
        'access_token',
        'expires'
      ],
      fn: function isExpired() {
        return !!(this.access_token && this.expires && Date.now() > this.expires);
      }
    },

    isValid: {
      cache: false,
      deps: [
        'access_token',
        'isExpired',
        'canRefresh'
      ],
      fn: function isValid() {
        return (this.access_token && !this.isExpired) || this.canRefresh;
      }
    },

    string: {
      deps: [
        'token_type',
        'access_token'
      ],
      fn: function string() {
        if (this.token_type && this.access_token) {
          return this.token_type + ' ' + this.access_token;
        }

        return '';
      }
    }
  },

  downscope: function downscope(scope) {
    this.logger.info('token: downscoping token to "' + scope + '"');
    // verify that the access_token is available before downscoping
    if (!this.access_token) {
      this.logger.info('token: request received to downscope an empty access_token, rejecting');
      return Promise.reject(new Error('cannot downscope empty access token'));
    }
    return this.spark.request({
      method: 'POST',
      api: 'oauth',
      resource: 'access_token',
      form: {
        grant_type: 'urn:cisco:oauth:grant-type:scope-reduction',
        token: this.access_token,
        scope: scope
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      }
    })
      .then(function returnToken(res) {
        this.logger.info('token: downscoped token to "' + scope + '"');
        return new Token(res.body, {parent: this.parent});
      }.bind(this));
  },

  initialize: function initialize() {
    if (!this.access_token) {
      throw new Error('`access_token` is required');
    }
    var now = Date.now();

    if (!this.expires && this.expires_in) {
      this.expires = now + this.expires_in*1000;
    }

    if (!this.refresh_token_expires && this.refresh_token_expires_in) {
      this.refresh_token_expires = now + this.refresh_token_expires_in*1000;
    }

    SparkBase.prototype.initialize.apply(this, arguments);
  },

  refresh: oneFlight('refresh', function refresh() {
    this.logger.info('token: refreshing access token');
    this.isRefreshing = true;
    return this.request({
      method: 'POST',
      api: 'oauth',
      resource: 'access_token',
      form: {
        grant_type: 'refresh_token',
        redirect_uri: this.config.oauth.redirect_uri,
        refresh_token: this.refresh_token
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then(function processResponse(res) {
        // If the authentication server did not send back a refresh_token, copy
        // the current refresh token and related values onto the response.
        if (!res.body.refresh_token) {
          assign(res.body, pick(this, 'refresh_token', 'refresh_token_expires', 'refresh_token_expires_in'));
        }

        this.logger.info('token: access token refreshed');

        // if the new token is same as the previousToken, possible bug in CI, log the details and reject the Promise
        if (this.previousToken && this.access_token && this.previousToken.access_token === this.access_token) {
          this.logger.error('token: previousToken is same as new token received from CI');
          // log the tokens if it is not production
          if (process.env.NODE_ENV !== 'production') {
            this.logger.error('token: previousToken = ', this.previousToken);
            this.logger.error('token: newToken received from CI = ', this);
          }
          return Promise.reject(new Error('previousToken is same as new token received from CI'));
        }

        if (this.previousToken) {
          this.previousToken.revoke();
          this.unset('previousToken');
        }

        res.body.previousToken = this;

        // this.constructor *should* be `Token`. We can't use it by name
        // because this file defines Token.
        return new this.constructor(res.body, {parent: this.parent});
      }.bind(this))
      .catch(processGrantError)
      .then(function onSuccess(res) {
        this.logger.info('token: access token refreshed');
        this.isRefreshing = false;
        return res;
      }.bind(this))
      .catch(function onFailure(res) {
        this.logger.warn('token: failed to refresh access token', res);
        this.isRefreshing = false;
        return Promise.reject(res);
      }.bind(this));
  }),

  revoke: oneFlight('revoke', function revoke() {
    if (this.isExpired || !this.isValid) {
      this.logger.info('token: access token already expired or invalid, not revoking');

      return Promise.resolve();
    }

    this.logger.info('token: revoking access token');

    return this.request({
      method: 'POST',
      api: 'oauth',
      resource: '/revoke',
      form: {
        token: this.access_token,
        token_type_hint: 'access_token'
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then(function clearProps() {
        this.unset([
          'access_token',
          'expires',
          'expires_in',
          'token_type'
        ]);
        this.logger.info('token: access token revoked');
      }.bind(this))
      .catch(processGrantError);
  }),

  toString: function toString() {
    return this.string;
  },

  validate: function validate() {
    return this.spark.request({
      method: 'POST',
      api: 'conversation',
      resource: 'users/validateAuthToken',
      body: {
        token: this.access_token
      }
    })
      .then(function resolveWithResponseBody(res) {
        return res.body;
      });
  }
});

module.exports = Token;
