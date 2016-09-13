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

  decryptActivity(key, activity) {
    if (!activity.encryptionKeyUrl && !(activity.object && activity.object.encryptionKeyUrl)) {
      return Promise.resolve(activity);
    }

    const keyUrl = activity.encryptionKeyUrl || activity.object.encryptionKeyUrl;
    return this.decryptObject(keyUrl, activity.object);
  },

  decryptEvent(key, event) {
    const promises = [
      this.decryptProperty(`displayName`, key, event)
    ];

    if (event.location && event.location.split(`.`).length === 5) {
      promises.push(this.decryptProperty(`location`, key, event));
    }

    return Promise.all(promises);
  },

  decryptPropDisplayName(key, displayName) {
    return this.spark.encryption.decryptText(key, displayName);
  }
});

export default Decrypter;
