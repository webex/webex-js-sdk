import BreakoutEditLockedError from '@webex/plugin-meetings/src/breakouts/edit-lock-error';
import {assert, expect} from '@webex/test-helper-chai';
import {ERROR_DICTIONARY} from '@webex/plugin-meetings/src/constants';
import {BREAKOUTS} from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
    describe('edit-lock-error', () => {
        it('check constructor paramter', () => {
            const result = new BreakoutEditLockedError();
            assert.equal(result.name, ERROR_DICTIONARY.BREAKOUT_EDIT.NAME);
            assert.equal(result.sdkMessage, ERROR_DICTIONARY.BREAKOUT_EDIT.MESSAGE);
            assert.equal(result.code, ERROR_DICTIONARY.BREAKOUT_EDIT.CODE);
            assert.equal(result.error, null);
        });

        it('check constructor paramter', () => {
            const fakeError = {
                body: {
                  "errorCode":BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
                  "message":"Edit lock token mismatch"
                }
              };
            const result = new BreakoutEditLockedError('message', fakeError);
            assert.equal(result.name, ERROR_DICTIONARY.BREAKOUT_EDIT.NAME);
            assert.equal(result.sdkMessage, ERROR_DICTIONARY.BREAKOUT_EDIT.MESSAGE);
            assert.equal(result.code, ERROR_DICTIONARY.BREAKOUT_EDIT.CODE);
            assert.equal(result.error, fakeError);
        });
    });
});