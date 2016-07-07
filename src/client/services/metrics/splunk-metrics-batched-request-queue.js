/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var defaults = require('lodash.defaults');
var BatchedRequestQueue = require('../../../lib/batched-request-queue');

/**
 * @extends BatchedRequestQueue
 * @memberof Metrics
 */
var SplunkMetricsBatchedRequestQueue = BatchedRequestQueue.extend({
  namespace: 'Metrics',

  push: function push(payload) {
    if (!payload) {
      throw new Error('`payload` is a required parameter');
    }

    // Assume 'development' if NODE_ENV is not specified
    var env = process.env.NODE_ENV || 'development';

    defaults(payload, {
      time: Date.now(),
      env: env.toUpperCase()
    });

    this.queue.push(payload);
  },

  toPayloads: function toPayloads() {
    var payload = this.queue.splice(0, this.queue.length);
    var now = Date.now();

    // Used to synchronize timestamps across clients.
    // It may be necessary to move this code into SplunkMetrics#_fetch because
    // the network call effectively happens on nextTick, which could be a long
    // way off.
    payload.forEach(function addPostTime(item) {
      item.postTime = now;
    });

    return Promise.resolve([payload]);
  }
});

module.exports = SplunkMetricsBatchedRequestQueue;
