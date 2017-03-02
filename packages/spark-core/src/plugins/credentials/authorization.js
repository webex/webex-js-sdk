/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import grantErrors from './grant-errors';
import {has, pick} from 'lodash';
import {oneFlight} from '@ciscospark/common';
import SparkPlugin from '../../lib/spark-plugin';

const AuthorizationBase = SparkPlugin.extend({
  derived: {
    canRefresh: {
      deps: [`refresh_token`],
      fn() {
        return Boolean(this.refresh_token);
      }
    },

    isAuthenticated: {
      deps: [
        `access_token`,
        `refresh_token`
      ],
      fn() {
        return Boolean(this.access_token || this.refresh_token);
      }
    },

    isExpired: {
      cache: false,
      deps: [
        `access_token`,
        `expires`
      ],
      fn() {
        // if we don't have an access token, it can't actually be expired
        return !this.access_token || Boolean(this.access_token && this.expires && Date.now() > this.expires);
      }
    },

    isValid: {
      cache: false,
      deps: [
        `access_token`,
        `isExpired`,
        `canRefresh`
      ],
      fn() {
        return this.access_token && !this.isExpired || this.canRefresh;
      }
    }
  },

  namespace: `Credentials`,

  props: {
    access_token: `string`,
    expires: `number`,
    expires_in: `number`,
    refresh_token: `string`,
    refresh_token_expires: `number`,
    refresh_token_expires_in: `number`,
    token_type: {
      default: `Bearer`,
      type: `string`
    }
  },

  session: {
    isRefreshing: {
      default: false,
      type: `boolean`
    }
  },

  toString() {
    if (this.token_type && this.access_token) {
      return `${this.token_type} ${this.access_token}`;
    }
    return ``;
  },

  initialize(...args) {
    const now = Date.now();

    if (!this.expires && this.expires_in) {
      this.expires = now + this.expires_in * 1000;
    }

    if (!this.refresh_token_expires && this.refresh_token_expires_in) {
      this.refresh_token_expires = now + this.refresh_token_expires_in * 1000;
    }

    return Reflect.apply(SparkPlugin.prototype.initialize, this, args);
  },

  @oneFlight
  refresh() {
    /* eslint no-invalid-this: [0] */
    if (!this.canRefresh) {
      return Promise.reject(new Error(`Authorization cannot be refreshed`));
    }

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

    this.isRefreshing = true;

    this.logger.info(`authorization: refreshing access token`);

    return this.request({
      method: `POST`,
      uri: this.config.oauth.tokenUrl,
      form: {
        grant_type: `refresh_token`,
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
      .then((res) => {
        // If the authentication server did not send back a refresh_token, copy
        // the current refresh token and related values onto the response.
        if (!res.body.refresh_token) {
          Object.assign(res.body, pick(this, `refresh_token`, `refresh_token_expires`, `refresh_token_expires_in`));
        }

        this.logger.info(`authorization: access token refreshed`);

        // this.constructor *should* be Authorization. We can`t use it by name
        // because this file defines AuthorizationBase.
        return new this.constructor(res.body);
      })
      .catch((reason) => {
        if (reason.statusCode !== 400) {
          return Promise.reject(reason);
        }

        const ErrorConstructor = grantErrors.select(reason.body.error);
        return Promise.reject(new ErrorConstructor(reason._res || reason));
      })
      .then((res) => {
        this.isRefreshing = false;
        return res;
      })
      .catch((res) => {
        this.isRefreshing = false;
        return Promise.reject(res);
      });
  },

  @oneFlight
  revoke() {
    /* eslint no-invalid-this: [0] */
    if (this.isExpired || !this.isValid) {
      this.logger.info(`authorization: access token already expired or invalid, not revoking`);

      return Promise.resolve();
    }

    this.logger.info(`authorization: revoking access token`);

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
      uri: this.config.oauth.revokeUrl,
      form: {
        token: this.access_token,
        token_type_hint: `access_token`
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then((res) => {
        this.logger.info(`authorization: authorization revoked`);
        this.unset(Object.keys(this.getAttributes({props: true})));
        return res;
      })
      .catch((reason) => {
        if (reason.statusCode !== 400) {
          return Promise.reject(reason);
        }

        const ErrorConstructor = grantErrors.select(reason.body.error);
        return Promise.reject(new ErrorConstructor(reason._res || reason));
      });
  }
});

export default AuthorizationBase;
