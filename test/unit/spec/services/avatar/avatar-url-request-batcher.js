/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AvatarUrlRequestBatcher = require('../../../../../src/client/services/avatar/avatar-url-request-batcher');
var assert = require('chai').assert;
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');
var uuid = require('uuid');

describe('Services', function() {
  describe('Avatar', function() {
    describe('AvatarUrlRequestBatcher', function() {
      var batcher;
      var spark;

      beforeEach(function() {
        spark = new MockSpark({
          children: {
            batcher: AvatarUrlRequestBatcher
          }
        });

        batcher = spark.batcher;
      });

      describe('#_checkParameters()', function() {
        it('requires a uuid', function() {
          return Promise.all([
            assert.isRejected(batcher._checkParameters(), /`id` must be a uuid/),
            assert.isRejected(batcher._checkParameters('some-id'), /`id` must be a uuid/)
          ]);
        });

        it('requires a size', function() {
          return Promise.all([
            assert.isRejected(batcher._checkParameters(uuid.v4()), /`size` is a required parameter/),
            assert.isFulfilled(batcher._checkParameters(uuid.v4(), 80))
          ]);
        });
      });

      describe('#_processSuccess()', function() {
        var fail;
        var res;
        var succeed;

        beforeEach(function() {
          fail = sinon.stub(batcher.store, 'fail');
          succeed = sinon.stub(batcher.store, 'succeed');

          res = {
            statusCode: 200,
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa1': {
                80: {
                  size: 80,
                  url: 'http://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1/80'
                },
                120: {
                  size: 140,
                  url: 'http://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1/140'
                }
              }
            },
            options: {
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [80, 120, 180]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa2',
                  sizes: [80]
                }
              ]
            }
          };
        });

        it('resolves avatar requests in the response', function() {
          batcher._processSuccess(res);
          assert.calledTwice(succeed);

          assert.calledWith(succeed, '88888888-4444-4444-4444-aaaaaaaaaaa1', 80, 'http://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1/80');
          assert.calledWith(succeed, '88888888-4444-4444-4444-aaaaaaaaaaa1', 120, 'http://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1/140');
        });

        it('logs a warning if the avater service substitued an alternate size', function() {
          batcher._processSuccess(res);
          assert.calledOnce(spark.logger.warn);
        });

        it('rejects avatar request sizes not included in the response', function() {
          batcher._processSuccess(res);
          assert.calledWith(fail, '88888888-4444-4444-4444-aaaaaaaaaaa1', 180);
          assert.match(fail.args[0][2].toString() , /requested size not found in bulk avatar payload/);
        });

        it('rejects avatar request uids not included in the response', function() {
          batcher._processSuccess(res);
          assert.calledWith(fail, '88888888-4444-4444-4444-aaaaaaaaaaa2', 80);
          assert.match(fail.args[1][2].toString() , /requested uuid not found in bulk avatar payload/);
        });
      });

      describe('#_processFailure()', function() {
        it('rejects each request in the response\'s http request', function() {
          var spy = sinon.stub(batcher.store, 'fail');

          var res = {
            statusCode: 500,
            options: {
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [80, 120]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa2',
                  sizes: [80]
                }
              ]
            }
          };

          batcher._processFailure(res);

          assert.callCount(spy, 3);
          assert.calledWith(spy, '88888888-4444-4444-4444-aaaaaaaaaaa1', 80);
          assert.match(spy.args[0][2].toString(), /bulk retrieval for avatar urls failed/);
          assert.calledWith(spy, '88888888-4444-4444-4444-aaaaaaaaaaa1', 120);
          assert.match(spy.args[1][2].toString(), /bulk retrieval for avatar urls failed/);
          assert.calledWith(spy, '88888888-4444-4444-4444-aaaaaaaaaaa2', 80);
          assert.match(spy.args[2][2].toString(), /bulk retrieval for avatar urls failed/);
        });
      });

    });
  });
});
