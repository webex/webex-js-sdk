/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');
var base64 = require('../../../util/base64');
var first = require('lodash.first');
var isArray = require('lodash.isarray');
var isFunction = require('lodash.isfunction');
var isObject = require('lodash.isobject');
var isString = require('lodash.isstring');
var pluck = require('lodash.pluck');
var resolveWith = require('../../../util/resolve-with');
var S = require('string');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Conversation
 */
var Decrypter = SparkBase.extend(
  /** @lends Conversation.Decrypter.prototype */
  {
  namespace: 'Conversation',

  /**
   * Decrypts an object
   * @param {Object} object
   * @param {Encryption~Key|string} key
   * @param {Object} options
   * @param {Object} parentObject
   */
  decryptObject: function decryptObject(object, key, options, parentObject) {
    if (!object) {
      return Promise.resolve();
    }

    // If key is defined but does not appear to be a key or keyUrl, assume it is
    // an options object.
    if (arguments.length === 2 && !isString(key) && (isObject(key) && !isString(key.keyValue))) {
      options = key;
      key = undefined;
    }

    if (object.encryptionKeyUrl) {
      key = object.encryptionKeyUrl;
    }

    if (isArray(object)) {
      return Promise.all(object.map(function processItem(item) {
        return this.decryptObject(item, key, options);
      }.bind(this)))
        .then(resolveWith(object));
    }

    var promises = [];
    if (object.kmsMessage) {
      promises.push(this.decryptProperty(object, 'kmsMessage', key));
    }

    if (object.objectType) {
      var decrypter = '_' + S('decrypt_' + object.objectType)
        .camelize()
        .s;

      if (isFunction(this[decrypter])) {
        promises.push(this[decrypter](object, key, options, parentObject));
      }
    }

    return Promise.all(promises)
      .then(resolveWith(object));
  },

  /**
   * Decrypts a property on an object. Copies encrypted value to
   * encryptedPropertyName.
   * @param {Object} object
   * @param {string} property
   * @param {Encryption~Key|string} key
   * @param {Function} failureCallback (optional) By default, a failure will
   * result in config.encryption.decryptionFailureMessage being set as the decrypted
   * property value. If specified, the result of failureCallback will be used
   * instead.
   */
  decryptProperty: function decryptProperty(object, property, key, failureCallback) {
    if (!isString(property)) {
      throw new Error('property is required');
    }

    if (isFunction(key)) {
      failureCallback = key;
      key = undefined;
    }

    if (!object[property]) {
      return Promise.resolve(object);
    }

    var decrypter = '_' + S('decrypt_prop_' + property)
      .camelize()
      .s;

    if (isFunction(this[decrypter])) {
      var encryptedProperty = S('encrypted_' + property).camelize().s;
      object[encryptedProperty] = object[property];
      delete object[property];
      return this[decrypter](object[encryptedProperty], key)
        .then(function assignPlaintext(decrypted) {
          object[property] = decrypted;
          if (!this.spark.conversation.config.keepEncryptedProperties) {
            delete object[encryptedProperty];
          }
        }.bind(this))
        .catch(function handleDecryptionError(reason) {
          this.logger.warn('failed to decrypt `' + property + '`', object, reason);
          if (failureCallback) {
            return failureCallback(object);
          }
          else {
            object[property] = this.spark.encryption.config.decryptionFailureMessage;
          }
        }.bind(this))
        .then(resolveWith(object));
    }

    return Promise.resolve(object);
  },

  // Object Decryption Methods
  // -------------------------

  /**
   * Decrypts a conversation
   * @param {Object} conversation
   * @param {Encryption~Key|string} key
   * @param {Object} options
   * @param {Object} parentObject
   * @private
   */
  _decryptConversation: function _decryptConversation(conversation, key, options, parentObject) {
    /* eslint complexity: [0] */
    var promises = [];
    if (conversation.activities.items) {
      promises = conversation.activities.items.map(function processItem(item) {
        return this.decryptObject(item, options);
      }.bind(this));
    }

    if (conversation.avatar && conversation.avatar.files &&
        conversation.avatar.files.items && conversation.avatar.files.items.length) {
      // should typically only have one avatar
      conversation.avatar.files.items.forEach(function processFile(file) {
        promises.push(this.decryptObject(file, conversation.avatarEncryptionKeyUrl));
      }.bind(this));
    }

    var usableKey = key || conversation.encryptionKeyUrl;

    if (usableKey && conversation.displayName) {
      try {
        var parts = conversation.displayName.split('.');
        if (parts.length === 5) {
          JSON.parse(base64.decode(parts[0]));

          this.spark.encryption.metrics.startDecryptionMetrics(parentObject || conversation, null, usableKey);
          promises.push(this.decryptProperty(conversation, 'displayName', usableKey, function displayNameFailureCallback() {
            if (conversation.participants) {
              // TODO figure out how to do method chaining with modular lodash.
              // see https://github.com/lodash/lodash/issues/966 for a possible
              // solution
              conversation.displayName = pluck(first(conversation.participants.items, 4), 'displayName').join(', ');
            }
            else {
              conversation.displayName = this.spark.encryption.config.decryptionFailureMessage;
            }
          }.bind(this)));

          if (conversation.content) {
            promises.push(this.decryptProperty(conversation, 'content', usableKey));
          }
        }
      }
      catch (error) {
        // It looks like the conversation's display name probably isn't a JWE so
        // delete the encryption key, but otherwise leave the conversation
        // unchanged.
        delete conversation.encryptionKeyUrl;
      }
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts an activity
   * @param {Object} activity
   * @param {Encryption~Key|string} key
   * @param {Object} options
   * @private
   */
  _decryptActivity: function _decryptActivity(activity, key, options) {
    if (!activity.encryptionKeyUrl && !(activity.object && activity.object.encryptionKeyUrl)) {
      return Promise.resolve(activity);
    }

    var promises = [this.decryptObject(activity.object, activity.encryptionKeyUrl || activity.object.encryptionKeyUrl, options, activity)];
    return Promise.all(promises);
  },

  /**
   * Decrypts a comment
   * @param {Object} comment
   * @param {Encryption~Key|string} key
   * @param {Object} options
   * @param {Object} activity
   * @private
   */
  _decryptComment: function _decryptComment(comment, key, options, activity) {
    this.spark.encryption.metrics.startDecryptionMetrics(activity);

    var promises = [];

    if (comment.displayName) {
      promises.push(this.decryptProperty(comment, 'displayName', key)
        .then(function submitDecryptionMetric() {
          this.spark.encryption.metrics.submitDecryptionMetrics(activity, options);
        }.bind(this)));
    }

    if (comment.content) {
      promises.push(this.decryptProperty(comment, 'content', key));
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts a content object
   * @param {Object} content
   * @param {Encryption~Key|string} key
   * @param {Object} options
   * @param {Object} activity
   * @private
   */
  _decryptContent: function _decryptContent(content, key, options, activity) {
    if (!content.files || !content.files.items || !content.files.items.length) {
      return Promise.resolve();
    }
    var promises = content.files.items.map(function processItem(item) {
      return this.decryptObject(item, key, options, activity);
    }, this);

    if (content.displayName) {
      this.spark.encryption.metrics.startDecryptionMetrics(activity);
      promises.push(this.decryptProperty(content, 'displayName', key)
        .then(function submitDecryptionMetric() {
          this.spark.encryption.metrics.submitDecryptionMetrics(activity, options);
        }.bind(this)));
    }

    if (content.content) {
      promises.push(this.decryptProperty(content, 'content', key));
    }

    return Promise.all(promises);
  },

  /**
   * @param {Object} event
   * @param {Encryption~Key} key
   * @private
   * @return {Promise}
   */
  _decryptEvent: function _decryptEvent(event, key) {
    var promises = [];
    promises.push(this.decryptProperty(event, 'displayName', key));
    // FIXME: add wrapper method around node-jose for detecting encrypted strings
    if (event.location && (event.location.split('.').length === 5)) {
      promises.push(this.decryptProperty(event, 'location', key));
    }
    return Promise.all(promises);
  },

  /**
   * Decrypts a file object
   * @param {Object} file
   * @param {Encryption~Key|string} key
   * @private
   */
  _decryptFile: function _decryptFile(file, key) {
    var promises = [];

    if (file.transcodedCollection) {
      promises = file.transcodedCollection.items.map(function processItem(item) {
        return this.decryptObject(item, key);
      }, this);
    }

    promises.push(this.decryptProperty(file, 'scr', key));

    promises.push(this.decryptProperty(file, 'displayName', key));

    if (file.content) {
      promises.push(this.decryptProperty(file, 'content', key));
    }

    if (file.image) {
      promises.push(this.decryptProperty(file.image, 'scr', key));
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts a transcoded content object
   * @param {Object} transcodedContent
   * @param {Encryption~Key|string} key
   * @private
   */
  _decryptTranscodedContent: function _decryptTranscodedContent(transcodedContent, key) {
    return Promise.all(transcodedContent.files.items.map(function processItem(item) {
      return this.decryptObject(item, key);
    }, this));
  },

  // Property Decryption Methods
  // ---------------------------

  /**
   * Decrypts a displayName property
   * @param {string} encryptedDisplayName
   * @param {Encryption~Key|string} key
   * @private
   * @return {Promise}
   */
  _decryptPropDisplayName: function _decryptPropDisplayName(encryptedDisplayName, key) {
    return this.spark.encryption.decryptText(encryptedDisplayName, key);
  },

  /**
   * Decrypts a content property
   * @param {string} encryptedDisplayName
   * @param {Encryption~Key|string} key
   * @private
   * @return {Promise}
   */
  _decryptPropContent: function _decryptPropContent(encryptedDisplayName, key) {
    return this.spark.encryption.decryptText(encryptedDisplayName, key);
  },

  /**
   * Decrypts a KMS message
   * @param {string} encryptedKmsMessage
   * @private
   * @return {Promise}
   */
  _decryptPropKmsMessage: function _decryptPropKmsMessage(encryptedKmsMessage) {
    return this.spark.encryption.kms.decryptKmsMessage(encryptedKmsMessage);
  },

  /**
   * Decrypts an scr property
   * @param {string} encryptedScr
   * @param {Encryption~Key|string} key
   * @private
   * @return {Promise}
   */
  _decryptPropScr: function _decryptPropScr(encryptedScr, key) {
    return this.spark.encryption.decryptScr(encryptedScr, key);
  },

  /**
    * Decrypts an imageURI property
    * @param {string} encryptedLocation
    * @param {Encryption~Key|string} key
    * @private
    * @return {Promise}
    */
  _decryptPropLocation: function _decryptPropLocation(encryptedLocation, key) {
    return this.spark.encryption.decryptText(encryptedLocation, key);
  },

  /**
   * Decrypts an imageURI
   * @param {Object} imageURI
   * @param {Encryption~Key|string} key
   * @param {Object} options
   * @param {Object} activity
   * @private
   */
  _decryptImageURI: function _decryptImageURI(imageURI, key, options, activity) {
    this.spark.encryption.metrics.startDecryptionMetrics(activity);

    var promises = [];

    if (imageURI.location) {
      promises.push(this.decryptProperty(imageURI, 'location', key)
        .then(function submitDecryptionMetric() {
          this.spark.encryption.metrics.submitDecryptionMetrics(activity, options);
        }.bind(this)));
    }

    return Promise.all(promises);
  }
});

module.exports = Decrypter;
