/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {has} from 'lodash';
import {
  cappedDebounce,
  Defer,
  tap
} from '@webex/common';

import WebexPlugin from './webex-plugin';
import WebexHttpError from './webex-http-error';

/**
 * Base class for coalescing requests to batched APIs
 * @class Batcher
 */
const Batcher = WebexPlugin.extend({
  session: {
    deferreds: {
      type: 'object',
      default() {
        return new Map();
      }
    },
    queue: {
      type: 'array',
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

  /**
   * Requests an item from a batched API
   * @param {Object} item
   * @returns {Promise<mixed>}
   */
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
              .then(tap(() => this.deferreds.delete(idx)))
              .catch((reason) => {
                this.deferreds.delete(idx);

                return Promise.reject(reason);
              });

            this.enqueue(req)
              .then(() => this.bounce())
              .catch((reason) => defer.reject(reason));
          })
          .catch((reason) => defer.reject(reason));
      })
      .catch((reason) => defer.reject(reason));

    return defer.promise;
  },

  /**
   * Adds an item to the queue.
   * Intended to be overridden
   * @param {mixed} req
   * @returns {Promise<undefined>}
   */
  enqueue(req) {
    this.queue.push(req);

    return Promise.resolve();
  },

  /**
   * Transform the item before adding it to the queue
   * Intended to be overridden
   * @param {mixed} item
   * @returns {Promise<mixed>}
   */
  prepareItem(item) {
    return Promise.resolve(item);
  },

  /**
   * Detaches the current queue, does any appropriate transforms, and submits it
   * to the API.
   * @returns {Promise<undefined>}
   */
  executeQueue() {
    const queue = this.queue.splice(0, this.config.batcherMaxCalls);

    return new Promise((resolve) => {
      resolve(this.prepareRequest(queue)
        .then((payload) => this.submitHttpRequest(payload)
          .then((res) => this.handleHttpSuccess(res)))
        .catch((reason) => {
          if (reason instanceof WebexHttpError) {
            return this.handleHttpError(reason);
          }

          return Promise.all(queue.map((item) => this.getDeferredForRequest(item)
            .then((defer) => {
              defer.reject(reason);
            })));
        }));
    })
      .catch((reason) => {
        this.logger.error(process.env.NODE_ENV === 'production' ? reason : reason.stack);

        return Promise.reject(reason);
      });
  },

  /**
   * Performs any final transforms on the queue before submitting it to the API
   * Intended to be overridden
   * @param {Object|Array} queue
   * @returns {Promise<Object>}
   */
  prepareRequest(queue) {
    return Promise.resolve(queue);
  },

  /**
   * Submits the prepared request body to the API.
   * This method *must* be overridden
   * @param {Object} payload
   * @returns {Promise<HttpResponseObject>}
   */
  // eslint-disable-next-line no-unused-vars
  submitHttpRequest(payload) {
    throw new Error('request() must be implemented');
  },

  /**
   * Actions taken when the http request returns a success
   * Intended to be overridden
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
   * Intended to be overridden
   * @param {WebexHttpError} reason
   * @returns {Promise<undefined>}
   */
  handleHttpError(reason) {
    if (reason instanceof WebexHttpError) {
      if (has(reason, 'options.body.map')) {
        return Promise.all(reason.options.body.map((item) => this.getDeferredForRequest(item)
          .then((defer) => {
            defer.reject(reason);
          })));
      }
    }
    this.logger.error('http error handler called without a WebexHttpError object', reason);

    return Promise.reject(reason);
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

  /**
   * Indicates if the specified response item implies a success or a failure
   * Intended to be overridden
   * @param {Object} item
   * @returns {Promise<Boolean>}
   */
  // eslint-disable-next-line no-unused-vars
  didItemFail(item) {
    return Promise.resolve(false);
  },

  /**
   * Finds the Defer for the specified item and rejects its promise
   * Intended to be overridden
   * @param {Object} item
   * @returns {Promise<undefined>}
   */
  handleItemFailure(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => {
        defer.reject(item);
      });
  },

  /**
   * Finds the Defer for the specified item and resolves its promise
   * Intended to be overridden
   * @param {Object} item
   * @returns {Promise<undefined>}
   */
  handleItemSuccess(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => {
        defer.resolve(item);
      });
  },

  /**
   * Returns the Deferred for the specified request item
   * @param {Object} item
   * @returns {Promise<Defer>}
   */
  getDeferredForRequest(item) {
    return this.fingerprintRequest(item)
      .then((idx) => {
        const defer = this.deferreds.get(idx);

        /* istanbul ignore if */
        if (!defer) {
          throw new Error('Could not find pending request for received response');
        }

        return defer;
      });
  },

  /**
   * Returns the Deferred for the specified response item
   * @param {Object} item
   * @returns {Promise<Defer>}
   */
  getDeferredForResponse(item) {
    return this.fingerprintResponse(item)
      .then((idx) => {
        const defer = this.deferreds.get(idx);

        /* istanbul ignore if */
        if (!defer) {
          throw new Error('Could not find pending request for received response');
        }

        return defer;
      });
  },

  /**
   * Generates a unique identifier for the item in a request payload
   * Intended to be overridden
   * Note that overrides must return a primitive.
   * @param {Object} item
   * @returns {Promise<primitive>}
   */
  // eslint-disable-next-line no-unused-vars
  fingerprintRequest(item) {
    throw new Error('fingerprintRequest() must be implemented');
  },

  /**
   * Generates a unique identifier for the item in a response payload
   * Intended to be overridden
   * Note that overrides must return a primitive.
   * @param {Object} item
   * @returns {Promise<primitive>}
   */
  // eslint-disable-next-line no-unused-vars
  fingerprintResponse(item) {
    throw new Error('fingerprintResponse() must be implemented');
  }
});

export default Batcher;
