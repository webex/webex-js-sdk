/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {isArray, isFunction, isString} from 'lodash';
import S from 'string';

/**
 * Encrypts Conversation objects
 */
const Decrypter = SparkPlugin.extend({
  /**
   * Decrypts an object using the specified key
   * @param {Object} key
   * @param {Object} object
   * @returns {Promise}
   */
  decryptObject(key, object) {
    if (!object) {
      object = key;
      key = undefined;
    }

    if (!object) {
      return Promise.resolve();
    }

    if (isArray(object)) {
      return Promise.all(object.map((item) => this.decryptObject(key, item)))
        .then(() => object);
    }

    if (object.encryptionKeyUrl) {
      key = object.encryptionKeyUrl;
    }

    if (object.objectType) {
      const methodName = S(`decrypt_${object.objectType}`).camelize().s;
      if (isFunction(this[methodName])) {
        return this[methodName](key, object)
          .then(() => object);
      }
    }

    return Promise.resolve(object);
  },

  /**
   * @private
   * @param {Object} property
   * @param {Object} key
   * @param {Object} object
   * @returns {Promise}
   */
  decryptProperty(property, key, object) {
    if (!isString(property)) {
      return Promise.reject(new Error(`\`property\` is required`));
    }

    if (!object[property]) {
      return Promise.resolve(object);
    }

    const methodName = S(`decrypt_prop_${property}`).camelize().s;

    if (!isFunction(this[methodName])) {
      return Promise.resolve(object);
    }

    return this[methodName](key, object[property])
      .then((decryptedProperty) => {
        object[property] = decryptedProperty;
        return object;
      })
      .catch((reason) => {
        this.logger.warn(`failed to decrypt ${property}`, reason);
        return object;
      });
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} conversation
   * @returns {Promise}
   */
  decryptConversation(key, conversation) {
    let promises = [];
    if (conversation.activities.items) {
      promises = conversation.activities.items.map((item) => this.decryptObject(null, item));
    }

    const usableKey = conversation.encryptionKeyUrl || key;
    if (usableKey) {
      promises.push(this.decryptProperty(`displayName`, usableKey, conversation));
      promises.push(this.decryptProperty(`content`, usableKey, conversation));
    }

    return Promise.all(promises);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} activity
   * @returns {Promise}
   */
  decryptActivity(key, activity) {
    if (!activity.encryptionKeyUrl && !(activity.object && activity.object.encryptionKeyUrl)) {
      return Promise.resolve(activity);
    }

    const keyUrl = activity.encryptionKeyUrl || activity.object.encryptionKeyUrl;
    return this.decryptObject(keyUrl, activity.object);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} comment
   * @returns {Promise}
   */
  decryptComment(key, comment) {
    const promises = [];

    if (comment.displayName) {
      promises.push(this.decryptProperty(`displayName`, key, comment));
    }

    if (comment.content) {
      promises.push(this.decryptProperty(`content`, key, comment));
    }

    return Promise.all(promises);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} content
   * @returns {Promise}
   */
  decryptContent(key, content) {
    const promises = content.files.items.map((item) => this.decryptObject(key, item));
    promises.push(this.decryptComment(key, content));

    return Promise.all(promises);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} event
   * @returns {Promise}
   */
  decryptEvent(key, event) {
    const promises = [
      this.decryptProperty(`displayName`, key, event)
    ];

    if (event.location && event.location.split(`.`).length === 5) {
      promises.push(this.decryptProperty(`location`, key, event));
    }

    return Promise.all(promises);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} file
   * @returns {Promise}
   */
  decryptFile(key, file) {
    let promises = [];

    if (file.transcodedCollection) {
      promises = file.transcodedCollection.items.map((item) => this.decryptObject(key, item));
    }

    promises.push(this.decryptProperty(`scr`, key, file));
    promises.push(this.decryptProperty(`displayName`, key, file));

    if (file.content) {
      promises.push(this.decryptProperty(`content`, key, file));
    }

    if (file.image) {
      promises.push(this.decryptProperty(`scr`, key, file.image));
    }

    return Promise.all(promises);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} transcodedContent
   * @returns {Promise}
   */
  decryptTranscodedContent(key, transcodedContent) {
    return Promise.all(transcodedContent.files.items.map((item) => this.decryptObject(key, item)));
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} imageURI
   * @returns {Promise}
   */
  decryptImageURI(key, imageURI) {
    if (imageURI.location) {
      return this.decryptProperty(`location`, key, imageURI);
    }
    return Promise.resolve();
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} displayName
   * @returns {Promise}
   */
  decryptPropDisplayName(key, displayName) {
    return this.spark.encryption.decryptText(key, displayName);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} content
   * @returns {Promise}
   */
  decryptPropContent(key, content) {
    return this.spark.encryption.decryptText(key, content);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} scr
   * @returns {Promise}
   */
  decryptPropScr(key, scr) {
    return this.spark.encryption.decryptScr(key, scr);
  },

  /**
   * @private
   * @param {Object} key
   * @param {Object} location
   * @returns {Promise}
   */
  decryptPropLocation(key, location) {
    return this.spark.encryption.decryptText(key, location);
  }
});

export default Decrypter;
