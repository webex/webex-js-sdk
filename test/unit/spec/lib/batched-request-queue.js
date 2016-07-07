/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var BatchedRequestQueue = require('../../../../src/lib/batched-request-queue');

describe('BatchedRequestQueue', function() {
  var queue;

  beforeEach(function() {
    queue = new BatchedRequestQueue();
  });

  describe('#push()', function() {
    it('requires an id', function() {
      assert.throws(function() {
        queue.push();
      }, /`id` is a required parameter/);
    });

    it('adds the id to the queue', function() {
      queue.push('some-id');
      assert.lengthOf(queue.queue, 1);
      assert.equal(queue.queue[0], 'some-id');
    });
  });

  describe('#toPayloads()', function() {
    before(function() {
      queue.push('some-id');
    });

    it('empties the queue', function() {
      queue.toPayloads();
      assert.lengthOf(queue.queue, 0);
    });

    it('resolves with a (possibly) segmented set of request bodies', function() {
      assert.isFulfilled(queue.toPayloads(), [['some-id']]);
    });
  });

});
