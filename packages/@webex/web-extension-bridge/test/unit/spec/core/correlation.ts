import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {PendingRequests} from '../../../../src/core/correlation';
import {BridgeError} from '../../../../src/core/errors';

describe('core/correlation', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'Date']});
  });

  afterEach(() => {
    clock.restore();
  });

  const options = (overrides = {}) => ({timeoutMs: 1000, topic: 'demo.topic', ...overrides});

  it('resolves a pending request', async () => {
    const pending = new PendingRequests();
    const promise = pending.create('a', options());

    assert.equal(pending.size, 1);
    assert.isTrue(pending.resolve('a', {value: 1}));

    assert.deepEqual(await promise, {value: 1});
    assert.equal(pending.size, 0);
  });

  it('rejects a pending request with its code and topic', async () => {
    const pending = new PendingRequests();
    const promise = pending.create('a', options());

    pending.reject('a', new BridgeError('NO_HANDLER', undefined, 'demo.topic'));

    const error = await promise.catch((cause) => cause);

    assert.instanceOf(error, BridgeError);
    assert.equal(error.code, 'NO_HANDLER');
    assert.equal(error.topic, 'demo.topic');
  });

  it('always settles: a request left alone times out', async () => {
    const pending = new PendingRequests();
    const promise = pending.create('a', options({timeoutMs: 250}));
    const settled = promise.catch((cause) => cause);

    clock.tick(249);
    assert.equal(pending.size, 1);

    clock.tick(1);

    const error = await settled;

    assert.equal(error.code, 'TIMEOUT');
    assert.equal(pending.size, 0);
  });

  it('tells the caller to notify its peer when the local timer fires', () => {
    const pending = new PendingRequests();
    const onTimeout = sinon.stub();

    void pending.create('a', options({timeoutMs: 100, onTimeout})).catch(() => undefined);
    clock.tick(100);

    assert.calledOnceWithExactly(onTimeout);
  });

  it('cancels the timer once settled, so a resolved request cannot later time out', async () => {
    const pending = new PendingRequests();
    const promise = pending.create('a', options({timeoutMs: 100}));

    pending.resolve('a', 'value');
    clock.tick(5000);

    assert.equal(await promise, 'value');
  });

  describe('single-use settling', () => {
    it('ignores a second response for the same id', async () => {
      const pending = new PendingRequests();
      const promise = pending.create('a', options());

      assert.isTrue(pending.resolve('a', 'first'));
      assert.isFalse(pending.resolve('a', 'second'));
      assert.isFalse(pending.reject('a', new BridgeError('TIMEOUT')));

      assert.equal(await promise, 'first');
    });

    it('ignores a response for an id it never issued', () => {
      const pending = new PendingRequests();

      assert.isFalse(pending.resolve('never-issued', 'value'));
      assert.isFalse(pending.reject('never-issued', new BridgeError('TIMEOUT')));
    });

    it('refuses to reuse a live id', () => {
      const pending = new PendingRequests();

      void pending.create('a', options()).catch(() => undefined);

      assert.throws(() => pending.create('a', options()), /Duplicate request id/);
    });
  });

  describe('abort', () => {
    it('rejects immediately when the signal is already aborted', async () => {
      const pending = new PendingRequests();
      const controller = new AbortController();

      controller.abort();

      const error = await pending
        .create('a', options({signal: controller.signal}))
        .catch((cause) => cause);

      assert.equal(error.code, 'ABORTED');
      assert.equal(pending.size, 0);
    });

    it('rejects when the signal aborts later', async () => {
      const pending = new PendingRequests();
      const controller = new AbortController();
      const settled = pending
        .create('a', options({signal: controller.signal}))
        .catch((cause) => cause);

      controller.abort();

      assert.equal((await settled).code, 'ABORTED');
      assert.equal(pending.size, 0);
    });

    it('detaches the abort listener once settled', async () => {
      const pending = new PendingRequests();
      const controller = new AbortController();
      const promise = pending.create('a', options({signal: controller.signal}));

      pending.resolve('a', 'value');
      controller.abort();

      assert.equal(await promise, 'value');
    });
  });

  describe('settleAll', () => {
    it('settles every request on disconnect', async () => {
      const pending = new PendingRequests();
      const first = pending.create('a', options()).catch((cause) => cause);
      const second = pending.create('b', options()).catch((cause) => cause);

      assert.equal(pending.settleAll('DISCONNECTED'), 2);
      assert.equal(pending.size, 0);
      assert.equal((await first).code, 'DISCONNECTED');
      assert.equal((await second).code, 'DISCONNECTED');
    });

    it('settles only the requests belonging to one tab', async () => {
      const pending = new PendingRequests();
      const inTab = pending.create('a', options(), 1).catch((cause) => cause);
      const otherTab = pending.create('b', options(), 2);

      assert.equal(pending.settleAll('DISCONNECTED', 1), 1);
      assert.equal((await inTab).code, 'DISCONNECTED');
      assert.equal(pending.size, 1);

      pending.resolve('b', 'still here');
      assert.equal(await otherTab, 'still here');
    });

    it('counts in-flight requests per tab', () => {
      const pending = new PendingRequests();

      void pending.create('a', options(), 1).catch(() => undefined);
      void pending.create('b', options(), 1).catch(() => undefined);
      void pending.create('c', options(), 2).catch(() => undefined);

      assert.equal(pending.countForTab(1), 2);
      assert.equal(pending.countForTab(2), 1);
      assert.equal(pending.countForTab(3), 0);
    });
  });

  describe('concurrency cap', () => {
    it('rejects beyond maxInFlight rather than queueing', () => {
      const pending = new PendingRequests({maxInFlight: 2});

      void pending.create('a', options()).catch(() => undefined);
      void pending.create('b', options()).catch(() => undefined);

      try {
        pending.create('c', options());
        assert.fail('expected a throw');
      } catch (error) {
        assert.instanceOf(error, BridgeError);
        assert.equal((error as BridgeError).code, 'RATE_LIMITED');
      }
    });

    it('frees a slot once a request settles', () => {
      const pending = new PendingRequests({maxInFlight: 1});

      void pending.create('a', options()).catch(() => undefined);
      pending.resolve('a', null);

      assert.doesNotThrow(() => {
        void pending.create('b', options()).catch(() => undefined);
      });
    });
  });
});
