/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var retry = require('../../../../src/util/retry');
var sinon = require('sinon');

describe('retry()', function() {
  it('requires a function', function() {
    assert.throws(retry, /`fn` must be a function/);
    assert.doesNotThrow(function() {
      retry(function() {});
    }, /`fn` must be a function/);
  });

  it('returns a function that will execute no more than options.maxRetries times', function() {
    var spy = sinon.stub().returns(Promise.reject());
    var catchSpy = sinon.spy();

    return retry(spy, {maxAttempts: 4})()
      .then(function() {
        assert(false, 'this code path should not be reached');
      })
      .catch(function() {
        catchSpy();
        assert.equal(spy.callCount, 4);
      })
      .then(function() {
        assert.calledOnce(catchSpy);
      });
  });

  it('returns a function that will not retry until it succeeds', function() {
    var spy = sinon.stub().returns(Promise.resolve());

    return retry(spy, {maxAttempts: 3})()
      .then(function() {
        assert.equal(spy.callCount, 1);
      });
  });

  it('returns a function that will retry using a following an exponential backoff pattern', function() {
    this.timeout(4000);
    var spy = sinon.stub().returns(Promise.reject());
    var catchSpy = sinon.spy();

    var start = Date.now();

    return retry(spy, {maxAttempts: 3, delay: 500})()
      .catch(function() {
        catchSpy();

        var now = Date.now();

        // Subtract 100ms to add a little wiggle room
        assert(now - start > (500 + 500*2 - 100));
        assert(now - start < (500 + 500*2 + 500*2*2 - 100));
      })
      .then(function() {
        assert.calledOnce(catchSpy);
      });
  });

  it('returns a function that will respect maximum delay time if options.maxDelay is provided', function() {
    var spy = sinon.stub().returns(Promise.reject());
    var catchSpy = sinon.spy();

    var start = Date.now();

    return retry(spy, {maxAttempts: 4, delay: 150, maxDelay: 310})()
      .catch(function() {
        catchSpy();

        var now = Date.now();

        // Subtract 100ms to add a little wiggle room
        assert(now - start > (150 + 150*2 + 310 - 100));
        assert(now - start < (150 + 150*2 + 310 + 310 - 100));
      })
      .then(function() {
        assert.calledOnce(catchSpy);
      });
  });
});
