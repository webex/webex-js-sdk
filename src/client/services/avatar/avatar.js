/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');
var AvatarUrlRequestBatcher = require('./avatar-url-request-batcher');
var defaults = require('lodash.defaults');
var patterns = require('../../../util/patterns');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Avatar
 */
var AvatarService = SparkBase.extend(
  /** @lends Avatar.AvatarService.prototype */
  {
  children: {
    _batcher: AvatarUrlRequestBatcher
  },

  derived: {
    store: {
      deps: ['_batcher'],
      fn: function store() {
        return this._batcher.store;
      }
    }
  },

  namespace: 'Avatar',

  /**
   * Retrieves an Avatar URL from the api.
   * Avatars are square images with sides of 1600, 640, 192, 135, 110, 80, 50,
   * or 40 pixels. If no size is specified, 80px will be retrieved. If a
   * non-standard size is requested, the server will return the closest-but-
   * greater size (or 1600).
   * @param {UserObject|string} user The user for which to retrieve an avatar
   * url.
   * @param {Object} options [description]
   * @param {integer} options.size One of 1600, 640, 192, 135, 110, 80, 50, or
   * 40. Defaults to 80
   */
  retrieveAvatarUrl: function retrieveAvatarUrl(user, options) {
    /* eslint complexity: [0] */
    options = options || {};
    defaults(options, {
      size: this.config.defaultAvatarSize
    });

    if (!user) {
      return Promise.reject(new Error('`user` is a required parameter'));
    }

    var id = (user.id || user.email || user.emailAddress || user);

    if (!id) {
      return Promise.reject(new Error('`user` is a required parameter'));
    }

    id = id.toLowerCase();

    if (patterns.uuid.test(id)) {
      return this._batcher.fetch(id, options.size);
    }
    else {
      return this.spark.user.getUUID(id)
        .then(function fetchAvatarUrl(uuid) {
          if (!uuid) {
            throw new Error('User "' + id + '" does not appear to exist');
          }

          return this._batcher.fetch(uuid, options.size);
        }.bind(this))
        .catch(function processError(reason) {
          throw new Error('failed to retrieve avatar url: ' + (reason.body || reason));
        });
    }
  },

  /**
   * Upload a new avatar for the current user
   * @memberof AvatarService.prototype
   * @param {Blob|File|Buffer} file The new avatar
   * @returns {Promise} Resolves with the URL of the full-sized avatar
   */
  setAvatar: function setAvatar(file) {
    return this.upload({
      api: 'avatar',
      resource: 'profile',
      file: file,
      phases: {
        upload: {
          $uri: function $uri(session) {
            return session.url;
          }
        },
        finalize: {
          method: 'PUT',
          api: 'avatar',
          $resource: function $resource(session) {
            return 'profile/' + session.id;
          },
          $body: function $body(session) {
            return session;
          }
        }
      }
    })
      .then(function processResponse(res) {
        // invalidate user's cached avatar
        this.store.remove(this.spark.device.userId);
        return res.url;
      }.bind(this));
  }
});

module.exports = AvatarService;
