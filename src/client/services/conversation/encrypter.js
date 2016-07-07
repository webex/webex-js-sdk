/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var base64 = require('../../../util/base64');
var contains = require('lodash.contains');
var isArray = require('lodash.isarray');
var isFunction = require('lodash.isfunction');
var isString = require('lodash.isstring');
var resolveWith = require('../../../util/resolve-with');
var S = require('string');
var SparkBase = require('../../../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Conversation
 */
var Encrypter = SparkBase.extend(
  /** @lends Conversation.Encrypter.prototype */
  {
  namespace: 'Conversation',

  encryptableActivities: [
    'assign',
    'create',
    'post',
    'share',
    'update'
  ],

  /**
   * Encrypts an Object
   * @param {Object} object object to encrypt. Must include an objectType
   * property
   * @param {Encryption~Key|string} key {@link Encryption~Key} or keyUrl to encrypt the object (not required
   * if `object.objectType === 'conversation'`)
   */
  encryptObject: function encryptObject(object, key) {
    if (isArray(object)) {
      return Promise.all(object.map(function processItem(item) {
        return this.encryptObject(item, key);
      }, this))
        .then(resolveWith(object));
    }

    if (!object.objectType) {
      return Promise.reject(new Error('Cannot encrypt `object` without `objectType`'));
    }

    var encrypter = '_' + S('encrypt_' + object.objectType)
      .camelize()
      .s;

    if (isFunction(this[encrypter])) {
      return this[encrypter](object, key)
        .then(resolveWith(object));
    }

    return Promise.resolve(object);
  },

  /**
   * Encrypts a property of an object
   * @param {Object} object object containing `property` to be encrypted
   * @param {string} property name of the property to encrypt
   * @param {Encryption~Key|string} key key or keyUrl to use to encrypt
   * `object[property]`
   */
  encryptProperty: function encryptProperty(object, property, key) {
    if (!isString(property)) {
      throw new Error('property is required');
    }

    if (!key) {
      throw new Error('key is required');
    }

    var encrypter = '_' + S('encrypt_prop_' + property)
      .camelize()
      .s;

    if (isFunction(this[encrypter])) {
      return this[encrypter](object[property], key, object)
        .then(function assignEncryptedPropery(encrypted) {
          object[property] = encrypted;
          return object;
        });
    }

    return Promise.resolve(object);
  },

  // Object Encryption Methods
  // -------------------------

  /**
   * Encrypts a conversation
   * @param {Object} conversation
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptConversation: function _encryptConversation(conversation, key) {
    return Promise.resolve(key || this.spark.encryption.getUnusedKey())
      .then(function encryptConversationWithKey(key) {
        var promises;

        if (conversation.activities && conversation.activities.items && conversation.activities.items.length > 0) {
          promises = conversation.activities.items.map(function processItem(activity) {
            return this.encryptObject(activity, key);
          }, this);
        }
        else {
          promises = [];
        }

        if (conversation.displayName) {
          promises.push(this.encryptProperty(conversation, 'displayName', key)
            // TODO can assignEncryptionKeyUrl be done inside encryptProperty? (
            // possibly after we go to per-device keys)
            .then(function assignEncryptionKeyUrl() {
              conversation.encryptionKeyUrl = key.keyUrl;
            }));
        }

        if (conversation.content) {
          promises.push(this.encryptProperty(conversation, 'content', key)
            // TODO can assignEncryptionKeyUrl be done inside encryptProperty? (
            .then(function assignEncryptionKeyUrl() {
              conversation.encryptionKeyUrl = key.keyUrl;
            }));
        }

        if (conversation.kmsMessage) {
          promises.push(this.encryptProperty(conversation, 'kmsMessage', key));
        }

        return Promise.all(promises)
          .then(function assignDefaultActivityEncryptionKeyUrl() {
            conversation.defaultActivityEncryptionKeyUrl = key.keyUrl;
          });
      }.bind(this));
  },

  /**
   * Encrypts an activity. If no key is provided, it will attempt to fetch the
   * parent conversation to see if has a key. If it still doesn't have key and
   * the activity is encryptable, the conversation will be encrypted.
   * @param {Object} activity
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptActivity: function _encryptActivity(activity, key) {
    /* eslint complexity: [0] */
    // Activity is already encrypted
    if (activity.encryptionKeyUrl) {
      return Promise.resolve();
    }

    if (!contains(this.encryptableActivities, activity.verb) && !activity.kmsMessage) {
      return Promise.resolve();
    }

    var encrypter;
    if (activity.object) {
      encrypter = '_' + S('encrypt_' + activity.object.objectType)
        .camelize()
        .s;
    }

    if (!isFunction(this[encrypter]) && !activity.kmsMessage) {
      return Promise.resolve();
    }

    if (this._shouldEnsureTargetIsEncrypted(activity, key)) {
      return this._ensureTargetIsEncrypted(activity)
        .then(this.encryptObject.bind(this, activity));
    }

    var promises = [];

    if (contains(this.encryptableActivities, activity.verb)) {
      promises.push(this.encryptObject(activity.object, key)
        .then(function assignEncryptionKeyUrl() {
          activity.encryptionKeyUrl = key.keyUrl || key;
        }));
    }

    if (activity.kmsMessage) {
      promises.push(this.encryptProperty(activity, 'kmsMessage', key));
    }

    return Promise.all(promises);
  },

  _shouldEnsureTargetIsEncrypted: function _shouldEnsureTargetIsEncrypted(activity, key) {
    if (!key && contains(this.encryptableActivities, activity.verb)) {
      return true;
    }

    if (!activity.kmsMessage) {
      return false;
    }

    if (activity.target && activity.target.kmsResourceObjectUrl) {
      return false;
    }

    if (!(activity.kmsMessage.method === 'create' && activity.kmsMessage.uri === '/resources')) {
      return true;
    }
    return false;
  },

  _ensureTargetIsEncrypted: function _ensureTargetIsEncrypted(activity) {
    var conversationUrl = activity.target.url;
    if (!conversationUrl) {
      return Promise.reject(new Error('Could not determine encryption key for activity - no key url or conversation url provided', activity));
    }

    return this.spark.conversation.get({
      url: conversationUrl,
      activitiesLimit: 0,
      participantsLimit: 0
    })
      .then(function processConversation(conversation) {
        // If, after fetching the conversation, it still does not have an
        // encryption key, assign it a key and reattempt to encrypt the
        // activity.
        if (!conversation.defaultActivityEncryptionKeyUrl) {
          return this.spark.conversation.updateKey(conversation)
            .then(function assignDefaultActivityEncrytionKeyUrl(activity) {
              return activity.object.defaultActivityEncryptionKeyUrl;
            });
        }

        if (!activity.target.defaultActivityEncryptionKeyUrl) {
          this.logger.warn('encrypter: downloaded conversation to determine its defaultActivityEncryptionKeyUrl; make sure to pass all encryption related properties when calling Spark.conversation methods.');
        }

        if (!activity.target.kmsResourceObjectUrl && conversation.kmsResourceObjectUrl) {
          this.logger.warn('encrypter: downloaded conversation to determine its kmsResourceObjectUrl; make sure to pass all encryption related properties when calling Spark.conversation methods.');
        }

        // Copy properties from the conversation to target
        activity.target.defaultActivityEncryptionKeyUrl = conversation.defaultActivityEncryptionKeyUrl;
        activity.target.kmsResourceObjectUrl = conversation.kmsResourceObjectUrl;

        // If we still don't have a kmsResourceObjectUrl, generate a V2 url
        // from its V1 url (which happens to be the conversation's url)
        if (!activity.target.kmsResourceObjectUrl) {
          this.logger.debug('encrypter: inferred V2 kmsResourceObjectUrl; this code should be removed pending a cloudapps change');
          activity.target.kmsResourceObjectUrl = '/resources/' + base64.toBase64Url(conversation.url);
        }

        return activity.target.defaultActivityEncryptionKeyUrl;
      }.bind(this));
  },

  /**
   * Encrypts a comment
   * @param {Object} comment
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptComment: function _encryptComment(comment, key) {
    var promises = [];

    if (comment.content) {
      promises.push(this.encryptProperty(comment, 'content', key));
    }

    if (comment.displayName) {
      promises.push(this.encryptProperty(comment, 'displayName', key));
    }

    return Promise.all(promises);
  },

  /**
   * Encrypts an imageURI
   * @param {Object} imageURI
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptImageURI: function _encryptImageURI(imageURI, key) {
    var promises = [];

    if (imageURI) {
      promises.push(this.encryptProperty(imageURI, 'location', key));
    }

    return Promise.all(promises);
  },

  /**
   * Encrypts a content object
   * @param {Object} content
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptContent: function _encryptContent(content, key) {
    var promises = content.files.items.map(function processItem(item) {
      return this.encryptObject(item, key);
    }, this);

    if (content.content) {
      promises.push(this.encryptProperty(content, 'content', key));
    }

    if (content.displayName) {
      promises.push(this.encryptProperty(content, 'displayName', key));
    }

    return Promise.all(promises);
  },

  /**
   * Encrypts a file
   * @param {Object} file
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptFile: function _encryptFile(file, key) {
    if (!file.scr.loc) {
      throw new Error('`item.scr` must have an `loc`');
    }

    var promises = [];

    promises.push(this.spark.encryption.encryptScr(file.scr, key)
      .then(function assignScr(scr) {
        file.scr = scr;
      }));


    if (file.displayName) {
      promises.push(this.spark.encryption.encryptText(file.displayName, key)
        .then(function assignCiphertext(ciphertext) {
          file.displayName = ciphertext;
        }));
    }

    if (file.content) {
      promises.push(this.spark.encryption.encryptText(file.content, key)
        .then(function assignCiphertext(ciphertext) {
          file.content = ciphertext;
        }));
    }

    if (file.image) {
      if (!file.image.scr) {
        throw new Error('`file.image` must have an `scr`');
      }

      if (!file.image.scr.loc) {
        throw new Error('`file.image.scr` must have a `loc`');
      }

      promises.push(this.spark.encryption.encryptScr(file.image.scr, key)
        .then(function assignScr(scr) {
          file.image.scr = scr;
        }));
    }

    return Promise.all(promises);
  },

  // Property Encryption Methods
  // ---------------------------

  _encryptPropKmsMessage: function _encryptPropKmsMessage(kmsMessage, key, object) {
    var kro;
    if (object.target) {
      kro = object.target.kmsResourceObjectUrl;
    }

    ['uri', 'resourceUri'].forEach(function replaceKro(k) {
      if (kmsMessage[k] && !kro && kmsMessage[k].indexOf('<KRO>') !== -1) {
        throw new Error('encrypter: cannot determine kro');
      }

      if (kmsMessage[k]) {
        kmsMessage[k] = kmsMessage[k].replace('<KRO>', kro);
        kmsMessage[k] = kmsMessage[k].replace('<KEYURL>', key.keyUrl);
      }
    });

    var keyUri = key.keyUrl || key;
    if (kmsMessage.keyUris && kmsMessage.keyUris.indexOf(keyUri) === -1) {
      kmsMessage.keyUris.push(keyUri);
    }

    return this.spark.encryption.kms.prepareRequest(kmsMessage)
      .then(function returnWrapped(req) {
        return req.wrapped;
      });
  },

  /**
   * Encrypts rich text
   * @param {string} content
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptPropContent: function _encryptPropContent(content, key) {
    return this.spark.encryption.encryptText(content, key);
  },

  /**
   * Encrypts a display name
   * @param {string} displayName
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptPropDisplayName: function _encryptPropDisplayName(displayName, key) {
    return this.spark.encryption.encryptText(displayName, key);
  },

  /**
   * Encrypts a location
   * @param {string} location
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptPropLocation: function _encryptPropLocation(location, key) {
    return this.spark.encryption.encryptText(location, key);
  },

  /**
   * Encrypts an scr
   * @param {Object} scr
   * @param {Encryption~Key|string} key
   * @private
   */
  _encryptPropScr: function _encryptPropScr(scr, key) {
    return this.spark.encryption.encryptScr(scr, key);
  }
});

module.exports = Encrypter;
