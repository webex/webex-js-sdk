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

         // Upload aws cmk and role
        await webex.internal.encryption.kms.uploadCustomerMasterKey({
          assignedOrgId: 'xx-sds-assdf',
          customerMasterKey: 'masterKey',
          awsKms: true,
          customerMasterKeyRole: 'role',
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
        assert.equal(spyStub.args[2][0].customerMasterKeyRole, 'role');
        assert.equal(spyStub.args[3][0].uri, '/awsKmsCmk');
        assert.equal(spyStub.args[3][0].customerMasterKeyBackup, 'masterKeyBackup');
        assert.equal(spyStub.args[4][0].uri, '/cmk');
        assert.equal(spyStub.args[4][0].customerMasterKeyBackup, undefined);
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

      describe('fetchKey', () => {
        let asKeyStub;

        beforeEach(() => {
          asKeyStub = sinon.stub(webex.internal.encryption.kms, 'asKey').resolves({
            jwk: {mockKey: 'data'},
            uri: 'test-key-uri',
          });
        });

        afterEach(() => {
          asKeyStub.restore();
        });

        it('should fetch key normally when no redirect is needed', async () => {
          const mockResponse = {
            key: {jwk: {mockKey: 'data'}},
            uri: 'test-key-uri',
          };

          spyStub.resolves(mockResponse);

          const result = await webex.internal.encryption.kms.fetchKey({
            uri: 'kms://test-kms.com/keys/test-key',
          });

          assert.calledOnce(spyStub);
          assert.calledWith(spyStub, {
            method: 'retrieve',
            uri: 'kms://test-kms.com/keys/test-key',
          });
          assert.calledOnce(asKeyStub);
          assert.equal(result.jwk.mockKey, 'data');
        });

        it('should handle redirect when errorCode is 301002', async () => {
          const redirectResponse = {
            errorCode: 301002,
            status: 301,
            requestId: '7ffba0b0-a5e8-497a-b856-e2b70e2eb92c',
            reason: 'KRO, Key or Auth has been migrated. Use redirectUri for future requests',
            redirectUri: 'kms://kms-afra.wbx2.com/keys/ce1ff0b8-fa2e-40bb-9a7f-bb36044ce1f4',
          };

          const finalResponse = {
            key: {jwk: {redirectedKey: 'data'}},
            uri: 'kms://kms-afra.wbx2.com/keys/ce1ff0b8-fa2e-40bb-9a7f-bb36044ce1f4',
          };

          spyStub.onFirstCall().resolves(redirectResponse);
          spyStub.onSecondCall().resolves(finalResponse);

          const result = await webex.internal.encryption.kms.fetchKey({
            uri: 'kms://test-kms.com/keys/old-key',
            onBehalfOf: 'user123',
          });

          assert.calledTwice(spyStub);

          // First call - original request
          assert.calledWith(
            spyStub.firstCall,
            {
              method: 'retrieve',
              uri: 'kms://test-kms.com/keys/old-key',
            },
            {onBehalfOf: 'user123'}
          );

          // Second call - redirect request
          assert.calledWith(
            spyStub.secondCall,
            {
              method: 'retrieve',
              uri: 'kms://kms-afra.wbx2.com/keys/ce1ff0b8-fa2e-40bb-9a7f-bb36044ce1f4',
            },
            {onBehalfOf: 'user123'}
          );

          assert.calledOnce(asKeyStub);
          assert.equal(result.jwk.mockKey, 'data');
        });

        it('should not redirect when errorCode is not 301002', async () => {
          const mockResponse = {
            errorCode: 400001,
            status: 400,
            key: {jwk: {mockKey: 'data'}},
            uri: 'test-key-uri',
          };

          spyStub.resolves(mockResponse);

          const result = await webex.internal.encryption.kms.fetchKey({
            uri: 'kms://test-kms.com/keys/test-key',
          });

          assert.calledOnce(spyStub);
          assert.calledOnce(asKeyStub);
          assert.equal(result.jwk.mockKey, 'data');
        });

        it('should not redirect when redirectUri is missing', async () => {
          const mockResponse = {
            errorCode: 301002,
            status: 301,
            key: {jwk: {mockKey: 'data'}},
            uri: 'test-key-uri',
          };

          spyStub.resolves(mockResponse);

          const result = await webex.internal.encryption.kms.fetchKey({
            uri: 'kms://test-kms.com/keys/test-key',
          });

          assert.calledOnce(spyStub);
          assert.calledOnce(asKeyStub);
          assert.equal(result.jwk.mockKey, 'data');
        });

        it('should reject when uri is not provided', async () => {
          try {
            await webex.internal.encryption.kms.fetchKey({});
            assert.fail('Should have thrown an error');
          } catch (error) {
            assert.equal(error.message, '`options.uri` is required');
          }
        });
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
