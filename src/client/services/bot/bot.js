/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Bot
 */
var BotService = SparkBase.extend(
  /** @lends Bot.BotService.prototype */
  {
  namespace: 'Bot',

  /**
   * Creates a bot
   * @param {Object} options
   * @param {string} options.name (optional)
   * @param {string} options.description (optional)
   * @param {string} options.contactEmail (required)
   * @return {Promise} Resolves with a {@link Bot~BotObject}
   */
  create: function create(options) {
    options = options || {};

    if (!options.name) {
      return Promise.reject(new Error('`options.name` is required'));
    }

    // TODO if contactEmail not defined, fetch the current user's email
    if (!options.contactEmail) {
      return Promise.reject(new Error('`options.contactEmail` is required'));
    }

    return this.request({
      method: 'POST',
      api: 'conversation',
      resource: 'bots',
      body: options
    })
      .then(function processResponse(res) {
        return res.body;
      });
  },

  /**
   * Deletes a bot
   * @param {Bot~BotObject|uuid} bot
   * @return {Promise}
   */
  remove: function remove(bot) {
    var id;
    if (bot) {
      id = bot.id || bot;
      if (typeof id !== 'string') {
        return Promise.reject(new Error('`bot.id` is required'));
      }
    }
    else {
      id = this.spark.device.userId;
    }

    return this.request({
      method: 'DELETE',
      api: 'conversation',
      resource: 'bots/' + id
    })
      .then(function processResponse(res) {
        return res.body;
      });
  },

  /**
   * Retrieves the current user's bots
   * @return {Promise} Resolves with a {@link Bot~BotObject}
   */
  get: function get() {
    return this.request({
      api: 'conversation',
      resource: 'bots'
    })
      .then(function processResponse(res) {
        return res.body;
      });
  }
});

module.exports = BotService;
