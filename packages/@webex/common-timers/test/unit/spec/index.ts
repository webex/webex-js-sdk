import {assert} from '@webex/test-helper-chai';
import { Timer, safeSetTimeout, safeSetInterval } from "@webex/common-timers";
import sinon from 'sinon';

describe("commonn timers", () => {
  let clock

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  })
  afterEach(() => {
    clock.restore();
  })

  describe("safeSetTimeout", () => {
    it("should call the callback when the timer expired", () => {
      const callback = sinon.fake();
      const timer = safeSetTimeout(callback, 1000)
      clock.runAll()
      assert.calledOnce(callback)

      clearTimeout(timer)
    });
  });

  describe("safeSetInterval", () => {
    it("should start in an interval", () => {
      const callback = sinon.fake();
      const timer = safeSetInterval(callback, 1000)
      clock.tick(2000)
      assert.calledTwice(callback)

      clearInterval(timer)
    });
  });

  describe("unref behaviour", () => {
    // These tests need real platform handles. Sinon's fake timers expose an unref()
    // method but no observable ref state, so hasRef() on a genuine Node handle is the
    // only way to prove the call actually landed.
    beforeEach(() => {
      clock.restore();
    });

    const wrappers = [
      {name: "safeSetTimeout", schedule: safeSetTimeout, clear: clearTimeout, global: "setTimeout"},
      {name: "safeSetInterval", schedule: safeSetInterval, clear: clearInterval, global: "setInterval"},
    ];

    wrappers.forEach(({name, schedule, clear, global: globalName}) => {
      it(`should unref the handle returned by ${name}`, () => {
        const timer = schedule(() => {}, 10000) as NodeJS.Timeout;

        assert.isFalse(timer.hasRef());

        clear(timer);
      });

      it(`should return a handle without unref unchanged from ${name}`, () => {
        // Browsers return a plain number with no unref method; the wrapper must
        // feature-detect rather than assume a Node handle.
        const browserHandle = 4242;
        const stub = sinon.stub(global, globalName as 'setTimeout').returns(browserHandle as never);

        try {
          assert.equal(schedule(() => {}, 1000), browserHandle);
        } finally {
          stub.restore();
        }
      });
    });

    it("should unref the handle Timer schedules internally", () => {
      let scheduled;
      const realSetTimeout = global.setTimeout;
      const stub = sinon
        .stub(global, 'setTimeout')
        .callsFake((...args) => {
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

  describe("Timer", () => {

    describe("start method", () => {
      it("should call the callback function when the timer expired", () => {
        const callback = sinon.fake();
        const timer = new Timer(callback, 1)
        timer.start();
        clock.runAll()
        assert.calledOnce(callback)
      });

      it("should throw error when start called more than once", () => {
        const timer = new Timer(() => {}, 1000)
        timer.start();

        assert.throws(() => timer.start(), /Can't start the timer when it's in running state/i);
        timer.cancel();
      });

      it("should throw error when start called after reset", () => {
        const timer = new Timer(() => {}, 1000)
        timer.start();
        timer.reset();

        assert.throws(() => timer.start(), /Can't start the timer when it's in running state/i);
        timer.cancel();
      });

      it("should throw error when start called after timer canceled", () => {
        const timer = new Timer(() => {}, 1000)
        timer.start();
        timer.cancel();

        assert.throws(() => timer.start(), /Can't start the timer when it's in done state/i);
      });

      it("should throw error when start called after timer finished", () => {
        const timer = new Timer(() => {}, 1000)
        timer.start();
        clock.runAll()

        assert.throws(() => timer.start(), /Can't start the timer when it's in done state/i);
      });
    });

    describe("reset method", () => {
      it("should reset the timer", () => {
        const callback = sinon.fake();
        const timer = new Timer(callback, 1000)
        timer.start();
        clock.tick(500)
        timer.reset();
        clock.tick(500)
        assert.notCalled(callback)
        clock.tick(500)
        assert.calledOnce(callback)
      });

      it("should throw error when reset called before start", () => {
        const timer = new Timer(() => {}, 1000)

        assert.throws(() => timer.reset(), /Can't reset the timer when it's in init state/i);
      });

      it("should throw error when reset called after cancel", () => {
        const timer = new Timer(() => {}, 1000)
        timer.start();
        timer.cancel();

        assert.throws(() => timer.reset(), /Can't reset the timer when it's in done state/i);
      });
    });

    describe("cancel method", () => {
      it("should stop the timer", () => {
        const callback = sinon.fake();
        const timer = new Timer(callback, 1)
        timer.start();
        timer.cancel();
        clock.runAll()
        assert.notCalled(callback)
      });

      it("should throw error when cancel called before start", () => {
        const timer = new Timer(() => {}, 1000)

        assert.throws(() => timer.cancel(), /Can't cancel the timer when it's in init state/i);
      });

      it("should throw error when cancel called more than once", () => {
        const timer = new Timer(() => {}, 1000)
        timer.start();
        timer.cancel();

        assert.throws(() => timer.cancel(), /Can't cancel the timer when it's in done state/i);
      });

    });
  });
});