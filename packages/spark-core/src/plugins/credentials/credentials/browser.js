/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint-env browser */

import {base64, oneFlight} from '@ciscospark/common';
import {assign, clone, has, omit, pick} from 'lodash';
import querystring from 'querystring';
import url from 'url';
import uuid from 'uuid';
import Authorization from '../authorization';
import common from './common';
import {persist, waitForValue} from '../../../lib/storage';
import SparkPlugin from '../../../lib/spark-plugin';

/**
 * @private
 * @returns {undefined}
 */
function noop() {/* eslint no-empty:[0] */}

const Credentials = SparkPlugin.extend(Object.assign({}, common, {
  @oneFlight
  @waitForValue(`authorization`)
  authorize(options) {
    /* eslint complexity: [0] */
    /* eslint camelcase: [0] */
    /* eslint no-invalid-this: [0] */

    this.logger.info(`credentials(shim): authenticating`);

    options = options || {};
    if (this.isAuthenticated && !options.force) {
      this.logger.info(`credentials(shim): authentication not expired, not authenticating`);
      return Promise.resolve();
    }

    this.set(pick(options, `name`, `orgId`, `password`));
    if (this.canRefresh || options.code || this.name && this.orgId && this.password) {
      /* eslint prefer-rest-params: [0] */
      return Reflect.apply(common.authorize, this, arguments);
    }

    options.state = options.state || {};
    options.state.csrf_token = options.state.csrf_token || this._generateSecurityToken();

    this._isAuthenticating = true;
    switch (this.config.clientType) {
    case `confidential`:
      return this.initiateAuthorizationCodeGrant(options);
    case `public`:
      return this.initiateImplicitGrant(options);
    default:
      return Promise.reject(new Error(`config.credentials.clientType must be defined`));
    }
  },

  initiateImplicitGrant(options) {
    const vars = {
      'oauth.client_id': `CLIENT_ID`,
      'oauth.redirect_uri': `REDIRECT_URI`,
      'oauth.scope': `SCOPE`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    this.logger.info(`credentials(shim): initiating implicit grant flow`);

    /* eslint camelcase: [0] */
    this._redirect(this.buildOAuthUrl(assign({response_type: `token`}, options)));

    // Return an unreasolved promise to suppress console errors.
    return new Promise(noop);
  },

  initiateAuthorizationCodeGrant(options) {
    const vars = {
      'oauth.client_id': `CLIENT_ID`,
      'oauth.client_secret': `CLIENT_SECRET`,
      'oauth.redirect_uri': `REDIRECT_URI`,
      'oauth.scope': `SCOPE`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    this.logger.info(`credentials(shim): initiating authorization code grant flow`);

    this._redirect(this.buildOAuthUrl(assign({response_type: `code`}, options)));
    return new Promise(noop);
  },

  @persist(`authorization`)
  @persist(`clientAuthorization`)
  initialize() {
    // AmpersandState is a little weird about initialization order. Code that
    // depends on this.config needs to run after SparkCore#initialize executes,
    // so, we'll use process.nextTick to run the following block on the next
    // execution cycle.
    process.nextTick(() => {
      const location = url.parse(window.location.href, true);

      let query = clone(location.query);

      if (query.code) {
        Reflect.deleteProperty(location.query, `code`);
        Reflect.deleteProperty(location.query, `state`);

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
        return Promise.resolve(noop);
      }

      let hash = location.hash || ``;
      if (hash.includes(`#`)) {
        hash = hash.substr(1);
      }

      query = querystring.parse(hash);
      if (query.access_token) {
        location.hash = this._extractTokenInfo(query);
        this._updateLocation(location);
      }

      return Promise.resolve();
    });
  },

  logout(options) {
    this.logger.info(`credentials(shim): logging out`);
    options = options || {};
    if (this.authorization) {
      const token = this.authorization.refresh_token || this.authorization.access_token;
      options = Object.assign({token}, options);
    }
    return Reflect.apply(common.logout, this, [options])
      .then(() => {
        if (!options.noRedirect) {
          this._redirect(this.buildLogoutUrl(options));
        }
      });
  },

  _redirect(location) {
    window.location = location;
  },

  _extractTokenInfo(query) {
    const tokenKeys = [
      `access_token`,
      `expires_in`,
      `token_type`,
      `refresh_token`,
      `refresh_token_expires_in`
    ];

    query.state = querystring.parse(base64.fromBase64url(query.state));

    this._verifySecurityToken(query.state.csrf_token);

    const token = pick(query, tokenKeys);
    token.expires_in = parseInt(token.expires_in, 10);
    token.refresh_token_expires_in = parseInt(token.refresh_token_expires_in, 10);
    const auth = new Authorization(token);
    this._pushAuthorization(auth);

    query = omit(query, tokenKeys);
    query.state = omit(query.state, `csrf_token`);
    if (Object.keys(query.state).length === 0) {
      Reflect.deleteProperty(query, `state`);
    }
    else {
      query.state = base64.toBase64Url(querystring.stringify(query.state));
    }

    return query;
  },

  _generateSecurityToken() {
    this.logger.info(`credentials(shim): generating csrf token`);

    const token = uuid.v4();
    sessionStorage.setItem(`oauth2-csrf-token`, token);
    return token;
  },

  _verifySecurityToken(token) {
    this.logger.info(`credentials(shim): verifying csrf token`);

    const _token = sessionStorage.getItem(`oauth2-csrf-token`);
    sessionStorage.removeItem(`oauth2-csrf-token`);

    if (token !== _token) {
      throw new Error(`CSRF token ${token} does not match stored token ${_token}`);
    }
  },

  _updateLocation(location) {
    if (typeof location !== `string`) {
      if (location.query) {
        Reflect.deleteProperty(location, `search`);
      }
      if (typeof location.hash !== `string`) {
        location.hash = querystring.stringify(location.hash);
      }
      location = url.format(location);
    }

    this.logger.info(`credentials(shim): updating browser location`, location);
    // It's pretty unlikely the SDK will be used in a browser that doesn't
    // support the history API, so we'll just ignore the cases where it's not
    // available.
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, null, location);
    }
  }
}));

export default Credentials;
