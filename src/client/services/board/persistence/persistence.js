/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var SparkBase = require('../../../../lib/spark-base');
var chunk = require('lodash.chunk');
var pick = require('lodash.pick');
var last = require('lodash.last');
var promiseSeries = require('es6-promise-series');
// number is hard-coded in board service atm
var MAX_ALLOWED_INPUT_SIZE = 1000;

/**
 * @class
 * @extends {SparkBase}
 * @memberof Board
 */
var PersistenceService = SparkBase.extend({

  namespace: 'Board',

  /**
   * Adds Content to a Channel
   * If contents length is greater than MAX_ALLOWED_INPUT_SIZE, this method
   * will break contents into chunks and make multiple GET request to the
   * board service
   * @memberof Board.PersistenceService
   * @param  {Conversation} conversation - Contains the currently selected conversation
   * @param  {Board~Channel} channel
   * @param  {Array} contents - Array of {@link Board~Content} objects
   * @return {Promise<Board~Content>}
   */
  addContent: function addContent(conversation, channel, contents) {
    var chunks = [];
    chunks = chunk(contents, MAX_ALLOWED_INPUT_SIZE);
    // we want the first promise to resolve before continuing with the next
    // chunk or else we'll have race conditions among patches
    return promiseSeries(chunks.map(function _addContent(part) {
      return this._addContentChunk.bind(this, conversation, channel, part);
    }, this));
  },

  /**
   * Adds Image to a Channel
   * Uploads image to spark files and adds SCR + downalodUrl to the persistence
   * service
   * @memberof Board.PersistenceService
   * @param  {Conversation} conversation - Contains the currently selected conversation
   * @param  {Board~Channel} channel
   * @param  {File} image - image to be uploaded
   * @return {Promise<Board~Content>}
   */
  addImage: function addImage(conversation, channel, image) {
    return this.spark.board._uploadImage(conversation, image)
      .then(function addContent(scr) {
        return this.spark.board.persistence.addContent(conversation, channel, [{
          mimeType: image.type,
          size: image.size,
          displayName: image.name,
          scr: scr
        }]);
      }.bind(this));
  },

  /**
   * Creates a Channel
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @return {Promise<Board~Channel>}
   */
  createChannel: function createChannel(channel) {
    return this.spark.request({
      method: 'POST',
      api: 'board',
      resource: '/channels',
      body: channel
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  /**
   * Deletes all Content from a Channel
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @return {Promise} Resolves with an content response
   */
  deleteAllContent: function deleteAllContent(channel) {
    return this.spark.request({
      method: 'DELETE',
      uri: channel.channelUrl + '/contents'
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  /**
   * Deletes a specified Content from a Channel
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @param  {Board~Content} content
   * @return {Promise} Resolves with an content response
   */
  deleteContent: function deleteContent(channel, content) {
    return this.spark.request({
      method: 'DELETE',
      uri: content.contentUrl
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  /**
   * Gets all Content from a Channel
   * It will make multiple GET requests if contents length are greater than
   * MAX_ALLOW_INPUT_SIZE, the number is currently determined and hard-coded
   * by the backend
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @return {Promise<Array>} Resolves with an Array of {@link Board~Content} objects.
   */
  getAllContent: function getAllContent(channel) {
    var contents = [];
    var hasMoreContents = false;
    function loop() {
      if (!hasMoreContents) {
        return Promise.resolve(contents);
      }

      var oldestContentTime = last(contents).createdTime;
      return this._getPageOfContents(channel, {sinceDate: oldestContentTime})
        .then(function getMoreContents(res) {
          if (res.length >= MAX_ALLOWED_INPUT_SIZE) {
            hasMoreContents = true;
          }
          else {
            hasMoreContents = false;
          }

          // for the 2nd+ request, the result will include the last item of
          // the first request, so we'll discard it here
          res.shift();
          contents = contents.concat(res);
          return contents;
        })
        .then(loop.bind(this));
    }

    return this._getPageOfContents(channel)
      .then(function getContents(res) {
        contents = res;
        if (contents.length >= MAX_ALLOWED_INPUT_SIZE) {
          hasMoreContents = true;
        }

        return contents;
      })
      .then(loop.bind(this));
  },

  /**
   * Gets a Channel
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @return {Promise<Board~Channel>}
   */
  getChannel: function getChannel(channel) {
    return this.spark.request({
      method: 'GET',
      uri: channel.channelUrl
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  /**
   * Gets Channels
   * @memberof Board.PersistenceService
   * @param {Object} options
   * @param {number} options.limit Max number of activities to return
   * @return {Promise} Resolves with an array of Channel items
   */
  getChannels: function getChannels(options) {
    options = options || {};

    if (!options.conversationId) {
      return Promise.reject(new Error('`conversationId` is required'));
    }

    var params = {
      api: 'board',
      resource: '/channels',
      qs: {}
    };
    assign(params.qs, pick(options, 'channelsLimit', 'conversationId'));

    return this.request(params)
      .then(function resolveWithBody(res) {
        var responseObject = res.body;
        responseObject.links = this.spark.board.parseLinkHeaders(res.headers.link);
        return responseObject;
      }.bind(this));
  },

  /**
   * Pings persistence
   */
  ping: function ping() {
    return this.spark.request({
      method: 'GET',
      api: 'board',
      resource: '/ping'
    })
    .then(function resolveWithBody(res) {
      return res.body;
    });
  },

  /**
   * Registers with Mercury
   * @memberof Board.PersistenceService
   * @param  {Object} data - Mercury bindings
   * @return {Promise<Board~Registration>}
   */
  register: function register(data) {
    return this.spark.request({
      method: 'POST',
      api: 'board',
      resource: '/registrations',
      body: data
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  _addContentChunk: function _addContentHelper(conversation, channel, contentChunk) {
    return this.spark.board.encryptContents(conversation.defaultActivityEncryptionKeyUrl, contentChunk)
      .then(function addContent(res) {
        return this.spark.request({
          method: 'POST',
          uri: channel.channelUrl + '/contents',
          body: res
        });
      }.bind(this))
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  _getPageOfContents: function _getPageOfContents(channel, query) {
    query = query ? pick(query, 'sinceDate', 'contentsLimit') : {};

    return this.spark.request({
      method: 'GET',
      uri: channel.channelUrl + '/contents',
      qs: query
    })
      .then(function decryptContents(res) {
        return this.spark.board.decryptContents(res.body);
      }.bind(this));
  }

});

module.exports = PersistenceService;
