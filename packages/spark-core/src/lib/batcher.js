/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import SparkPlugin from './spark-plugin';
import {
  cappedDebounce,
  Defer
} from '@ciscospark/common';

/* eslint require-jsdoc: [0] */

const Batcher = SparkPlugin.extend({
  session: {
    deferreds: {
      type: `object`,
      default() {
        return new Map();
      }
    },
    queue: {
      type: `array`,
      default() {
        return [];
      }
    }
  },

  derived: {
    bounce: {
      fn() {
        return cappedDebounce((...args) => this.submitRequest(...args), this.config.batcherWait, {
          maxCalls: this.config.batcherMaxCalls,
          maxWait: this.config.batcherMaxWait
        });
      }
    }
  },

  enqueue(req) {
    const defer = new Defer();
    Promise.resolve(this.fingerprintRequest(req))
      .then((idx) => {
        if (this.deferreds.has(idx)) {
          defer.resolve(this.deferreds.get(idx).promise);
          return;
        }
        this.deferreds.set(idx, defer);

        defer.promise = defer.promise
          .then(() => this.deferreds.delete(idx))
          .catch((reason) => {
            this.deferreds.delete(idx);
            return Promise.reject(reason);
          });

        // TODO queue.push should be wrapped so that it's easy to deal with more
        // advanced queues later
        this.queue.push(req);
        this.bounce();
      })
      .catch((reason) => defer.reject(reason));

    return defer.promise;
  },

  submitRequest() {
    const queue = this.queue.splice(0);
    return new Promise((resolve) => {
      resolve(Promise.resolve(this.prepareRequest(queue))
        .then((payload) => this.request(payload)
            .then((res) => this.acceptResponse(res, payload, queue))
            .catch((reason) => this.handleHttpError(reason, payload, queue))
        ));
    })
      .catch((reason) => this.logger.error(reason.stack));
  },

  prepareRequest(queue) {
    return queue;
  },

  request(payload) {
    throw new Error(`request must be implemented`);
  },

  acceptResponse(res) {
    return Promise.resolve(res.body.map((item) => this.acceptItem(item)));
  },

  handleHttpError(reason, payload, queue) {
    const msg = reason.message || reason.body || reason;
    queue.forEach((item, index) => {
      Promise.resolve(this.fingerprintRequest(item, index))
        .then((idx) => {
          this.deferreds.get(idx).reject(msg);
        });
    });
  },

  acceptItem(item, index) {
    return Promise.resolve(this.fingerprintResponse(item, index))
      .then((idx) => {
        const defer = this.deferreds.get(idx);
        defer.resolve(item);
      });
  },

  fingerprintRequest(item) {
    // note: this may be at risk of a race condition in the future but for now
    // we can assume that this item will be the next item added to the queue.
    return Promise.resolve(this.queue.length);
  },

  fingerprintResponse(item, index) {
    return Promise.resolve(index);
  }
});

export default Batcher;
