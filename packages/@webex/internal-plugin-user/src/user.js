/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {isArray} from 'lodash';
import {deprecated, oneFlight, patterns, tap} from '@webex/common';
import {persist, WebexPlugin, waitForValue} from '@webex/webex-core';

import UserUUIDBatcher from './user-uuid-batcher';
import UserUUIDStore from './user-uuid-store';

/**
 * @class
 */
const User = WebexPlugin.extend({
  namespace: 'User',

  children: {
    batcher: UserUUIDBatcher,
  },

  props: {
    /**
     * Indicates if the current user is known to have a password.
     * @instance
     * @memberof User
     * @type {boolean}
     */
    hasPassword: {
      default: false,
      type: 'boolean',
    },
  },

  session: {
    store: {
      default() {
        return new UserUUIDStore();
      },
      type: 'any',
    },
  },

  @waitForValue('@')
  /**
   * Activates a Webex user account and exchanges for user token.
   * @instance
   * @memberof User
   * @param {Object} options
   * @param {Object} options.confirmationCode (required -- optional if verification token is provided)
   * @param {Object} options.id (required -- optional if verification token is provided)
   * @param {Object} options.verificationToken (required -- optional if uuid and verification token provided)
   * @param {Object} options.email (required with verificationToken for Federation/global user)
   * @returns {Promise} Resolves with a userSession
   */
  activate(options = {}) {
    if (!(options.verificationToken || (options.confirmationCode && options.id))) {
      return Promise.reject(
        new Error(
          'either options.verificationToken is required or both options.confirmationCode and options.id are required'
        )
      );
    }

    options.scope = this.webex.config.credentials.scope;

    // if we have options.email and options.verificationToken
    // and Federation flag is enabled, flag that we need to
    // lookup user's CI.
    const activateOptions = {...options};

    delete activateOptions.email;

    return this.request({
      uri: this.webex.config.credentials.activationUrl,
      method: 'POST',
      body: activateOptions,
      auth: {
        user: this.webex.config.credentials.client_id,
        pass: this.webex.config.credentials.client_secret,
        sendImmediately: true,
      },
    }).then((res) => {
      this.webex.credentials.set({supertoken: res.body.tokenData});

      return res.body;
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
      return Promise.reject(new Error('`user` is required'));
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
      return Promise.reject(new Error('Provided user object does not appear to identify a user'));
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
    return this.batcher
      .request({
        email,
        create: options && options.create,
      })
      .then((user) => this.recordUUID({emailAddress: email, ...user}).then(() => user.id));
  },
  /**
   * Generates One Time Password.
   * @instance
   * @param {Object} options
   * @param {string} options.email
   * @param {string} options.id
   * @returns {Promise}
   */
  generateOTP(options = {}) {
    if (!(options.email || options.id)) {
      return Promise.reject(new Error('One of `options.email` or `options.id` is required'));
    }

    return this.request({
      uri: this.webex.config.credentials.generateOtpUrl,
      method: 'POST',
      body: options,
      auth: {
        user: this.webex.config.credentials.client_id,
        pass: this.webex.config.credentials.client_secret,
      },
    }).then((res) => res.body);
  },

  /**
   * Fetches details about the current user
   * @returns {Promise<Object>}
   */
  get() {
    return this.request({
      service: 'conversation',
      resource: 'users',
    })
      .then((res) => res.body)
      .then(
        tap((user) =>
          this.recordUUID({
            id: user.id,
            // CI endpoints don't use the same user format as actors, so, email may
            // be in one of a few fields
            emailAddress: user.email || user.emailAddress,
          })
        )
      );
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
    return this.store
      .getByEmail(email)
      .then((user) => {
        if (options && options.create && !user.userExists) {
          return Promise.reject(new Error('User for specified email cannot be confirmed to exist'));
        }

        if (!user.id) {
          return Promise.reject(new Error('No id recorded for specified user'));
        }

        return user.id;
      })
      .catch(() => this.fetchUUID(email, options));
  },

  @persist('@')
  initialize(...args) {
    return Reflect.apply(WebexPlugin.prototype.initialize, this, args);
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
      return Promise.reject(new Error('`user` is required'));
    }

    if (!user.id) {
      return Promise.reject(new Error('`user.id` is required'));
    }

    if (!patterns.uuid.test(user.id)) {
      return Promise.reject(new Error('`user.id` must be a uuid'));
    }

    if (!user.emailAddress) {
      return Promise.reject(new Error('`user.emailAddress` is required'));
    }

    if (!patterns.email.test(user.emailAddress)) {
      return Promise.reject(new Error('`user.emailAddress` must be an email address'));
    }

    return this.store.add(user);
  },

  @deprecated('Use User#verify()')
  register(...args) {
    return this.verify(...args);
  },

  /**
   * Updates a user with webex.
   * @param {Object} body
   * @private
   * @returns {Promise} Resolves with a response from PATCH request
   */
  _setUser(body) {
    return this.webex.credentials.getUserToken().then((token) =>
      this.request({
        uri: `${this.webex.config.credentials.setPasswordUrl}/${this.webex.internal.device.userId}`,
        method: 'PATCH',
        headers: {
          authorization: token.toString(),
        },
        body,
      })
    );
  },

  /**
   * Updates a user's password with webex.
   * @instance
   * @memberof User
   * @param {Object} options
   * @param {string} options.password (required)
   * @param {string} options.email (required when federation enabled)
   * @returns {Promise} Resolves with complete user object containing new password
   */
  setPassword(options) {
    options = options || {};
    if (!options.password) {
      return Promise.reject(new Error('`options.password` is required'));
    }

    return this._setUser({
      schemas: ['urn:scim:schemas:core:1.0', 'urn:scim:schemas:extension:cisco:commonidentity:1.0'],
      password: options.password,
    }).then((res) => {
      this.hasPassword = true;

      return res.body;
    });
  },

  /**
   * Updates a user's name with webex.
   * @instance
   * @memberof User
   * @param {string} givenName
   * @param {string} familyName
   * @param {string} displayName
   * @returns {Promise<Object>}
   */
  updateName({givenName, familyName, displayName} = {}) {
    if (!(givenName || familyName || displayName)) {
      return Promise.reject(
        new Error('One of `givenName` and `familyName` or `displayName` is required')
      );
    }

    return this._setUser({
      schemas: ['urn:scim:schemas:core:1.0', 'urn:scim:schemas:extension:cisco:commonidentity:1.0'],
      name: {givenName, familyName},
      displayName,
    }).then((res) => res.body);
  },

  /**
   * Updates the current user's display name
   * @param {Object} options
   * @param {string} options.displayName
   * @returns {Promise<Object>}
   */
  update(options) {
    options = options || {};
    if (!options.displayName) {
      return Promise.reject(new Error('`options.displayName` is required'));
    }

    return this.request({
      method: 'PATCH',
      service: 'conversation',
      resource: 'users/user',
      body: options,
    }).then((res) => res.body);
  },

  /**
   * Validated One Time Password.
   * @instance
   * @param {Object} options
   * @param {string} options.email
   * @param {string} options.id
   * @param {string} options.oneTimePassword
   * @returns {Promise}
   */
  validateOTP(options = {}) {
    if (!(options.email || options.id) || !options.oneTimePassword) {
      return Promise.reject(
        new Error(
          'One of `options.email` or `options.id` and `options.oneTimePassword` are required'
        )
      );
    }

    options.scope = this.webex.config.credentials.scope;

    return this.request({
      uri: this.webex.config.credentials.validateOtpUrl,
      method: 'POST',
      body: options,
      auth: {
        user: this.webex.config.credentials.client_id,
        pass: this.webex.config.credentials.client_secret,
      },
    }).then((res) => {
      this.webex.credentials.set({supertoken: res.body.tokenData});

      return res.body;
    });
  },

  /**
   * Determines if the specified user needs to signup or can signin.
   * Triggers activation email if client credentials are used
   * @param {Object} options
   * @param {string} options.email (required)
   * @param {string} options.reqId required if need to check email status
   * @param {string} options.preloginId
   * @returns {Promise<Object>}
   */
  verify(options) {
    options = {...this.config.verifyDefaults, ...options};
    const {email} = options;

    if (!email) {
      return Promise.reject(new Error('`options.email` is required'));
    }

    return this.webex.internal.services
      .collectPreauthCatalog({email})
      .then(() => this.webex.credentials.getUserToken())
      .catch(() => this.webex.credentials.getClientToken())
      .then((token) =>
        this.request({
          service: 'atlas',
          resource: 'users/activations',
          method: 'POST',
          headers: {
            authorization: token.toString(),
            'x-prelogin-userid': options.preloginId,
          },
          body: options,
          shouldRefreshAccessToken: false,
        })
      )
      .then((res) => {
        if (res.body.hasPassword || res.body.sso) {
          this.hasPassword = true;
        }

        return res.body;
      });
  },

  /**
   * If the passed-in lookupCI is true, retrieve the user's
   * CI from Atlas and return the URL's via a Promise.
   * Otherwise, return current CI in config via a Promise.
   * Useful in a Promise chain to retrieve the CI based on
   * conditions like Federation enabled, and suppresses sending
   * an additional email to the user, since this is just a
   * look-up.
   * @param {string} email (required)
   * @param {boolean} lookupCI (required)
   * @returns {Promise<Object>}
   */
  getUserCI(email, lookupCI) {
    if (lookupCI) {
      // call verify first to get the user's CI, but suppress sending another email
      const verifyOptions = {
        email,
        suppressEmail: true,
      };

      return this.verify(verifyOptions).then((res) => Promise.resolve(res.userEntities));
    }

    return Promise.resolve({
      idBrokerUrl: this.webex.config.credentials.idbroker.url,
      identityUrl: this.webex.config.credentials.identity.url,
    });
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
});

export default User;
