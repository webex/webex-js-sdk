/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {patterns} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import {filter} from '@ciscospark/helper-html';
import {isArray, isString} from 'lodash';
import S from 'string';

const Normalizer = SparkPlugin.extend({
  namespace: `Conversation`,

  derived: {
    filter: {
      deps: [],
      fn() {
        // eslint-disable-next-line no-empty-function
        return filter(() => {}, this.config.allowedTags || {}, this.config.allowedStyles);
      }
    }
  },

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

    if (isString(object.content)) {
      if (object.content.length === 0) {
        Reflect.deleteProperty(object.content);
      }
      else {
        promises.push(this.filter(object.content)
          .then((content) => {object.content = content;}));
      }
    }

    return Promise.all(promises)
      .then(() => object);
  },

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

  normalizeActivity(activity) {
    return Promise.all([`actor`, `object`, `target`].map((key) => {
      if (activity[key]) {
        return this.normalize(activity[key]);
      }
      return Promise.resolve();
    }))
      .then(() => activity);
  },

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
  }
});

export default Normalizer;
