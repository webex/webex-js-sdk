/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {pick} from 'lodash';
import {oneFlight, tap} from '@ciscospark/common';
import {grantErrors, SparkPlugin} from '@ciscospark/spark-core';
import {sortScope} from './scope';

/**
 * Parse response from CI and converts to structured error when appropriate
 * @param {SparkHttpError} res
 * @private
 * @returns {GrantError}
 */
function processGrantError(res) {
  if (res.statusCode !== 400) {
    return Promise.reject(res);
  }

  const ErrorConstructor = grantErrors.select(res.body.error);
  return Promise.reject(new ErrorConstructor(res._res || res));
}

const Token = SparkPlugin.extend({
  namespace: `Credentials`,

  props: {
    scope: `string`,
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
    },
    previousToken: {
      type: `any`
    }
  },

  derived: {
    canAuthorize: {
      cache: false,
      deps: [
        `access_token`,
        `isExpired`
      ],
      fn() {
        return Boolean(this.access_token) && !this.isExpired;
      }
    },

    canDownscope: {
      cache: false,
      deps: [
        `canAuthorize`
      ],
      fn() {
        return this.canAuthorize;
      }
    },

    canRefresh: {
      deps: [
        // Reminder: refresh_token_expires is useless because every refresh
        // extends it an application-specific number of days
        `refresh_token`
      ],
      fn() {
        return Boolean(this.refresh_token);
      }
    },

    isExpired: {
      cache: false,
      deps: [
        `expires`
      ],
      fn: function isExpired() {
        return Boolean(this.expires && Date.now() > this.expires);
      }
    },

    string: {
      deps: [
        `token_type`,
        `access_token`
      ],
      fn: function string() {
        if (this.token_type && this.access_token) {
          return `${this.token_type} ${this.access_token}`;
        }

        return ``;
      }
    }
  },

  downscope(scope) {
    this.logger.info(`token: downscoping token to ${scope}`);

    if (this.isExpired) {
      this.logger.info(`token: request received to downscope expired access_token`);
      return Promise.reject(new Error(`cannot downscope expired access token`));
    }

    if (!this.canDownscope) {
      this.logger.info(`token: request received to downscope invalid access_token`);
      return Promise.reject(new Error(`cannot downscope access token`));
    }

    // Since we're going to use scope as the index in our token collection, it's
    // important scopes are always deterministically specified.
    if (scope) {
      scope = sortScope(scope);
    }

    return this.spark.request({
      method: `POST`,
      service: `oauth`,
      resource: `access_token`,
      form: {
        grant_type: `urn:cisco:oauth:grant-type:scope-reduction`,
        token: this.access_token,
        scope
      },
      auth: {
        user: this.config.oauth.client_id,
        pass: this.config.oauth.client_secret,
        sendImmediately: true
      }
    })
      .then((res) => {
        this.logger.info(`token: downscoped token to ${scope}`);
        return new Token(Object.assign(res.body, {scope}), {parent: this.parent});
      });
  },

  initialize(...args) {
    if (!this.access_token) {
      throw new Error(`\`access_token\` is required`);
    }

    if (this.access_token && this.access_token.includes(` `)) {
      [this.token_type, this.access_token] = this.access_token.split(` `);
    }

    if (this.scope) {
      this.scope = sortScope(this.scope);
    }

    const now = Date.now();

    if (!this.expires && this.expires_in) {
      this.expires = now + this.expires_in * 1000;
    }

    if (!this.refresh_token_expires && this.refresh_token_expires_in) {
      this.refresh_token_expires = now + this.refresh_token_expires_in * 1000;
    }

    Reflect.apply(SparkPlugin.prototype.initialize, this, args);
  },

  @oneFlight
  refresh() {
    this.logger.info(`token: refreshing access token`);
    this.isRefreshing = true;
    return this.request({
      method: `POST`,
      service: `oauth`,
      resource: `access_token`,
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
        // If the authentication server did not send back a refresh token, copy
        // the current refresh token and related values to the response (note:
        // at time of implementation, CI never sends a new refresh token)
        if (!res.body.refresh_token) {
          Object.assign(res.body, pick(this, `refresh_token`, `refresh_token_expires`, `refresh_token_expires_in`));
        }

        // If the new token is the same as the previous token, then we may have
        // found a bug in CI; log the details and reject the Promise
        if (this.access_token === res.body.access_token) {
          this.logger.error(`token: new token matches current token`);
          // log the tokens if it is not production
          if (process.env.NODE_ENV !== `production`) {
            this.logger.error(`token: current token:`, this.access_token);
            this.logger.error(`token: new token:`, res.body.access_token);
          }
          return Promise.reject(new Error(`new token matches current token`));
        }

        if (this.previousToken) {
          this.previousToken.revoke();
          this.unset(`previousToken`);
        }

        res.body.previousToken = this;
        res.body.scope = this.scope;

        return new Token(res.body, {parent: this.parent});
      })
      .catch(processGrantError)
      .then(tap(() => {
        this.logger.info(`token: access token refreshed`);
        this.isRefreshing = false;
      }))
      .catch((res) => {
        this.logger.warn(`token: failed to refresh access token`, res);
        this.isRefreshing = false;
        return Promise.reject(res);
      });
  },

  @oneFlight
  revoke() {
    if (this.isExpired) {
      this.logger.info(`token: access token already expired, not revoking`);
      return Promise.resolve();
    }

    if (!this.canAuthorize) {
      this.logger.info(`token: access token no longer usable, not revoking`);
      return Promise.resolve();
    }

    this.logger.info(`token: revoking access token`);
    return this.spark.request({
      method: `POST`,
      service: `oauth`,
      resource: `/revoke`,
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
      .then(() => {
        this.unset([
          `access_token`,
          `expires`,
          `expires_in`,
          `token_type`
        ]);
        this.logger.info(`token: access token revoked`);
      })
      .catch(processGrantError);
  },

  toString() {
    if (!this.string) {
      throw new Error(`cannot stringify Token`);
    }

    return this.string;
  },

  validate() {
    return this.spark.request({
      method: `POST`,
      service: `conversation`,
      resource: `users/validateAuthToken`,
      body: {
        token: this.access_token
      }
    })
      .catch((reason) => {
        if (reason.message === `\`conversation\` is not a known service`) {
          const convApi = process.env.CONVERSATION_SERVICE || process.env.CONVERSATION_SERVICE_URL || `https://conv-a.wbx2.com/conversation/api/v1`;
          return this.spark.request({
            method: `POST`,
            uri: `${convApi}/users/validateAuthToken`,
            body: {
              token: this.access_token
            },
            headers: {
              authorization: `Bearer ${this.access_token}`
            }
          });
        }

        return Promise.reject(reason);
      })
      .then((res) => res.body);
  }
});

export default Token;
