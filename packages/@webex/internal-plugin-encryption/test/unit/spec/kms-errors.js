import {assert} from '@webex/test-helper-chai';
import {handleKmsKeyRevokedEncryptionFailure} from '../../../src/kms-errors'
import sinon from 'sinon';

describe('handleKmsKeyRevokedEncryptionFailure', () => {

    it('triggers `event:kms:key:revoke:encryption:failure` event when correct error code is detected', () => {
        const webex = {
            internal: {
                encryption: {
                trigger: sinon.spy()
              },
            },
          }

        const item = {
            status: 405,
            body: {
                errorCode: 405005,
            }
        }

        handleKmsKeyRevokedEncryptionFailure(item, webex);
        
        assert.calledOnce(webex.internal.encryption.trigger);
        assert.calledWithExactly(webex.internal.encryption.trigger, `event:kms:key:revoke:encryption:failure`);
    });

    it('does not trigger `event:kms:key:revoke:encryption:failure` event when correct status but wrong error code is detected', () => {
        const webex = {
            internal: {
                encryption: {
                trigger: sinon.spy()
              },
            },
          }

        const item = {
            status: 405,
            body: {
                errorCode: 405009,
            }
        }

        handleKmsKeyRevokedEncryptionFailure(item, webex);
         
        assert.notCalled(webex.internal.encryption.trigger);
       });

       it('does not trigger `event:kms:key:revoke:encryption:failure` event when wrong status but correct error code is detected', () => {
        const webex = {
            internal: {
                encryption: {
                trigger: sinon.spy()
              },
            },
          }

        const item = {
            status: 403,
            body: {
                errorCode: 405005,
            }
        }

        handleKmsKeyRevokedEncryptionFailure(item, webex);
         
        assert.notCalled(webex.internal.encryption.trigger);
       });
});