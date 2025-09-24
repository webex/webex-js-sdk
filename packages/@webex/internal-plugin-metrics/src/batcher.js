/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher, WebexHttpError} from '@webex/webex-core';
import {safeSetTimeout} from '@webex/common-timers';

const sym = Symbol('metric id');

/**
 * MetricsBatcher class for handling metrics batching and submission
 * @class
 * @extends Batcher
 * @memberof Metrics
 */
class MetricsBatcher extends Batcher {
  namespace = 'Metrics';

  /**
   * Prepare an individual metric item before batching
   * @param {any} item - The metric item to prepare
   * @returns {Promise<any>} Promise resolving to the prepared item
   */
  prepareItem(item) {
    // Keep non-prod data out of metrics
    const env = process.env.NODE_ENV === 'production' ? null : 'TEST';

    item.appType = item.appType || this.config.appType;
    item.env = item.env || env;
    item.time = item.time || Date.now();
    item.version = item.version || this.webex.version;

    return Promise.resolve(item);
  }

  /**
   * Prepare the request payload from the queue of items
   * @param {any[]} queue - Array of metric items to prepare
   * @returns {Promise<any[]>} Promise resolving to the prepared request payload
   */
  prepareRequest(queue) {
    return Promise.resolve(
      queue.map((item) => {
        item.postTime = item.postTime || Date.now();

        return item;
      })
    );
  }

  /**
   * Submit the HTTP request to the metrics service
   * @param {any} payload - The prepared payload to submit
   * @returns {Promise<any>} Promise resolving to the HTTP response
   */
  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'metrics',
      resource: 'metrics',
      body: {
        metrics: payload,
      },
      waitForServiceTimeout: this.webex.config.metrics.waitForServiceTimeout,
    });
  }

  /**
   * Handle successful HTTP response
   * @param {any} res - The HTTP response object
   * @returns {Promise<any>} Promise resolving when all items are accepted
   */
  handleHttpSuccess(res) {
    return Promise.all(res.options.body.metrics.map((item) => this.acceptItem(item)));
  }

  /**
   * Handle HTTP error responses and retry logic
   * @param {any} reason - The error reason
   * @returns {Promise<any>} Promise resolving when error is handled
   */
  handleHttpError(reason) {
    if (reason instanceof WebexHttpError.NetworkOrCORSError) {
      this.logger.warn(
        'metrics-batcher: received network error submitting metrics, reenqueuing payload'
      );

      return Promise.all(
        reason.options.body.metrics.map(
          (item) =>
            new Promise((resolve) => {
              const delay = item[sym].nextDelay;

              if (delay < this.config.batcherRetryPlateau) {
                item[sym].nextDelay *= 2;
              }
              safeSetTimeout(() => {
                resolve(this.rerequest(item));
              }, delay);
            })
        )
      );
    }

    return super.handleHttpError(reason);
  }

  /**
   * Re-request a failed item with retry logic
   * @param {any} item - The metric item to re-request
   * @returns {Promise<any>} Promise resolving when item is re-queued
   */
  rerequest(item) {
    return Promise.all([this.getDeferredForRequest(item), this.prepareItem(item)]).then(
      ([defer, req]) => {
        this.enqueue(req)
          .then(() => this.bounce())
          .catch((reason) => defer.reject(reason));
      }
    );
  }

  /**
   * Create a fingerprint for request tracking
   * @param {any} item - The metric item to fingerprint
   * @returns {Promise<any>} Promise resolving to the fingerprint
   */
  fingerprintRequest(item) {
    item[sym] = item[sym] || {
      nextDelay: 1000,
    };

    return Promise.resolve(item[sym]);
  }

  /**
   * Create a fingerprint for response tracking
   * @param {any} item - The metric item to fingerprint
   * @returns {Promise<any>} Promise resolving to the fingerprint
   */
  fingerprintResponse(item) {
    return Promise.resolve(item[sym]);
  }
}

export default MetricsBatcher;
