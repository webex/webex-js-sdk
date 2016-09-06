/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-shadow: [0] */

import {cappedDebounce, Defer} from '@ciscospark/common';
import SparkPlugin2 from './spark-plugin-2';

const defers = new Map();
const executors = new WeakMap();
const queues = new WeakMap();

export default class RequestBatcher extends SparkPlugin2 {
  constructor(...args) {
    super(...args);
    if (!this.submit) {
      throw new Error(`\`RequestBatcher#submit() must be defined`);
    }

    if (!this.generateKey) {
      throw new Error(`\`RequestBatcher#generateKey()\` must be implemented`);
    }

    queues.set(this, []);
  }

  // Get around the fact that AmpersandState doesn't provide attributes to
  // children at initialization by latebinding the execute method.
  get bounce() {
    let exec = executors.get(this);
    if (!exec) {
      exec = cappedDebounce((...args) => this.execute(...args), this.config.batchWait, {
        maxCalls: this.config.batchMaxCalls,
        maxWait: this.config.batchMaxWait
      });
      executors.set(this, exec);
    }
    return exec;
  }

  enqueue(payload) {
    const defer = new Defer();
    new Promise((resolve) => resolve(this.batchWillReceiveRequest(payload)))
      .then((payload) => [payload, this.generateKey(payload)])
      .then(([payload, key]) => {
        if (defers.has(key)) {
          return defer.resolve(defers.get(key).promise);
        }

        // I'm not a fan of passing defer down here, but anything else is going
        // to be too complicated right now.
        return Promise.resolve(this.batchDidReceiveRequest(payload, defer))
          .then(() => {
            const queue = queues.get(this) || [];
            queue.push(payload);

            defers.set(key, defer);
            defer.promise.then(() => defers.delete(key));
            defer.promise.catch(() => defers.delete(key));
            this.bounce();
          });
      })
      .catch((reason) => defer.reject(reason));

    return defer.promise;
  }

  /**
   * Do work needed before enqueuing the payload and generating its index
   * @param {Object} payload
   * @returns {Promise}
   */
  batchWillReceiveRequest(payload) {
    return Promise.resolve(payload);
  }

  /**
   * Do additional work that can wait until after the payload is enqueued
   * @param {Object} payload
   * @returns {Promise}
   */
  batchDidReceiveRequest({payload}) {
    return Promise.resolve(payload);
  }

  execute() {
    let queue = queues.get(this);
    queue = queue.splice(0, queue.length);
    new Promise((resolve) => {
      resolve(this.batchWillExecute(queue));
    })
      .then((payload) => this.submit(payload))
      .then((response) => this.batchDidSucceed(response, queue))
      .catch((reason) => this.batchDidFail(reason, queue));
  }

  /**
   * Executed immediately before submitting a request
   * @param {Array} queue
   * @returns {Object}
   */
  batchWillExecute(queue) {
    return queue;
  }

  /**
   * Called when the http request succeeds
   * @returns {Promise}
   */
  batchDidSucceed(response, queue) {
    this.logger.info(`request-batcher: batchDidSucceed()`);
    return Promise.all(queue.map((item) => {
      if (this.didRequestFail(item, response)) {
        return this.requestWillFail(item, response)
          .then((reason) => this.requestDidFail(item, reason));
      }

      return this.requestWillSucceed(item, response)
        .then((result) => this.requestDidSucceed(item, result));
    }));
    // TODO need to handle processing errors
  }

  /**
   * Indicates whether a specific entry in the response implies a success or a
   * failure
   * @returns {boolean}
   */
  didRequestFail() {
    return false;
  }

  /**
   * Should almost always be overridden: specifies the value with which to
   * resolve the request.
   * @param {[type]} item
   * @param {[type]} response
   * @returns {[type]}
   */
  requestWillSucceed(item, response) {
    return Promise.resolve(response.body);
  }

  /**
   * Resolves the promise;
   * @param {[type]} item
   * @param {[type]} result
   * @returns {[type]}
   */
  requestDidSucceed(item, result) {
    const key = this.generateKey(item);
    this.markSuccess(item, result);
    defers.delete(key);
  }

  /**
   * Called when the http request fails
   * @returns {Promise}
   */
  batchDidFail(reason, queue) {
    this.logger.error(`request-batcher: batchDidFail()`, reason);
    return Promise.all(queue.map((item) => this.requestWillFail(item, reason)
      .catch((reason) => this.requestDidFail(item, reason))
    ));
  }

  requestWillFail(item, reason) {
    return Promise.reject(reason);
  }

  requestDidFail(item, reason) {
    const key = this.generateKey(item);
    this.markFailure(item, reason);
    defers.delete(key);
  }

  markSuccess(item, result) {
    const key = this.generateKey(item);
    const defer = defers.get(key);
    defer.resolve(result);
  }

  markFailure(item, reason) {
    const key = this.generateKey(item);
    const defer = defers.get(key);
    defer.reject(reason);
  }
}
