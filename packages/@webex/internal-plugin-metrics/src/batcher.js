/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher, WebexHttpError} from '@webex/webex-core';
import {safeSetTimeout} from '@webex/common-timers';

const sym = Symbol('metric id');

/**
 * @class
 * @extends Batcher
 * @memberof Metrics
 */
const MetricsBatcher = Batcher.extend({
  namespace: 'Metrics',

  /**
   * @param {any} item
   * @returns {Promise<any>}
   */
  prepareItem(item) {
    // Keep non-prod data out of metrics
    const env = process.env.NODE_ENV === 'production' ? null : 'TEST';

    item.appType = item.appType || this.config.appType;
    item.env = item.env || env;
    item.time = item.time || Date.now();
    item.version = item.version || this.webex.version;

    return Promise.resolve(item);
  },

  /**
   * @param {any[]} queue
   * @returns {Promise<any[]>}
   */
  prepareRequest(queue) {
    return Promise.resolve(
      queue.map((item) => {
        item.postTime = item.postTime || Date.now();

        return item;
      })
    );
  },

  /**
   * @param {any} payload
   * @returns {Promise<any>}
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
  },

  /**
   * @param {any} res
   * @returns {Promise<any>}
   */
  handleHttpSuccess(res) {
    return Promise.all(res.options.body.metrics.map((item) => this.acceptItem(item)));
  },

  /**
   * @param {any} reason
   * @returns {Promise<any>}
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

    return Reflect.apply(Batcher.prototype.handleHttpError, this, [reason]);
  },

  /**
   * @param {any} item
   * @returns {Promise<any>}
   */
  rerequest(item) {
    return Promise.all([this.getDeferredForRequest(item), this.prepareItem(item)]).then(
      ([defer, req]) => {
        this.enqueue(req)
          .then(() => this.bounce())
          .catch((reason) => defer.reject(reason));
      }
    );
  },

  /**
   * @param {any} item
   * @returns {Promise<any>}
   */
  fingerprintRequest(item) {
    item[sym] = item[sym] || {
      nextDelay: 1000,
    };

    return Promise.resolve(item[sym]);
  },

  /**
   * @param {any} item
   * @returns {Promise<any>}
   */
  fingerprintResponse(item) {
    return Promise.resolve(item[sym]);
  },
});

export default MetricsBatcher;
