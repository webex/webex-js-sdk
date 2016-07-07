/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Page from '../lib/page';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @typedef {Object} Types~Membership
 * @property {uuid} id - Unique identifier for the membership
 * @property {string} roomId - The room ID
 * @property {uuid} personId - The person ID
 * @property {email} personEmail - The email address of the person / room member
 * @property {boolean} isModerator - Indicates whether the specified person should be a room moderator.
 * @property {boolean} isMonitor - Indicates whether the specified member is a room monitor.
 * @property {isoDate} created - The date and time that this membership was created.
 */

/**
 * @class
 * @extends SparkPlugin
 */
const Memberships = SparkPlugin.extend({
  /**
   * Adds a person to a room. The person can be added by ID (personId) or by
   * Email Address (personEmail). The person can be optionally added to the room
   * as a moderator.
   * @instance
   * @memberof Memberships
   * @param {Types~Membership} membership
   * @returns {Promise<Types~Membership>}
   * @example
   * <%= memberships__create_es6 %>
   * @example
   * <%= memberships__create %>
   */
  create(membership) {
    return this.request({
      method: `POST`,
      uri: `${this.config.hydraServiceUrl}/memberships`,
      body: membership
    })
      .then((res) => res.body);
  },

  /**
   * Returns a single membership.
   * @instance
   * @memberof Memberships
   * @param {Types~Membership|uuid} membership
   * @returns {Promise<Types~Membership>}
   * @example
   * <%= memberships__get_es6 %>
   * @example
   * <%= memberships__get %>
   */
  get(membership) {
    const id = membership.id || membership;
    return this.request({
      uri: `${this.config.hydraServiceUrl}/memberships/${id}`
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Returns a list of memberships. In most cases the results will only contain
   * rooms that the authentiated user is a member of. You can filter the results
   * by room to list people in a room or by person to find rooms that a
   * specific person is a member of.
   * @instance
   * @memberof Memberships
   * @param {Object} options
   * @param {string} options.personId
   * @param {string} options.personEmail
   * @param {string} options.roomId
   * @param {number} options.max
   * @returns {Promise<Page<Types~Membership>>}
   * @example
   * <%= memberships__list_es6 %>
   * @example
   * <%= memberships__list %>
   */
  list(options) {
    return this.request({
      uri: `${this.config.hydraServiceUrl}/memberships`,
      qs: options
    })
      .then((res) => new Page(res, this.spark));
  },

  /**
   * Deletes a single membership.
   * @instance
   * @memberof Memberships
   * @param {Types~Membership|uuid} membership
   * @returns {Promise}
   * @example
   * <%= memberships__remove_es6 %>
   * @example
   * <%= memberships__remove %>
   */
  remove(membership) {
    const id = membership.id || membership;

    return this.request({
      method: `DELETE`,
      uri: `${this.config.hydraServiceUrl}/memberships/${id}`
    })
      .then((res) => {
        // Firefox has some issues with 204s and/or DELETE. This should move to
        // http-core
        if (res.statusCode === 204) {
          return undefined;
        }
        return res.body;
      });
  },

  /**
   * Used to update a single membership's properties
   * @instance
   * @memberof Memberships
   * @param {Types~Membership|uuid} membership
   * @returns {Promise<Types~Membership>}
   * @example
   * <%= memberships__update_es6 %>
   * @example
   * <%= memberships__update %>
   */
  update(membership) {
    const id = membership.id || membership;
    return this.request({
      method: `PUT`,
      uri: `${this.config.hydraServiceUrl}/memberships/${id}`,
      body: membership
    })
      .then((res) => res.body);
  }
});

export default Memberships;
