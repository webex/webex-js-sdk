/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var isArray = require('lodash.isarray');
var isFunction = require('lodash.isfunction');
var isString = require('lodash.isstring');
var patterns = require('../../../util/patterns');
var resolveWith = require('../../../util/resolve-with');
var S = require('string');
var SparkBase = require('../../../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Conversation
 */
var Normalizer = SparkBase.extend(
  /** @lends Conversation.Normalizer.prototype */
  {
  namespace: 'Conversation',

  /**
   * Ensures all Objects receieved from the Conversation API are of the expected
   * shape.
   * @param {Object} object An object received from Spark
   * @return {Promise} Resolves with normalized object.
   */
  normalize: function normalize(object) {
    if (isArray(object)) {
      return Promise.all(object.map(this.normalize.bind(this)))
        .then(resolveWith(object));
    }

    if (!object.objectType) {
      return Promise.reject(new Error('Cannot normalize `object` without `objectType`'));
    }

    var normalizer = '_normalize' + S(object.objectType).capitalize().s;
    var promises = [];
    if (this[normalizer]) {
      promises.push(this[normalizer](object));
    }

    [
      'content',
      'displayName'
    ].forEach(function normalizeProp(property) {
      if (typeof object[property] === 'string') {
        if (object[property].length === 0) {
          delete object[property];
        }
        else {
          promises.push(this.normalizeProperty(object, property));
        }
      }
    }.bind(this));

    return Promise.all(promises)
      .then(resolveWith(object));
  },

  normalizeProperty: function normalizeProperty(object, property) {
    if (!isString(property)) {
      throw new Error('property is required');
    }

    var normalizer = '_' + S('normalize_prop_' + property)
      .camelize()
      .s;

    if (isFunction(this[normalizer])) {
      return this[normalizer](object[property])
        .then(function assignProp(value) {
          object[property] = value;
          return object;
        });
    }
  },

  /**
   * @param {Conversation~ConversationObject} conversation
   * @private
   * @return {Promise}
   */
  _normalizeConversation: function _normalizeConversation(conversation) {
    conversation.activities = conversation.activities || {};
    conversation.activities.items = conversation.activities.items || [];
    conversation.participants = conversation.participants || {};
    conversation.participants.items = conversation.participants.items || [];

    return Promise.all([
      Promise.all(conversation.activities.items.map(this.normalize.bind(this))),
      Promise.all(conversation.participants.items.map(this.normalize.bind(this)))
    ])
      .then(resolveWith(conversation));
  },

  /**
   * @param {Conversation~ActivityObject} activity
   * @private
   * @return {Promise}
   */
  _normalizeActivity: function _normalizeActivity(activity) {
    return Promise.all(['actor', 'object', 'target'].map(function normalizeActivityObjects(key) {
      if (activity[key]) {
        return this.normalize(activity[key]);
      }
    }.bind(this)))
      .then(resolveWith(activity));
  },

  /**
   * @param {Conversation~PersonObject} person
   * @private
   * @return {Promise}
   */
  _normalizePerson: function _normalizePerson(person) {
    var email = person.entryEmail || person.emailAddress || person.id;
    var uuid = person.entryUUID || person.id;

    if (patterns.email.test(email)) {
      // TODO deprecate person.emailAddress in favor of person.entryEmail
      person.entryEmail = person.emailAddress = email.toLowerCase();
    }
    else {
      delete person.entryEmail;
      delete person.emailAddress;
    }

    if (patterns.uuid.test(uuid)) {
      person.entryUUID = person.id = uuid.toLowerCase();
      return Promise.resolve(person);
    }

    if (!email) {
      return Promise.reject(new Error('cannot determine uuid without an `emailAddress` or `entryUUID` property'));
    }

    return this.spark.user.getUUID(email)
      .then(function assignUUID(uuid) {
        person.entryUUID = person.id = uuid;
        return person;
      });
  }
});

module.exports = Normalizer;
