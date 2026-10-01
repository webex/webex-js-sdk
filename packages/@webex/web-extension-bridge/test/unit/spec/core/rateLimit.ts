import {assert} from '@webex/test-helper-chai';

import {InFlightLimiter, RateLimiter, rateLimitKey} from '../../../../src/core/rateLimit';

describe('core/rateLimit', () => {
  describe('RateLimiter', () => {
    let now: number;
    const clock = () => now;

    beforeEach(() => {
      now = 0;
    });

    it('allows a burst up to capacity, then denies', () => {
      const limiter = new RateLimiter({perSecond: 3, now: clock});

      assert.isTrue(limiter.allow('k'));
      assert.isTrue(limiter.allow('k'));
      assert.isTrue(limiter.allow('k'));
      assert.isFalse(limiter.allow('k'));
    });

    it('refills over time', () => {
      const limiter = new RateLimiter({perSecond: 2, now: clock});

      assert.isTrue(limiter.allow('k'));
      assert.isTrue(limiter.allow('k'));
      assert.isFalse(limiter.allow('k'));

      now += 500;
      assert.isTrue(limiter.allow('k'));
      assert.isFalse(limiter.allow('k'));
    });

    it('never refills above capacity', () => {
      const limiter = new RateLimiter({perSecond: 2, now: clock});

      assert.isTrue(limiter.allow('k'));
      now += 60000;

      assert.isTrue(limiter.allow('k'));
      assert.isTrue(limiter.allow('k'));
      assert.isFalse(limiter.allow('k'));
    });

    it('keeps refilling while being hammered', () => {
      const limiter = new RateLimiter({perSecond: 1, now: clock});

      assert.isTrue(limiter.allow('k'));

      for (let attempt = 0; attempt < 20; attempt += 1) {
        assert.isFalse(limiter.allow('k'));
      }

      now += 1000;
      assert.isTrue(limiter.allow('k'));
    });

    it('tracks keys independently', () => {
      const limiter = new RateLimiter({perSecond: 1, now: clock});

      assert.isTrue(limiter.allow('a'));
      assert.isFalse(limiter.allow('a'));
      assert.isTrue(limiter.allow('b'));
    });

    it('bounds the key map, so cycling topics cannot grow it', () => {
      const limiter = new RateLimiter({perSecond: 5, maxKeys: 4, now: clock});

      for (let index = 0; index < 1000; index += 1) {
        limiter.allow(`topic-${index}`);
      }

      assert.isAtMost(limiter.size, 4);
    });

    it('refuses a nonsensical rate rather than clamping it', () => {
      // Clamping was the bug. `Math.max(NaN, 1)` is `NaN`, every `tokens < 1` test
      // against `NaN` is false, and the limiter silently fails open — which is the one
      // failure mode a rate limiter must not have.
      assert.throws(() => new RateLimiter({perSecond: 0, now: clock}), /between 1 and/);
      assert.throws(() => new RateLimiter({perSecond: Number.NaN, now: clock}), /finite integer/);
      assert.throws(
        () => new RateLimiter({perSecond: Number.POSITIVE_INFINITY, now: clock}),
        /finite integer/
      );
      assert.throws(() => new RateLimiter({perSecond: 2.5, now: clock}), /finite integer/);
      assert.throws(() => new RateLimiter({perSecond: -1, now: clock}), /between 1 and/);
    });

    it('does not fail open for a NaN rate', () => {
      // The regression this guards: before the fix, `new RateLimiter({perSecond: NaN})`
      // constructed happily and then allowed every message for ever.
      let constructed = false;

      try {
        // eslint-disable-next-line no-new
        new RateLimiter({perSecond: Number.NaN, now: clock});
        constructed = true;
      } catch {
        constructed = false;
      }

      assert.isFalse(constructed);
    });

    it('resets', () => {
      const limiter = new RateLimiter({perSecond: 1, now: clock});

      limiter.allow('k');
      limiter.reset();

      assert.equal(limiter.size, 0);
      assert.isTrue(limiter.allow('k'));
    });
  });

  describe('rateLimitKey', () => {
    it('separates tab and topic with a character no topic may contain', () => {
      assert.equal(rateLimitKey(7, 'demo'), '7\u0000demo');
      assert.equal(rateLimitKey(undefined, 'demo'), 'unknown\u0000demo');
    });

    it('cannot be forged by a crafted topic, since the separator is not in the charset', () => {
      assert.notEqual(rateLimitKey(1, '2\u0000demo'), rateLimitKey(1, '2'));
    });
  });

  describe('InFlightLimiter', () => {
    it('caps concurrency per tab', () => {
      const limiter = new InFlightLimiter({max: 2});

      assert.isTrue(limiter.acquire(1));
      assert.isTrue(limiter.acquire(1));
      assert.isFalse(limiter.acquire(1));
      assert.equal(limiter.count(1), 2);
    });

    it('counts tabs independently', () => {
      const limiter = new InFlightLimiter({max: 1});

      assert.isTrue(limiter.acquire(1));
      assert.isTrue(limiter.acquire(2));
    });

    it('frees slots on release', () => {
      const limiter = new InFlightLimiter({max: 1});

      limiter.acquire(1);
      limiter.release(1);

      assert.equal(limiter.count(1), 0);
      assert.isTrue(limiter.acquire(1));
    });

    it('drops the whole tab on releaseAll', () => {
      const limiter = new InFlightLimiter({max: 5});

      limiter.acquire(1);
      limiter.acquire(1);
      limiter.releaseAll(1);

      assert.equal(limiter.count(1), 0);
    });

    it('does not go negative when released more often than acquired', () => {
      const limiter = new InFlightLimiter({max: 1});

      limiter.release(1);
      limiter.release(1);

      assert.equal(limiter.count(1), 0);
      assert.isTrue(limiter.acquire(1));
      assert.isFalse(limiter.acquire(1));
    });
  });
});
