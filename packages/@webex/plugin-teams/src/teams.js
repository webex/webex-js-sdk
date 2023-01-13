/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin, Page} from '@webex/webex-core';

/**
 * @typedef {Object} TeamObject
 * @property {string} id - (server generated) Unique identifier for the team
 * @property {string} name - The name of the team
 * @property {isoDate} created - (server generated) The date and time that the
 * team was created
 */

/**
 * @class
 */
const Teams = WebexPlugin.extend({
  /**
   * Create a new team.
   * @instance
   * @param {TeamObject} team
   * @returns {Promise<TeamObject>}
   * @memberof Teams
   * @example
   * webex.teams.create({name: 'Create Team Example'})
   *   .then(function(team) {
   *     var assert = require('assert');
   *     assert(team.id);
   *     assert(team.name);
   *     assert(team.created);
   *     return 'success';
   *   });
   *   // => success
   */
  create(team) {
    return this.request({
      method: 'POST',
      service: 'hydra',
      resource: 'teams',
      body: team,
    }).then((res) => res.body);
  },

  /**
   * Returns a single team
   * @instance
   * @param {TeamObject|string} team
   * @param {Object} options
   * @returns {Promise<TeamObject>}
   * @memberof Teams
   * @example
   * var team;
   * webex.teams.create({name: 'Get Team Example'})
   *   .then(function(r) {
   *     team = r;
   *     return webex.teams.get(team.id);
   *   })
   *   .then(function(team2) {
   *     var assert = require('assert');
   *     assert.equal(team2.id, team.id);
   *     return 'success';
   *   });
   *   // => success
   */
  get(team, options) {
    const id = team.id || team;

    return this.request({
      service: 'hydra',
      resource: `teams/${id}`,
      qs: options,
    }).then((res) => res.body.items || res.body);
  },

  /**
   * List teams.
   * @instance
   * @param {object} options
   * @param {object} options.max Limit the maximum number of teams in the
   * response.
   * @returns {Promise<Page<TeamObject>>}
   * @memberof Teams
   * @example
   * var createdRooms;
   * Promise.all([
   *   webex.teams.create({name: 'List Teams Example 1'}),
   *   webex.teams.create({name: 'List Teams Example 2'}),
   *   webex.teams.create({name: 'List Teams Example 3'})
   * ])
   *   .then(function(r) {
   *     createdRooms = r;
   *     return webex.teams.list({max: 3});
   *   })
   *   .then(function(teams) {
   *     var assert = require('assert');
   *     assert(teams.length === 3);
   *     for (var i = 0; i < teams.items.length; i+= 1) {
   *       assert(createdRooms.filter(function(room) {
   *         return room.id === teams.items[i].id;
   *       }).length === 1);
   *     }
   *     return 'success';
   *   });
   *   // => success
   */
  list(options) {
    return this.request({
      service: 'hydra',
      resource: 'teams/',
      qs: options,
    }).then((res) => new Page(res, this.webex));
  },

  /**
   * Update a team.
   * @instance
   * @param {TeamObject} team
   * @returns {Promise<TeamObject>}
   * @memberof Teams
   * @example
   * var teams;
   * webex.teams.create({name: 'Update Team Example'})
   *   .then(function(r) {
   *     teams = r;
   *     teams.name = 'Teams Example (Updated Title)';
   *     return webex.teams.update(teams);
   *   })
   *   .then(function() {
   *     return webex.teams.get(teams.id);
   *   })
   *   .then(function(teams) {
   *     var assert = require('assert');
   *     assert.equal(teams.name, 'Teams Example (Updated Title)');
   *     return 'success';
   *   });
   *   // => success

   */
  update(team) {
    const {id} = team;

    return this.request({
      method: 'PUT',
      service: 'hydra',
      resource: `teams/${id}`,
      body: team,
    }).then((res) => res.body);
  },
});

export default Teams;
