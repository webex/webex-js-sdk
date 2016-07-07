/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Page from '../lib/page';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @typedef {Object} Types~Webhook
 * @property {string} id - The unique ID for the webhook.
 * @property {string} resource - The resource type for the webhook.
 * @property {string} event - The event type for the webhook.
 * @property {string} filter - The filter that defines the webhook scope.
 * @property {string} targetUrl - The URL that receives POST requests for each event.
 * @property {string} name - A user-friendly name for this webhook.
 */

/**
 * A webhook notifies an application when an event for which the application is
 * registered has occurred.
 * @class
 * @extends SparkPlugin
 */
const Webhooks = SparkPlugin.extend({
  /**
   * Posts a webhook.
   * @instance
   * @memberof Webhooks
   * @param {Types~Webhook} webhook
   * @returns {Promise<Webhook>}
   * @example
   * <%= webhooks__create_es6 %>
   * @example
   * <%= webhooks__create %>
   */
  create(webhook) {
    return this.request({
      method: `POST`,
      uri: `${this.config.hydraServiceUrl}/webhooks`,
      body: webhook
    })
      .then((res) => res.body);
  },

  /**
   * Shows details for a webhook.
   * @instance
   * @memberof Webhooks
   * @param {Webhook|string} webhook
   * @returns {Promise<Array<Webhook>>}
   * @example
   * <%= webhooks__get_es6 %>
   * @example
   * <%= webhooks__get %>
   */
  get(webhook) {
    const id = webhook.id || webhook;

    return this.request({
      uri: `${this.config.hydraServiceUrl}/webhooks/${id}`
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Lists all webhooks.
   * @instance
   * @memberof Webhooks
   * @param {Object} options
   * @param {integer} options.max Limit the maximum number of webhooks in the response.
   * @returns {Promise<Webhook>}
   * @example
   * <%= webhooks__list_es6 %>
   * @example
   * <%= webhooks__list %>
   */
  list(options) {
    return this.request({
      uri: `${this.config.hydraServiceUrl}/webhooks/`,
      qs: options
    })
      .then((res) => new Page(res, this.spark));
  },

  /**
   * Delete a webhook.
   * @instance
   * @memberof Webhooks
   * @param {Webhook|string} webhook
   * @returns {Promise}
   * @example
   * <%= webhooks__remove_es6 %>
   * @example
   * <%= webhooks__remove %>
   */
  remove(webhook) {
    const id = webhook.id || webhook;
    return this.request({
      method: `DELETE`,
      uri: `${this.config.hydraServiceUrl}/webhooks/${id}`
    })
      .then((res) => {
        // Firefox has some issues with 204s and/or DELETE. This should move to
        // http-core
        if (res.statusCode === 204) {
          return undefined;
        }
        return res.body;
      });
  },

  /**
   * Update a webhook.
   * @instance
   * @memberof Webhooks
   * @param {Webhook} webhook
   * @returns {Promise<Webhook>}
   * @example
   * <%= webhooks__update_es6 %>
   * @example
   * <%= webhooks__update %>
   */
  update(webhook) {
    const id = webhook.id;
    return this.request({
      method: `PUT`,
      uri: `${this.config.hydraServiceUrl}/webhooks/${id}`,
      body: webhook
    })
      .then((res) => res.body);
  }
});

export default Webhooks;
