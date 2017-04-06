/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var SparkBase = require('../../../../lib/spark-base');
var chunk = require('lodash.chunk');
var pick = require('lodash.pick');
var promiseSeries = require('es6-promise-series');

var MAX_CONTENTS_ADD = 150;
var MAX_CONTENTS_GET = 1000;

/**
 * @class
 * @extends {SparkBase}
 * @memberof Board
 */
var PersistenceService = SparkBase.extend({

  namespace: 'Board',

  /**
   * Adds Content to a Channel
   * If contents length is greater than MAX_CONTENTS_ADD, this method
   * will break contents into chunks and make multiple GET request to the
   * board service
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @param  {Array} contents - Array of {@link Board~Content} objects
   * @return {Promise<Board~Content>}
   */
  addContent: function addContent(channel, contents) {
    var chunks = [];
    chunks = chunk(contents, MAX_CONTENTS_ADD);
    // we want the first promise to resolve before continuing with the next
    // chunk or else we'll have race conditions among patches
    return promiseSeries(chunks.map(function _addContent(part) {
      return this._addContentChunk.bind(this, channel, part);
    }, this));
  },

  /**
   * Adds Image to a Channel
   * Uploads image to spark files and adds SCR + downalodUrl to the persistence
   * service
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @param  {File} image - image to be uploaded
   * @return {Promise<Board~Content>}
   */
  addImage: function addImage(channel, image) {
    return this.spark.board._uploadImage(channel, image)
      .then(function addContent(scr) {
        return this.spark.board.persistence.addContent(channel, [{
          type: 'FILE',
          displayName: image.name,
          file: {
            mimeType: image.type,
            scr: scr,
            size: image.size,
            url: scr.loc
          }
        }]);
      }.bind(this));
  },


  /**
   * Set a snapshot image for a board
   *
   * @param {Board~Channel} channel
   * @param {File} image
   * @returns {Promise<Board~Channel>}
   */
  setSnapshotImage: function setSnapshotImage(channel, image) {
    var imageScr;
    return this.spark.board._uploadImage(channel, image, {hiddenSpace: true})
      .then(function encryptScr(scr) {
        imageScr = scr;
        return this.spark.encryption.encryptScr(imageScr, channel.defaultEncryptionKeyUrl);
      }.bind(this))
      .then(function attachEncryptedScr(encryptedScr) {
        imageScr.encryptedScr = encryptedScr;
        return encryptedScr;
      }.bind(this))
      .then(function setSnapshotInChannel() {
        var imageBody = {
          image: {
            url: imageScr.loc,
            height: image.height || 900,
            width: image.width || 1600,
            mimeType: image.type || 'image/png',
            scr: imageScr.encryptedScr,
            encryptionKeyUrl: channel.defaultEncryptionKeyUrl,
            fileSize: image.size
          }
        };
        return this.spark.request({
          method: 'PATCH',
          api: 'board',
          resource: '/channels/' + channel.channelId,
          body: imageBody
        });
      }.bind(this))
      .then(function returnSnapshotRes(res) {
        return res.body;
      });
  },

  /**
   * Creates a Channel
   * @memberof Board.PersistenceService
   * @param  {Conversation~ConversationObject} conversation
   * @param  {Board~Channel} channel
   * @return {Promise<Board~Channel>}
   */
  createChannel: function createChannel(conversation, channel) {
    return this._encryptChannel(conversation, channel)
      .then(function requestCreateChannel(preppedChannel) {
        return this.spark.request({
          method: 'POST',
          api: 'board',
          resource: '/channels',
          body: preppedChannel
        });
      }.bind(this))
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  _encryptChannel: function _encryptChannel(conversation, channel) {
    channel = this._prepareChannel(conversation, channel);
    return this.spark.board.encryptChannel(channel);
  },

  _prepareChannel: function _prepareChannel(conversation, channel) {
    if (!channel) {
      channel = {};
    }

    channel.aclUrlLink = conversation.aclUrl;
    channel.kmsMessage = {
      method: 'create',
      uri: '/resources',
      userIds: [conversation.kmsResourceObjectUrl],
      keyUris: []
    };

    return channel;
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
   * Gets all Content from a Channel
   * It will make multiple GET requests if contents length are greater than
   * MAX_CONTENTS_GET, the number is currently determined and hard-coded
   * by the backend
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @return {Promise<Array>} Resolves with an Array of {@link Board~Content} objects.
   */
  getAllContent: function getAllContent(channel, query) {
    var defaultQuery = {
      contentsLimit: MAX_CONTENTS_GET
    };

    query = query ? assign(defaultQuery, pick(query, 'contentsLimit')) : defaultQuery;

    function loop(contents) {
      if (!contents.link || !contents.link.next) {
        return Promise.resolve(contents.items);
      }

      return this.spark.request({
        uri: contents.link.next
      })
        .then(function decryptContents(res) {
          contents.link = this.spark.board.parseLinkHeaders(res.headers.link);
          return this.spark.board.decryptContents(res.body);
        }.bind(this))

        .then(function getMoreContents(res) {
          contents.items = contents.items.concat(res);
          return contents;
        }.bind(this))
        .then(loop.bind(this));
    }

    return this._getPageOfContents(channel, query)
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
   * @param {Conversation~ConversationObject} conversation
   * @param {Object} options
   * @param {number} options.limit Max number of activities to return
   * @return {Promise} Resolves with an array of Channel items
   */
  getChannels: function getChannels(conversation, options) {
    options = options || {};

    if (!conversation) {
      return Promise.reject(new Error('`conversation` is required'));
    }

    var params = {
      api: 'board',
      resource: '/channels',
      qs: {
        aclUrlLink: conversation.aclUrl
      }
    };
    assign(params.qs, pick(options, 'channelsLimit'));

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

  /**
   * Registers with Mercury to share mercury connection
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @return {Promise<Board~Registration>}
   */
  registerToShareMercury: function registerToShareMercury(channel) {
    if (!this.spark.mercury.localClusterServiceUrls) {
      return Promise.reject(new Error('`localClusterServiceUrls` is not defined, make sure mercury is connected'));
    }
    else if (!this.spark.feature.getFeature('developer', 'web-shared-mercury')) {
      return Promise.reject(new Error('`web-shared-mercury` is not enabled'));
    }

    var webSocketUrl = this.spark.device.webSocketUrl;
    var localClusterServiceUrls = this.spark.mercury.localClusterServiceUrls;

    var data = {
      mercuryConnectionServiceClusterUrl: localClusterServiceUrls.mercuryConnectionServiceClusterUrl,
      webSocketUrl: webSocketUrl,
      action: 'REPLACE'
    };

    return this.spark.request({
      method: 'POST',
      uri: channel.channelUrl + '/register',
      body: data
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  /**
   * Unregister the board from share mercury connection
   * @memberof Board.PersistenceService
   * @param  {Board~Channel} channel
   * @param  {Object} binding - board binding
   * @return {Promise<Board~Registration>}
   */
  unregisterFromSharedMercury: function unregisterFromSharedMercury(channel, binding) {
    var webSocketUrl = this.spark.device.webSocketUrl;
    var data = {
      binding: binding,
      webSocketUrl: webSocketUrl,
      action: 'REMOVE'
    };

    return this.spark.request({
      method: 'POST',
      uri: channel.channelUrl + '/register',
      body: data
    })
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  _addContentChunk: function _addContentHelper(channel, contentChunk) {
    return this.spark.board.encryptContents(channel.defaultEncryptionKeyUrl, contentChunk)
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
    query = query ? pick(query, 'contentsLimit') : {};
    var nextLink;

    return this.spark.request({
      method: 'GET',
      uri: channel.channelUrl + '/contents',
      qs: query
    })
      .then(function decryptContents(res) {
        nextLink = this.spark.board.parseLinkHeaders(res.headers.link);
        return this.spark.board.decryptContents(res.body);
      }.bind(this))
      .then(function addNextLink(res) {
        return {
          items: res,
          link: nextLink
        };
      }.bind(this));
  }

});

module.exports = PersistenceService;
