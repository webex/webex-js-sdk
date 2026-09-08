import {assert} from '@webex/test-helper-chai';

import {CLOCK_SKEW_TOLERANCE_MS} from '../../../../src/core/constants';
import {SeenIds, isWithinClockSkew} from '../../../../src/core/replay';

describe('core/replay', () => {
  describe('SeenIds', () => {
    let now: number;
    const clock = () => now;

    beforeEach(() => {
      now = 1000;
    });

    it('accepts an id once', () => {
      const seen = new SeenIds({now: clock});

      assert.isTrue(seen.accept('a'));
      assert.isFalse(seen.accept('a'));
      assert.isTrue(seen.has('a'));
    });

    it('evicts the oldest entry past the size cap', () => {
      const seen = new SeenIds({maxEntries: 3, now: clock});

      ['a', 'b', 'c', 'd'].forEach((id) => seen.accept(id));

      assert.equal(seen.size, 3);
      assert.isFalse(seen.has('a'));
      assert.isTrue(seen.has('d'));
      // The evicted id is accepted again: the size cap trades a narrow replay window
      // for a bounded memory footprint.
      assert.isTrue(seen.accept('a'));
    });

    it('expires entries once the TTL has passed', () => {
      const seen = new SeenIds({ttlMs: 100, now: clock});

      seen.accept('a');
      now += 99;
      assert.isFalse(seen.accept('a'));

      now += 2;
      assert.isTrue(seen.accept('a'));
    });

    it('expires older entries without dropping younger ones', () => {
      const seen = new SeenIds({ttlMs: 100, now: clock});

      seen.accept('old');
      now += 60;
      seen.accept('young');
      now += 50;

      assert.isTrue(seen.accept('old'));
      assert.isFalse(seen.accept('young'));
    });

    it('clears on demand', () => {
      const seen = new SeenIds({now: clock});

      seen.accept('a');
      seen.clear();

      assert.equal(seen.size, 0);
      assert.isTrue(seen.accept('a'));
    });

    it('stays bounded under a flood of distinct ids', () => {
      const seen = new SeenIds({maxEntries: 10, now: clock});

      for (let index = 0; index < 5000; index += 1) {
        seen.accept(`id-${index}`);
      }

      assert.equal(seen.size, 10);
    });
  });

  describe('isWithinClockSkew', () => {
    const now = 5000000;

    [
      {name: 'now', ts: now, expected: true},
      {name: 'the past edge', ts: now - CLOCK_SKEW_TOLERANCE_MS, expected: true},
      {name: 'the future edge', ts: now + CLOCK_SKEW_TOLERANCE_MS, expected: true},
      {name: 'just past the past edge', ts: now - CLOCK_SKEW_TOLERANCE_MS - 1, expected: false},
      {name: 'just past the future edge', ts: now + CLOCK_SKEW_TOLERANCE_MS + 1, expected: false},
      {name: 'zero', ts: 0, expected: false},
      {name: 'NaN', ts: NaN, expected: false},
      {name: 'Infinity', ts: Infinity, expected: false},
      {name: 'a string', ts: String(now), expected: false},
      {name: 'undefined', ts: undefined, expected: false},
      {name: 'null', ts: null, expected: false},
    ].forEach(({name, ts, expected}) => {
      it(`${expected ? 'accepts' : 'rejects'} ${name}`, () => {
        assert.equal(isWithinClockSkew(ts, now), expected);
      });
    });

    it('honours a custom tolerance', () => {
      assert.isTrue(isWithinClockSkew(now - 5, now, 5));
      assert.isFalse(isWithinClockSkew(now - 6, now, 5));
    });
  });
});
