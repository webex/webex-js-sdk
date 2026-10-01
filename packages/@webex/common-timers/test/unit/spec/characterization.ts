import {assert} from '@webex/test-helper-chai';
import {Timer, safeSetTimeout, safeSetInterval} from '@webex/common-timers';
import sinon from 'sinon';

/**
 * Characterization baseline for @webex/common-timers.
 *
 * This suite pins the module's CURRENT observable behaviour at the public boundary. It is a golden
 * master, not a statement of intent: if a change here goes red, the change altered behaviour that
 * some consumer may already depend on. Decide deliberately, then update this file in the same
 * commit.
 *
 * It deliberately overlaps with index.ts. That file asserts intended behaviour; this one photographs
 * reality, including the edges nobody designed.
 *
 * IMPORTANT: these tests import the package by name, which resolves through `main` to `dist/`.
 * They validate the BUILT artifact, so run `yarn workspace @webex/common-timers build:src` before
 * trusting a green result after a source change.
 */
describe('common-timers characterization baseline', () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('platform handle handling', () => {
    // Real platform handles are required: sinon's fake timers expose unref() but no observable
    // ref state, so hasRef() on a genuine Node handle is the only proof the call landed.
    beforeEach(() => {
      clock.restore();
    });

    const wrappers = [
      {name: 'safeSetTimeout', schedule: safeSetTimeout, clear: clearTimeout, global: 'setTimeout'},
      {
        name: 'safeSetInterval',
        schedule: safeSetInterval,
        clear: clearInterval,
        global: 'setInterval',
      },
    ];

    wrappers.forEach(({name, schedule, clear, global: globalName}) => {
      it(`${name} returns the platform handle already unref-ed`, () => {
        const handle = schedule(() => {}, 10000) as NodeJS.Timeout;

        assert.isFalse(handle.hasRef());

        clear(handle);
      });

      it(`${name} returns a handle with no unref method unchanged`, () => {
        // A browser returns a plain number. The wrapper feature-detects rather than
        // assuming a Node handle, so this must pass through untouched.
        const browserHandle = 4242;
        const stub = sinon
          .stub(global, globalName as 'setTimeout')
          .returns(browserHandle as never);

        try {
          assert.equal(schedule(() => {}, 1000), browserHandle);
        } finally {
          stub.restore();
        }
      });
    });

    it('Timer unrefs the handle it schedules internally', () => {
      let scheduled;
      const realSetTimeout = global.setTimeout;
      const stub = sinon.stub(global, 'setTimeout').callsFake((...args) => {
        scheduled = realSetTimeout(...(args as Parameters<typeof setTimeout>));

        return scheduled;
      });

      try {
        const timer = new Timer(() => {}, 10000);
        timer.start();
        timer.cancel();
      } finally {
        stub.restore();
      }

      assert.isFalse(scheduled.hasRef());
    });
  });

  describe('argument forwarding', () => {
    it('safeSetTimeout forwards trailing arguments to the callback', () => {
      const callback = sinon.fake();
      const handle = safeSetTimeout(callback, 1000, 'first', 'second');

      clock.tick(1000);

      assert.calledOnceWithExactly(callback, 'first', 'second');

      clearTimeout(handle);
    });

    it('safeSetInterval forwards trailing arguments to the callback', () => {
      const callback = sinon.fake();
      const handle = safeSetInterval(callback, 1000, 'first', 'second');

      clock.tick(1000);

      assert.calledOnceWithExactly(callback, 'first', 'second');

      clearInterval(handle);
    });
  });

  describe('Timer lifecycle', () => {
    it('schedules nothing until start is called', () => {
      const callback = sinon.fake();

      // eslint-disable-next-line no-new
      new Timer(callback, 1000);
      clock.runAll();

      assert.notCalled(callback);
    });

    it('reset restarts the full timeout rather than the remaining time', () => {
      const callback = sinon.fake();
      const timer = new Timer(callback, 1000);

      timer.start();
      clock.tick(900);
      timer.reset();
      clock.tick(900);

      assert.notCalled(callback);

      clock.tick(100);

      assert.calledOnce(callback);
    });

    it('enters the done state before the caller callback runs', () => {
      // The class marks itself done first, so a callback that re-enters the timer always
      // observes a terminal timer rather than a running one.
      let observed;
      const timer = new Timer(() => {
        try {
          timer.start();
        } catch (error) {
          observed = error.message;
        }
      }, 1000);

      timer.start();
      clock.tick(1000);

      assert.equal(observed, "Can't start the timer when it's in done state");
    });

    it('rejects reset called from inside the expiry callback', () => {
      // The sharp edge every consumer must design around: an inbound event arriving after the
      // deadline cannot push it out, it throws. Consumers avoid this by tearing down their
      // listener inside the expiry callback.
      let observed;
      const timer = new Timer(() => {
        try {
          timer.reset();
        } catch (error) {
          observed = error.message;
        }
      }, 1000);

      timer.start();
      clock.tick(1000);

      assert.equal(observed, "Can't reset the timer when it's in done state");
    });
  });

  describe('Timer rejected transitions', () => {
    // The thrown strings are pinned exactly. Consumers log them and the suite matches them, so
    // the wording is part of the contract, not an implementation detail.
    const arrange = {
      init: () => new Timer(() => {}, 1000),
      running: () => {
        const timer = new Timer(() => {}, 1000);
        timer.start();

        return timer;
      },
      done: () => {
        const timer = new Timer(() => {}, 1000);
        timer.start();
        timer.cancel();

        return timer;
      },
    };

    const rejections = [
      {state: 'running', method: 'start', message: "Can't start the timer when it's in running state"},
      {state: 'done', method: 'start', message: "Can't start the timer when it's in done state"},
      {state: 'init', method: 'reset', message: "Can't reset the timer when it's in init state"},
      {state: 'done', method: 'reset', message: "Can't reset the timer when it's in done state"},
      {state: 'init', method: 'cancel', message: "Can't cancel the timer when it's in init state"},
      {state: 'done', method: 'cancel', message: "Can't cancel the timer when it's in done state"},
    ];

    rejections.forEach(({state, method, message}) => {
      it(`throws when ${method} is called in the ${state} state`, () => {
        const timer = arrange[state]();

        assert.throws(() => timer[method](), message);
      });
    });

    it('reaches the done state by expiry as well as by cancel', () => {
      const timer = new Timer(() => {}, 1000);

      timer.start();
      clock.tick(1000);

      // Expiry and cancellation are indistinguishable to a caller; both report done.
      assert.throws(() => timer.cancel(), "Can't cancel the timer when it's in done state");
    });
  });

  describe('Timer timeout argument', () => {
    // SUSPECTED-BUG: the constructor validates nothing. A class that throws on every invalid
    // state transition accepts any duration silently, so undefined, null, 0, a negative number,
    // and NaN all produce a timer that fires in about a millisecond. A numeric string such as
    // '5000' is coerced correctly, so only genuinely absent or invalid values collapse.
    //
    // This is reachable, not theoretical. Both Timer consumers read config.requestTimeout, and
    // plugin config is merged with lodash merge, which keeps a null supplied by the caller
    // instead of falling back to the default. A null from JSON or remote config therefore makes
    // every dss request reject with DssTimeoutError, and every ai-assistant request emit
    // AI_ASSISTANT_TIMEOUT, immediately — an error that names a timeout while the real cause is
    // a missing config value.
    //
    // TRIAGE DECISION 2026-09-24: fix-separately. The behaviour stays pinned here as current
    // reality. Validating the timeout is a breaking change for any caller relying on the
    // coercion, so it belongs in its own change with its own spec delta and review rather than
    // riding along with documentation work. Do not "fix" this by editing these assertions: if
    // validation lands, update this block deliberately in the same commit as the behaviour
    // change.
    const durations = [
      {name: 'undefined', value: undefined},
      {name: 'null', value: null},
      {name: 'a negative number', value: -1},
      {name: 'zero', value: 0},
      {name: 'NaN', value: NaN},
    ];

    durations.forEach(({name, value}) => {
      it(`fires almost immediately when the timeout is ${name}`, () => {
        const callback = sinon.fake();
        const timer = new Timer(callback, value as number);

        timer.start();
        clock.tick(1);

        assert.calledOnce(callback);
      });
    });
  });
});
