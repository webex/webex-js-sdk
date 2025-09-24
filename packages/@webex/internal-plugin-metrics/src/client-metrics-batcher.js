/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import Batcher from './batcher';

/**
 * ClientMetricsBatcher class for handling client metrics request batching
 * @class
 * @extends Batcher
 */
class ClientMetricsBatcher extends Batcher {
  namespace = 'Metrics';

  /**
   * Prepare an individual item for batching
   * @param {any} item - The item to prepare
   * @returns {Promise<any>} Promise resolving to the prepared item
   */
  prepareItem(item) {
    // Add more defaults to payload when the clientmetrics endpoint evolves to support richer payloads
    return Promise.resolve(item);
  }

  /**
   * Prepare the request from the queue
   * @param {any[]} queue - Array of items to prepare
   * @returns {Promise<any[]>} Promise resolving to the prepared request
   */
  prepareRequest(queue) {
    return Promise.resolve(queue);
  }

  /**
   * Submit the HTTP request
   * @param {any} payload - The payload to submit
   * @returns {Promise<any>} Promise resolving to the HTTP response
   */
  request(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'metrics',
      resource: 'clientmetrics',
      body: {
        metrics: payload,
      },
      waitForServiceTimeout: this.webex.config.metrics.waitForServiceTimeout,
    });
  }
}

export default ClientMetricsBatcher;
