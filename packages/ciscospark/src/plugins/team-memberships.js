/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Page from '../lib/page';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @typedef {Object} Types~TeamMembership
 * @property {string} id - (server generated) The team ID
 * @property {string} personId - The person ID
 * @property {string} personEmail - The email address of the person
 * @property {boolean} isModerator - Set to `true` to make the person a team
 * moderator
 */

/**
 * Team Memberships represent a person's relationship to a team. Use this API to
 * list members of any team that you're in or create memberships to invite
 * someone to a team. Team memberships can also be updated to make someome a
 * moderator or deleted to remove them from the team.
 *
 * Just like in the Spark app, you must be a member of the team in order to list
 * its memberships or invite people.
 * @class
 * @extends SparkPlugin
 */
const TeamMemberships = SparkPlugin.extend({
  /**
   * Add someone to a team by Person ID or email address; optionally making them
   * a moderator.
   * @instance
   * @memberof TeamMemberships
   * @param {Types~TeamMembership} membership
   * @returns {Promise<Types~TeamMembership>}
   * @example
   * <%= team_memberships__create %>
   */
  create(membership) {
    return this.request({
      method: `POST`,
      uri: `${this.config.hydraServiceUrl}/team/memberships`,
      body: membership
    })
      .then((res) => res.body);
  },

  /**
   * Get details for a membership by ID.
   * @instance
   * @memberof TeamMemberships
   * @param {Types~TeamMembership|string} membership
   * @returns {Promise<Types~TeamMembership>}
   * @example
   * <%= team_memberships__get %>
   */
  get(membership) {
    const id = membership.id || membership;
    return this.request({
      uri: `${this.config.hydraServiceUrl}/team/memberships/${id}`
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Lists all team memberships. By default, lists memberships for teams to
   * which the authenticated user belongs.
   * @instance
   * @memberof TeamMemberships
   * @param {Object} options
   * @param {string} options.max
   * @returns {[type]}
   * @example
   * <%= team_memberships__list %>
   */
  list(options) {
    return this.request({
      uri: `${this.config.hydraServiceUrl}/team/memberships`,
      qs: options
    })
      .then((res) => new Page(res, this.spark));
  },

  /**
   * Deletes a membership by ID.
   * @instance
   * @memberof TeamMemberships
   * @param {Types~TeamMembership|string} membership
   * @returns {Promise}
   * @example
   * <%= team_memberships__remove %>
   */
  remove(membership) {
    const id = membership.id || membership;

    return this.request({
      method: `DELETE`,
      uri: `${this.config.hydraServiceUrl}/team/memberships/${id}`
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
   * Updates properties for a membership.
   * @instance
   * @memberof TeamMemberships
   * @param {Types~TeamMembership} membership
   * @returns {Promise<Types~TeamMembership>}
   * @example
   * <%= team_memberships__update %>
   */
  update(membership) {
    const id = membership.id || membership;
    return this.request({
      method: `PUT`,
      uri: `${this.config.hydraServiceUrl}/team/memberships/${id}`,
      body: membership
    })
      .then((res) => res.body);
  }
});

export default TeamMemberships;
