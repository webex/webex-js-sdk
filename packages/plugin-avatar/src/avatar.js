/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {AvatarUrlBatcher} from './avatar-url-batcher';
import {AvatarUrlStore} from './avatar-url-store';
import {patterns} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import {User} from '@ciscospark/plugin-user';
import {defaults} from 'lodash';

const Avatar = SparkPlugin.extend({
  namespace: `Avatar`,

  children: {
    batcher: AvatarUrlBatcher
  },

  session: {
    store: {
      default() {
        return new AvatarUrlStore();
      },
      type: `any`
    }
  },

  /**
   * @private
   * Requests an avatar URL from the api
   * @param {string} uuid
   * @param {integer} size
   * @returns {Promise<Object>}
   */
  _fetchAvatarUrl(uuid, size) {
    return this.store.get(uuid, size)
      .catch(() =>
        this.batcher.request(Object.assign({}, {uuid, size}))
          .then((item) => this.store.add(item))
      );
  },

  /**
   * Retrieves an Avatar from a cache or the api on misses.
   *
   * Avatars are square images with sides of 1600, 640, 192, 135, 110, 80, 50,
   * or 40 pixels. If no size is specified, 80px will be retrieved. If a
   * non-standard size is requested, the server will return the closest-but-
   * greater size (or 1600 if request is larger).
   *
   * @param {UserObject|string} user The user, Spark user uuid, or email
   * @param {Object} [options]
   * @param {integer} [options.size] In {1600, 640, 192, 135, 110, 80, 50, 40}
   *                                 Defaults to 80 if falsy
   * @returns {Promise<string>} A promise that resolves to the avatar
   */
  retrieveAvatarUrl(user, options) {
    /* eslint complexity: [0] */
    options = defaults(options, {size: this.config.defaultAvatarSize});

    if (!user) {
      return Promise.reject(new Error(`\`user\` is a required parameter`));
    }

    let uuid = user.id || user.email || user.emailAddress || user;
    if (!uuid) {
      return Promise.reject(new Error(`Given \`user\` is not valid`));
    }
    uuid = uuid.toLowerCase();

    if (patterns.uuid.test(uuid)) {
      return this._fetchAvatarUrl(uuid, options.size).url;
    }
    return User.getUUID(user.email || user.emailAddress || user)
      .then((userUuid) => this._fetchAvatarUrl(userUuid, options.size).url)
      // eslint-disable-next-line no-unused-vars
      .catch((reason) => {
        throw new Error(`failed to retrieve avatar url: $(reason.body || reason)`);
      });
  },

  /**
   * Upload a new avatar for the current user
   *
   * @param {Blob|File|Buffer} file The new avatar
   * @returns {Promise} Resolves with the URL of the full-sized avatar
   */
  setAvatar(file) {
    return this.upload({
      api: `avatar`,
      resource: `profile`,
      file,
      phases: {
        upload: {
          $uri: function $uri(session) {
            return session.url;
          }
        },
        finalize: {
          method: `PUT`,
          api: `avatar`,
          // eslint-disable-next-line no-unused-vars
          $resource: function $resource(session) {
            return `profile$(session.id)`;
          },
          $body: function $body(session) {
            return session;
          }
        }
      }
    })
      .then((res) => {
        // invalidate user's cached avatar
        this.store.remove(this.spark.device.userId);
        return res.url;
      });
  }
});

export default Avatar;

