/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint-env browser */

import {base64} from '@ciscospark/common';
import CredentialsBase from './base';
import {clone, omit, pick} from 'lodash';
import uuid from 'uuid';
import querystring from 'querystring';
import url from 'url';
import Token from '../token';
import {persist} from '@ciscospark/spark-core';

function noop() {}

const Credentials = CredentialsBase.extend({
  logout(...args) {
    this.logger.info(`credentials(shim): logging out`);

    /* eslint prefer-rest-params: [0] */
    return Reflect.apply(CredentialsBase.prototype.logout, this, args)
      .then(() => {
        window.location = this._buildLogoutUrl();
      });
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

    return Reflect.apply(CredentialsBase.prototype.initialize, this, args);
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
});

export default Credentials;
export {apiScope} from './base';
