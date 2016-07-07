/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');
var omit = require('lodash.omit');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Mashups
 */
var MashupsService = SparkBase.extend({
  /** @lends Mashups.MashupsService.prototype */
  namespace: 'Mashups',

  /**
   * Returns the users configured integrations
   * @param {Object|Conversation~ConversationObect} options
   * @param {string} options.id
   * @param {string} options.roomId
   * @returns {Array}
   */
  get: function get(options) {
    options = options || {};

    var resource = 'integrations';
    if (options.id || options.roomId) {
      resource = 'integrations/rooms/' + (options.id || options.roomId);
    }

    return this.request({
      api: 'mashups',
      resource: resource,
      method: 'GET'
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  /**
   * Creates a new integration
   * @param {Object} options integration details
   * @returns {IntegrationModel} created integration
   */
  create: function create(options) {
    options = options || {};

    if (!options.type) {
      return Promise.reject(new Error('`options.type` is required'));
    }

    if (!options.roomId) {
      return Promise.reject(new Error('`options.roomId` is required'));
    }

    return this.request({
      api: 'mashups',
      resource: 'integrations/' + options.type,
      method: 'POST',
      body: omit(options, 'type')
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  /**
   * Delete an integration
   * @param {Object} options integration details
   */
  remove: function remove(options) {
    options = options || {};

    if (!options.type) {
      return Promise.reject(new Error('`options.type` is required'));
    }

    if (!options.id) {
      return Promise.reject(new Error('`options.id` is required'));
    }

    return this.request({
      api: 'mashups',
      resource: 'integrations/' + options.type + '/' + options.id,
      method: 'DELETE'
    });
  }
});

module.exports = MashupsService;
