/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {decodeState, encodeState} from '@webex/common';

describe('oauth-state', () => {
  describe('encodeState() / decodeState()', () => {
    it('round-trips a typical state object', () => {
      const state = {csrf_token: 'abc123', provider: 'google', returnURL: '/app'};

      assert.deepEqual(decodeState(encodeState(state)), state);
    });

    it('round-trips an empty object', () => {
      assert.deepEqual(decodeState(encodeState({})), {});
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
