import '@ciscospark/plugin-board';
import '@ciscospark/plugin-conversation';
import {SparkPlugin, Page} from '@ciscospark/spark-core';
import {base64} from '@ciscospark/common';
import util from 'util';

/**
 * @typedef {Object} Types~Whiteboard
 * @property {string} id - (server generated) Unique identifier for the whiteboard
 * @property {string} roomId - (optional): The id of the room with which the board is associated
 */

/**
 * Rooms are virtual meeting places for getting stuff done. This resource
 * represents the room itself. Check out the Memberships API to learn how to add
 * and remove people from rooms and the Messages API for posting and managing
 * content.
 * @class
 * @extends SparkPlugin
 */
const Whiteboards = SparkPlugin.extend({
  /**
   * Creates a new whiteboard.
   * @instance
   * @memberof Whiteboards
   * @param {Types~Whiteboard} whiteboard
   * @returns {Promise<Types~Whiteboard>}
   * @example
   * var ciscospark = require('../..');
   * ciscospark.whiteboards.create({ })
   *   .then(function(board) {
   *     var assert = require('assert')
   *     assert(typeof board.created === 'string');
   *     assert(typeof board.id === 'string');
   *     console.log(board.id);
   *     return 'success';
   *   });
   *   // => success
   */
  create(board) {
    let resolveConversation = null;
    let conversationId;
    if (board.roomId) {
      conversationId = base64.fromBase64url(board.roomId);
      const idx = conversationId.lastIndexOf('/');
      if (idx == -1) {
        return Promise.reject(new Error('Invalid roomId: ' + board.roomId));
      }
      conversationId = conversationId.substring(idx + 1);
    }

    const body = {};
    if (conversationId) {
      body.aclUrl = conversationId;
    }

    return this.spark.board.createChannel(body)
        .then((res) => _channelToWhiteboard(res));
  },

  /**
   * Returns a single whiteboard.
   * @instance
   * @memberof Whiteboards
   * @param {Types~Whiteboard|string} board
   * @param {Object} options
   * @returns {Promise<Types~Whiteboard>}
   * @example
   * var ciscospark = require('../..');
   * var board;
   * ciscospark.whiteboards.create({ })
   *   .then(function(w) {
   *     board = w
   *     return ciscospark.whiteboards.get(board.id)
   *   })
   *   .then(function(w) {
   *     var assert = require('assert');
   *     assert.deepEqual(w, board);
   *     return 'success';
   *   });
   *   // => success
   */
  get(board, options) {
    const id = board.id || board;
    let channelId = base64.decode(id);
    const idx = channelId.lastIndexOf('/');
    if (idx == -1) {
      // Assume it's a Channel UUID
      channelId = id;
    } else {
      channelId = channelId.substring(idx + 1);
    }

    return this.spark.request({
      method: 'GET',
      api: 'board',
      resource: '/channels/' + channelId })
      .then((res) => {
        return _channelToWhiteboard(res.body);
      });
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
    options = options || {};
    const roomId = options.roomId;
    let conversationId = base64.decode(roomId);
    const idx = conversationId.lastIndexOf('/');
    if (idx == -1) {
      return Promise.reject(new Error('Invalid room ID: ' + id));
    }
    conversationId = conversationId.substring(idx + 1);

    return this.spark.request({
      method: 'GET',
      api: 'board',
      resource: '/channels',
      qs: { conversationId: conversationId }
     })
      .then((res) => {
        const items = res.body.items;
        for (let idx = 0; idx < items.length; idx++) {
          items[idx] = _channelToWhiteboard(items[idx]);
        }
        return new Page(res, this.spark);
      });
  },

});

export default Whiteboards;


function _channelToWhiteboard(channel) {
  const result = {
    id: base64.encode(`ciscospark://us/WHITEBOARD/${channel.channelId}`)
  };

  if (channel.conversationUrl) {
    let roomId = channel.conversationUrl;
    const idx = roomId.lastIndexOf('/');
    if (idx != -1) {
      roomId = roomId.substring(idx + 1);
    }
    result.roomId = base64.encode(`ciscospark://us/ROOM/${roomId}`);
  }

  result.creatorId = base64.encode(`ciscospark://us/PERSON/${channel.creatorId}`);
  result.created = new Date(channel.createdTime).toISOString();

  return result;
}
