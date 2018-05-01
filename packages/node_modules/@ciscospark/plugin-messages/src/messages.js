/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {SparkPlugin, Page} from '@ciscospark/spark-core';
import {isArray} from 'lodash';

/**
 * @typedef {Object} MessageObject
 * @property {string} id - (server generated) Unique identifier for the message
 * @property {string} personId - The ID for the author of the messasge
 * @property {email} personEmail - The email for the author of the messasge
 * @property {string} roomId - The ID for the room of the message
 * @property {string} text - The message posted to the room in plain text
 * @property {string} markdown - The message posted to the room in markdown
 * @property {Array<string>} files - The source URL(s) for the message attachment(s).
 * See the {@link https://developer.webex.com/attachments.html|Message Attachments}
 * Guide for a list of supported media types.
 * @property {isoDate} created - (server generated) The date and time that the message was created
 */

/**
 * Messages are how people communicate in rooms. Each message timestamped and
 * represented in Spark as a distinct block of content. Messages can contain
 * plain text and a single file attachment. See the
 * {@link https://developer.webex.com/attachments.html|Message Attachments} Guide
 * for a list of supported media types.
 * @class
 */
const Messages = SparkPlugin.extend({
  /**
   * Post a new message and/or media content into a room.
   * @instance
   * @memberof Messages
   * @param {MessageObject} message
   * @returns {Promise<MessageObject>}
   * @example
   * ciscospark.rooms.create({title: 'Create Message Example'})
   *   .then(function(room) {
   *     return ciscospark.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(message) {
   *     var assert = require('assert');
   *     assert(message.id);
   *     assert(message.personId);
   *     assert(message.personEmail);
   *     assert(message.roomId);
   *     assert(message.created);
   *     return 'success';
   *   });
   *   // => success
   */
  create(message) {
    let key = 'body';
    if (message.file) {
      this.logger.warn('Supplying a single `file` property is deprecated; please supply a `files` array');
      message.files = [message.file];
      Reflect.deleteProperty(message, 'file');
    }

    if (isArray(message.files) && message.files.reduce((type, file) => type || typeof file !== 'string', false)) {
      key = 'formData';
    }

    const options = {
      method: 'POST',
      service: 'hydra',
      resource: 'messages',
      [key]: message
    };

    return this.request(options)
      .then((res) => res.body);
  },

  /**
   * Returns a single message.
   * @instance
   * @memberof Messages
   * @param {RoomObject|string} message
   * @returns {Promise<MessageObject>}
   * @example
   * var message;
   * ciscospark.rooms.create({title: 'Get Message Example'})
   *   .then(function(room) {
   *     return ciscospark.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message = m;
   *     return ciscospark.messages.get(message.id);
   *   })
   *   .then(function(message2) {
   *     var assert = require('assert');
   *     assert.deepEqual(message2, message);
   *     return 'success';
   *   });
   *   // => success
   */
  get(message) {
    const id = message.id || message;

    return this.request({
      service: 'hydra',
      resource: `messages/${id}`
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Returns a list of messages. In most cases the results will only contain
   * messages posted in rooms that the authentiated user is a member of.
   * @instance
   * @memberof Messages
   * @param {Object} options
   * @param {string} options.roomId
   * @param {number} options.max
   * @returns {Promise<Page<MessageObject>>}
   * @example
   * var message1, message2, room;
   * ciscospark.rooms.create({title: 'List Messages Example'})
   *   .then(function(r) {
   *     room = r;
   *     return ciscospark.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message1 = m;
   *     return ciscospark.messages.create({
   *       text: 'How are you?',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message2 = m;
   *     return ciscospark.messages.list({roomId: room.id});
   *   })
   *   .then(function(messages) {
   *     var assert = require('assert');
   *     assert.equal(messages.length, 2);
   *     assert.equal(messages.items[0].id, message2.id);
   *     assert.equal(messages.items[1].id, message1.id);
   *     return 'success';
   *   });
   *   // => success
   */
  list(options) {
    return this.request({
      service: 'hydra',
      resource: 'messages',
      qs: options
    })
      .then((res) => new Page(res, this.spark));
  },

  /**
   * Deletes a single message. Deleting a message will notify all members of the
   * room that the authenticated user deleted the message. Generally, users can
   * only delete their own messages except for the case of Moderated Rooms and
   * Org Administrators.
   * @instance
   * @memberof Messages
   * @param {MessageObject|uuid} message
   * @returns {Promise}}
   * @example
   * var message1, room;
   * ciscospark.rooms.create({title: 'Messages Example'})
   *   .then(function(r) {
   *     room = r;
   *     return ciscospark.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message1 = m;
   *     return ciscospark.messages.create({
   *       text: 'How are you?',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function() {
   *     return ciscospark.messages.remove(message1);
   *   })
   *   .then(function() {
   *     return ciscospark.messages.list({roomId: room.id});
   *   })
   *   .then(function(messages) {
   *     var assert = require('assert');
   *     assert.equal(messages.items.length, 1);
   *     assert(messages.items[0].id !== message1.id);
   *     return 'success';
   *   });
   *   // => success
   */
  remove(message) {
    const id = message.id || message;

    return this.request({
      method: 'DELETE',
      service: 'hydra',
      resource: `messages/${id}`
    })
      .then((res) => {
        // Firefox has some issues with 204s and/or DELETE. This should move to
        // http-core
        if (res.statusCode === 204) {
          return undefined;
        }
        return res.body;
      });
  }
});

export default Messages;
