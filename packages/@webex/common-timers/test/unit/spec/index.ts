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