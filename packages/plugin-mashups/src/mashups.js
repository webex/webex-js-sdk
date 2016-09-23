/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {omit} from 'lodash';
import {SparkPlugin} from '@ciscospark/spark-core';

const Mashups = SparkPlugin.extend({
  namespace: `Mashups`,
  /**
   * Creates a new integration
   * @param {Object} options integration details
   * @returns {IntegrationModel} created integration
   */
  create(options) {
    options = options || {};

    if (!options.type) {
      return Promise.reject(new Error(`options.type is required`));
    }

    if (!options.roomId) {
      return Promise.reject(new Error(`options.roomId is required`));
    }

    return this.request({
      service: `mashups`,
      resource: `integrations/${options.type}`,
      method: `POST`,
      body: omit(options, `type`)
    })
        .then((res) => res.body);
  },
  /**
   * Returns the users configured integrations
   * @param {Object|Conversation~ConversationObect} options
   * @param {string} options.id
   * @param {string} options.roomId
   * @returns {Array}
   */
  get(options) {
    options = options || {};

    if (!options.roomId && !options.id) {
      return Promise.reject(new Error(`options.roomId or option.id is required`));
    }

    return this.request({
      service: `mashups`,
      resource: `integrations/rooms/${options.id || options.roomId}`,
      method: `GET`
    })
        .then((res) => res.body);
  },
  /**
   * Returns users all integrations
   * @returns {Array}
   */
  list() {
    return this.request({
      service: `mashups`,
      resource: `integrations`,
      method: `GET`
    })
        .then((res) => res.body);
  },

  /**
   * Delete an integration
   * @param {Object} options integration details
   * @returns {Promise}
   */
  remove(options) {
    options = options || {};

    if (!options.type) {
      return Promise.reject(new Error(`options.type is required`));
    }

    if (!options.id) {
      return Promise.reject(new Error(`options.id is required`));
    }

    return this.request({
      service: `mashups`,
      resource: `integrations/${options.type}/${options.id}`,
      method: `DELETE`
    });
  }
});

export default Mashups;
