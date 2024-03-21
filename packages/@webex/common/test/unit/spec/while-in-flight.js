/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Defer, whileInFlight} from '@webex/common';
import AmpState from 'ampersand-state';
import {assert} from '@webex/test-helper-chai';

describe('common', () => {
  describe('@whileInFlight()', () => {
    const State = AmpState.extend({
      session: {
        isSucceeding: {
          default: false,
          type: 'boolean',
        },
        isFailing: {
          default: false,
          type: 'boolean',
        },
        success: {
          default() {
            return new Defer();
          },
          type: 'any',
        },
        failure: {
          default() {
            return new Defer();
          },
          type: 'any',
        },
      },

      @whileInFlight('isSucceeding')
      willSucceed() {
        return this.success.promise;
      },

      @whileInFlight('isFailing')
      willFail() {
        return this.failure.promise;
      },
    });

    it('sets the specified param to true while the decorated function is in flight', () => {
      const s = new State();

      assert.isFalse(s.isSucceeding);
      const ps = s.willSucceed();

      assert.isTrue(s.isSucceeding);
      s.success.resolve();

      return ps.then(() => assert.isFalse(s.isSucceeding));
    });

    it('sets the specified param back to false even when the decorated function fails', () => {
      const s = new State();

      assert.isFalse(s.isFailing);
      const ps = s.willFail();

      assert.isTrue(s.isFailing);
      s.failure.reject(new Error('fail'));

      return assert.isRejected(ps).then(() => assert.isFalse(s.isFailing));
    });
  });
});
