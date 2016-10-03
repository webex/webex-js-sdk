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
var ClientMetricsBatchedRequestQueue = BatchedRequestQueue.extend({
  namespace: 'Metrics',

  push: function push(payload) {
    if (!payload) {
      throw new Error('`payload` is a required parameter');
    }

    defaults(payload);

    this.queue.push(payload);
  },

  toPayloads: function toPayloads() {
    var payload = this.queue.splice(0, this.queue.length);
    return Promise.resolve([payload]);
  }
});

module.exports = ClientMetricsBatchedRequestQueue;
