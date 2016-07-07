/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

var assign = require('lodash.assign');
var Authorization = require('./authorization');
var base64 = require('../../util/base64');
var clone = require('lodash.clone');
var CredentialsBase = require('./credentials-base');
var defaults = require('lodash.defaults');
var noop = require('lodash.noop');
var omit = require('lodash.omit');
var oneFlight = require('../../util/one-flight');
var pick = require('lodash.pick');
var querystring = require('querystring');
var url = require('url');
var uuid = require('uuid');

var methods = {
  authenticate: oneFlight('authenticate', function authenticate(options) {
    this.logger.info('credentials(shim): authenticating');

    /* eslint complexity: [0] */
    options = options || {};
    if (this.isAuthenticated && !options.force) {
      this.logger.info('credentials(shim): authentication not expired, not authenticating');
      return Promise.resolve();
    }

    this.set(pick(options, 'name', 'orgId', 'password'));
    if (this.canRefresh || options.code || (this.name && this.orgId && this.password)) {
      return CredentialsBase.prototype.authenticate.apply(this, arguments);
    }

    this._isAuthenticating = true;
    switch (this.config.clientType) {
      case 'confidential':
        return this.initiateAuthorizationCodeGrant(options);
      case 'public':
        return this.initiateImplicitGrant(options);
      default:
        return Promise.reject(new Error('config.credentials.clientType must be defined'));
    }
  }),

  initiateImplicitGrant: function initiateImplicitGrant(options) {
    this.logger.info('credentials(shim): initiating implicit grant flow');

    window.location = this._buildOAuthUrl(assign({
      response_type: 'token',
      self_contained_token: true
    }, options));

    // Return an unreasolved promise to suppress console errors.
    return new Promise(noop);
  },

  initiateAuthorizationCodeGrant: function initiateAuthorizationCodeGrant(options) {
    this.logger.info('credentials(shim): initiating authorization code grant flow');

    window.location = this._buildOAuthUrl(assign({response_type: 'code'}, options));
    return new Promise(noop);
  },

  initialize: function initialize(attrs, options) {
    CredentialsBase.prototype.initialize.call(this, attrs, options);
    // Need to wait for 'change:config' because, as a `children` object,
    // attributes aren't set yet.
    this.listenTo(this.spark, 'change:config', function onPostInit() {
      var location = url.parse(window.location.href, true);

      var query;
      if (this.config.clientType === 'confidential') {
        query = clone(location.query);

        if (query.code) {
          delete location.query.code;
          delete location.query.state;

          this._updateLocation(location);

          // Though initialize is a synchronous call, it should be safe to
          // call authenticate() because it'll get called again later but end
          // up cached via oneFlight.
          // Call spark.authenticate to make sure we trigger a device refresh.
          return this.spark.authenticate(query);
        }

        if (query.access_token) {
          location.query = this._extractTokenInfo(query);
          this._updateLocation(location);
        }
      }
      else {
        var hash = location.hash || '';
        if (hash.indexOf('#') === 0) {
          hash = hash.substr(1);
        }

        query = querystring.parse(hash);
        if (query.access_token) {
          location.hash = this._extractTokenInfo(query);
          this._updateLocation(location);
        }
      }
    });
  },

  logout: function logout() {
    this.logger.info('credentials(shim): logging out');

    CredentialsBase.prototype.logout.apply(this, arguments);
    window.location = this._buildLogoutUrl();
  },

  _buildOAuthUrl: function _buildOAuthUrl(options) {
    /* eslint camelcase: [0] */
    var fields = [
      'client_id',
      'redirect_uri',
      'scope',
      'service'
    ];

    var parameters = clone(options);

    parameters.state = parameters.state || {};
    if (!(parameters.state instanceof Object)) {
      throw new Error('if specified, `options.state` must be an object');
    }

    if (!parameters.response_type) {
      throw new Error('`options.response_type` is required');
    }

    defaults(parameters.state, {
      csrf_token: this._generateSecurityToken()
    });

    fields.forEach(function checkField(key) {
      if (key in this.config.oauth) {
        parameters[key] = this.config.oauth[key];
      }
      else {
        throw new Error('`' + key + '` is required');
      }
    }, this);

    // Some browser aparently don't parse nested querystrings very well, so
    // we'll additionally base64url-encode the state
    parameters.state = base64.toBase64Url(querystring.stringify(parameters.state));

    return this.spark.device.getPreAuthServiceUrl('oauth') + 'authorize?' + querystring.stringify(parameters);
  },

  _buildLogoutUrl: function _buildLogoutUrl() {
    return this.config.logoutUri + '?' + querystring.stringify({
      type: 'logout',
      goto: this.config.oauth.redirect_uri,
      service: this.config.oauth.service
    });
  },

  _extractTokenInfo: function _extractTokenInfo(query) {
    var tokenKeys = [
      'access_token',
      'expires_in',
      'token_type',
      'refresh_token',
      'refresh_token_expires_in'
    ];

    query.state = querystring.parse(base64.fromBase64url(query.state));

    this._verifySecurityToken(query.state.csrf_token);

    var token = pick(query, tokenKeys);
    token.expires_in = parseInt(token.expires_in);
    token.refresh_token_expires_in = parseInt(token.refresh_token_expires_in);
    var auth = new Authorization(token);
    this._pushAuthorization(auth);

    query = omit(query, tokenKeys);
    query.state = omit(query.state, 'csrf_token');
    if (Object.keys(query.state).length === 0) {
      delete query.state;
    }
    else {
      query.state = base64.toBase64Url(querystring.stringify(query.state));
    }

    return query;
  },

  _generateSecurityToken: function _generateSecurityToken() {
    this.logger.info('credentials(shim): generating csrf token');

    var token = uuid.v4();
    sessionStorage.setItem('oauth2-csrf-token', token);
    return token;
  },

  _verifySecurityToken: function _verifySecurityToken(token) {
    this.logger.info('credentials(shim): verifying csrf token');

    var _token = sessionStorage.getItem('oauth2-csrf-token');
    sessionStorage.removeItem('oauth2-csrf-token');

    if (token !== _token) {
      throw new Error('CSRF token `' + token + '` does not match stored token `' + _token);
    }
  },

  _updateLocation: function _updateLocation(location) {
    if (typeof location !== 'string') {
      if (location.query) {
        delete location.search;
      }
      if (typeof location.hash !== 'string') {
        location.hash = querystring.stringify(location.hash);
      }
      location = url.format(location);
    }

    this.logger.info('credentials(shim): updating browser location', location);
    // It's pretty unlikely the SDK will be used in a browser that doesn't
    // support the history API, so we'll just ignore the cases where it's not
    // available.
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, null, location);
    }
  }
};

/**
 * @class
 * @extends CredentialsBase
 */
var Credentials = CredentialsBase.extend(methods);
module.exports = Credentials;
