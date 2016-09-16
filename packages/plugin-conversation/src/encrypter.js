/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {isArray, isFunction, isString} from 'lodash';
import S from 'string';

const encryptableActivities = [
  `add`,
  `create`,
  `post`,
  `share`,
  `update`
];

/**
 * Encrypts Conversation objects
 */
const Encrypter = SparkPlugin.extend({
  /**
   * Encrypts an Object
   * @param {Encryption~Key|string} key {@link Encryption~Key} or keyUrl to encrypt the object (not required
   * if `object.objectType === 'conversation'`)
   * @param {Object} object object to encrypt. Must include an objectType
   * property
   * @returns {Promise}
   */
  encryptObject(key, object) {
    if (!object) {
      object = key;
      key = undefined;
    }

    if (isArray(object)) {
      return Promise.all(object.map((item) => this.encryptObject(key, item)))
        .then(() => object);
    }

    if (!object.objectType) {
      return Promise.reject(new Error(`Cannot encrypt \`object\` without \`objectType\``));
    }

    const methodName = S(`encrypt_${object.objectType}`).camelize().s;
    if (isFunction(this[methodName])) {
      return this[methodName](key, object)
        .then(() => object);
    }

    return Promise.resolve(object);
  },

  /**
   * Encrypts a property of an object
   * @param {string} property name of the property to encrypt
   * @param {Encryption~Key|string} key key or keyUrl to use to encrypt
   * `object[property]`
   * @param {Object} object object containing `property` to be encrypted
   * @returns {Promise}
   */
  encryptProperty(property, key, object) {
    if (!isString(property)) {
      throw new Error(`property is required`);
    }

    if (!key) {
      throw new Error(`key is required`);
    }

    const methodName = S(`encrypt_prop_${property}`).camelize().s;

    if (isFunction(this[methodName])) {
      return this[methodName](key, object[property])
        .then((encrypted) => {
          object[property] = encrypted;
          return object;
        });
    }

    return Promise.resolve(object);
  },

  /**
   * Encrypts a conversation
   * @param {Encryption~Key|string} key
   * @param {Object} conversation
   * @private
   * @returns {Promise}
   */
  encryptConversation(key, conversation) {
    return Promise.resolve(key || this.spark.encryption.kms.createUnboundKeys({count: 1}))
      .then((keys) => {
        const k = isArray(keys) ? keys[0] : keys;
        if (conversation.kmsMessage) {
          if (conversation.kmsMessage.keyUris && !conversation.kmsMessage.keyUris.includes(k.uri)) {
            conversation.kmsMessage.keyUris.push(k.uri);
          }
        }

        let promises = [];
        if (conversation.activities && conversation.activities.items) {
          promises = conversation.activities.items.reduce((p, activity) => {
            p.push(this.encryptObject(k, activity));
            return p;
          }, promises);
        }

        if (conversation.displayName) {
          promises.push(this.encryptProperty(`displayName`, k, conversation)
            .then(() => {conversation.encryptionKeyUrl = k.uri;}));
        }

        return Promise.all(promises)
          .then(() => {
            if (!conversation.defaultActivityEncryptionKeyUrl) {
              conversation.defaultActivityEncryptionKeyUrl = k.uri;
            }
          });
      });
  },

  /**
   * Encrypts an activity. If no key is provided, it will attempt to fetch the
   * parent conversation to see if has a key. If it still doesn't have key and
   * the activity is encryptable, the conversation will be encrypted.
   * @param {Encryption~Key|string} key
   * @param {Object} activity
   * @private
   * @returns {Promise}
   */
  encryptActivity(key, activity) {
    /* eslint complexity: [0] */
    // Activity is already encrypted
    if (activity.encryptionKeyUrl) {
      return Promise.resolve();
    }

    if (this._shouldEnsureTargetIsEncrypted(key, activity)) {
      return this._ensureTargetIsEncrypted(activity)
        .then((keyUrl) => this.encryptObject(keyUrl, activity));
    }

    const promises = [];

    if (!key && activity.verb === `updateKey` && activity.object.defaultActivityEncryptionKeyUrl) {
      key = activity.object.defaultActivityEncryptionKeyUrl;
    }

    // leave shoudn't trigger an encryption, but it should use the
    // defaultActivityEncryptionKeyUrl if no other key is provided.
    if (!key && activity.verb === `leave` && activity.target.defaultActivityEncryptionKeyUrl) {
      key = activity.target.defaultActivityEncryptionKeyUrl;
    }

    if (encryptableActivities.includes(activity.verb) && activity.object) {
      promises.push(this.encryptObject(key, activity.object)
        .then(() => {activity.encryptionKeyUrl = key.uri || key;}));
    }

    if (activity.kmsMessage) {
      if (key) {
        const kro = activity.target.kmsResourceObjectUrl;
        [`uri`, `resourceUri`].forEach((k) => {
          if (activity.kmsMessage[k] && !kro && activity.kmsMessage[k].includes(`<KRO>`)) {
            throw new Error(`encrypter: cannot determine kro`);
          }

          if (activity.kmsMessage[k]) {
            activity.kmsMessage[k] = activity.kmsMessage[k].replace(`<KRO>`, kro);
            // key may be a key or a key url
            activity.kmsMessage[k] = activity.kmsMessage[k].replace(`<KEYURL>`, key.keyUrl || key);
          }
        });
      }
      // If we made it this far and still don't have an encryption key, assume
      // this is a conversation that is not encrypted and we're performing an
      // action that should not encrypt it (e.g. `leave`)
      else {
        Reflect.deleteProperty(activity, `kmsMessage`);
      }

    }

    return Promise.all(promises);
  },

  /**
   * @param {Object} key
   * @param {Object} activity
   * @private
   * @returns {boolean}
   */
  _shouldEnsureTargetIsEncrypted(key, activity) {
    if (key === false) {
      return false;
    }

    if (!key && encryptableActivities.includes(activity.verb)) {
      return true;
    }

    if (!activity.kmsMessage) {
      return false;
    }

    if (activity.target && activity.target.kmsResourceObjectUrl) {
      return false;
    }

    if (!(activity.kmsMessage.method === `create` && activity.kmsMessage.uri === `/resources`)) {
      return true;
    }

    return false;
  },

  /**
   * @param {Object} activity
   * @private
   * @returns {Promise}
   */
  _ensureTargetIsEncrypted(activity) {
    const conversationUrl = activity.target.url;
    if (!conversationUrl) {
      return Promise.reject(new Error(`Cannot determine encryption key for activity's conversation; no key url or conversation url provided`));
    }

    if (activity.target.defaultActivityEncryptionKeyUrl) {
      return Promise.resolve(activity.target.defaultActivityEncryptionKeyUrl);
    }

    return this.spark.conversation.get({
      url: conversationUrl
    })
      .then((conversation) => {
        if (!conversation.defaultActivityEncryptionKeyUrl) {
          if (!encryptableActivities.includes(activity.verb)) {
            return false;
          }
          return this.spark.conversation.updateKey(conversation)
            .then((updateKeyActivity) => {
              activity.target.kmsResourceObjectUrl = updateKeyActivity.kmsMessage.resource.uri;
              activity.target.defaultActivityEncryptionKeyUrl = updateKeyActivity.object.defaultActivityEncryptionKeyUrl;
              return updateKeyActivity.object.defaultActivityEncryptionKeyUrl;
            });
        }

        if (!activity.target.defaultActivityEncryptionKeyUrl) {
          this.logger.warn(`encrypter: downloaded conversation to determine its defaultActivityEncryptionKeyUrl; make sure to pass all encryption related properties when calling Spark.conversation methods.`);
        }

        if (!activity.target.kmsResourceObjectUrl && conversation.kmsResourceObjectUrl) {
          this.logger.warn(`encrypter: downloaded conversation to determine its kmsResourceObjectUrl; make sure to pass all encryption related properties when calling Spark.conversation methods.`);
        }

        // Copy properties from the conversation to target
        activity.target.defaultActivityEncryptionKeyUrl = conversation.defaultActivityEncryptionKeyUrl;
        activity.target.kmsResourceObjectUrl = conversation.kmsResourceObjectUrl;

        return activity.target.defaultActivityEncryptionKeyUrl;
      });
  },

  /**
   * Encrypts a comment
   * @param {Encryption~Key|string} key
   * @param {Object} comment
   * @private
   * @returns {Promise}
   */
  encryptComment(key, comment) {
    const promises = [];

    if (comment.content) {
      promises.push(this.encryptProperty(`content`, key, comment));
    }

    if (comment.displayName) {
      promises.push(this.encryptProperty(`displayName`, key, comment));
    }

    return Promise.all(promises);
  },

  /**
   * Encrypts a content object
   * @param {Encryption~Key|string} key
   * @param {Object} content
   * @private
   * @returns {Promise}
   */
  encryptContent(key, content) {
    const promises = content.files.items.map((item) => this.encryptObject(key, item));

    if (content.content) {
      promises.push(this.encryptProperty(`content`, key, content));
    }

    if (content.displayName) {
      promises.push(this.encryptProperty(`displayName`, key, content));
    }

    return Promise.all(promises);
  },

  /**
   * Encrypts a file
   * @param {Encryption~Key|string} key
   * @param {Object} file
   * @private
   * @returns {Promise}
   */
  encryptFile(key, file) {
    const promises = [];
    promises.push(this.spark.encryption.encryptScr(key, file.scr)
      .then((scr) => {file.scr = scr;}));

    if (file.displayName) {
      promises.push(this.spark.encryption.encryptText(key, file.displayName)
        .then((ciphertext) => {file.displayName = ciphertext;}));
    }

    if (file.content) {
      promises.push(this.spark.encryption.encryptText(key, file.content)
        .then((ciphertext) => {file.content = ciphertext;}));
    }

    if (file.image) {
      if (!file.image.scr) {
        return Promise.reject(new Error(`\`file.image\` must have an \`scr\``));
      }

      promises.push(this.spark.encryption.encryptScr(key, file.image.scr)
        .then((scr) => {file.image.scr = scr;}));
    }

    return Promise.all(promises);
  },

  /**
   * Encrypts an imageURI
   * @param {Encryption~Key|string} key
   * @param {Object} imageURI
   * @private
   * @returns {Promise}
   */
  encryptImageURI(key, imageURI) {
    if (imageURI.location) {
      return this.encryptProperty(`location`, key, imageURI);
    }

    return Promise.resolve();
  },

  /**
   * Encrypts rich text
   * @param {Encryption~Key|string} key
   * @param {string} content
   * @private
   * @returns {Promise}
   */
  encryptPropContent(key, content) {
    return this.spark.encryption.encryptText(key, content);
  },

  /**
   * Encrypts a display name
   * @param {Encryption~Key|string} key
   * @param {string} displayName
   * @private
   * @returns {Promise}
   */
  encryptPropDisplayName(key, displayName) {
    return this.spark.encryption.encryptText(key, displayName);
  },

  /**
   * Encrypts a location
   * @param {Encryption~Key|string} key
   * @param {string} location
   * @private
   * @returns {Promise}
   */
  encryptPropLocation(key, location) {
    return this.spark.encryption.encryptText(key, location);
  },

  /**
   * Encrypts an scr
   * @param {Encryption~Key|string} key
   * @param {Object} scr
   * @private
   * @returns {Promise}
   */
  encryptPropScr(key, scr) {
    return this.spark.encryption.encryptScr(key, scr);
  }
});

export default Encrypter;
