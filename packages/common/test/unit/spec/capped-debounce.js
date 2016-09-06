/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {cappedDebounce} from '../..';
import lolex from 'lolex';

describe(`common`, () => {
  describe(`cappedDebounce()`, () => {
    let clock;

    beforeEach(() => {
      clock = lolex.install(Date.now());
    });

    afterEach(() => {
      clock.uninstall();
    });

    it(`requires a function`, () => {
      assert.throws(cappedDebounce, /`fn` must be a function/);
    });

    it(`requires a \`wait\``, () => {
      assert.throws(cappedDebounce.bind(null, sinon.spy()), /`wait` is required/);
    });

    it(`requires a \`maxWait\``, () => {
      assert.throws(cappedDebounce.bind(null, sinon.spy(), 5), /`options.maxWait` is required/);
    });

    it(`requires a \`maxCalls\``, () => {
      assert.throws(cappedDebounce.bind(null, sinon.spy(), 5, {maxWait: 10}), /`options.maxCalls` is required/);
    });

    it(`returns a function that will execute once it stops being invoked for \`wait\` ms`, () => {
      const spy = sinon.spy();
      const fn = cappedDebounce(spy, 50, {maxWait: 1000, maxCalls: 10000});
      fn();
      fn();
      fn();
      fn();
      assert.notCalled(spy);
      clock.tick(20);
      assert.notCalled(spy);
      clock.tick(40);
      assert.calledOnce(spy);
      clock.tick(40);
      assert.calledOnce(spy);
    });

    it(`returns a function that will execute once if it continues to be invoked for \`wait\` ms after \`maxWait\` ms`, () => {
      const spy = sinon.spy();
      const fn = cappedDebounce(spy, 100, {maxWait: 130, maxCalls: 10000});

      fn();
      assert.notCalled(spy);
      clock.tick(50);
      fn();
      assert.notCalled(spy);
      clock.tick(50);
      fn();
      assert.notCalled(spy);
      clock.tick(50);
      fn();
      assert.calledOnce(spy);
    });

    it(`returns a function that will execute once it has been invoked \`maxCalls\` times`, () => {
      const spy = sinon.spy();
      const fn = cappedDebounce(spy, 50, {maxWait: 100, maxCalls: 3});
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
