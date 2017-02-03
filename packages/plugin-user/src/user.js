/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {deprecated} from 'core-decorators';
import {isArray} from 'lodash';
import {oneFlight, patterns, tap} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import UserUUIDBatcher from './user-uuid-batcher';
import UserUUIDStore from './user-uuid-store';

const User = SparkPlugin.extend({
  namespace: `User`,

  children: {
    batcher: UserUUIDBatcher
  },

  session: {
    store: {
      default() {
        return new UserUUIDStore();
      },
      type: `any`
    }
  },

  /**
   * Activates a Spark user account and exchanges for user token.
   * @param {Object} options
   * @param {Object} options.verificationToken (required)
   * @returns {Promise} Resolves with a userSession
   */
  activate(options) {
    options = options || {};

    if (!options.verificationToken) {
      throw new Error(`\`options.verificationToken\` is required`);
    }
    let response;

    return this.request({
      uri: this.config.activationUrl,
      method: `POST`,
      body: options,
      auth: {
        user: this.spark.config.credentials.oauth.client_id,
        pass: this.spark.config.credentials.oauth.client_secret,
        sendImmediately: true
      },
      withCredentials: true
    })
      .then((res) => {
        response = res;
        return this.getOauthCode();
      })
      .then((res) => {
        const code = res.match(`<title>(.*)</title>`)[1];
        return this.spark.credentials.requestAuthorizationCodeGrant({code});
      })
      .then(() => {
        this.setPasswordStatus(false);
        return response.body;
      });
  },

  /**
   * Converts a user-identifying object to a uuid, perhaps by doing a network
   * lookup
   * @param {string|Object} user
   * @param {Object} options
   * @param {boolean} options.create if true, ensures the return UUID refers to
   * an existing user (rather than creating one deterministically based on email
   * address), even if that user must be created
   * @returns {Promise<string>}
   */
  asUUID(user, options) {
    if (!user) {
      return Promise.reject(new Error(`\`user\` is required`));
    }

    if (isArray(user)) {
      return Promise.all(user.map((u) => this.asUUID(u, options)));
    }

    const id = this._extractUUID(user);
    if (!(options && options.force) && patterns.uuid.test(id)) {
      return Promise.resolve(id);
    }

    const email = this._extractEmailAddress(user);

    if (!patterns.email.test(email)) {
      return Promise.reject(new Error(`Provided user object does not appear to identify a user`));
    }

    return this.getUUID(email, options);
  },

  /**
   * Requests a uuid from the api
   * @param {string} email
   * @param {Object} options
   * @param {boolean} options.create
   * @returns {Promise<string>}
   */
  fetchUUID(email, options) {
    return this.batcher.request({
      email,
      create: options && options.create
    })
      .then((user) => this.recordUUID(Object.assign({emailAddress: email}, user))
        .then(() => user.id));
  },

  /**
   * Fetches details about the current user
   * @returns {Promise<Object>}
   */
  get() {
    return this.request({
      service: `conversation`,
      resource: `users`
    })
      .then((res) => res.body)
      .then(tap((user) => this.recordUUID(user)));
  },

  /**
   * Converts an email address to a uuid, perhaps by doing a network lookup
   * @param {string} email
   * @param {Object} options
   * @param {boolean} options.create
   * @returns {Promise<string>}
   */
  @oneFlight({keyFactory: (email, options) => email + String(options && options.create)})
  getUUID(email, options) {
    return this.store.getByEmail(email)
      .then((user) => {
        if (options && options.create && !user.userExists) {
          return Promise.reject(new Error(`User for specified email cannot be confirmed to exist`));
        }

        if (!user.id) {
          return Promise.reject(new Error(`No id recorded for specified user`));
        }

        return user.id;
      })
      .catch(() => this.fetchUUID(email, options));
  },

  /**
   * Caches the uuid for the specified email address
   * @param {Object} user
   * @param {string} user.id
   * @param {string} user.emailAddress
   * @returns {Promise}
   */
  recordUUID(user) {
    if (!user) {
      return Promise.reject(new Error(`\`user\` is required`));
    }

    if (!user.id) {
      return Promise.reject(new Error(`\`user.id\` is required`));
    }

    if (!patterns.uuid.test(user.id)) {
      return Promise.reject(new Error(`\`user.id\` must be a uuid`));
    }

    if (!user.emailAddress) {
      return Promise.reject(new Error(`\`user.emailAddress\` is required`));
    }

    if (!patterns.email.test(user.emailAddress)) {
      return Promise.reject(new Error(`\`user.emailAddress\` must be an email address`));
    }

    return this.store.add(user);
  },

  @deprecated(`Use User#verify()`)
  register(...args) {
    return this.verify(...args);
  },

  /**
   * Sets password status on token
   * @param {Boolean} value
   * @returns {undefined}
   */
  setPasswordStatus(value) {
    if (this.spark.credentials && this.spark.credentials.supertoken) {
      this.spark.credentials.supertoken.passwordSet = value;
    }
  },

  /**
   * Updates a user's password with spark.
   * @param {Object} options
   * @param {string} options.password (required)
   * @param {string} options.userId (required)
   * @returns {Promise} Resolves with complete user object containing new password
   */
  setPassword(options) {
    options = options || {};
    if (!options.password) {
      return Promise.reject(new Error(`\`options.password\` is required`));
    }
    if (!options.userId) {
      return Promise.reject(new Error(`\`options.userId\` is required`));
    }

    let headers;

    const promise = this.spark.credentials.getAuthorization()
      .then((authorization) => {
        headers = {authorization};
      });

    return promise
      .then(() => this.request({
        uri: `${this.config.setPasswordUrl}/${options.userId}`,
        method: `PATCH`,
        headers,
        body: {
          schemas: [`urn:scim:schemas:core:1.0`, `urn:scim:schemas:extension:cisco:commonidentity:1.0`],
          password: options.password
        }
      }))
      .then(() => {
        this.setPasswordStatus(true);
      });
  },

  /**
   * Updates the current user's display name
   * @param {Object} options
   * @param {string} options.displayName
   * @returns {Promise<Object>}
   */
  update(options) {
    if (!options.displayName) {
      return Promise.reject(new Error(`\`options.displayName\` is required`));
    }

    return this.request({
      method: `PATCH`,
      service: `conversation`,
      resource: `users/user`,
      body: options
    })
      .then((res) => res.body);
  },

  /**
   * Determines if the speicfied user needs to signup or can signin.
   * Triggers activation email if client credentials are used
   * @param {Object} options
   * @param {string} options.email (required)
   * @param {string} options.reqId required for the endpoint
   * @returns {Promise<Object>}
   */
  verify(options) {
    options = Object.assign({}, this.config.verifyDefaults, options);

    if (!options.email) {
      return Promise.reject(new Error(`\`options.email\` is required`));
    }

    if (!options.reqId) {
      return Promise.reject(new Error(`\`options.reqId\` is required`));
    }

    let shouldRefreshAccessToken = true;
    let requiresClientCredentials = false;
    let headers;
    const promise = this.spark.credentials.getAuthorization()
      .then((authorization) => {
        headers = {authorization};
      })
      .catch(() => this.spark.credentials.getClientCredentialsAuthorization()
        .then((authorization) => {
          headers = {authorization};
          shouldRefreshAccessToken = false;
          requiresClientCredentials = true;
        })
        .catch((err) => Promise.reject(new Error(`failed to set authorization`, err)))
      );

    return promise
      .then(() => this.request({
        service: `atlas`,
        resource: `users/activations`,
        method: `POST`,
        headers,
        body: options,
        shouldRefreshAccessToken,
        requiresClientCredentials
      }))
      .then((res) => res.body);
  },

  /**
   * Extracts the uuid from a user identifying object
   * @param {string|Object} user
   * @private
   * @returns {string}
   */
  _extractUUID(user) {
    return user.entryUUID || user.id || user;
  },

  /**
   * Extracts the email address from a user identifying object
   * @param {string|Object} user
   * @private
   * @returns {string}
   */
  _extractEmailAddress(user) {
    return user.email || user.emailAddress || user.entryEmail || user;
  },

  /**
   * Uses cookie header to request quth code
   * @private
   * @returns {string} html body with auth code
   */
  _getOauthCode() {
    return this.request({
      api: `oauth`,
      withCredentials: true,
      method: `POST`,
      resource: `authorize`,
      form: {
        /* eslint camelcase: [0] */
        response_type: `code`,
        redirect_uri: `urn:ietf:wg:oauth:2.0:oob`,
        client_id: this.spark.config.credentials.oauth.client_id,
        scope: this.spark.config.credentials.oauth.scope,
        service: `spark`
      }
    })
      .then((res) => res.body);
  }
});

export default User;
