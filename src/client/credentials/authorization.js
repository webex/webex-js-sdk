/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var oneFlight = require('../../util/one-flight');
var makeStateDataType = require('./make-state-data-type');
var SparkBase = require('../../lib/spark-base');
var Token = require('./token');

var Authorization = SparkBase.extend({
  dataTypes: {
    token: makeStateDataType(Token, 'token').dataType
  },

  derived: {
    canRefresh: {
      deps: ['supertoken.canRefresh'],
      fn: function canRefresh() {
        return !!(this.supertoken && this.supertoken.canRefresh);
      }
    },

    isAuthenticated: {
      deps: ['supertoken.isAuthenticated'],
      fn: function isAuthenticated() {
        return !!(this.supertoken && this.supertoken.isAuthenticated);
      }
    },

    isExpired: {
      cache: false,
      deps: ['supertoken.isExpired'],
      fn: function isExpired() {
        return !!(this.supertoken && this.supertoken.isExpired);
      }
    },

    isValid: {
      cache: false,
      deps: ['supertoken.isValid'],
      fn: function isValid() {
        return !!(this.supertoken && this.supertoken.isValid);
      }
    }
  },

  namespace: 'Credentials',

  props: {
    supertoken: makeStateDataType(Token, 'token').prop,
    apiToken: makeStateDataType(Token, 'token').prop,
    kmsToken: makeStateDataType(Token, 'token').prop
  },

  session: {
    isRefreshing: {
      default: false,
      type: 'boolean'
    }
  },

  getToken: function getToken(scopes) {
    if (scopes === 'spark:kms') {
      return this._getToken('kms');
    }

    return this._getToken('api');
  },

  initialize: function initialize(attrs, options) {
    if (!this.supertoken && attrs.access_token) {
      this.set('supertoken', attrs);
    }

    SparkBase.prototype.initialize.call(this, attrs, options);
  },

  refresh: oneFlight('refresh', function refresh() {
    if (!this.canRefresh) {
      return Promise.reject(new Error('Authorization cannot be refreshed'));
    }

    this.isRefreshing = true;
    this.logger.info('authorization: refreshing supertoken');

    var supertoken = this.supertoken;
    var kmsToken = this.kmsToken;
    var apiToken = this.apiToken;

    // Once we've decided to refresh, immediately unset the subtokens so we
    // don't try to use them.
    this.unset([
      'apiToken',
      'kmsToken',
      'supertoken'
    ]);

    return supertoken.refresh()
      .then(function revokeChildTokens(supertoken) {
        return Promise.all([
          apiToken && apiToken.revoke()
            .catch(function suppressError(reason) {
              this.logger.warn('authorization: failed to revoke api token', reason);
            }.bind(this)),
          kmsToken && kmsToken.revoke()
            .catch(function suppressError(reason) {
              this.logger.warn('authorization: failed to revoke kms token', reason);
            }.bind(this))
        ])
          .then(function splitToken() {
          return this._split(supertoken);
        }.bind(this));
      }.bind(this))
      .then(function setState() {
        this.isRefreshing = false;
      }.bind(this));
  }),

  revoke: oneFlight('revoke', function revoke() {
    var supertoken = this.supertoken;
    var kmsToken = this.kmsToken;
    var apiToken = this.apiToken;

    this.unset([
      'apiToken',
      'kmsToken',
      'supertoken'
    ]);

    return Promise.all([
      apiToken && apiToken.revoke()
        .catch(function suppressError(reason) {
          this.logger.warn('authorization: failed to revoke api token', reason);
        }.bind(this)),
      kmsToken && kmsToken.revoke()
        .catch(function suppressError(reason) {
          this.logger.warn('authorization: failed to revoke kms token', reason);
        }.bind(this))
    ])
      .then(function revokeSupertoken() {
        return supertoken.revoke()
          .catch(function suppressError(reason) {
            this.logger.warn('authorization: failed to revoke supertoken', reason);
          }.bind(this));
      }.bind(this));
  }),

  _getToken: function _getToken(name) {
    return new Promise(function executor(resolve, reject) {
      var propertyName = name + 'Token';
      this.logger.info('authorization: getting token "' + propertyName + '"');

      if (this[propertyName]) {
        this.logger.info('authorization: found token "' + propertyName + '"');
        return resolve(this[propertyName]);
      }

      this.logger.info('authorization: waiting for token "' + propertyName + '"');

      var eventName = 'change:' + propertyName;
      this.once(eventName, function onChange() {
        this.logger.info('authorization: token "' + propertyName + '" changed');
        resolve(this._getToken(name));
      }.bind(this));

      // If we made it this far but still have a supertoken, kick off a split in
      // case there isn't one inflight
      if (this.supertoken) {
        this._split(this.supertoken)
          .catch(reject);
      }
    }.bind(this));
  },

  _split: oneFlight('_split', function _split(supertoken) {
    return Promise.all([
      supertoken.downscope(this.config.oauth.scope.replace('spark:kms', ''))
        .catch(function setSuperToken(error) {
          this.logger.error('authorization: error while downscoping api token ', error);
          if (error && error.body && error.body.error === 'invalid_request') {
            // log the details to splunk
            var splitTokenErrorMetrics = {
              comment: 'authorization: error while downscoping api token',
              statusCode: error.statusCode,
              statusMessage: error.statusMessage,
              error: error.body.error,
              errorDescription: error.body.error_description
            };
            this.spark.metrics.sendUnstructured('splitTokenError', splitTokenErrorMetrics);
            return Promise.reject(error);
          }
          // should set the supertoken by default for all interactions if the response from id broker is not invalid_request
          this.logger.error('authorization: falling back to supertoken for api interactions');
          return Promise.resolve(supertoken);
        }.bind(this)),
      supertoken.downscope('spark:kms')
        .catch(function setSuperToken(error) {
          this.logger.error('authorization: error while downscoping spark:kms');
          if (error && error.body && error.body.error === 'invalid_request') {
            // log the details to splunk
            var splitTokenErrorMetrics = {
              comment: 'authorization: error while downscoping spark:kms',
              statusCode: error.statusCode,
              statusMessage: error.statusMessage,
              error: error.body.error,
              errorDescription: error.body.error_description
            };
            this.spark.metrics.sendUnstructured('splitTokenError', splitTokenErrorMetrics);
            return Promise.reject(error);
          }
          // should set the supertoken by default for all interactions if the response from id broker is not invalid_request
          this.logger.error('authorization: falling back to supertoken for kms interactions');
          return Promise.resolve(supertoken);
        }.bind(this))
    ])
      .then(function setTokens(tokens) {
        this.set({
          supertoken: supertoken,
          apiToken: tokens[0],
          kmsToken: tokens[1]
        });
      }.bind(this));
  })
});

module.exports = Authorization;
