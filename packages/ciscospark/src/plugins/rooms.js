import {SparkPlugin, Page} from '@ciscospark/spark-core';

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
   * var ciscospark = require('../..');
   * ciscospark.rooms.create({title: 'Create Room Example'})
   *   .then(function(room) {
   *     var assert = require('assert')
   *     assert(typeof room.created === 'string');
   *     assert(typeof room.id === 'string');
   *     assert(room.title === 'Create Room Example');
   *     console.log(room.title);
   *     return 'success';
   *   });
   *   // => success
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
   * @returns {Promise<Types~Room>}
   * @example
   * var ciscospark = require('../..');
   * var room;
   * ciscospark.rooms.create({title: 'Get Room Example'})
   *   .then(function(r) {
   *     room = r
   *     return ciscospark.rooms.get(room.id)
   *   })
   *   .then(function(r) {
   *     var assert = require('assert');
   *     assert.deepEqual(r, room);
   *     return 'success';
   *   });
   *   // => success
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
   * @returns {Promise<Page<Types~Room>>}
   * @example
   * var ciscospark = require('../..');
   * var createdRooms;
   * Promise.all([
   *   ciscospark.rooms.create({title: 'List Rooms Example 1'}),
   *   ciscospark.rooms.create({title: 'List Rooms Example 2'}),
   *   ciscospark.rooms.create({title: 'List Rooms Example 3'})
   * ])
   *   .then(function(r) {
   *     createdRooms = r;
   *     return ciscospark.rooms.list({max: 3})
   *       .then(function(rooms) {
   *         var assert = require('assert');
   *         assert(rooms.length === 3);
   *         for (var i = 0; i < rooms.items.length; i++) {
   *           assert(createdRooms.filter(function(room) {
   *             return room.id === rooms.items[i].id;
   *           }).length === 1);
   *         }
   *         return 'success';
   *       });
   *   });
   *   // => success
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
   * var ciscospark = require('../..');
   * var room;
   * ciscospark.rooms.create({title: 'Remove Room Example'})
   *  .then(function(r) {
   *    room = r;
   *    return ciscospark.rooms.remove(room.id);
   *  })
   *  .then(function() {
   *    return ciscospark.rooms.get(room.id);
   *  })
   *  .then(function() {
   *    var assert = require('assert');
   *    assert(false, 'the previous get should have failed');
   *  })
   *  .catch(function(reason) {
   *    var assert = require('assert');
   *    assert.equal(reason.statusCode, 404);
   *    return 'success'
   *  });
   *  // => success
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
   * var ciscospark = require('../..');
   * var room;
   * ciscospark.rooms.create({title: 'Update Room Example'})
   *   .then(function(r) {
   *     room = r;
   *     room.title = 'Update Room Example (Updated Title)';
   *     return ciscospark.rooms.update(room);
   *   })
   *   .then(function() {
   *     return ciscospark.rooms.get(room.id);
   *   })
   *   .then(function(room) {
   *    var assert = require('assert');
   *     assert.equal(room.title, 'Update Room Example (Updated Title)');
   *     return 'success';
   *   });
   *   // => success
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
