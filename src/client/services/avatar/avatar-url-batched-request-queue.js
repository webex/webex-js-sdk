/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BatchedRequestQueue = require('../../../lib/batched-request-queue');
var contains = require('lodash.contains');
var reduce = require('lodash.reduce');

/**
 * @class
 * @extends BatchedRequestQueue
 * @memberof Avatar
 */
var AvatarUrlBatchedRequestQueue = BatchedRequestQueue.extend({
  namespace: 'Avatar',

  session: {
    queue: {
      default: function queue() {
        return {};
      },
      type: 'object'
    }
  },

  push: function push(id, size) {
    if (!id) {
      throw new Error('`id` is a required parameter');
    }

    if (!size) {
      throw new Error('`size` is a required parameter');
    }

    var queue = this.queue[id];
    if (!queue) {
      queue = this.queue[id] = [];
    }

    if (!contains(queue, size)) {
      queue.push(size);
    }
  },

  toPayloads: function toPayload() {
    var queue = reduce(this.queue, function reducePayloadItem(queue, value, key) {
      queue.push({
        uuid: key,
        sizes: value
      });
      return queue;
    }, []);

    this.queue = {};
    return Promise.resolve([queue]);
  }
});

module.exports = AvatarUrlBatchedRequestQueue;
