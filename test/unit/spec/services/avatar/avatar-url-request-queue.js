/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AvatarUrlBatchedRequestQueue = require('../../../../../src/client/services/avatar/avatar-url-batched-request-queue');
var chai = require('chai');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Avatar', function() {
    describe('AvatarUrlBatchedRequestQueue', function() {
      var queue;
      var UUID0 = '88888888-4444-4444-4444-aaaaaaaaaaa0';
      var UUID1 = '88888888-4444-4444-4444-aaaaaaaaaaa1';

      beforeEach(function() {
        queue = new AvatarUrlBatchedRequestQueue();
      });

      describe('#push()', function() {
        it('requires an id parameter', function() {
          assert.throws(function() {
            queue.push();
          }, /`id` is a required parameter/);

          assert.doesNotThrow(function() {
            queue.push(UUID0);
          }, /`id` is a required parameter/);
        });

        it('requires a size parameter', function() {
          assert.throws(function() {
            queue.push(UUID0);
          }, /`size` is a required parameter/);

          assert.doesNotThrow(function() {
            queue.push(UUID0, 80);
          }, /`size` is a required parameter/);
        });

        it('adds an (id,size) to the list queue', function() {
          assert.isUndefined(queue.queue[UUID0]);

          queue.push(UUID0, 80);
          assert.isDefined(queue.queue[UUID0]);
          assert.include(queue.queue[UUID0], 80);

          queue.push(UUID0, 110);
          assert.isDefined(queue.queue[UUID0]);
          assert.include(queue.queue[UUID0], 80);
          assert.include(queue.queue[UUID0], 110);

          queue.push(UUID1, 110);
          assert.isDefined(queue.queue[UUID0]);
          assert.include(queue.queue[UUID0], 80);
          assert.include(queue.queue[UUID0], 110);
          assert.isDefined(queue.queue[UUID1]);
          assert.include(queue.queue[UUID1], 110);
        });

        it('does not add an (id,size) pair to the queue twice', function() {
          assert.isUndefined(queue.queue[UUID0]);
          queue.push(UUID0, 80);

          assert.isDefined(queue.queue[UUID0]);
          assert.lengthOf(queue.queue[UUID0], 1);

          queue.push(UUID0, 80);
          assert.lengthOf(queue.queue[UUID0], 1);
        });
      });

      describe('#toPayload()', function() {
        it('converts the queue to a payload parsable by the avatar API', function() {
          queue.push(UUID0, 80);
          queue.push(UUID0, 110);
          queue.push(UUID1, 80);

          return queue.toPayloads()
            .then(function(payloads) {
              assert.deepEqual(payloads[0], [
                {
                  uuid: UUID0,
                  sizes: [80, 110]
                },
                {
                  uuid: UUID1,
                  sizes: [80]
                }
              ]);
            });
        });

        it('empties the queue', function() {
          queue.push(UUID0, 80);
          queue.push(UUID0, 110);
          queue.push(UUID1, 80);

          queue.toPayloads();
          assert.deepEqual(queue.queue, {});
        });
      });
    });
  });
});
