/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var patterns = require('../../../util/patterns');

/**
 * User Store - Caches users (primarily for mapping email addresses to user IDs)
 * Though the mechanism to do so hasn't been written yet, consuming clients
 * will be able to supply an alternate implementations, e.g., backed by
 * IndexedDB for persistent storage
 * @class UserStore
 * @memberof User
 */
function UserStore() {
  this.usersById = {};
  this.usersByEmail = {};
}

assign(UserStore.prototype,
  /** @lends User.UserStore.prototype */
  {
  /**
   * Adds a user to the store
   * @memberof UserService.prototype
   * @param {Object} user
   */
  add: function add(user) {
    user = {
      id: user.entryUUID || user.id,
      emailAddress: user.entryEmail || user.emailAddress || user.email || user.id,
      userExists: user.userExists
    };

    var p1;
    if (user.id && patterns.uuid.test(user.id)) {
      p1 = this.getById(user.id)
        .then(function processUserRetrievedById(u) {
          assign(u, user);
        })
        .catch(function processUserErrorRetrievedById() {
          this.usersById[user.id] = user;
        }.bind(this));
    }

    var p2;
    if (user.emailAddress && patterns.email.test(user.emailAddress)) {
      p2 = this.getByEmail(user.emailAddress)
        .then(function processUserRetrievedByEmail(u) {
          assign(u, user);
        })
        .catch(function processUserErrorRetrievedByEmail() {
          this.usersByEmail[user.emailAddress] = user;
        }.bind(this));
    }

    return Promise.all([p1, p2]);
  },

  /**
   * Retrieves a user by email address or uuid
   * @memberof UserService.prototype
   * @param {string} id
   * @returns {Promise} Resolves with the requested user
   */
  get: function get(id) {
    if (patterns.uuid.test(id)) {
      return this.getById(id);
    }
    else if (patterns.email.test(id)) {
      return this.getByEmail(id);
    }

    return Promise.reject(new Error('`id` does not appear to be a valid identifier'));
  },

  /**
   * Retrieves user by uuid
   * @memberof UserService.prototype
   * @param {string} id
   * @returns {Promise} Resolves with the requested user
   */
  getById: function getById(id) {
    if (!patterns.uuid.test(id)) {
      return Promise.reject(new Error('`id` is not a uuid'));
    }

    var user = this.usersById[id];

    if (!user) {
      return Promise.reject(new Error('No user found with id "' + id + '"'));
    }

    return Promise.resolve(user);
  },

  /**
   * Retrieves user by email address
   * @memberof UserService.prototype
   * @param {string} email
   * @returns {Promise} Resolves with the requested user
   */
  getByEmail: function getByEmail(email) {
    if (!patterns.email.test(email)) {
      return Promise.reject(new Error('`email` is not an email address'));
    }

    var user = this.usersByEmail[email];

    if (!user) {
      return Promise.reject(new Error('No user found with email "' + email + '"'));
    }

    return Promise.resolve(user);
  }
});

module.exports = UserStore;
