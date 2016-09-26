/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {patterns} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import {isArray, isFunction, isString} from 'lodash';
import S from 'string';

const Normalizer = SparkPlugin.extend({
  namespace: `Conversation`,

  initialize(...args) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, args);
    if (!this.filter) {
      throw new Error(`Normalizer#filter() must be implemented`);
    }
  },

  /**
   * Adjust properties on object received from the api to address
   * inconsistencies. in particular, ensures that all Person objects are
   * identified by UUIDs rather than email addresses.
   * @param {Object} object
   * @returns {Promise}
   */
  normalize(object) {
    if (isArray(object)) {
      return Promise.all(object.map((o) => this.normalize(o)))
        .then(() => object);
    }

    if (!object.objectType) {
      return Promise.reject(new Error(`Cannot normalize \`object\` without \objectType\``));
    }

    const methodName = `normalize${S(object.objectType).capitalize().s}`;
    const promises = [];
    if (this[methodName]) {
      promises.push(this[methodName](object));
    }

    [
      `content`,
      `displayName`
    ].forEach((property) => {
      if (typeof object[property] === `string`) {
        if (object[property].length === 0) {
          Reflect.deleteProperty(object, property);
        }
        else {
          promises.push(this.normalizeProperty(object, property));
        }
      }
    });

    return Promise.all(promises)
      .then(() => object);
  },

  normalizeProperty(object, property) {
    if (!isString(property)) {
      throw new Error(`property is required`);
    }

    const normalizer = S(`normalize_prop_${property}`)
      .camelize()
      .s;

    if (isFunction(this[normalizer])) {
      return this[normalizer](object[property])
        .then((value) => {
          object[property] = value;
          return object;
        });
    }

    return Promise.resolve();
  },

  /**
   * @param {Object} conversation
   * @private
   * @returns {Promise}
   */
  normalizeConversation(conversation) {
    conversation.activities = conversation.activities || {};
    conversation.activities.items = conversation.activities.items || [];
    conversation.participants = conversation.participants || {};
    conversation.participants.items = conversation.participants.items || [];

    return Promise.all([
      Promise.all(conversation.activities.items.map((item) => this.normalize(item))),
      Promise.all(conversation.participants.items.map((item) => this.normalize(item)))
    ])
      .then(() => conversation);
  },

  /**
   * @param {Object} activity
   * @private
   * @returns {Promise}
   */
  normalizeActivity(activity) {
    return Promise.all([`actor`, `object`, `target`].map((key) => {
      if (activity[key]) {
        return this.normalize(activity[key]);
      }
      return Promise.resolve();
    }))
      .then(() => activity);
  },

  /**
   * @param {Object} person
   * @private
   * @returns {Promise}
   */
  normalizePerson(person) {
    const email = person.entryEmail || person.emailAddress || person.id;
    const id = person.entryUUID || person.id;

    if (patterns.email.test(email)) {
      person.entryEmail = person.emailAddress = email.toLowerCase();
    }
    else {
      Reflect.deleteProperty(person, `entryEmail`);
      Reflect.deleteProperty(person, `emailAddress`);
    }

    if (patterns.uuid.test(id)) {
      person.entryUUID = person.id = id.toLowerCase();
      return Promise.resolve(person);
    }

    if (!email) {
      return Promise.reject(new Error(`cannot determine id without an \`emailAddress\` or \`entryUUID\` property`));
    }

    return this.spark.user.asUUID(email)
      .then((uuid) => {
        person.entryUUID = person.id = uuid;
        return person;
      });
  },

  normalizePropContent(content) {
    return this.filter(content);
  }
});

export default Normalizer;
