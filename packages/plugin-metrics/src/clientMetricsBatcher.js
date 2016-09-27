/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {
  Batcher,
  SparkHttpError
} from '@ciscospark/spark-core';

const sym = Symbol(`metric id`);

const ClientMetricsBatcher = Batcher.extend({
  namespace: `Metrics`,

  prepareItem(item) {
    // Add more defaults to payload when the clientmetrics endpoint evolves to support richer payloads
    return Promise.resolve(item);
  },

  prepareRequest(queue) {
    return Promise.resolve(queue.map((item) => {
      return item;
    }));
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
  },

  handleHttpSuccess(res) {
    return Promise.all(res.options.body.metrics.map((item) => this.acceptItem(item)));
  },

  handleHttpError(reason) {
    if (reason instanceof SparkHttpError.NetworkOrCORSError) {
      this.logger.warn(`metrics-batcher: received network error submitting metrics, reenqueuing payload`);
      return Promise.all(reason.options.body.metrics.map((item) => new Promise((resolve) => {
        const delay = item[sym].nextDelay;
        if (delay < this.config.batcherRetryPlateau) {
          item[sym].nextDelay *= 2;
        }
        setTimeout(() => {
          resolve(this.rerequest(item));
        }, delay);
      })));
    }

    return Reflect.apply(Batcher.prototype.handleHttpError, this, [reason]);
  },

  rerequest(item) {
    return Promise.all([
      this.getDeferredForRequest(item),
      this.prepareItem(item)
    ])
      .then(([defer, req]) => {
        this.enqueue(req)
          .then(() => this.bounce())
          .catch((reason) => defer.reject(reason));
      });
  },

  fingerprintRequest(item) {
    item[sym] = item[sym] || {
      nextDelay: 1000
    };

    return Promise.resolve(item[sym]);
  },

  fingerprintResponse(item) {
    return Promise.resolve(item[sym]);
  }
});

export default ClientMetricsBatcher;
