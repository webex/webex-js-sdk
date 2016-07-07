/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BatchedRequestQueue = require('../../../lib/batched-request-queue');
var isArray = require('lodash.isarray');
var map = require('lodash.map');

/**
 * @extends BatchedRequestQueue
 * @memberof Metrics
 */
var CirconusMetricsBatchedRequestQueue = BatchedRequestQueue.extend({
  namespace: 'Metrics',

  session: {
    queue: {
      type: 'object',
      default: function queue() {
        return {};
      }
    }
  },

  push: function push(api, payload) {
    /* istanbul ignore else */
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      payload.env = 'TEST';
    }

    if (!isArray(this.queue[api])) {
      this.queue[api] = [];
    }

    this.queue[api].push(payload);
  },

  toPayloads: function toPayloads() {
    return Promise.all(map(this.queue, function toPayload(queue, api) {
      return {
        api: api,
        queue: queue.splice(0, queue.length)
      };
    }));
  }
});

module.exports = CirconusMetricsBatchedRequestQueue;
