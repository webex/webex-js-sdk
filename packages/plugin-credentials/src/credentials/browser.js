/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint-env browser */

import {base64, whileInFlight} from '@ciscospark/common';
import common from './common';
import {clone, has, omit, pick} from 'lodash';
import uuid from 'uuid';
import querystring from 'querystring';
import url from 'url';
import Token from '../token';
import {persist, waitForValue} from '@ciscospark/spark-core';
import {deprecated} from 'core-decorators';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @private
 * @returns {undefined}
 */
function noop() {/* eslint no-empty:[0] */}

const Credentials = SparkPlugin.extend(Object.assign({}, common, {
  session: Object.assign(common.session, {
    isLoggingIn: {
      default: false,
      type: `boolean`
    }
  }),

  @deprecated(`Please use initiateLogin`)
  authorize(...args) {
    return this.initiateLogin(...args);
  },

  @deprecated(`Please use initiateLogin`)
  authenticate(...args) {
    return this.initiateLogin(...args);
  },

  @whileInFlight(`isLoggingIn`)
  @waitForValue(`@`)
  initiateLogin(options) {
    this.logger.info(`credentials: initiating login flow`);

    options = options || {};
    options.state = options.state || {};
    options.state.csrf_token = options.state.csrf_token || this._generateSecurityToken();

    switch (this.config.clientType) {
    case `confidential`:
      return this.initiateAuthorizationCodeGrant(options);
    case `public`:
      return this.initiateImplicitGrant(options);
    default:
      return Promise.reject(new Error(`\`config.credentials.clientType\` must be defined`));
    }
  },

  @waitForValue(`@`)
  initiateImplicitGrant(options) {
    const vars = {
      client_id: `CLIENT_ID`,
      redirect_uri: `REDIRECT_URI`,
      scope: `SCOPE`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    this.logger.info(`credentials(shim): initiating implicit grant flow`);

    /* eslint camelcase: [0] */
    window.location = this.buildOAuthUrl(Object.assign({response_type: `token`}, options));

    // Return an unreasolved promise to suppress console errors.
    return new Promise(noop);
  },

  @waitForValue(`@`)
  initiateAuthorizationCodeGrant(options) {
    const vars = {
      client_id: `CLIENT_ID`,
      client_secret: `CLIENT_SECRET`,
      redirect_uri: `REDIRECT_URI`,
      scope: `SCOPE`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    this.logger.info(`credentials(shim): initiating authorization code grant flow`);

    window.location = this.buildOAuthUrl(Object.assign({response_type: `code`}, options));
    return new Promise(noop);
  },

  @persist(`@`)
  initialize(...args) {
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
        this.spark.credentials.requestAuthorizationCodeGrant(query);
        return Promise.resolve();
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

    return Reflect.apply(common.initialize, this, args);
  },

  @waitForValue(`@`)
  logout(...args) {
    this.logger.info(`credentials(shim): logging out`);

    /* eslint prefer-rest-params: [0] */
    return Reflect.apply(common.logout, this, args)
      .then(() => {
        window.location = this.buildLogoutUrl();
      });
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

    if (query.expires_in) {
      query.expires_in = parseInt(query.expires_in, 10);
    }
    if (query.refresh_token_expires_in) {
      query.refresh_token_expires_in = parseInt(query.refresh_token_expires_in, 10);
    }

    const token = new Token(pick(query, tokenKeys), {parent: this});
    this._receiveSupertoken(token);

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
export {apiScope} from './common';
