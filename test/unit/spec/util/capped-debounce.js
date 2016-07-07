/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var cappedDebounce = require('../../../../src/util/capped-debounce');
var delay = require('../../../lib/delay');
var retry = require('../../../integration/lib/retry');
var sinon = require('sinon');

describe('cappedDebounce()', function() {
  it('requires a function', function() {
    assert.throws(cappedDebounce, /`fn` must be a function/);
  });

  it('requires a `wait`', function() {
    assert.throws(cappedDebounce.bind(null, sinon.spy()), /`wait` is required/);
  });

  it('requires a `maxWait`', function() {
    assert.throws(cappedDebounce.bind(null, sinon.spy(), 5), /`options.maxWait` is required/);
  });

  it('requires a `maxCalls`', function() {
    assert.throws(cappedDebounce.bind(null, sinon.spy(), 5, {maxWait: 10}), /`options.maxCalls` is required/);
  });

  it('returns a function that will execute once it stops being invoked for `wait` ms', function() {
    return retry(function() {
      var spy = sinon.spy();
      var fn = cappedDebounce(spy, 50, {maxWait: 1000, maxCalls: 10000});
      fn();
      fn();
      fn();
      fn();
      assert.notCalled(spy);
      return delay(20)
        .then(function() {
          assert.notCalled(spy);
          return delay(40);
        })
        .then(function() {
          assert.calledOnce(spy);
          return delay(40);
        })
        .then(function() {
          assert.calledOnce(spy);
        });
    });
  });

  it('returns a function that will execute once if it continues to be invoked for `wait` ms after `maxWait` ms', function() {
    return retry(function() {
      var spy = sinon.spy();
      var fn = cappedDebounce(spy, 100, {maxWait: 130, maxCalls: 10000});

      fn();
      assert.notCalled(spy);
      return delay(50)
        .then(function() {
          fn();
          assert.notCalled(spy);
          return delay(50);
        })
        .then(function() {
          fn();
          assert.notCalled(spy);
          return delay(50);
        })
        .then(function() {
          fn();
          assert.calledOnce(spy);
        });
    });
  });

  it('returns a function that will execute once it has been invoked `maxCalls` times', function() {
    return retry(function() {
      var spy = sinon.spy();
      var fn = cappedDebounce(spy, 50, {maxWait: 100, maxCalls: 3});
      fn();
      assert.notCalled(spy);
      fn();
      assert.notCalled(spy);
      fn();
      assert.notCalled(spy);
      fn();
      assert.called(spy);
    });
  });
});
