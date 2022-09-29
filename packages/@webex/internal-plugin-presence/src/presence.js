/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {WebexPlugin} from '@webex/webex-core';

import PresenceBatcher from './presence-batcher';
import PresenceWorker from './presence-worker';

const defaultSubscriptionTtl = 600;
const USER = 'user';
const USER_PRESENCE_ENABLED = 'user-presence-enabled';

/**
 * @class
 * @extends WebexPlugin
 */
const Presence = WebexPlugin.extend({
  namespace: 'Presence',

  children: {
    batcher: PresenceBatcher
  },

  session: {
    worker: {
      default() {
        return new PresenceWorker();
      },
      type: 'any'
    }
  },

  /**
   * Initialize the presence worker for client
   * @returns {undefined}
   */
  initialize() {
    this.webex.once('ready', () => {
      if (this.config.initializeWorker) {
        this.worker.initialize(this.webex);
      }
    });
  },

  /**
   * Trigger an event.
   * @param {string} event
   * @param {string} payload
   * @returns {undefined}
   */
  emitEvent(event, payload) {
    if (payload.type && payload.payload) {
      this.trigger(event, payload);
    }
  },

  /**
   * Enables presence feature
   * @returns {Promise<boolean>} resolves with true, if successful
   */
  enable() {
    return this.webex.internal.feature.setFeature(USER, USER_PRESENCE_ENABLED, true)
      .then((response) => response.value);
  },

  /**
   * Disables presence feature
   * @returns {Promise<boolean>} resolves with false, if successful
   */
  disable() {
    return this.webex.internal.feature.setFeature(USER, USER_PRESENCE_ENABLED, false)
      .then((response) => response.value);
  },

  /**
   * Returns true if presence is enabled, false otherwise
   * @returns {Promise<boolean>} resolves with true if presence is enabled
   */
  isEnabled() {
    return this.webex.internal.feature.getFeature(USER, USER_PRESENCE_ENABLED);
  },

  /**
   * The status object
   * @typedef {Object} PresenceStatusObject
   * @property {string} url: Public resource identifier for presence
   * @property {string} subject: User ID for the user the returned composed presence represents
   * @property {string} status: Current composed presence state
   * @property {string} statusTime: DateTime in RFC3339 format that the current status began
   * @property {string} lastActive: DateTime in RFC3339 format that the service last saw activity from the user.
   * @property {string} expires: DEPRECATED - DateTime in RFC3339 format that represents when the current
   * status will expire. Will not exist if expiresTTL is -1.
   * @property {Number} expiresTTL: TTL in seconds until the status will expire. If TTL is -1 the current
   * status has no known expiration.
   * @property {string} expiresTime: DateTime in RFC3339 format that the current status will expire. Missing
   * field means no known expiration.
   * @property {Object} vectorCounters: Used for packet ordering and tracking.
   * @property {Boolean} suppressNotifications: Indicates if notification suppresion is recommended for this status.
   * @property {string} lastSeenDeviceUrl: Resource Identifier of the last device to post presence activity for
   * this user.
   */

  /**
   * Gets the current presence status of a given person id
   * @param {string} personId
   * @returns {Promise<PresenceStatusObject>} resolves with status object of person
   */
  get(personId) {
    if (!personId) {
      return Promise.reject(new Error('A person id is required'));
    }

    return this.webex.request({
      method: 'GET',
      service: 'apheleia',
      resource: `compositions?userId=${personId}`
    })
      .then((response) => response.body);
  },

  /**
  * @typedef {Object} PresenceStatusesObject
  * @property {Array.<PresenceStatusObject>} statusList
   */
  /**
   * Gets the current presence statuses of an array of people ids
   * @param {Array} personIds
   * @returns {Promise<PresenceStatusesObject>} resolves with an object with key of `statusList` array
   */
  list(personIds) {
    if (!personIds || !Array.isArray(personIds)) {
      return Promise.reject(new Error('An array of person ids is required'));
    }

    return Promise.all(personIds.map((id) =>
      this.batcher.request(id)))
      .then((presences) => ({statusList: presences}));
  },

  /**
   * Subscribes to a person's presence status updates
   * Updates are sent via mercury events `apheleia.subscription_update`
   * @param {string | Array} personIds
   * @param {number} subscriptionTtl - Requested length of subscriptions in seconds.
   * @returns {Promise}
   */
  subscribe(personIds, subscriptionTtl = defaultSubscriptionTtl) {
    let subjects;
    const batches = [];
    const batchLimit = 50;

    if (!personIds) {
      return Promise.reject(new Error('A person id is required'));
    }
    if (Array.isArray(personIds)) {
      subjects = personIds;
    }
    else {
      subjects = [personIds];
    }
    // Limit batches to 50 ids per request
    for (let i = 0; i < subjects.length; i += batchLimit) {
      batches.push(subjects.slice(i, i + batchLimit));
    }

    return Promise.all(batches.map((ids) =>
      this.webex.request({
        method: 'POST',
        api: 'apheleia',
        resource: 'subscriptions',
        body: {
          subjects: ids,
          subscriptionTtl,
          includeStatus: true
        }
      })
        .then((response) => response.body.responses)))
      .then((idBatches) => ({responses: [].concat(...idBatches)}));
  },

  /**
   * Unsubscribes from a person or group of people's presence subscription
   * @param {string | Array} personIds
   * @returns {Promise}
   */
  unsubscribe(personIds) {
    let subjects;

    if (!personIds) {
      return Promise.reject(new Error('A person id is required'));
    }
    if (Array.isArray(personIds)) {
      subjects = personIds;
    }
    else {
      subjects = [personIds];
    }

    return this.webex.request({
      method: 'POST',
      api: 'apheleia',
      resource: 'subscriptions',
      body: {
        subjects,
        subscriptionTtl: 0,
        includeStatus: true
      }
    });
  },

  /**
   * Sets the status of the current user
   * @param {string} status - active | inactive | ooo | dnd
   * @param {number} ttl - Time To Live for the event in seconds.
   * @returns {Promise}
   */
  setStatus(status, ttl) {
    if (!status) {
      return Promise.reject(new Error('A status is required'));
    }

    return this.webex.request({
      method: 'POST',
      api: 'apheleia',
      resource: 'events',
      body: {
        subject: this.webex.internal.device.userId,
        eventType: status,
        ttl
      }
    })
      .then((response) => response.body);
  },

  /**
   * Retrieves and subscribes to a user's presence.
   * @param {string} id
   * @returns {undefined}
   */
  enqueue(id) {
    return this.worker.enqueue(id);
  },

  /**
   * Retract from subscribing to a user's presence.
   * @param {string} id
   * @returns {undefined}
   */
  dequeue(id) {
    return this.worker.dequeue(id);
  }
});

export default Presence;
