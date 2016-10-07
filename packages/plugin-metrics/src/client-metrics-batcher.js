/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Batcher from './batcher';

const ClientMetricsBatcher = Batcher.extend({
  namespace: `Metrics`,

  prepareItem(item) {
    // Add more defaults to payload when the clientmetrics endpoint evolves to support richer payloads
    return Promise.resolve(item);
  },

  prepareRequest(queue) {
    return Promise.resolve(queue);
  },

  submitHttpRequest(payload) {
    return this.spark.request({
      method: `POST`,
      service: `metrics`,
      resource: `clientmetrics`,
      body: {
        metrics: payload
      }
    });
  }

});

export default ClientMetricsBatcher;
