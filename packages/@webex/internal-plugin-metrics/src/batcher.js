/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {Batcher, WebexHttpError} from '@webex/webex-core';
import {safeSetTimeout} from '@webex/common-timers';

const sym = Symbol('metric id');

const MetricsBatcher = Batcher.extend({
  namespace: 'Metrics',

  /**
   * Implement prepare item
   * @param item
   * @returns
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
   * Implement prepare request
   * @param queue
   * @returns
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
   * Implement submit HTTP request
   * @param payload
   * @returns
   */
  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'metrics',
      resource: 'metrics',
      body: {
        metrics: payload,
      },
    });
  },

  /**
   *
   */
  handleHttpSuccess(res) {
    return Promise.all(res.options.body.metrics.map((item) => this.acceptItem(item)));
  },

  /**
   * Implement handle HTTP error
   * @param reason
   * @returns
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
   * Implement rerequest
   * @param item
   * @returns
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
   * Implement fingerprint request
   * @param item
   * @returns
   */
  fingerprintRequest(item) {
    item[sym] = item[sym] || {
      nextDelay: 1000,
    };

    return Promise.resolve(item[sym]);
  },

  /**
   * Implement fingerprint response
   * @param item
   * @returns
   */
  fingerprintResponse(item) {
    return Promise.resolve(item[sym]);
  },
});

export default MetricsBatcher;
