/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

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
 *  }
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
   * @param {string} user.id
   * @returns {Promise} resolves with the newly added user presence.
   */
  add(presence) {

  },

  /**
   * Retrieves a user's presence from the store.
   *
   * @param {Object} user
   * @returns {Promise} resolves with the user's presence.
   */
  get(user) {

  },

  /**
   * Removes a user's presence from the store.
   *
   * @param {object} user
   * @returns {Promise} resolves with true
   */
  remove() {
    return Promise.resolve(true);
  }

};
