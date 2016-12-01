/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var EncryptionMetrics = require('../metrics');
var EventEmitter = require('events').EventEmitter;
var filter = require('lodash.filter');
var jose = require('node-jose');
var KeyStore = require('../key-store');
var KMS = require('../kms');
var oneFlight = require('../../../../util/one-flight');
var resolveWith = require('../../../../util/resolve-with');
var retry = require('../../../../util/retry');
var SCR = require('node-scr');
var shimPlaceholder = require('../../../../lib/shim-placeholder');
var SparkBase = require('../../../../lib/spark-base');

function makeOneFlightDownloadKey(scr) {
  if (!scr.loc) {
    throw new Error('`scr.loc` is required');
  }
  return scr.loc;
}

/**
 * @class
 * @extends {SparkBase}
 * @memberof Encryption
 */
var EncryptionServiceBase = SparkBase.extend(
  /** @lends Encryption.EncryptionServiceBase.prototype */
  {
  children: {
    kms: KMS,
    metrics: EncryptionMetrics
  },

  derived: {
    keystore: {
      fn: function keystore() {
        return this.config.AlternateKeyStore ? new this.config.AlternateKeyStore() : new KeyStore();
      }
    }
  },

  namespace: 'Encryption',

  session: {
    keyRequests: {
      default: function keyRequests() {
        return {};
      },
      type: 'object'
    },
    // FIXME figure out where the race condition is that `this.nearlyBoundKeys`
    // solves
    nearlyBoundKeys: {
      default: function nearlyBoundKeys() {
        return {};
      },
      type: 'object'
    }
  },

  download: oneFlight(makeOneFlightDownloadKey, function download(scr, options) {
    if (!scr.loc) {
      return Promise.reject(new Error('`scr.loc` is required'));
    }

    var emitter = new EventEmitter();

    var promise = this._fetchDownloadUrl(scr)
      .then(function downloadAndEmit(url) {
        var promise = this._fetchBinary(url);
        promise.on('download-progress', emitter.emit.bind(emitter, 'progress'));
        return promise;
      }.bind(this))
      .then(function _decryptBinary(buffer) {
        return this._decryptBinary(buffer, scr, options);
      }.bind(this));

    promise.on = function on(key, callback) {
      emitter.on(key, callback);
      return promise;
    };

    return promise;
  }),

  getBinary: function getBinary(item, options) {
    this.logger.warn('Encryption#getBinary() is deprecated. Please use Conversation#download()');

    return this.spark.conversation.download(item, options);
  },

  _fetchDownloadUrl: function _fetchDownloadUrl(scr) {
    this.logger.info('encryption: retrieving download url for encrypted file');
    // TODO _fetchDownloadUrl should be a Fetcher
    // TODO this should be able to determine if scr is something that files
    // knows about.
    // TODO this should be moved to a files service
    return this.request({
      method: 'POST',
      api: 'files',
      resource: 'download/endpoints',
      body: {
        endpoints: [
          scr.loc
        ]
      }
    })
    .then(function processResponse(res) {
      var url = res.body.endpoints[scr.loc];
      if (!url) {
        return Promise.reject(new Error('`scr.loc` does not appear to identify a file known to Spark'));
      }
      this.logger.info('encryption: retrieved download url for encrypted file');
      return url;
    }.bind(this));
  },

  _fetchBinary: retry(function _fetchBinary(url) {
    this.logger.info('encryption: downloading encrypted file');

    var emitter = new EventEmitter();

    var promise = this.request({
      url: url,
      responseType: 'buffer'
    })
      .on('download-progress', emitter.emit.bind(emitter, 'download-progress'))
      .then(function processResponse(res) {
        this.logger.info('encryption: downloaded encrypted file');
        return res.body;
      }.bind(this));

    promise.on = function on(key, callback) {
      emitter.on(key, callback);
      return promise;
    };

    return promise;
  }),

  processClientEncryptKeysEvent: function processClientEncryptKeysEvent(event) {
    /* istanbul ignore else */
    if (event.keys) {
      var keys = JSON.parse(event.keys);
      keys.forEach(function processKey(key) {
        jose.JWK.asKey(key.keyValue)
          .then(function processKey(keyValue) {
            key.keyValue = keyValue;
            this.keystore.add(key);
          }.bind(this));
      }, this);
    }
  },

  processKmsMessageEvent: function processKmsMessagesEvent(event) {
    return this.kms.processKmsMessageEvent(event);
  },

  encryptText: function encryptText(plaintext, keyUrl) {
    return this._getKey(keyUrl)
      .then(this._encryptText.bind(this, plaintext));
  },

  encryptScr: function encryptScr(scr, keyUrl) {
    return this._getKey(keyUrl)
      .then(this._encryptScr.bind(this, scr));
  },

  /**
   * @memberof EncryptionServiceBase.prototype
   * @param {File|Buffer} file The file to encrypt. In the browser, this
   * should be a File or Blob; in node, this should be a Buffer.
   * @returns {Promise} resolves with an object with keys `scr` and `cblob`
   */
  encryptBinary: function encryptBinary(file) {
    return this._encryptBinary(file);
  },

  decryptText: function decryptText(ciphertext, keyUrl) {
    return this._getKey(keyUrl)
      .then(this._decryptText.bind(this, ciphertext));
  },

  decryptScr: function decryptScr(scr, keyUrl) {
    return this._getKey(keyUrl)
      .then(this._decryptScr.bind(this, scr));
  },

  decryptBinary: function decryptBinary(blob, scr, options) {
    return this._decryptBinary(blob, scr, options);
  },

  getUnusedKey: function getUnusedKey() {
    return this._createKeys(1)
      .then(function markNearlyBoundKey(key) {
        key = key[0];
        this.nearlyBoundKeys[key.keyUrl] = true;
        return key;
      }.bind(this));
  },

  _createKeys: function _createKeys(count) {
    return this.kms.createUnboundKeys({count: count})
      .then(function checkNearlyBoundKeys(keys) {
        return Promise.all(keys.map(function checkIfNearlyBoundKey(key) {
          /* istanbul ignore if */
          if (this.nearlyBoundKeys[key.keyUrl]) {
            return Promise.resolve();
          }

          // Don't add unbound keys to the keystore. This forces us to
          // reretrieve the bound key and therefore learn the conversation's
          // resource url.
          return this.keystore.addUnused(key)
            .then(resolveWith(key));
        }.bind(this)));
      }.bind(this))
      .then(function confirmAvailableKeys(keys) {
        keys = filter(keys);

        // If we don't have any keys (because every key returned was in
        // this.nearlyBoundKeys), fetch double the number of initially
        // requested keys (we'll get the first set that is still nearlyBound
        // as well as the desired quantity of truly new keys).
        // TODO verify that calling create returns previously created keys
        /* istanbul ignore if */
        if (keys.length === 0) {
          this.logger.warn('encryption: increasing count and rerequesting unused keys');
          return this._createKeys(count + 10);
        }
        return keys;
      }.bind(this));
  },

  _fetchKey: function _fetchKey(keyUrl) {
    return this.kms.retrieveKeys({uri: keyUrl})
      .then(function storeKey(key) {
        return this.keystore.add(key)
          .then(resolveWith(key));
      }.bind(this));
  },

  _getKey: function _getKey(keyUrl) {
    if (keyUrl.keyValue) {
      return jose.JWK.asKey(keyUrl.keyValue)
        .then(function processKey(keyValue) {
          keyUrl.keyValue = keyValue;
          return keyUrl;
        });
    }

    var promise = this.keyRequests[keyUrl];

    if (!promise) {
      promise = this.keyRequests[keyUrl] = this.keystore.get(keyUrl)
        .catch(function handleCacheMiss() {
          return this._fetchKey(keyUrl)
            .then(function removeInflightRequest() {
              // TODO Is this line necessary?
              delete this.keyRequests[keyUrl];
            }.bind(this))
            .then(this.keystore.get.bind(this.keystore, keyUrl));
        }.bind(this))
        .then(function processKey(key) {
          // Make sure keys are always keys. These needs to happen on every
          // retrieval because keystore implementations (e.g. those backed by
          // IndexedDB) may turn the key back into a plain object.
          return jose.JWK.asKey(key.keyValue)
            .then(function processKey(keyValue) {
              key.keyValue = keyValue;
              return key;
            });
        });
    }

    return promise;
  },

  _encryptText: function _encryptText(plaintext, key) {
    var recipient = {
      key: key.keyValue,
      header: {
        alg: 'dir'
      },
      reference: null
    };

    return jose.JWE
      .createEncrypt(this.config.joseOptions, recipient)
      .final(plaintext, 'utf8');
  },

  _encryptScr: function _encryptScr(scr, key) {
    return scr.toJWE(key.keyValue);
  },

  _encryptBinary: shimPlaceholder('encryption', '_encryptBinary'),

  _decryptText: function _decryptText(ciphertext, key) {
    return jose.JWE
      .createDecrypt(key.keyValue)
      .decrypt(ciphertext)
      .then(function processPlaintext(result) {
        return result.plaintext.toString();
      });
  },

  _decryptScr: function _decryptScr(scr, key) {
    return SCR.fromJWE(key.keyValue, scr);
  },

  _decryptBinary: function _decryptBinary(buffer, scr) {
    if (buffer.length === 0) {
      return Promise.reject(new Error('Attempted to decrypt zero-length file'));
    }

    this.metrics.startDecryptionMetrics(scr, buffer);

    this.logger.info('encryption: decrypting file');
    return scr.decrypt(buffer)
      .then(function logAndMeasure(pdata) {
        this.logger.info('encryption: decrypted file');
        this.metrics.submitDecryptionMetrics(scr);
        return pdata;
      }.bind(this));
  }
});

module.exports = EncryptionServiceBase;
