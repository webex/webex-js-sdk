import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {getBroadcastRoles, boServiceErrorHandler, isSessionTypeChangedFromSessionToMain} from '@webex/plugin-meetings/src/breakouts/utils';
import BreakoutEditLockedError from '../../../../src/breakouts/edit-lock-error';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
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

        LoggerProxy.logger.info = sinon.stub();
        //Edit lock token mismatch error
        const tokenMismatchError = {
          body: {errorCode: BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH},
        };
        handledError = boServiceErrorHandler(tokenMismatchError, 'position');
        assert.deepEqual(
          handledError,
          new BreakoutEditLockedError('Edit lock token mismatch', tokenMismatchError)
        );
        assert.calledOnceWithExactly(
          LoggerProxy.logger.info,
          'position --> Edit lock token mismatch',
        );
      });
    });

    describe('#isSessionTypeChangedFromSessionToMain', () => {
      it('returns false previous is not BREAKOUT', () => {
        const breakout = {previous: sinon.stub().returns(BREAKOUTS.SESSION_TYPES.MAIN)};
        assert.equal(isSessionTypeChangedFromSessionToMain(breakout, BREAKOUTS.SESSION_TYPES.MAIN), false);
        assert.equal(isSessionTypeChangedFromSessionToMain(breakout, BREAKOUTS.SESSION_TYPES.BREAKOUT), false);
      });

      it('returns false newSessionType is not MAIN', () => {
        const breakout = {previous: sinon.stub().returns(BREAKOUTS.SESSION_TYPES.BREAKOUT)};
        assert.equal(isSessionTypeChangedFromSessionToMain(breakout, BREAKOUTS.SESSION_TYPES.BREAKOUT), false);
      });

      it('returns true previous is BREAKOUT and newSessionType is MAIN', () => {
        const breakout = {previous: sinon.stub().returns(BREAKOUTS.SESSION_TYPES.BREAKOUT)};
        assert.equal(isSessionTypeChangedFromSessionToMain(breakout, BREAKOUTS.SESSION_TYPES.MAIN), true);
      });
    })
  });
});
