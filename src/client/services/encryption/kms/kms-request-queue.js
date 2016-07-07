/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BatchedRequestQueue = require('../../../../lib/batched-request-queue');

/**
 * @class
 * @extends BatchedRequestQueue
 * @memberof Encryption
 */
var KmsBatchedRequestQueue = BatchedRequestQueue.extend({
  namespace: 'Encryption',

  push: function push(req) {
    if (!req) {
      throw new Error('`req` is a required parameter');
    }

    if (!req.wrapped) {
      throw new Error('`req` must be wrapped');
    }

    this.queue.push(req.wrapped);
  },

  toPayloads: function toPayloads() {
    var payload = this.queue.splice(0, this.queue.length);
    return Promise.resolve([{
      kmsMessages: payload
    }]);
  }
});

module.exports = KmsBatchedRequestQueue;
