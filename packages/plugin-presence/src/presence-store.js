/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {patterns} from '@ciscospark/common';

/**
 * A Presence object returned from the service.
 *
 * {
 *     {string} url The apheleia endpoint used to fetch this presence
 *     {string} subject uuid
 *     {string} status  The well known status state idenitifier
 *     {string} statusTime ISO-8601 UTC Date/Time when status began
 *     {string} lastActive ISO-8601 UTC DT when subject last had status === 'active'
 *     {string} [expires] ISO-8601 UTC DT when this status state will automatically change
 *                        optional, currently returned for current user only
 *                        changing name and functionality shortly
 * }
 */

 /**
  * <uuid, Presence> map
  */
const presenceById = new WeakMap();

/**
 * @class PresenceStore
 */
export default class PresenceStore {

  constructor() {
    presenceById.set(this, new Map());
  },

  /**
   * Adds a user's presence object to the store.
   *
   * @param {Object} presence
   * @param {string} presence.subject id of user
   * @returns {Promise} resolves with the newly added user presence.
   */
  add(presence) {
    if (!presence) {
      return Promise.reject(new Error(`\`presence\` is a required parameter`));
    }
    if (!presence.subject) {
      return Promise.reject(new Error(`\`presence.subject\` is a required parameter`));
    }
    if (!patterns.uuid.test(presence.subject)) {
      return Promise.reject(new Error(`\`presence.subject\` does not appear to be a uuid`));
    }
    if (!presence.status) {
      return Promise.reject(new Error(`\`presence.status\` is a required parameter`));
    }
    if (!presence.statusTime) {
      return Promise.reject(new Error(`\`presence.statusTime\` is a required parameter`));
    }
    if (!presence.lastActive) {
      return Promise.reject(new Error(`\`presence.lastActive\` is a required parameter`));
    }

    const ttl = presence.expires || this.config.cacheExpiration;
    setTimeout(this.remove.bind(this, presence.subject), ttl);
    return Promise.resolve(presence);
  },

  /**
   * Retrieves a user's presence from the store.
   *
   * @param {Object|string} user
   * @param {string} user.id
   * @returns {Promise} resolves with the user's presence.
   */
  get(user) {
    if (!user) {
      return Promise.reject(new Error(`\`user\` is a required parameter`));
    }

    const id = user.id || user;

    if (!id) {
      return Promise.reject(new Error(`\`user.id\` is a required parameter`));
    }

    if (!patterns.uuid.test(id)) {
      return Promise.reject(new Error(`\`user.id\` does not appear to be a uuid`));
    }

    const cachedPresence = presenceById.get(this).get(id);
    if (cachedPresence) {
      return Promise.resolve(cachedPresence);
    }
    return Promise.reject(new Error(`No Presence found for specified user`));
  },

  /**
   * Removes a user's presence from the store.
   *
   * @param {Object|string} user
   * @param {string} user.id
   * @returns {Promise} resolves with true
   */
  remove(user) {
    if (!user) {
      return Promise.reject(new Error(`\`user\` is a required parameter`));
    }

    const id = user.id || user;

    if (!id) {
      return Promise.reject(new Error(`\`user.id\` is a required parameter`));
    }

    if (!patterns.uuid.test(id)) {
      return Promise.reject(new Error(`\`user.id\` does not appear to be a uuid`));
    }

    presenceById.get(this).delete(id);
    return Promise.resolve(true);
  }

};
