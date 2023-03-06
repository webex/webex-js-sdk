import {assert} from '@webex/test-helper-chai';
import {getBroadcastRoles, boServiceErrorHandler} from '@webex/plugin-meetings/src/breakouts/utils';
import BreakoutEditLockedError from '../../../../src/breakouts/edit-lock-error';
import {BREAKOUTS} from '../../../../src/constants';

describe('plugin-meetings', () => {
  describe('Breakouts utils', () => {
    describe('#getBroadcastRoles', () => {
      it('return expect roles', () => {
        let roles = getBroadcastRoles();
        assert.deepEqual(roles, []);

        roles = getBroadcastRoles({cohosts: true});
        assert.deepEqual(roles, ['COHOST']);

        roles = getBroadcastRoles({presenters: true});
        assert.deepEqual(roles, ['PRESENTER']);

        roles = getBroadcastRoles({presenters: true, cohosts: true});
        assert.deepEqual(roles, ['COHOST', 'PRESENTER']);
      });
    });
    describe('#boServiceErrorHandler', () => {
      it('return handled breakout service errors', () => {
        // normal error
        const errorMessage = 'Something was wrong.';
        let handledError = boServiceErrorHandler(new Error(errorMessage));
        assert.deepEqual(handledError, handledError);
        assert.equal(handledError.message, errorMessage);

        // undefined
        handledError = boServiceErrorHandler();
        assert.equal(handledError, undefined);

        //Edit lock token mismatch error
        const tokenMismatchError = {
          body: {errorCode: BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH},
        };
        handledError = boServiceErrorHandler(tokenMismatchError);
        assert.deepEqual(
          handledError,
          new BreakoutEditLockedError('Edit lock token mismatch', tokenMismatchError)
        );
      });
    });
  });
});
