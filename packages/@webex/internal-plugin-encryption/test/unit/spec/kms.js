/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Encryption from '@webex/internal-plugin-encryption';
import {KmsError} from '../../../dist/kms-errors';

describe('internal-plugin-encryption', () => {
  describe('kms', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          encryption: Encryption,
        },
      });
    });

    describe('key management', () => {
      const options = undefined;
      let spyStub;

      beforeEach(() => {
        const returnStub = (obj) => Promise.resolve(obj);

        spyStub = sinon.stub(webex.internal.encryption.kms, 'request').callsFake(returnStub);
      });

      afterEach(() => {
        spyStub.resetHistory();
      });

      it('listAllCustomerMasterKey', async () => {
        await webex.internal.encryption.kms.listAllCustomerMasterKey({
          assignedOrgId: 'xx-sds-assdf',
          awsKms: false,
        });

        await webex.internal.encryption.kms.listAllCustomerMasterKey({
          assignedOrgId: 'xx-sds-assdf',
          awsKms: true,
        });

        assert.equal(spyStub.args[0][0].uri, '/cmk');
        assert.equal(spyStub.args[1][0].uri, '/awsKmsCmk');
      });

      it('uploadCustomerMasterKey without backup', async () => {
        await webex.internal.encryption.kms.uploadCustomerMasterKey({
          assignedOrgId: 'xx-sds-assdf',
          awsKms: false,
        });

        await webex.internal.encryption.kms.uploadCustomerMasterKey({
          assignedOrgId: 'xx-sds-assdf',
          customerMasterKey: 'masterKey',
          awsKms: true,
        });

        // Upload backup cmk for aws
        await webex.internal.encryption.kms.uploadCustomerMasterKey({
          assignedOrgId: 'xx-sds-assdf',
          customerMasterKey: 'masterKey',
          awsKms: true,
          customerMasterKeyBackup: 'masterKeyBackup',
        });

        // Ensures backup cmd is undefined for non-aws
        await webex.internal.encryption.kms.uploadCustomerMasterKey({
          assignedOrgId: 'xx-sds-assdf',
          customerMasterKey: 'masterKey',
          customerMasterKeyBackup: 'masterKeyBackup',
        });

        assert.equal(spyStub.args[0][0].uri, '/cmk');
        assert.equal(spyStub.args[1][0].uri, '/awsKmsCmk');
        assert.equal(spyStub.args[1][0].customerMasterKeyBackup, undefined);
        assert.equal(spyStub.args[2][0].uri, '/awsKmsCmk');
        assert.equal(spyStub.args[2][0].customerMasterKeyBackup, 'masterKeyBackup');
        assert.equal(spyStub.args[3][0].uri, '/cmk');
        assert.equal(spyStub.args[3][0].customerMasterKeyBackup, undefined);
      });

      it('deleteAllCustomerMasterKeys', async () => {
        await webex.internal.encryption.kms.deleteAllCustomerMasterKeys({
          assignedOrgId: 'xx-sds-assdf',
          awsKms: false,
        });

        await webex.internal.encryption.kms.deleteAllCustomerMasterKeys({
          assignedOrgId: 'xx-sds-assdf',
          awsKms: true,
        });

        assert.equal(spyStub.args[0][0].uri, '/cmk');
        assert.equal(spyStub.args[1][0].uri, '/awsKmsCmk');
      });
    });

    describe('KMS error', () => {
      it('KMSError', async () => {
        const error = new KmsError({
          status: 404,
          errorCode: 30005,
          reason: 'cannot fetch keys',
          requestId: '3434343',
        });
        assert.equal(
          error.toString(),
          'KmsError: cannot fetch keys\n' +
            'KMS_RESPONSE_STATUS: 404\n' +
            'KMS_REQUEST_ID: 3434343\n' +
            'KMS_ErrorCode: 30005'
        );
      });
    });
  });
});
