/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var State = require('ampersand-state');

/**
 * @class
 * @extends {State}
 */
var BatchedRequestQueue = State.extend(
  /** @lends BatchedRequestQueue.prototype */
  {
  session: {
    queue: {
      type: 'array',
      required: true,
      default: function _buffer() {
        return [];
      }
    }
  },

  push: function push(id) {
    if (!id) {
      throw new Error('`id` is a required parameter');
    }

    this.queue.push(id);
  },

  toPayloads: function toPayload() {
    return Promise.resolve([this.queue.splice(0, this.queue.length)]);
  }
});

module.exports = BatchedRequestQueue;
