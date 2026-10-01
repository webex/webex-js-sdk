import {assert} from '@webex/test-helper-chai';

import {CounterName, Counters} from '../../../../src/core/counters';

describe('core/counters', () => {
  it('starts empty', () => {
    assert.deepEqual(new Counters().snapshot(), {});
  });

  it('counts by name', () => {
    const counters = new Counters();

    counters.increment(CounterName.PUSH_SENT);
    counters.increment(CounterName.PUSH_SENT);

    assert.equal(counters.snapshot()[CounterName.PUSH_SENT], 2);
  });

  it('counts by name and detail', () => {
    const counters = new Counters();

    counters.increment(CounterName.DROPPED, 'CLOCK_SKEW');
    counters.increment(CounterName.DROPPED, 'REPLAYED_ID');
    counters.increment(CounterName.DROPPED, 'CLOCK_SKEW');

    assert.equal(counters.snapshot()['dropped.CLOCK_SKEW'], 2);
    assert.equal(counters.snapshot()['dropped.REPLAYED_ID'], 1);
  });

  it('honours a custom increment', () => {
    const counters = new Counters();

    counters.increment(CounterName.PUSH_RECEIVED, undefined, 5);

    assert.equal(counters.snapshot()[CounterName.PUSH_RECEIVED], 5);
  });

  it('hands out a detached snapshot', () => {
    const counters = new Counters();

    counters.increment(CounterName.PUSH_SENT);

    const snapshot = counters.snapshot();

    counters.increment(CounterName.PUSH_SENT);

    assert.equal(snapshot[CounterName.PUSH_SENT], 1);
  });

  it('resets', () => {
    const counters = new Counters();

    counters.increment(CounterName.PUSH_SENT);
    counters.reset();

    assert.deepEqual(counters.snapshot(), {});
  });

  it('cannot be polluted through a detail string', () => {
    const counters = new Counters();

    counters.increment(CounterName.DROPPED, '__proto__');

    assert.equal(counters.snapshot()['dropped.__proto__'], 1);
    assert.isNull(Object.getPrototypeOf(counters.snapshot()));
    assert.isUndefined(({} as Record<string, unknown>).polluted);
  });
});
