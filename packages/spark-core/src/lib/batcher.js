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
        return cappedDebounce((...args) => this.executeQueue(...args), this.config.batcherWait, {
          maxCalls: this.config.batcherMaxCalls,
          maxWait: this.config.batcherMaxWait
        });
      }
    }
  },

  fetch(...args) {
    return this.fetch(...args);
  },

  request(item) {
    // So far, I can't find a way to avoid three layers of nesting here.
    /* eslint max-nested-callbacks: [0] */
    const defer = new Defer();
    this.fingerprintRequest(item)
      .then((idx) => {
        if (this.deferreds.has(idx)) {
          defer.resolve(this.deferreds.get(idx).promise);
          return;
        }
        this.deferreds.set(idx, defer);

        this.prepareItem(item)
          .then((req) => {
            defer.promise = defer.promise
              .then(() => this.deferreds.delete(idx))
              .catch((reason) => {
                this.deferreds.delete(idx);
                return Promise.reject(reason);
              });

            this.enqueue(req)
              .then(() => this.bounce());
          });
      })
      .catch((reason) => defer.reject(reason));

    return defer.promise;
  },

  enqueue(req) {
    this.queue.push(req);
    return Promise.resolve();
  },

  prepareItem(item) {
    return Promise.resolve(item);
  },

  /**
   * Detaches the current queue, does any appropriate transforms, and submits it
   * to the API.
   * @returns {Promise<undefined>}
   */
  executeQueue() {
    const queue = this.queue.splice(0);
    return new Promise((resolve) => {
      resolve(this.prepareRequest(queue)
        .then((payload) => this.submitHttpRequest(payload)
          // note: using the double-callback form of .then because that catch
          // handler should not receive the errors from handleHttpSuccess.
          .then(
            (res) => this.handleHttpSuccess(res, payload, queue)),
            (reason) => this.handleHttpError(reason)
          ));
    })
      .catch((reason) => {
        this.logger.error(process.env.NODE_ENV === `production` ? reason : reason.stack);
        return Promise.reject(reason);
      });
  },

  /**
   * Performs any final transforms on the queue before submitting it to the API
   * @param {Object|Array} queue
   * @returns {Promise<Object>}
   */
  prepareRequest(queue) {
    return Promise.resolve(queue);
  },

  /**
   * Submits the prepared request body to the API. This method *must* be
   * overridden
   * @param {Object} payload
   * @returns {Promise<HttpResponseObject>}
   */
  submitHttpRequest(payload) {
    throw new Error(`request() must be implemented`);
  },

  /**
   * Actions taken when the http request returns a success
   * @param {Promise<HttpResponseObject>} res
   * @returns {Promise<undefined>}
   */
  handleHttpSuccess(res) {
    return Promise.all((res.body && res.body.items || res.body).map((item) => this.acceptItem(item)));
  },

  /**
   * Actions taken when the http request returns a failure. Typically, this
   * means failing the entire queue, but could be overridden in some
   * implementations to e.g. reenqueue.
   * @param {SparkHttpError} reason
   * @returns {Promise<undefined>}
   */
  handleHttpError(reason) {
    const msg = reason.message || reason.body || reason;
    return Promise.all(reason._res.req.body.map((item) => this.getDeferredForRequest(item)
      .then((defer) => {
        defer.reject(msg);
      })));
  },

  /**
   * Determines if the item succeeded or failed and delegates accordingly
   * @param {Object} item
   * @returns {Promise<undefined>}
   */
  acceptItem(item) {
    return this.didItemFail(item)
      .then((didFail) => {
        if (didFail) {
          return this.handleItemFailure(item);
        }
        return this.handleItemSuccess(item);
      });
  },

  didItemFail(item) {
    return Promise.resolve(false);
  },

  handleItemFailure(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => {
        defer.reject(item);
      });
  },

  handleItemSuccess(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => {
        defer.resolve(item);
      });
  },

  getDeferredForRequest(item) {
    return this.fingerprintRequest(item)
      .then((idx) => {
        const defer = this.deferreds.get(idx);
        if (!defer) {
          throw new Error(`Could not find pending request for received response`);
        }
        return defer;
      });
  },

  getDeferredForResponse(item) {
    return this.fingerprintResponse(item)
      .then((idx) => {
        const defer = this.deferreds.get(idx);
        if (!defer) {
          throw new Error(`Could not find pending request for received response`);
        }
        return defer;
      });
  },

  fingerprintRequest(item) {
    throw new Error(`fingerprintRequest() must be implemented`);
  },

  fingerprintResponse(item) {
    throw new Error(`fingerprintResponse() must be implemented`);
  }
});

export default Batcher;
