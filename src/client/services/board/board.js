/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

var assign = require('lodash.assign');
var defaults = require('lodash.defaults');
var isarray = require('lodash.isarray');
var Persistence = require('./persistence');
var pick = require('lodash.pick');
var Realtime = require('./realtime');
var reduce = require('lodash.reduce');
var SparkBase = require('../../../lib/spark-base');

var MERCURY_BINDING_PREFIX = 'board.';

/**
 * @class
 * @extends {SparkBase}
 * @memberof Board
 */
var BoardService = SparkBase.extend({
  namespace: 'Board',

  children: {
    persistence: Persistence,
    realtime: Realtime
  },

  /**
   * Decrypts a collection of content objects
   *
   * @memberof Board.BoardService
   * @param  {Array} contents curves, text, and images
   * @return {Promise<Array>} Resolves with an array of {@link Board~Content} objects.
   */
  decryptContents: function decryptContents(contents) {
    return Promise.all(contents.items.map(function decryptSingleContent(content) {
      var decryptPromise;

      if (content.type === 'FILE') {
        decryptPromise =  this.decryptSingleFileContent(content, content.encryptionKeyUrl);
      }
      else {
        decryptPromise = this.decryptSingleContent(content.payload, content.encryptionKeyUrl);
      }

      return decryptPromise
        .then(function prepareContent(res) {
          delete content.payload;
          delete content.encryptionKeyUrl;
          return defaults(res, content);
        });
    }, this));
  },

  /**
   * Decryts a single STRING content object
   * @memberof Board.BoardService
   * @param  {string} encryptedData
   * @param  {string} encryptionKeyUrl
   * @return {Promise<Board~Content>}
   */
  decryptSingleContent: function _decryptSingleContent(encryptedData, encryptionKeyUrl) {
    return this.spark.encryption.decryptText(encryptedData, encryptionKeyUrl)
      .then(function returnDecryptedText(res) {
        return JSON.parse(res);
      });
  },

  /**
   * Decryts a single FILE content object
   * @memberof Board.BoardService
   * @param  {string} encryptedFileContent
   * @param  {string} encryptionKeyUrl
   * @return {Promise<Board~Content>}
   */
  decryptSingleFileContent: function _decryptSingleFileContent(encryptedFileContent, encryptionKeyUrl) {
    var metadata = {};

    if (encryptedFileContent.payload) {
      metadata = JSON.parse(encryptedFileContent.payload);
    }

    return this.spark.encryption.decryptScr(encryptedFileContent.file.scr, encryptionKeyUrl)
      .then(function setScrInPayload(scr) {
        encryptedFileContent.file.scr = scr;
        return this.spark.encryption.decryptText(metadata.displayName, encryptionKeyUrl);
      }.bind(this))
      .then(function setDisplayNameInPayload(displayName) {
        encryptedFileContent.displayName = displayName;
        return encryptedFileContent;
      });
  },


  /**
   * Encrypt a channel
   *
   * @param {Board~Channel} channel
   * @param {Object} options
   * @param {Object} options.key Key to encrypt the channel and its contents
   * @returns {Promise<Board~EncryptedChannel>}
   */
  encryptChannel: function encryptChannel(channel, options) {
    options = options || {};

    return Promise.resolve(options.key || this.spark.encryption.getUnusedKey())
      .then(function encryptKmsMessage(key) {
        channel.defaultEncryptionKeyUrl = key.keyUrl;
        return this.spark.conversation.encrypter.encryptProperty(channel, 'kmsMessage', key);
      }.bind(this));
  },

  /**
   * Encrypts a collection of content
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl channel.defaultEncryptionKeyUrl
   * @param  {Array} contents   Array of {@link Board~Content} objects. (curves, text, and images)
   * @return {Promise<Array>} Resolves with an array of encrypted {@link Board~Content} objects.
   */
  encryptContents: function encryptContents(encryptionKeyUrl, contents) {
    return Promise.all(contents.map(function encryptSingleContent(content) {
      var encryptionPromise;
      var contentType = 'STRING';

      // the existence of an scr will determine if the content is a FILE.
      if (content.file) {
        contentType = 'FILE';
        encryptionPromise = this.encryptSingleFileContent(encryptionKeyUrl, content);
      }
      else {
        encryptionPromise = this.encryptSingleContent(encryptionKeyUrl, content);
      }

      return encryptionPromise
        .then(function createEncryptedContent(res) {
          return assign({
              device: this.spark.device.deviceType,
              type: contentType,
              encryptionKeyUrl: encryptionKeyUrl,
              payload: res.encryptedData
            },
            pick(res, 'file')
          );
        }.bind(this));
    }, this));
  },

  /**
   * Encrypts a single STRING content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {Board~Content} content
   * @return {Promise<Board~Content>}
   */
  encryptSingleContent: function _encryptSingleContent(encryptionKeyUrl, content) {
    return this.spark.encryption.encryptText(JSON.stringify(content), encryptionKeyUrl)
      .then(function returnEncryptedText(res) {
        return {
          encryptedData: res,
          encryptionKeyUrl: encryptionKeyUrl
        };
      });
  },

  /**
   * Encrypts a single FILE content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {Board~Content} content
   * @return {Promise<Board~Content>}
   */
  encryptSingleFileContent: function _encryptSingleFileContent(encryptionKeyUrl, content) {
    return this.spark.encryption.encryptScr(content.file.scr, encryptionKeyUrl)
      .then(function encryptDisplayName(encryptedScr) {
        content.file.scr = encryptedScr;
        return this.spark.encryption.encryptText(content.displayName, encryptionKeyUrl);
      }.bind(this))
      .then(function returnEncryptedContent(encryptedDisplayName) {
        var metadata = {
          displayName: encryptedDisplayName
        };

        return {
          file: content.file,
          encryptedData: JSON.stringify(metadata),
          encryptionKeyUrl: encryptionKeyUrl
        };
      });
  },

  /**
   * Separate a single link header string into an actionable object
   * @param {string} linkHeaders
   * @private
   * @returns {Object}
   */
  parseLinkHeaders: function parseLinkHeaders(linkHeaders) {
    if (!linkHeaders) {
      return {};
    }

    linkHeaders = isarray(linkHeaders) ? linkHeaders : [linkHeaders];
    return reduce(linkHeaders, function reduceLinkHeaders(links, linkHeader) {
      linkHeader = linkHeader.split(';');
      var link = linkHeader[0]
        .replace('<', '')
        .replace('>', '');
      var rel = linkHeader[1]
        .split('=')[1]
        .replace(/"/g, '');
      links[rel] = link;
      return links;
    }, {});
  },

  processActivityEvent: function processActivityEvent(message) {
    var decryptionPromise;

    if (message.contentType === 'FILE') {
      decryptionPromise = this.decryptSingleFileContent(message.payload, message.envelope.encryptionKeyUrl);
    }
    else {
      decryptionPromise = this.decryptSingleContent(message.payload, message.envelope.encryptionKeyUrl);
    }

    return decryptionPromise
      .then(function sendDecryptedData(decryptedData) {
        // call the event handlers
        message.payload = decryptedData;
        return message;
      });
  },

  /**
   * Ensure board channelId is compatible with mercury bindings by replacing
   * '-' with '.' and '_' with '#'
   * @memberof Board.BoardService
   * @param  {String} channel.channelId
   * @returns {String} mercury-binding compatible string
   */
  boardChannelIdToMercuryBinding: function boardChannelIdToMercuryBinding(channelId) {
    // make channelId mercury compatible replace '-' with '.' and '_' with '#'
    return MERCURY_BINDING_PREFIX + channelId.replace(/-/g, '.').replace(/_/g, '#');
  },

  /**
   * Encrypts and uploads image to SparkFiles
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {File} file - File to be uploaded
   * @private
   * @return {Object} Encrypted Scr and KeyUrl
   */
  _uploadImage: function uploadImage(channel, file, options) {
    options = options || {};
    var encryptedBinary;

    return this.spark.encryption.encryptBinary(file)
      .then(function _uploadImageToBoardSpace(res) {
        encryptedBinary = res;
        return this._uploadImageToBoardSpace(channel, res.cblob, options.hiddenSpace);
      }.bind(this))
      .then(function prepareScr(res) {
        var scr = encryptedBinary.scr;
        scr.loc = res.downloadUrl;
        return scr;
      }.bind(this));
  },

  _uploadImageToBoardSpace: function _uploadImageToBoardSpace(channel, cblob, hiddenSpace) {
    return this._getSpaceUrl(channel, hiddenSpace)
      .then(function uploadFile(res) {
        return this.spark.client.upload({
          uri: res.body.spaceUrl + '/upload_sessions',
          file: cblob,
          qs: {
            transcode: true
          },
          phases: {
            initialize: {
              fileSize: cblob.length || cblob.size || cblob.byteLength
            },
            upload: {
              $uri: function $uri(session) {
                return session.uploadUrl;
              }
            },
            finalize: {
              $uri: function $uri(session) {
                return session.finishUploadUrl;
              },
              body: {
                fileSize: cblob.length || cblob.size || cblob.byteLength
              }
            }
          }
        });
      }.bind(this));
  },

  _getSpaceUrl: function _getSpaceUrl(channel, hiddenSpace) {
    var requestUri = channel.channelUrl + '/spaces/open';
    if (hiddenSpace) {
      requestUri = channel.channelUrl + '/spaces/hidden';
    }

    return this.spark.request({
      method: 'PUT',
      uri: requestUri
    });
  }
});

module.exports = BoardService;
