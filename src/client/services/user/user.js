/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var defaults = require('lodash.defaults');
var isArray = require('lodash.isarray');
var noop = require('lodash.noop');
var patterns = require('../../../util/patterns');
var SparkBase = require('../../../lib/spark-base');
var UserStore = require('./user-store');

/**
 * @class
 * @extends {SparkBase}
 * @memberof User
 */
var UserService = SparkBase.extend(
  /** @lends User.UserService.prototype */
  {
  namespace: 'User',

  session: {
    inflights: {
      default: function userstore() {
        return {};
      },
      required: true,
      setOnce: true,
      type: 'object'
    },
    userstore: {
      default: function userstore() {
        return new UserStore();
      },
      required: true,
      setOnce: true,
      type: 'object'
    }
  },

  /**
   * Searches for users based on the query string
   * @deprecated
   * @memberof UserService.prototype
   * @param {string} q Search string
   * @param {Object} options Additional query string parameters to pass to the
   * search endpoint
   * @param {Object} options.size Maximum number of results to return
   * @returns {Promise} Resolves with an array of users
   */
  find: function find(q, options) {
    return this.spark.search.people(assign({query: q}, options));
  },

  /**
   * Retrieves the current user
   * @memberof UserService.prototype
   * @returns {Promise} Resolves with the current user
   */
  get: function get() {
    return this.request({
      api: 'conversation',
      resource: 'users'
    })
      .then(function processResponse(res) {
        return res.body;
      });
  },

  /**
   * Converts a user-identifying object to a UUID
   * @memberof UserService.prototype
   * @param {UserObject|string} user
   * @param {Object} options
   * @param {boolean} options.force if true, forces an API call even if the user
   * already appears to have a UUID
   * @param {boolean} options.create if true, makes an API call for any users
   * that are not cached with {userExists: true}
   * @returns {Promise} Resolves with the user's UUID (or null if the user can't
   * be found)
   */
  getUUID: function getUUID(user, options) {
    // Complexity is high because of the possible fields containing uuid and
    // email.

    if (!user) {
      return Promise.reject(new Error('`user` is a required parameter'));
    }

    if (isArray(user)) {
      return Promise.all(user.map(function getEachUUID(user) {
        return this.getUUID(user, options);
      }.bind(this)));
    }

    var id = this._extractUUID(user);
    if (!(options && options.force) && patterns.uuid.test(id)) {
      return Promise.resolve(id);
    }

    var email = this._extractEmailAddress(user);

    if (!patterns.email.test(email)) {
      return Promise.reject(new Error('provided email address does not appear to identify a valid user'));
    }

    var inflight = this.inflights[email];
    if (inflight) {
      return inflight;
    }

    // TODo migrate to oneFlight
    inflight = this.inflights[email] = this.userstore.getByEmail(email)
      .then(function processResponse(user) {
        if (options && options.create && !user.userExists) {
          return Promise.reject(new Error('User for specified email cannot be confirmed to exist'));
        }

        if (!user.id) {
          return Promise.reject(new Error('No email address recorded for user'));
        }

        delete this.inflights[id];
        return user.id;
      }.bind(this))
      .catch(function handleError() {
        return this._getUUID(email, options);
      }.bind(this));

    return inflight;
  },

  _getUUID: function _getUUID(email, options) {
    options = options || {};
    return this.request({
      method: 'POST',
      api: 'conversation',
      resource: 'users',
      body: [{email: email}],
      qs: {
        shouldCreateUsers: options.create
      }
    })
      .then(function processResponse(res) {
        this.recordUUID({
          emailAddress: email,
          id: res.body[email].id,
          userExists: res.body[email].userExists
        })
          // Suppress the uncaught error message in recent versions of
          // dev tools
          .catch(noop);
        delete this.inflights[email];
        return res.body[email].id;
      }.bind(this))
      .catch(function processErrorResponse(res) {
        // Don't delete the inflight if it 404s. We want to keep track of
        // the fact that we can never get the uuid.
        if (res.statusCode === 404) {
          this.recordUUID({
            emailAddress: email,
            id: null,
            userExists: false
          })
            // Suppress the uncaught error message in recent versions of
            // dev tools
            .catch(noop);
          return null;
        }
        // Otherwise, delete the request so it can be retried later
        delete this.inflights[email];

        // And return null
        return null;
      }.bind(this));
  },

  /**
   * Records the mapping of a user id and an email address
   * @memberof UserService.prototype
   * @param {Object} user
   * @param {Object} user.email
   * @param {Object} user.id
   * @returns {Promise} Resolves when the user has been added to this.userstore
   */
  recordUUID: function recordUUID(user) {
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

    return this.userstore.add(user);
  },

  /**
   * Registers a new user with Spark. Can be called before
   * authenticate.
   * @param {Object} params
   * @param {Object} params.email (required)
   * @param {Object} params.pushId (optional)
   * @param {Object} params.deviceId (optional)
   * @param {Object} params.deviceName (optional)
   * @returns {Promise}
   * @todo Add details to the @returnsobject once the endpoint stabilizes
   */
  register: function register(params, options) {
    params = params || {};
    options = options || {};

    defaults(params, this.config.registrationDefaults);

    if (!params.email) {
      throw new Error('`params.email` is required');
    }

    // Spoof mobile client for testing of activate and reverify APIs
    var headers;
    if (options.spoofMobile) {
      headers = {'User-Agent': 'wx2-android'};
    }

    return this.request({
      api: 'atlas',
      resource: 'users/email/verify',
      method: 'POST',
      body: params,
      headers: headers
    })
      .then(function processResponse(res) {
        return res.body;
      });
  },

  /**
   * @deprecated Use {User.UserService#register()} instead
   * @return {Promise}
   */
  reverify: function reverify() {
    this.logger.warn('UserService#reverify() is deprecated. Please use UserService#register()');
    return this.register.apply(this, arguments);
  },

  /**
   * Activates/verifies a Spark user account.
   * @param {Object} params
   * @param {Object} params.encryptedQueryParam (required)
   * @returns {Promise}
   * @todo Add details to the @returns object once the endpoint stabilizes
   */
  activate: function activate(params) {
    params = params || {};

    if (!params.encryptedQueryString) {
      throw new Error('`params.encryptedQueryString` is required');
    }

    return this.request({
      api: 'atlas',
      resource: 'users/email/activate',
      method: 'POST',
      body: params
    })
      .then(function processResponse(res) {
        return res.body;
      });
  },

  /**
   * Updates a user's display name with spark.
   * @param {Object} params
   * @param {string} params.displayName (required)
   * @returns {Promise} Resolves with complete user object containing new name
   */
  update: function update(params) {
    params = params || {};

    if (!params.displayName) {
      throw new Error('`params.displayName` is required');
    }

    return this.request({
      api: 'conversation',
      resource: 'users/user',
      body: params,
      method: 'PATCH'
    })
      .then(function processResponse(res) {
        return res.body;
      })
      .catch(function processResponseError(reason) {
        return Promise.reject(new Error('failed to update user: ' + (reason.body || reason)));
      });
  },

  _extractUUID: function _extractUUID(user) {
    return user.entryUUID || user.id || user;
  },

  _extractEmailAddress: function _extractEmailAddress(user) {
    return user.email || user.emailAddress || user.entryEmail || user;
  }
});

module.exports = UserService;
