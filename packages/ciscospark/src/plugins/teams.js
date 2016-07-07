/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Page from '../lib/page';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @typedef {Object} Types~Team
 * @property {string} id - (server generated) The unique ID for the team.
 * @property {string} name - The name of the team.
 * @property {isoDate} created - (server generated) The date and time when the
 * team was created, in ISO8601 format.
 */

/**
* @class
* @extends SparkPlugin
 */
const Teams = SparkPlugin.extend({
  /**
   * Create a new team.
   * @instance
   * @param {Types~Team} team
   * @returns {Promise<Types~Team>}
   * @memberof Teams
   * @example
   * <%= teams__create %>
   */
  create(team) {
    return this.request({
      method: `POST`,
      uri: `${this.config.hydraServiceUrl}/teams`,
      body: team
    })
      .then((res) => res.body);
  },

  /**
   * Returns a single team
   * @instance
   * @param {Types~Team|string} team
   * @param {object} options
   * @returns {Promise<Types~Team>}
   * @memberof Teams
   * @example
   * <%= teams__get %>
   */
  get(team, options) {
    const id = team.id || team;

    return this.request({
      uri: `${this.config.hydraServiceUrl}/teams/${id}`,
      qs: options
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * List teams.
   * @instance
   * @param {object} options
   * @param {object} options.max Limit the maximum number of teams in the
   * response.
   * @returns {Promise<Page<Types~Team>>}
   * @memberof Teams
   * @example
   * <%= teams__list %>
   */
  list(options) {
    return this.request({
      uri: `${this.config.hydraServiceUrl}/teams/`,
      qs: options
    })
      .then((res) => new Page(res, this.spark));
  },

  /**
   * Update a team.
   * @instance
   * @param {Types~Team} team
   * @returns {Promise<Types~Team>}
   * @memberof Teams
   * @example
   * <%= teams__update %>
   */
  update(team) {
    const id = team.id;
    return this.request({
      method: `PUT`,
      uri: `${this.config.hydraServiceUrl}/teams/${id}`,
      body: team
    })
      .then((res) => res.body);
  }
});

export default Teams;
