/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../lib/spark-base');
var BatchedRequestQueue = require('./batched-request-queue');
var BatchedRequestStore = require('./batched-request-store');
var DummyBatchedRequestStore = require('./dummy-batched-request-store');
var debounce = require('lodash.debounce');

/**
 * @class
 * @extends {SparkBase}
 */
var AbstractRequestBatcher = SparkBase.extend(
  /** @lends AbstractRequestBatcher.prototype */
  {
  children: {
    queue: BatchedRequestQueue,
    store: BatchedRequestStore
  },

  /**
   * Enqueues a request to request using the desired parameters
   * @return {Promise} Resolves when the corresponding request complets
   */
  fetch: function fetch() {
    var args = Array.prototype.slice.call(arguments);

    return this._checkParameters.apply(this, args)
      .then(function request() {
        if (this.store instanceof DummyBatchedRequestStore) {
          this.queue.push.apply(this.queue, args);
          this._processQueue();
          return Promise.resolve();
        }

        var defer;
        try {
          return this.store.get.apply(this.store, args).promise;
        }
        catch (error) {
          defer = this.store.create.apply(this.store, args);
          this.queue.push.apply(this.queue, args);
          this._processQueue();
          return defer.promise;
        }
      }.bind(this));
  },

  // yes, this is weird. the first time _processQueue is invoked, it'll replace
  // itself with a debounce wrapper around __processQueue. So far, I haven't
  // found a better way to ensure this.config has been initialized.
  _processQueue: function _processQueue() {
    this._processQueue = debounce(this.__processQueue, this.config.bulkFetchDebounceDelay, {maxWait: this.config.bulkFetchDebounceDelay*3});
    this._processQueue.apply(this, arguments);
  },

  /**
   * Passes the queue to {@link AbstractRequestBatcher#_request} and wires up response
   * handlers. Called on every call of {@link AbstractRequestBatcher#request} but
   * debounced.
   * @access private
   */
  __processQueue: function __processQueue() {
    this.queue.toPayloads()
      .then(function _processQueue(payloads) {
        payloads.forEach(function fetchPayload(payload) {
          return this._request(payload)
            .then(this._processSuccess.bind(this))
            .catch(this._processFailure.bind(this));
        }.bind(this));
      }.bind(this))
      .catch(function logError(err) {
        this.logger.error('Abstract Request Batcher: an unexpected error occurred', err);
        throw err;
      }.bind(this));
  },

  /**
   * Override this method to verify the correct paramters have been passed to
   * {@link AbstractRequestBatcher#request}
   * @abstract
   * @access private
   */
  _checkParameters: function _checkParameters() {
    throw new Error('Abstract Method');
  },

  /**
   * Override this method to make the API request
   * @abstract
   * @access private
   */
  _request: function _request() {
    throw new Error('Abstract Method');
  },

  /**
   * Override this method to process a successful response from the API
   * @abstract
   * @access private
   */
  _processSuccess: function _processSuccess() {
    throw new Error('Abstract Method');
  },

  /**
   * Override this method to process a failed response from the API
   * @abstract
   * @access private
   */
  _processFailure: function _processFailure(reason) {
    throw reason;
  }
});

module.exports = AbstractRequestBatcher;
