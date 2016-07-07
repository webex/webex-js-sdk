/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../../src/lib/abstract-request-batcher');
var BatchedRequestQueue = require('../../../../src/lib/batched-request-queue');
var BatchedRequestStore = require('../../../../src/lib/batched-request-store');
var assert = require('chai').assert;
var delay = require('../../../lib/delay');
var MockSpark = require('../../lib/mock-spark');
var sinon = require('sinon');

describe('AbstractRequestBatcher', function() {
  var batcher;

  var Batcher = AbstractRequestBatcher.extend({
    namespace: 'test'
  });

  beforeEach(function() {
    var spark = new MockSpark({
      children: {
        batcher: Batcher
      }
    });

    batcher = spark.batcher;

    spark.config = {
      test: {
        bulkFetchDebounceDelay: 5
      }
    };
  });

  describe('#request()', function() {
    beforeEach(function() {
      sinon.stub(batcher, '_checkParameters').returns(Promise.resolve());
      sinon.stub(batcher.queue, 'push').returns(Promise.resolve());
      sinon.stub(batcher.store, 'create').returns(Promise.resolve());
      sinon.stub(batcher, '_processQueue').returns(Promise.resolve());
    });

    it('adds a request to the queue', function() {
      batcher.fetch('id');
      return delay(100)
        .then(function() {
          assert.called(batcher.queue.push);
        });
    });

    it('adds a request to the store', function() {
      batcher.fetch('id');
      return delay(100)
        .then(function() {
          assert.called(batcher.store.create);
        });
    });

    it('signals the queue is ready to be processed', function() {
      batcher.fetch('id');
      return delay(100)
        .then(function() {
          assert.called(batcher._processQueue);
        });
    });


    it('resolves with the original request if the request has already been added to the store', function() {
      sinon.stub(batcher.store, 'get').returns(Promise.resolve('id'));

      batcher.fetch();
      return delay(100)
        .then(function() {
          assert.notCalled(batcher.store.create);
          assert.notCalled(batcher._processQueue);
        });
    });
  });

  describe('#initialize()', function() {
    it('initializes the queue', function() {
      assert.isDefined(batcher.queue);
      assert.instanceOf(batcher.queue, BatchedRequestQueue);
    });

    it('initializes the store', function() {
      assert.isDefined(batcher.store);
      assert.instanceOf(batcher.store, BatchedRequestStore);
    });
  });

  describe('#_processQueue()', function() {
    it('converts the queue to a payload', function(done) {
      sinon.stub(batcher.queue, 'toPayloads').returns(Promise.resolve([[1]]));
      batcher._processQueue();
      setTimeout(function() {
        assert.called(batcher.queue.toPayloads);
        done();
      }, 10);
    });

    it('invokes #_request()', function() {
      sinon.stub(batcher.queue, 'toPayloads').returns(Promise.resolve([[1]]));
      sinon.stub(batcher, '_request').returns(Promise.resolve({statusCode: 200}));

      batcher._processQueue();
      return delay(100)
        .then(function() {
          assert.called(batcher.queue.toPayloads);
          return delay(100);
        })
        .then(function() {
          assert.called(batcher._request);
          assert.callCount(batcher._request, 1);
        });
    });

    it('invokes #_request() if the queue has been segmented into multiple portions', function() {
      sinon.stub(batcher.queue, 'toPayloads').returns(Promise.resolve([[1], [2]]));
      sinon.stub(batcher, '_request').returns(Promise.resolve({statusCode: 200}));

      batcher._processQueue();
      return delay(100)
        .then(function() {
          assert.called(batcher.queue.toPayloads);
          return delay(100);
        })
        .then(function() {
          assert.called(batcher._request);
          assert.callCount(batcher._request, 2);
        });
    });

    it('invokes #_processSuccess() if #_request() succeeds', function() {
      sinon.stub(batcher.queue, 'toPayloads').returns(Promise.resolve([[1]]));
      sinon.stub(batcher, '_request').returns(Promise.resolve({statusCode: 200}));
      sinon.spy(batcher, '_processSuccess');

      batcher._processQueue();
      return delay(100)
        .then(function() {
          assert.called(batcher._processSuccess);
        });
    });

    it('invokes #_processFailure() if #_request() fails', function() {
      sinon.stub(batcher.queue, 'toPayloads').returns(Promise.resolve([[1]]));
      sinon.stub(batcher, '_request').returns(Promise.resolve({statusCode: 400}));
      sinon.spy(batcher, '_processFailure');

      batcher._processQueue();
      return delay(100)
        .then(function() {
          assert.called(batcher._processFailure);
        });
    });
  });

  describe('#_checkParameters()', function() {
    it('must be implemented', function() {
      assert.throws(function() {
        batcher._checkParameters();
      }, /Abstract Method/);
    });
  });

  describe('#_request()', function() {
    it('must be implemented', function() {
      assert.throws(function() {
        batcher._request();
      }, /Abstract Method/);
    });
  });

  describe('#_processSuccess()', function() {
    it('must be implemented', function() {
      assert.throws(function() {
        batcher._processSuccess();
      }, /Abstract Method/);
    });
  });

});
