/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

var isarray = require('lodash.isarray');
var Persistence = require('./persistence');
var Realtime = require('./realtime');
var reduce = require('lodash.reduce');
var SparkBase = require('../../../lib/spark-base');
var defaults = require('lodash.defaults');

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
        decryptPromise =  this.decryptSingleFileContent(content.payload, content.encryptionKeyUrl);
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
   * @param  {string} encryptedData
   * @param  {string} encryptionKeyUrl
   * @return {Promise<Board~Content>}
   */
  decryptSingleFileContent: function _decryptSingleFileContent(encryptedData, encryptionKeyUrl) {
    var payload = JSON.parse(encryptedData);

    return this.spark.encryption.decryptScr(payload.scr, encryptionKeyUrl)
      .then(function setScrInPayload(scr) {
        payload.scr = scr;
        return this.spark.encryption.decryptText(payload.displayName, encryptionKeyUrl);
      }.bind(this))
      .then(function setDisplayNameInPayload(displayName) {
        payload.displayName = displayName;
        return payload;
      });
  },

  /**
   * Encrypts a collection of content
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl conversation.defaultActivityEncryptionKeyUrl
   * @param  {Array} contents   Array of {@link Board~Content} objects. (curves, text, and images)
   * @return {Promise<Array>} Resolves with an array of encrypted {@link Board~Content} objects.
   */
  encryptContents: function encryptContents(encryptionKeyUrl, contents) {
    return Promise.all(contents.map(function encryptSingleContent(content) {
      var encryptionPromise;
      var contentType = 'STRING';

      // the existence of an scr will determine if the content is a FILE.
      if (content.scr) {
        contentType = 'FILE';
        encryptionPromise = this.encryptSingleFileContent(encryptionKeyUrl, content);
      }
      else {
        encryptionPromise = this.encryptSingleContent(encryptionKeyUrl, content);
      }

      return encryptionPromise
        .then(function createEncryptedContent(res) {
          return {
            device: this.spark.device.deviceType,
            type: contentType,
            encryptionKeyUrl: encryptionKeyUrl,
            payload: res.encryptedData
          };
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
    return this.spark.encryption.encryptScr(content.scr, encryptionKeyUrl)
      .then(function encryptDisplayName(encryptedScr) {
        content.scr = encryptedScr;
        return this.spark.encryption.encryptText(content.displayName, encryptionKeyUrl);
      }.bind(this))
      .then(function stringifyContent(displayName) {
        content.displayName = displayName;

        return {
          encryptedData: JSON.stringify(content),
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
   * Encrypts and uploads image to SparkFiles
   * @memberof Board.BoardService
   * @param  {Conversation} conversation - Contains the currently selected conversation
   * @param  {File} file - File to be uploaded
   * @private
   * @return {Object} Encrypted Scr and KeyUrl
   */
  _uploadImage: function uploadImage(conversation, file) {
    var encryptedBinary;
    return this.spark.encryption.encryptBinary(file)
      .then(function _uploadImageToSparkFiles(res) {
        encryptedBinary = res;
        return this._uploadImageToSparkFiles(conversation, res.cblob);
      }.bind(this))
      .then(function prepareScr(res) {
        var scr = encryptedBinary.scr;
        scr.loc = res.downloadUrl;
        return scr;
      }.bind(this));
  },

  _uploadImageToSparkFiles: function _uploadImageToSparkFiles(conversation, cblob) {
    return this.spark.request({
      method: 'PUT',
      uri: conversation.url + '/space'
    })
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
  }
});

module.exports = BoardService;
