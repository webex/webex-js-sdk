import {assert} from '@webex/test-helper-chai';

import {
  DEFAULT_MAX_PAYLOAD_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_PAYLOAD_BYTES_CEILING,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
} from '../../../../src/core/constants';
import {clampMaxPayloadBytes, clampTimeoutMs} from '../../../../src/core/limits';

describe('core/limits', () => {
  describe('clampMaxPayloadBytes', () => {
    [
      {name: 'undefined', input: undefined, expected: DEFAULT_MAX_PAYLOAD_BYTES},
      {name: 'a sane value', input: 1024, expected: 1024},
      {name: 'a fractional value', input: 1024.9, expected: 1024},
      {name: 'zero', input: 0, expected: 1},
      {name: 'a negative value', input: -5, expected: 1},
      {name: 'above the ceiling', input: MAX_PAYLOAD_BYTES_CEILING * 10, expected: MAX_PAYLOAD_BYTES_CEILING},
      {name: 'Infinity', input: Infinity, expected: DEFAULT_MAX_PAYLOAD_BYTES},
      {name: 'NaN', input: NaN, expected: DEFAULT_MAX_PAYLOAD_BYTES},
      {name: 'a string', input: '2048' as never, expected: DEFAULT_MAX_PAYLOAD_BYTES},
    ].forEach(({name, input, expected}) => {
      it(`maps ${name} to ${expected}`, () => {
        assert.equal(clampMaxPayloadBytes(input), expected);
      });
    });

    it('cannot be disabled', () => {
      assert.isAtMost(clampMaxPayloadBytes(Number.MAX_SAFE_INTEGER), MAX_PAYLOAD_BYTES_CEILING);
      assert.isAtLeast(clampMaxPayloadBytes(-1), 1);
    });
  });

  describe('clampTimeoutMs', () => {
    [
      {name: 'undefined', input: undefined, expected: DEFAULT_TIMEOUT_MS},
      {name: 'a sane value', input: 2500, expected: 2500},
      {name: 'below the floor', input: 1, expected: MIN_TIMEOUT_MS},
      {name: 'zero', input: 0, expected: MIN_TIMEOUT_MS},
      {name: 'a negative value', input: -1000, expected: MIN_TIMEOUT_MS},
      {name: 'above the ceiling', input: 600000, expected: MAX_TIMEOUT_MS},
      {name: 'Infinity', input: Infinity, expected: DEFAULT_TIMEOUT_MS},
      {name: 'NaN', input: NaN, expected: DEFAULT_TIMEOUT_MS},
    ].forEach(({name, input, expected}) => {
      it(`maps ${name} to ${expected}`, () => {
        assert.equal(clampTimeoutMs(input), expected);
      });
    });

    it('offers no way to wait forever', () => {
      assert.isAtMost(clampTimeoutMs(Infinity), MAX_TIMEOUT_MS);
      assert.isAtMost(clampTimeoutMs(Number.MAX_SAFE_INTEGER), MAX_TIMEOUT_MS);
    });
  });
});
