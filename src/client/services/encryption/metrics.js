/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');
var hashId = require('./../../../util/hash-id');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Encryption
 */
var EncryptionMetrics = SparkBase.extend(
  /** @lends Encryption.EncryptionMetrics.prototype */
  {
  namespace: 'Encryption',

  /**
   * Records initial data for sending a `decryption` metric to splunk
   * @param {Activity|Conversation|FileItem} object
   * @param {ArrayBuffer} buffer only expected if object is  FileItem
   */
  startDecryptionMetrics: function startDecryptionMetrics(object, buffer, key) {
    // If it has an loc, it is an SCR
    if (object.loc) {
      this._startBinaryDecryptionMetrics(object, buffer);
    }
    else {
      this._startTextDecryptionMetrics(object, key);
    }
  },

  /**
   * Records initial data for sending a `decryption` metric to splunk for
   * FileItems
   * @param {FileItems} scr
   * @param {ArrayBuffer} buffer
   * @private
   */
  _startBinaryDecryptionMetrics: function _startBinaryDecryptionMetrics(scr, buffer) {
    if (this.decryptionMetrics[scr.loc]) {
      return;
    }

    var payload = {
      id: scr.loc,
      keyId: scr.key.kid,
      cipherSize: buffer.byteLength,
      type: 'binary',
      start: Date.now()
    };

    this.decryptionMetrics[scr.loc] = payload;
  },

  /**
   * Records initial data for sending a `decryption` metric to splunk for
   * Activities or Conversations
   * @param {Activity|Conversation} object
   * @private
   */
  _startTextDecryptionMetrics: function _startTextDecryptionMetrics(object, key) {
    /* eslint complexity: [2, 15] */

    if (!object) {
      throw new Error('`object` is required');
    }

    if (!object.url) {
      throw new Error('`object.url` is required');
    }

    var encryptionKeyUrl = object.encryptionKeyUrl || key.keyid || key;
    if (!encryptionKeyUrl) {
      throw new Error('`object.encryptionKeyUrl`, `key.keyId`, or `key` is required');
    }

    if (this.decryptionMetrics[object.url]) {
      return Promise.resolve();
    }

    var payload = {
      id: object.url,
      keyId: encryptionKeyUrl,
      start: Date.now()
    };

    if (object.objectType === 'activity') {
      if (!object.object.displayName) {
        return Promise.resolve();
      }
      payload.type = 'activity';
      payload.cipherSize = object.object.displayName.length;
    }
    else if (object.objectType === 'file' || object.objectType === 'comment') {
      if (!object.displayName) {
        return Promise.resolve();
      }
      payload.type = 'activity';
      payload.cipherSize = object.displayName.length;
    }
    else if (object.objectType === 'conversation') {
      if (!object.displayName) {
        return Promise.resolve();
      }
      payload.type = 'conversation';
      payload.cipherSize = object.displayName.length;
    }

    this.decryptionMetrics[object.url] = payload;

    return Promise.resolve();
  },

  /**
   * Collects and submits `decryption` metric
   * @param {Object} object
   * @param {Object} options
   * @param {boolean} options.includeUxTimers
   */
  submitDecryptionMetrics: function submitDecryptionMetrics(object, options) {
    options = options || {};
    var id = object.loc || object.url;

    if (!id) {
      throw new Error('`scr.loc` or `object.url` is required');
    }

    var decryptionMetric = this.decryptionMetrics[id];
    if (!decryptionMetric) {
      return Promise.resolve();
    }

    decryptionMetric.decryptionDuration = Date.now() - decryptionMetric.start;
    delete decryptionMetric.start;

    if (decryptionMetric.type !== 'binary') {
      if (options.includeUxTimers) {
        decryptionMetric.screenTimeToDecrypt = decryptionMetric.decryptionDuration;
      }
      // if it wasn't a ux event, discard it
      else {
        delete this.decryptionMetrics[id];
        return Promise.resolve();
      }
    }

    return Promise.all([
      hashId(decryptionMetric.id),
      hashId(decryptionMetric.keyId)
    ])
      .then(function assignHashes(hashes) {
        decryptionMetric.id = hashes[0];
        decryptionMetric.keyId = hashes[1];
        this.spark.metrics.sendUnstructured('decryption', decryptionMetric);
        delete this.decryptionMetrics[id];
      }.bind(this));
  },

  session: {
    decryptionMetrics: {
      default: function decryptionMetrics() {
        return {};
      },
      type: 'object'
    }
  }
});

module.exports = EncryptionMetrics;
