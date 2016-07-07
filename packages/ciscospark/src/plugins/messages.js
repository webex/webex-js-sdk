/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Page from '../lib/page';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @typedef {Object} Types~Message
 * @property {uuid} id - (server generated) Unique identifier for the message
 * @property {uuid} personId - The ID for the author of the messasge
 * @property {email} personEmail - The email for the author of the messasge
 * @property {string} roomId - The message posted to the room in plain text
 * @property {isoDate} created - (server generated)The source URLs for the
 * message attachment. See the {@link Content & Attachments{ Guide for a list of
 * supported media types.
 */

/**
 * Messages are how people communicate in rooms. Each message timestamped and
 * represented in Spark as a distinct block of content. Messages can contain
 * plain text and a single file attachment. See the
 * {@link Message Attachments Guide} for a list of supported media types.
 * @class
 * @extends SparkPlugin
 */
const Messages = SparkPlugin.extend({
  /**
   * Post a new message and/or media content into a room.
   * @instance
   * @memberof Messages
   * @param {Types~Message} message
   * @returns {Promise<Types~Message>}
   * @example
   * <%= messages__create_es6 %>
   * @example
   * <%= messages__create %>
   */
  create(message) {
    return this.request({
      method: `POST`,
      uri: `${this.config.hydraServiceUrl}/messages`,
      body: message
    })
      .then((res) => res.body);
  },

  /**
   * Returns a single message.
   * @instance
   * @memberof Messages
   * @param {Types~Room|string} message
   * @returns {Promise<Types~Message>}
   * @example
   * <%= messages__get_es6 %>
   * @example
   * <%= messages__get %>
   */
  get(message) {
    const id = message.id || message;

    return this.request({
      uri: `${this.config.hydraServiceUrl}/messages/${id}`
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
   * @returns {Promise<Page<Types~Message>>}
   * @example
   * <%= messages__list_es6 %>
   * @example
   * <%= messages__list %>
   */
  list(options) {
    return this.request({
      uri: `${this.config.hydraServiceUrl}/messages`,
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
   * @param {Types~Message|uuid} message
   * @returns {Promise}}
   * @example
   * <%= messages__remove_es6 %>
   * @example
   * <%= messages__remove %>
   */
  remove(message) {
    const id = message.id || message;

    return this.request({
      method: `DELETE`,
      uri: `${this.config.hydraServiceUrl}/messages/${id}`
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
