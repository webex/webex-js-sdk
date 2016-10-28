/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import PresenceBatcher from './presence-batcher';
import PresenceStore from './presence-store';
import {SparkPlugin} from '@ciscospark/spark-core';

const Presence = SparkPlugin.extend({
  namespace: `Presence`,

  children: {
    batcher: PresenceBatcher
  },

  session: {
    store: {
      default() {
        return new PresenceStore();
      },
      type: `any`
    }
  },

  /**
   * Retrieves the presence of a set of users.
   *
   *  {
   *     {string} url The apheleia endpoint used to fecth this presence
   *     {string} subject uuid
   *     {string} status  The well known status state idenitifier
   *     {string} statusTime ISO-8601 UTC Date/Time when status began
   *     {string} lastActive ISO-8601 UTC DT when subject last had status === 'active'
   *     {string} [expires] ISO-8601 UTC DT when this status state will automatically change
   *                        optional, currently returned for current user only
   *                        changing name and functionality shortly
   *  }
   *
   * @param {Array<string>} subjects
   * @returns {Promise}
   */
  get(subjects) {
    return Promise.all(subjects.map((subject) => {
      return this._retrievePresence(subject);
    }));
  },

  /**
   * Sets presence for the current user.
   *
   * Post a well known presence event for the current user, optionally setting
   * an event time to live.
   *
   * A given TTL may be overriden by the presence service. The actual TTL is
   * returned as part of a successful response.
   *
   * Ultimately resolves to a result object
   *  {
   *     {string} subject uuid
   *     {strrng} event well known event identifier
   *     {string} expires ISO-8601 UTC Date/time when event expires
   *  }
   * or an error object {{string}subject, {Number}statusCode, {string|object}error}
   *
   * @param {string} status One of the enumerated event types
   *                       allowed. The service is responsible
   *                       for checking validity.
   * @param {Object} [options] event posting options
   * @param {integer} [options.ttl] seconds to live, uses server default
   *                                if not provided, 0 or invalid.
   *
   * @returns {Promise} Resolves to a result object on success or an
   *                    or Error object on failure.
   */
  set(status, options) {

  },

  /**
   * Subscribe to users' presence
   *
   * Subscribe to the given users' presence, where updates are
   * pushed through mercury for the duration of the subscription.
   *
   * This function attempts to subscribe to all the given user ids
   * with an optional minimum duration, or time to live. If subscriptionsTtl
   * is not provided, a default value of 300 seconds is used.
   *
   * `subjects` must contain at least one element and cannot be more than
   * the server enforced limit (50). These cause the function to
   * resolve to an error.
   *
   * Ultimately resolves to returns an array of result objects
   *  {
   *     {string} subject uuid
   *     {stirng} subscription subscribed | unsubscribed
   *     {number} subscriptionTtl seconds left on subscription
   *  }
   * and/or error objects {subject, statusCode, error}
   * Results may be mix of both
   *
   * @param {string[]} subjects The uuids of the users to subscribe to
   * @param {Object}   [options] The subscription options
   * @param {number}   [options.subscriptionTtl] requested subscription TTL
   * @returns {Promise} resolves to an array of results on success
   *                    resolves to an Error if bad paramaters are found.
   */
  subscribe(subjects, options) {

  },

  /**
   * Unsubscribe from users' presence.
   *
   * Ends subscription to the given users' presence sent via mercury event.
   *
   * Ultimately resolves to returns an array of result objects
   *  {
   *     {string} subject uuid
   *     {string} subscription subscribed | unsubscribed
   *     {number} subscriptionTtl seconds left on subscription
   *  }
   * and/or error objects {subject, statusCode, error}
   * Results may be mix of both
   *
   * @param {string[]} subjects The uuids of the users to subscribe to
   * @returns {Promise} resolves to an array of results on success
   *                    resolves to an Error if bad paramaters are found.
   */
  unsubscribe(subjects) {

  },

  _retrievePresence(user) {
    return this.store.get(user)
      .catch(() => this.batcher.request(user.id || user))
        .then((presence) => this.store.add(presence));
  }

});

export default Presence;
