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
   * @param {Object} params.reqId (optional)
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
    var shouldRefreshAccessToken = true;
    var headers = {};
    if (options.spoofMobile) {
      headers = {'User-Agent': 'wx2-android'};
    }
    var promise = this.spark.credentials.getAuthorization()
      .then(function addAuthHeader(authorization) {
        headers.Authorization = authorization;
      })
      .catch(function getClientCredentials() {
        return this.spark.credentials.getClientAuthorization()
          .then(function addAuthHeader(authorization) {
            headers.Authorization = authorization;
            shouldRefreshAccessToken = false;
          })
          .catch(function handleError(err) {
            throw new Error('failed to set authorization', err);
          });
      }.bind(this));


    return promise
      .then(function verify() {
        return this.request({
          api: 'atlas',
          resource: 'users/activations',
          method: 'POST',
          body: params,
          headers: headers,
          shouldRefreshAccessToken: shouldRefreshAccessToken
        })
          .then(function processResponse(res) {
            return res.body;
          });
      }.bind(this));
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
   * Activates a Spark user account and exchanges for user token.
   * @param {Object} params
   * @param {Object} params.verificationToken (required)
   * @returns {Promise} Resolves with a userSession
   */
  activate: function activate(params) {
    params = params || {};

    if (!params.verificationToken) {
      throw new Error('`params.verificationToken` is required');
    }
    params.scope = this.spark.config.credentials.oauth.scope;

    return this.request({
      uri: this.config.activationUrl,
      method: 'POST',
      body: params,
      auth: {
        user: this.spark.config.credentials.oauth.client_id,
        pass: this.spark.config.credentials.oauth.client_secret,
        sendImmediately: true
      },
      withCredentials: true
    })
      .then(function processResponse(res) {
        var response = res.body;
        response.tokenData.hasPassword = false;
        this.spark.credentials.setToken(response.tokenData);
        return response;
      }.bind(this));
  },

  /**
   * Updates a user's password with spark.
   * @param {Object} params
   * @param {string} params.password (required)
   * @param {string} params.userId (required)
   * @returns {Promise} Resolves with complete user object containing new password
   */
  setPassword: function setPassword(params) {
    params = params || {};
    if (!params.password) {
      return Promise.reject(new Error('`params.password` is required'));
    }
    if (!params.userId) {
      return Promise.reject(new Error('`params.userId` is required'));
    }

    var headers;

    var promise = this.spark.credentials.getAuthorization()
      .then(function addAuthHeader(authorization) {
        headers = {
          Authorization: authorization
        };
      })
      .catch(function handleError(err) {
        throw err;
      });

    return promise
      .then(function setPassword() {
        return this.request({
          uri: this.config.setPasswordUrl + '/' + params.userId,
          method: 'PATCH',
          headers: headers,
          body: {
            schemas: ['urn:scim:schemas:core:1.0', 'urn:scim:schemas:extension:cisco:commonidentity:1.0'],
            password: params.password
          }
        });
      }.bind(this))
      .then(function setPasswordStatus() {
        this.setPasswordStatus(true);
      }.bind(this));
  },

  setPasswordStatus: function setPasswordStatus(value) {
    this.spark.credentials.setPasswordStatus(value);
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
