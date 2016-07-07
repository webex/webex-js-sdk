/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Page from '../lib/page';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @typedef {Object} Types~Room
 * @property {string} id - (server generated) Unique identifier for the room
 * @property {string} title - The display name for the room. All room members
 * will see the title so make it something good
 * @property {isoDate} created - (server generated) The date and time that the
 * room was created
 * @property {string} teamId - (optional): The id of the team to which the room
 * belongs
 */

/**
 * Rooms are virtual meeting places for getting stuff done. This resource
 * represents the room itself. Check out the Memberships API to learn how to add
 * and remove people from rooms and the Messages API for posting and managing
 * content.
 * @class
 * @extends SparkPlugin
 */
const Rooms = SparkPlugin.extend({
  /**
   * Creates a new room. The authenticated user is automatically added as a
   * member of the room. See the @{link Memberships} to learn how to add more
   * people to the room.
   * {@link Membership}
   * @instance
   * @memberof Rooms
   * @param {Types~Room} room
   * @returns {Promise<Types~Room>}
   * @example
   * <%= rooms__create_es6 %>
   * @example
   * <%= rooms__create %>
   */
  create(room) {
    return this.request({
      method: `POST`,
      uri: `${this.config.hydraServiceUrl}/rooms`,
      body: room
    })
      .then((res) => res.body);
  },

  /**
   * Returns a single room.
   * @instance
   * @memberof Rooms
   * @param {Types~Room|string} room
   * @param {Object} options
   * @param {Object} options.includeSipAddress To show the SIP address for the
   * room in the response, set this value to `true`. A session initiation
   * protocol (SIP) address is a URI that addresses a specific telephone
   * extension on a voice over IP (VOIP) system.
   * @returns {Promise<Types~Room>}
   * @example
   * <%= rooms__get_es6 %>
   * @example
   * <%= rooms__get %>
   */
  get(room, options) {
    const id = room.id || room;

    return this.request({
      uri: `${this.config.hydraServiceUrl}/rooms/${id}`,
      qs: options
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Returns a list of rooms. In most cases the results will only contain rooms
   * that the authentiated user is a member of.
   * @instance
   * @memberof Rooms
   * @param {Object} options
   * @param {Object} options.max Limit the maximum number of rooms in the
   * response.
   * @param {Object} options.includeSipAddress To show the SIP address for the
   * room in the response, set this value to `true`. A session initiation
   * protocol (SIP) address is a URI that addresses a specific telephone
   * extension on a voice over IP (VOIP) system.
   * @returns {Promise<Page<Types~Room>>}
   * @example
   * <%= rooms__list_es6 %>
   * @example
   * <%= rooms__list %>
   */
  list(options) {
    return this.request({
      uri: `${this.config.hydraServiceUrl}/rooms/`,
      qs: options
    })
      .then((res) => new Page(res, this.spark));
  },

  /**
   * Deletes a single room.
   * @instance
   * @memberof Rooms
   * @param {Types~Room|string} room
   * @returns {Promise}
   * @example
   * <%= rooms__remove_es6 %>
   * @example
   * <%= rooms__remove %>
   */
  remove(room) {
    const id = room.id || room;
    return this.request({
      method: `DELETE`,
      uri: `${this.config.hydraServiceUrl}/rooms/${id}`
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
   * Used to update a single room's properties.
   * @instance
   * @memberof Rooms
   * @param {Types~Room} room
   * @returns {Promise<Types~Room>}
   * @example
   * <%= rooms__update_es6 %>
   * @example
   * <%= rooms__update %>
   */
  update(room) {
    const id = room.id;
    return this.request({
      method: `PUT`,
      uri: `${this.config.hydraServiceUrl}/rooms/${id}`,
      body: room
    })
      .then((res) => res.body);
  }
});

export default Rooms;
