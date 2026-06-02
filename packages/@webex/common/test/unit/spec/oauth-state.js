/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {decodeState, encodeState} from '@webex/common';

describe('oauth-state', () => {
  describe('encodeState() / decodeState()', () => {
    it('encodeState produces the expected base64url string', () => {
      const encoded = encodeState({csrf_token: 'abc'});

      assert.equal(encoded, 'eyJjc3JmX3Rva2VuIjoiYWJjIn0');
      assert.notInclude(encoded, '+');
      assert.notInclude(encoded, '/');
      assert.notInclude(encoded, '=');
    });

    it('encodeState produces the expected base64url string for an empty object', () => {
      const encoded = encodeState({});

      assert.equal(encoded, 'e30');
      assert.notInclude(encoded, '+');
      assert.notInclude(encoded, '/');
      assert.notInclude(encoded, '=');
    });

    it('decodeState parses a known base64url string', () => {
      assert.deepEqual(decodeState('eyJjc3JmX3Rva2VuIjoiYWJjIn0'), {csrf_token: 'abc'});
    });

    it('decodeState parses an empty-object encoding', () => {
      assert.deepEqual(decodeState('e30'), {});
    });

    it('round-trips a typical state object', () => {
      const state = {csrf_token: 'abc123', provider: 'google', returnURL: '/app'};
      const encoded = encodeState(state);

      assert.notInclude(encoded, '+');
      assert.notInclude(encoded, '/');
      assert.notInclude(encoded, '=');
      assert.deepEqual(decodeState(encoded), state);
    });

    it('round-trips an empty object', () => {
      const encoded = encodeState({});

      assert.notInclude(encoded, '+');
      assert.notInclude(encoded, '/');
      assert.notInclude(encoded, '=');
      assert.deepEqual(decodeState(encoded), {});
    });

    it('produces a url-safe encoding (no +, /, or = padding)', () => {
      // Inputs chosen so the resulting bytes would include +, / and padding under
      // standard base64.
      const encoded = encodeState({a: '???>>>'});

      assert.notInclude(encoded, '+');
      assert.notInclude(encoded, '/');
      assert.notInclude(encoded, '=');
    });

    it('throws when decoding invalid input', () => {
      assert.throws(() => decodeState('not-valid-base64-json'));
    });
  });
});
