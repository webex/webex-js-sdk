/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assign} from 'lodash';
import {SparkPlugin, Page} from '@ciscospark/spark-core';
import Realtime from './realtime';
import {defaults, chunk, pick, last} from 'lodash';
import promiseSeries from 'es6-promise-series';

// number is hard-coded in board service atm
const MAX_ALLOWED_INPUT_SIZE = 1000;

const Board = SparkPlugin.extend({
  namespace: `Board`,

  children: {
    realtime: Realtime
  },

  /**
   * Adds Content to a Channel
   * If contents length is greater than MAX_ALLOWED_INPUT_SIZE, this method
   * will break contents into chunks and make multiple GET request to the
   * board service
   * @memberof Board.BoardService
   * @param  {Conversation} conversation - Contains the currently selected conversation
   * @param  {Board~Channel} channel
   * @param  {Array} contents - Array of {@link Board~Content} objects
   * @returns {Promise<Board~Content>}
   */
  addContent(conversation, channel, contents) {
    let chunks = [];
    chunks = chunk(contents, MAX_ALLOWED_INPUT_SIZE);
    // we want the first promise to resolve before continuing with the next
    // chunk or else we'll have race conditions among patches
    return promiseSeries(chunks.map((part) => this._addContentChunk.bind(this, conversation, channel, part)));
  },

  /**
   * Adds Image to a Channel
   * Uploads image to spark files and adds SCR + downloadUrl to the persistence
   * service
   * @memberof Board.BoardService
   * @param  {Conversation} conversation - Contains the currently selected conversation
   * @param  {Board~Channel} channel
   * @param  {File} image - image to be uploaded
   * @returns {Promise<Board~Content>}
   */
  addImage: function addImage(conversation, channel, image) {
    return this.spark.board._uploadImage(conversation, image)
      .then((scr) => this.spark.board.addContent(conversation, channel, [{
        mimeType: image.type,
        size: image.size,
        displayName: image.name,
        scr
      }]));
  },

  /**
   * Creates a Channel
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Channel>}
   */
  createChannel(channel) {
    return this.spark.request({
      method: `POST`,
      api: `board`,
      resource: `/channels`,
      body: channel
    })
      .then((res) => res.body);
  },

  /**
   * Decrypts a collection of content objects
   *
   * @memberof Board.BoardService
   * @param  {Array} contents curves, text, and images
   * @returns {Promise<Array>} Resolves with an array of {@link Board~Content} objects.
   */
  decryptContents(contents) {
    return Promise.all(contents.items.map((content) => {
      let decryptPromise;

      if (content.type === `FILE`) {
        decryptPromise = this.decryptSingleFileContent(content.payload, content.encryptionKeyUrl);
      }
      else {
        decryptPromise = this.decryptSingleContent(content.payload, content.encryptionKeyUrl);
      }

      return decryptPromise
      .then((res) => {
        Reflect.deleteProperty(content, `payload`);
        Reflect.deleteProperty(content, `encryptionKeyUrl`);
        return defaults(res, content);
      });
    }));
  },

  /**
   * Decryts a single STRING content object
   * @memberof Board.BoardService
   * @param  {string} encryptedData
   * @param  {string} encryptionKeyUrl
   * @returns {Promise<Board~Content>}
   */
  decryptSingleContent(encryptedData, encryptionKeyUrl) {
    return this.spark.encryption.decryptText(encryptionKeyUrl, encryptedData)
    .then((res) => JSON.parse(res));
  },

  /**
   * Decryts a single FILE content object
   * @memberof Board.BoardService
   * @param  {string} encryptedData
   * @param  {string} encryptionKeyUrl
   * @returns {Promise<Board~Content>}
   */
  decryptSingleFileContent(encryptedData, encryptionKeyUrl) {
    const payload = JSON.parse(encryptedData);

    return this.spark.encryption.decryptScr(encryptionKeyUrl, payload.scr)
    .then((scr) => {
      payload.scr = scr;
      return this.spark.encryption.decryptText(encryptionKeyUrl, payload.displayName);
    })
    .then((displayName) => {
      payload.displayName = displayName;
      return payload;
    });
  },

  /**
   * Deletes all Content from a Channel
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise} Resolves with an content response
   */
  deleteAllContent(channel) {
    return this.spark.request({
      method: `DELETE`,
      uri: `${channel.channelUrl}/contents`
    })
      .then((res) => res.body);
  },

  /**
   * Deletes a specified Content from a Channel
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {Board~Content} content
   * @returns {Promise} Resolves with an content response
   */
  deleteContent(channel, content) {
    return this.spark.request({
      method: `DELETE`,
      uri: content.contentUrl
    })
      .then((res) => res.body);
  },

  /**
   * Encrypts a collection of content
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl conversation.defaultActivityEncryptionKeyUrl
   * @param  {Array} contents   Array of {@link Board~Content} objects. (curves, text, and images)
   * @returns {Promise<Array>} Resolves with an array of encrypted {@link Board~Content} objects.
   */
  encryptContents(encryptionKeyUrl, contents) {
    return Promise.all(contents.map((content) => {
      let encryptionPromise;
      let contentType = `STRING`;

      // the existence of an scr will determine if the content is a FILE.
      if (content.scr) {
        contentType = `FILE`;
        encryptionPromise = this.encryptSingleFileContent(encryptionKeyUrl, content);
      }
      else {
        encryptionPromise = this.encryptSingleContent(encryptionKeyUrl, content);
      }

      return encryptionPromise
        .then((res) => ({
          device: this.spark.device.deviceType,
          type: contentType,
          encryptionKeyUrl,
          payload: res.encryptedData
        }));
    }));
  },

  /**
   * Encrypts a single STRING content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {Board~Content} content
   * @returns {Promise<Board~Content>}
   */
  encryptSingleContent(encryptionKeyUrl, content) {
    return this.spark.encryption.encryptText(encryptionKeyUrl, JSON.stringify(content))
    .then((res) => ({
      encryptedData: res,
      encryptionKeyUrl
    }));
  },

  /**
   * Encrypts a single FILE content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {Board~Content} content
   * @returns {Promise<Board~Content>}
   */
  encryptSingleFileContent(encryptionKeyUrl, content) {
    return this.spark.encryption.encryptScr(encryptionKeyUrl, content.scr)
    .then((encryptedScr) => {
      content.scr = encryptedScr;
      return this.spark.encryption.encryptText(encryptionKeyUrl, content.displayName);
    })
    .then((encryptedDisplayName) => {
      content.displayName = encryptedDisplayName;

      return {
        encryptedData: JSON.stringify(content),
        encryptionKeyUrl
      };
    });
  },

  /**
   * Gets all Content from a Channel
   * It will make multiple GET requests if contents length are greater than
   * MAX_ALLOW_INPUT_SIZE, the number is currently determined and hard-coded
   * by the backend
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise<Array>} Resolves with an Array of {@link Board~Content} objects.
   */
  getAllContent(channel) {
    let contents = [];
    let hasMoreContents = false;

    const loop = () => {
      if (!hasMoreContents) {
        return Promise.resolve(contents);
      }
      const oldestContentTime = last(contents).createdTime;

      return this._getPageOfContents(channel, {sinceDate: oldestContentTime})
        .then((res) => {

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
    };

    return this._getPageOfContents(channel)
      .then((res) => {
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
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Channel>}
   */
  getChannel(channel) {
    return this.spark.request({
      method: `GET`,
      uri: channel.channelUrl
    })
      .then((res) => res.body);
  },

  /**
   * Gets Channels
   * @memberof Board.BoardService
   * @param {Object} options
   * @param {number} options.limit Max number of activities to return
   * @returns {Promise<Page<Board~Channel>>} Resolves with an array of Channel items
   */
  getChannels(options) {
    options = options || {};

    if (!options.conversationId) {
      return Promise.reject(new Error(`\`conversationId\` is required`));
    }

    const params = {
      api: `board`,
      resource: `/channels`,
      qs: {}
    };
    assign(params.qs, pick(options, `channelsLimit`, `conversationId`));

    return this.request(params)
      .then((res) => new Page(res, this.spark));
  },

  /**
   * Pings persistence
   * @memberof Board.BoardService
   * @returns {Promise<Object>} ping response body
   */
  ping() {
    return this.spark.request({
      method: `GET`,
      api: `board`,
      resource: `/ping`
    })
      .then((res) => res.body);
  },

  processActivityEvent(message) {
    let decryptionPromise;

    if (message.contentType === `FILE`) {
      decryptionPromise = this.decryptSingleFileContent(message.payload, message.envelope.encryptionKeyUrl);
    }
    else {
      decryptionPromise = this.decryptSingleContent(message.payload, message.envelope.encryptionKeyUrl);
    }

    return decryptionPromise
      .then((decryptedData) => {
        // call the event handlers
        message.payload = decryptedData;
        return message;
      });
  },

  /**
   * Registers with Mercury
   * @memberof Board.BoardService
   * @param  {Object} data - Mercury bindings
   * @returns {Promise<Board~Registration>}
   */
  register(data) {
    return this.spark.request({
      method: `POST`,
      api: `board`,
      resource: `/registrations`,
      body: data
    })
      .then((res) => res.body);
  },

  _addContentChunk(conversation, channel, contentChunk) {
    return this.spark.board.encryptContents(conversation.defaultActivityEncryptionKeyUrl, contentChunk)
      .then((res) => this.spark.request({
        method: `POST`,
        uri: `${channel.channelUrl}/contents`,
        body: res
      }))
      .then((res) => res.body);
  },

  _getPageOfContents(channel, query) {
    query = query ? pick(query, `sinceDate`, `contentsLimit`) : {};

    return this.spark.request({
      method: `GET`,
      uri: `${channel.channelUrl}/contents`,
      qs: query
    })
      .then((res) => this.spark.board.decryptContents(res.body));
  },

  /**
   * Encrypts and uploads image to SparkFiles
   * @memberof Board.BoardService
   * @param  {Conversation} conversation - Contains the currently selected conversation
   * @param  {File} file - File to be uploaded
   * @private
   * @returns {Object} Encrypted Scr and KeyUrl
   */
  _uploadImage(conversation, file) {
    return this.spark.encryption.encryptBinary(file)
      .then(({scr, cdata}) => Promise.all([scr, this._uploadImageToSparkFiles(conversation, cdata)]))
      .then(([scr, res]) => assign(scr, {loc: res.downloadUrl}));
  },

  _getSpaceUrl(conversation) {
    return this.spark.request({
      method: `PUT`,
      uri: `${conversation.url}/space`
    })
      .then((res) => res.body.spaceUrl);
  },

  _uploadImageToSparkFiles(conversation, file) {
    const fileSize = file.length || file.size || file.byteLength;

    return this._getSpaceUrl(conversation)
      .then((spaceUrl) => this.spark.upload({
        uri: `${spaceUrl}/upload_sessions`,
        file,
        qs: {
          transcode: true
        },
        phases: {
          initialize: {fileSize},
          upload: {
            $url(session) {
              return session.uploadUrl;
            }
          },
          finalize: {
            $uri(session) {
              return session.finishUploadUrl;
            },
            body: {fileSize}
          }
        }
      }));
  }
});

export default Board;
