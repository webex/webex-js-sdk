/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */
import fs from 'fs';
import path from 'path';

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Encryption from '@webex/internal-plugin-encryption';
import {KmsError, KmsTimeoutError} from '../../../dist/kms-errors';
import {UNION_BUNDLE_ASSET} from '../../../dist/union-bundle';

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

    describe('_validateKMSStaticPubKey', () => {
      // Real CA root that signed the `x5c` certificate below.
      const caroots = [
        'MIID6TCCAtGgAwIBAgIURmBu688C9oUIJXlykr1J3fi5H4kwDQYJKoZIhvcNAQELBQAwgYMxCzAJBgNVBAYTAlVTMREwDwYDVQQIDAhDb2xvcmFkbzEPMA0GA1UEBwwGRGVudmVyMRAwDgYDVQQKDAdFeGFtcGxlMR8wHQYDVQQDDBZodHRwczovL2NhLmV4YW1wbGUuY29tMR0wGwYJKoZIhvcNAQkBFg5jYUBleGFtcGxlLmNvbTAeFw0yMDAyMDYyMDIyMDhaFw00MDAyMDEyMDIyMDhaMIGDMQswCQYDVQQGEwJVUzERMA8GA1UECAwIQ29sb3JhZG8xDzANBgNVBAcMBkRlbnZlcjEQMA4GA1UECgwHRXhhbXBsZTEfMB0GA1UEAwwWaHR0cHM6Ly9jYS5leGFtcGxlLmNvbTEdMBsGCSqGSIb3DQEJARYOY2FAZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7TaDWldwjU65y4fnNDIuNu4dZi3bZvaN9nJ3A8D9pwFcNx3DL5cPpafAkJuE/2ZBrsZxJWKwXLQFuNE9V3XVslv0OPgEZVfY5AKuPhVezRqEqsCdUgODMkJat6PE02r0NZRFpBiRCThh0wY5u/tiTiPgjHwEPhBEyLgcJ6FOWLn9wBsS4SvBzfppYGL5GW1G0eN9yORnKKgqkgyf0x8FvTMyVSjtkhcI/kA/8061sl4DFG6sefQmAOVvH7tp7YmN+jpQ7cOKQtjOpZS6Gp22u7LEI0/qb5n2QvjjcUQM81mN6CZ8nciWXRgjBhdAJJhmyMvcx8rnVb6vtU26fCaetAgMBAAGjUzBRMB0GA1UdDgQWBBRZiCyKaTYL94gwhxzktYg32qMOYjAfBgNVHSMEGDAWgBRZiCyKaTYL94gwhxzktYg32qMOYjAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQATa2QkTGcj8IPjItnvg23ihlRjHdFHn6lB7uYPhcDurwRlBrlC2/OB44P3dHB9tEPbV4unoF9ftEKO3nNY3HUDcPrQwRqkPftlYYr4/6z/jnmNBRgiDICVaiTZNlX54fLiPsSAbIymPWLLLNtq17vjVEcfGUXhi/F+EkN/uXZ4yH6RK0YjBRwPV9cfziz1YsF2WVYVYtQErf+NTjnYR5S4Ba2kEqhI5j7mNhiafPNODaOchHcaRMvfWcBhlHt+atwNyPxNr4NP+cDjAWg0I8xAUdbZGQiRJecjkctolLHsfZXj+ulEv3eaKw7gSo3Aekexw8aZS7soy+VM1fzmLopw',
      ];
      // Unrelated self-signed CA that does NOT sign the `x5c` certificate.
      const unrelatedCaroots = [
        'MIIFmTCCA4GgAwIBAgIUOxbqWoC/R0Lt2eWgqE3960xTLE4wDQYJKoZIhvcNAQELBQAwXDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNPMQ8wDQYDVQQHDAZEZW52ZXIxFTATBgNVBAoMDEV4YW1wbGUgSW5jLjEYMBYGA1UEAwwPa21zLmV4YW1wbGUuY29tMB4XDTIwMDIxMTIwMjk0NVoXDTQwMDIwNjIwMjk0NVowXDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNPMQ8wDQYDVQQHDAZEZW52ZXIxFTATBgNVBAoMDEV4YW1wbGUgSW5jLjEYMBYGA1UEAwwPa21zLmV4YW1wbGUuY29tMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAyRUvQFD9UboxW4xjOyo2Cu7RsAT0GDx66Brl3tEnxvCwnfSystwerbAZtGtrklDJWcqAWVbSNwxnPuGsxSUg4D8ziI4Biqc6rvoNO4YYzpHWYmS9aLMG8TOUzAZZORrnvuiu7VGleZKi+Yd08fXSjrUV4sldRiD+Y0IN80xa52B0053yFX4geCuFn0Ewo8NXhkCU6Pfwb9wVVuCmcu9mt3ubpWRa2H+h2ie3suAc4ADrb9Ng63stU3UrjUcYv5guo0gBOBrk7i0WL/2KJf2NmDJiTaaCxR0gEe0sHjio7PCXDNHS0eJj/2++Wq90fDbBFDP/LP0aBKJAvaTZNEKcX5Hr/Y32Bz1Szpi18/HSlEF6rIketLiAzgLfzRMktctWLGGubp6RarNWALBX5kJA43/Cernaf0sVRtCUqjKPRd8k8Bo3BXl5VwVn2b+nZO6EJQ6RslOfbumFPVhlyFv6I1tAOPmZOHjOpc4ogPyI7jMefXMMsSJOGgLb7JVPpbi0bjXmsW7I0sWcAdDzcASNUxxp1c0qXZu4nHI2VlPucA4LA5W4Z1qcNQsfQEN4gdPWBeSbDBv0FPxFcHZNqk87ywvLkurgASL+KxqB9FzIqhv7w0OYm1r7iClBJxsbItYeehEypv/PJpxBq1uxcd6pExY6kTP3x8YAqUgb3GoWlUsCAwEAAaNTMFEwHQYDVR0OBBYEFOJqvx/CUIV6mkiTURkyVYiugkqVMB8GA1UdIwQYMBaAFOJqvx/CUIV6mkiTURkyVYiugkqVMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggIBAHTov7zZOMt7zAfy9N8X6yOsakUqAXVtrTDu9DMn9kw2vhudSfNfno7dSc3JeE+KtySkyfrMbNub19IzfVHMI2dRiO7PGzgv8XD69PC/PKaqNmViW27P0l4ORGKE4RHcjd0Y0Rj8nciwHDu4u7p9gI1yS7TiLtpQqyb0ba/ZVP88EVe7wI+BtoHiSMQeEjs13gTSARTYXay0WsL7xxwzKH68Y4RRjfqt+NpyMP7wrf5Kcha2cID8jG9i4LqSoj+o5jvwH969jEP+9DX7XFx0894O42xGreyl1E1HkKOgrGE+owkEpVNYLfcQP3tbx3maoG2g5TXMtMqei1ffNdUiONPbi9II1UP53JrTcnFUb3aVo2yLJ5ftkOSWpkyhk9G9TWoUiTB/k3Jb6gxzk6HvjhLgYTeT+UPW/ATiffL7SNmGTQBuVuNUHNxm4sAz9oQTmCo+8vCqMtqK4IHeKqNP+yqVGCAI71yEcxuYy17S57iarK7ON/RTMiblerUOowOSBzTmm+7kuR8Ke0BVCw6l0A7yUueAUnRaVXEAszvhHsLxZMlnMeYlL5qj6CAamdgpwdsMFa0QcAAcGl6j3vW9ks9nLlEAzJmUIQUx33W4SryYwflliWkH4f4OlRj7Lrq81/QvZ+tTUTiTBrvZjB1j9ezCv0Fjp9cEDi1hyV1ArKV3',
      ];
      const validKey = {
        kty: 'RSA',
        kid: 'kms://kms.example.com',
        x5c: [
          'MIIDaDCCAlACFG2NkKF2WKCN/OnGN2E7mBamxhB2MA0GCSqGSIb3DQEBCwUAMIGDMQswCQYDVQQGEwJVUzERMA8GA1UECAwIQ29sb3JhZG8xDzANBgNVBAcMBkRlbnZlcjEQMA4GA1UECgwHRXhhbXBsZTEfMB0GA1UEAwwWaHR0cHM6Ly9jYS5leGFtcGxlLmNvbTEdMBsGCSqGSIb3DQEJARYOY2FAZXhhbXBsZS5jb20wHhcNMjAwMjA2MjAzMjU0WhcNNDAwMjAxMjAzMjU0WjBdMQswCQYDVQQGEwJVUzERMA8GA1UECAwIQ29sb3JhZG8xDzANBgNVBAcMBkRlbnZlcjEQMA4GA1UECgwHRXhhbXBsZTEYMBYGA1UEAwwPa21zLmV4YW1wbGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2OObWUoNG0Wv4zYuhGUT7JNiUkefUsFZ384NS2l5VOB/lSNcElBtmX55yPcjvPnukfpETDUG82K8ncOwCuV8ZTpvzM3QHSIHGyO5JBFJ38U6Pq6kHje6An+eSHLCVkQfOlf4TCRb8SlcEoi8wkl3IIGewzC0/87b1OvyYTb8BHZJVeUV7AxcZChkAA/IJV5ADnmc/6ZCihXVuCWJgTFpLLv7HVqE924lNDTgRn64ioCpHK4pC1FFqQKLlsq0tV75gc5d7A6m5/9znEvg02JuqUFd9LdOcnf8QeTkyg6OTTvJUUa39KZDKONi8MXiECacGU6VbUvuKOXZU49UeqVKQQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQCmlEodmn5LfgIWViRn8t4qjTZoM7VUGWXfCnaMqSnW6P0eYbZdCoCecja6WicBWPAlFFR/UscYv4rEGXtmzD+GQUQKfYFfsNdkfCpPvCFlpudHNuW0kCZ8lUfDWQRirrC+MyiAVpEG7mNHNZfK9hof05MHS6ItcpET5+F0DiC6l+vsBBRqP2SU8bo9gTrr8WO7bW8JQb59XNEoTQC1AzCn172+idJcgaasOfp/V+QqODIa96YNM7vT9pj09nGL0Wxulaq546pW32HYkOhZw1nr8prZn17UFLfoQnaNuTuT2ZCsFc7V2H0UqcMwjg1QZoObLI5tXPv0syP6WXo19OjW',
        ],
        e: 'AQAB',
        n: '2OObWUoNG0Wv4zYuhGUT7JNiUkefUsFZ384NS2l5VOB_lSNcElBtmX55yPcjvPnukfpETDUG82K8ncOwCuV8ZTpvzM3QHSIHGyO5JBFJ38U6Pq6kHje6An-eSHLCVkQfOlf4TCRb8SlcEoi8wkl3IIGewzC0_87b1OvyYTb8BHZJVeUV7AxcZChkAA_IJV5ADnmc_6ZCihXVuCWJgTFpLLv7HVqE924lNDTgRn64ioCpHK4pC1FFqQKLlsq0tV75gc5d7A6m5_9znEvg02JuqUFd9LdOcnf8QeTkyg6OTTvJUUa39KZDKONi8MXiECacGU6VbUvuKOXZU49UeqVKQQ',
      };
      const invalidKey = {kty: 'NOT_RSA', kid: 'kms://kms.example.com'};

      beforeEach(() => {
        webex.internal.metrics = {submitClientMetrics: sinon.stub()};
        webex.internal.encryption.config.shouldValidateKMSCertificate = true;
      });

      // Mandatory metadata checks still reject malformed keys when chain enforcement is disabled.
      [true, false].forEach((shouldValidateKMSCertificate) => {
        it(`rejects and reports invalid KMS metadata with enforced chain validation ${
          shouldValidateKMSCertificate ? 'enabled' : 'disabled'
        }`, async () => {
          webex.internal.encryption.config.shouldValidateKMSCertificate =
            shouldValidateKMSCertificate;
          await assert.isRejected(
            webex.internal.encryption.kms._validateKMSStaticPubKey(invalidKey, caroots),
            /INVALID KMS/
          );

          assert.calledOnceWithExactly(
            webex.internal.metrics.submitClientMetrics,
            'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
            {
              fields: {success: false},
              tags: {
                reason: "INVALID KMS: 'kty' header must be 'RSA'",
                kid: 'kms://kms.example.com',
                validationMode: 'enforced',
              },
            }
          );
        });
      });

      it('rejects and reports missing KMS metadata', async () => {
        await assert.isRejected(
          webex.internal.encryption.kms._validateKMSStaticPubKey(undefined, caroots),
          /INVALID KMS/
        );

        assert.calledOnceWithExactly(
          webex.internal.metrics.submitClientMetrics,
          'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: "INVALID KMS: 'kty' header must be 'RSA'",
              kid: undefined,
              validationMode: 'enforced',
            },
          }
        );
      });

      it('preserves the validation error when metric submission rejects', async () => {
        const metricError = new Error('clientmetrics request failed');
        const {warn} = webex.internal.encryption.kms.logger;

        warn.resetHistory();
        webex.internal.metrics.submitClientMetrics.rejects(metricError);

        await assert.isRejected(
          webex.internal.encryption.kms._validateKMSStaticPubKey(invalidKey, caroots),
          "INVALID KMS: 'kty' header must be 'RSA'"
        );

        assert.calledOnceWithExactly(
          webex.internal.metrics.submitClientMetrics,
          'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: "INVALID KMS: 'kty' header must be 'RSA'",
              kid: 'kms://kms.example.com',
              validationMode: 'enforced',
            },
          }
        );
        assert.calledWithExactly(
          warn,
          'kms: failed to submit JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED metric',
          metricError
        );
      });

      it('rejects when enforced chain validation is enabled but no caroots are provided', async () => {
        await assert.isRejected(
          webex.internal.encryption.kms._validateKMSStaticPubKey(validKey, undefined),
          /INVALID KMS/
        );

        assert.calledOnceWithExactly(
          webex.internal.metrics.submitClientMetrics,
          'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: 'INVALID KMS: no CA roots configured to validate the KMS certificate against',
              kid: 'kms://kms.example.com',
              validationMode: 'enforced',
            },
          }
        );
      });

      it('resolves with no caroots when enforced chain validation is disabled', async () => {
        webex.internal.encryption.config.shouldValidateKMSCertificate = false;

        const result = await webex.internal.encryption.kms._validateKMSStaticPubKey(
          validKey,
          undefined
        );

        assert.equal(result, validKey);
        assert.notCalled(webex.internal.metrics.submitClientMetrics);
      });

      it('resolves without a metric when the enforced chain validates', async () => {
        const result = await webex.internal.encryption.kms._validateKMSStaticPubKey(
          validKey,
          caroots
        );

        assert.equal(result, validKey);
        assert.notCalled(webex.internal.metrics.submitClientMetrics);
      });

      it('rejects and reports an untrusted chain when enforced chain validation is enabled', async () => {
        const error = await assert.isRejected(
          webex.internal.encryption.kms._validateKMSStaticPubKey(validKey, unrelatedCaroots),
          /INVALID KMS: Certificate Validation failed/
        );

        assert.calledOnceWithExactly(
          webex.internal.metrics.submitClientMetrics,
          'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: error.message,
              kid: 'kms://kms.example.com',
              validationMode: 'enforced',
            },
          }
        );
      });

      it('resolves an untrusted chain without a metric when enforced chain validation is disabled', async () => {
        webex.internal.encryption.config.shouldValidateKMSCertificate = false;

        const result = await webex.internal.encryption.kms._validateKMSStaticPubKey(
          validKey,
          unrelatedCaroots
        );

        assert.equal(result, validKey);
        assert.notCalled(webex.internal.metrics.submitClientMetrics);
      });
    });

    describe('CA roots', () => {
      // Cisco Union bundle signed 2026-10-22 (version 20261022, 231 roots).
      const FIXTURE_SIGNING_TIME = new Date('2026-10-22T04:41:57.000Z').getTime();
      const DAY = 24 * 60 * 60 * 1000;
      const bundle = new Uint8Array(
        fs.readFileSync(path.join(__dirname, '../../../../test-helper-server/static/ios_union.p7b'))
      );
      const configuredCaroots = ['MIIconfigured'];
      let kms;
      let clock;

      const assertFailClosedError = (error, detail) => {
        assert.isTrue(error.kmsError);
        assert.include(error.message, detail);
        assert.include(error.message, '`encryption.caroots`');
        assert.include(error.message, '`encryption.assetsBaseUrl`');
        assert.include(error.message, '`encryption.shouldValidateKMSCertificate`');
      };

      beforeEach(() => {
        clock = sinon.useFakeTimers({now: FIXTURE_SIGNING_TIME + DAY, toFake: ['Date']});
        webex.internal.metrics = {submitClientMetrics: sinon.stub()};
        kms = webex.internal.encryption.kms;
        Object.assign(webex.internal.encryption.config, {
          shouldValidateKMSCertificate: true,
          caroots: undefined,
          carootsAsset: UNION_BUNDLE_ASSET,
          assetsBaseUrl: 'https://cdn.example.com/assets/internal-plugin-encryption/',
        });
        sinon.stub(kms, '_getCarootsAssetBytes').resolves(bundle.slice());
      });

      afterEach(() => {
        clock.restore();
        sinon.restore();
      });

      describe('_getCaroots', () => {
        it('resolves undefined without loading the asset when validation is disabled', async () => {
          webex.internal.encryption.config.shouldValidateKMSCertificate = false;

          assert.isUndefined(await kms._getCaroots());
          assert.notCalled(kms._getCarootsAssetBytes);
        });

        it('prefers configured caroots over the asset', async () => {
          webex.internal.encryption.config.caroots = configuredCaroots;

          assert.equal(await kms._getCaroots(), configuredCaroots);
          assert.notCalled(kms._getCarootsAssetBytes);
        });

        [undefined, []].forEach((caroots) => {
          it(`loads and verifies the asset when caroots is ${JSON.stringify(
            caroots
          )}`, async () => {
            webex.internal.encryption.config.caroots = caroots;

            const result = await kms._getCaroots();

            assert.lengthOf(result, 231);
            assert.calledOnceWithExactly(kms._getCarootsAssetBytes);
            assert.notCalled(webex.internal.metrics.submitClientMetrics);
          });
        });

        it('caches the verified CA roots', async () => {
          const [first, second] = await Promise.all([kms._getCaroots(), kms._getCaroots()]);
          const third = await kms._getCaroots();

          assert.equal(first, second);
          assert.equal(first, third);
          assert.calledOnce(kms._getCarootsAssetBytes);
        });

        [
          {title: 'a network error', error: new Error('socket hang up'), reason: 'socket hang up'},
          {
            title: 'an HTTP error',
            error: Object.assign(new Error(`{}\nGET /assets/${UNION_BUNDLE_ASSET}`), {
              statusCode: 404,
              options: {uri: `/assets/${UNION_BUNDLE_ASSET}`},
            }),
            reason: `HTTP 404 /assets/${UNION_BUNDLE_ASSET}`,
          },
        ].forEach(({title, error: loadError, reason}) => {
          it(`fails closed with an actionable error and retries after ${title}`, async () => {
            kms._getCarootsAssetBytes.onFirstCall().rejects(loadError);

            const error = await kms._getCaroots().then(
              () => assert.fail('expected rejection'),
              (e) => e
            );

            assertFailClosedError(error, `"${UNION_BUNDLE_ASSET}" could not be loaded`);
            assert.include(error.message, `Cause: ${reason}`);
            assert.calledOnceWithExactly(
              webex.internal.metrics.submitClientMetrics,
              'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED',
              {
                fields: {success: false},
                tags: {
                  reason,
                  assetsBaseUrl: 'https://cdn.example.com/assets/internal-plugin-encryption/',
                },
              }
            );

            assert.lengthOf(await kms._getCaroots(), 231);
            assert.calledTwice(kms._getCarootsAssetBytes);
          });
        });

        it('fails closed with an actionable error and retries when the asset fails verification', async () => {
          const tampered = bundle.slice();

          tampered[2000] ^= 1;
          kms._getCarootsAssetBytes.onFirstCall().resolves(tampered);

          const error = await kms._getCaroots().then(
            () => assert.fail('expected rejection'),
            (e) => e
          );

          assertFailClosedError(error, `"${UNION_BUNDLE_ASSET}" failed verification`);
          assert.calledOnce(webex.internal.metrics.submitClientMetrics);

          const [name, payload] = webex.internal.metrics.submitClientMetrics.args[0];

          assert.equal(name, 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED');
          assert.deepEqual(payload.fields, {success: false});
          assert.equal(payload.tags.reason, 'signature');

          assert.lengthOf(await kms._getCaroots(), 231);
          assert.calledTwice(kms._getCarootsAssetBytes);
        });

        it('reports a stale asset but still uses it', async () => {
          clock.setSystemTime(FIXTURE_SIGNING_TIME + 400 * DAY);

          assert.lengthOf(await kms._getCaroots(), 231);
          assert.calledOnceWithExactly(
            webex.internal.metrics.submitClientMetrics,
            'JS_SDK_KMS_CAROOTS_ASSET_STALE',
            {fields: {ageInDays: 400}, tags: {bundleVersion: 20261022}}
          );
        });
      });

      describe('_getCarootsAssetBytes', () => {
        it('reads the asset shipped with the package in Node', async () => {
          kms._getCarootsAssetBytes.restore();
          webex.internal.encryption.config.assetsBaseUrl = undefined;

          const bytes = await kms._getCarootsAssetBytes();

          assert.deepEqual(
            Buffer.from(bytes),
            fs.readFileSync(path.join(__dirname, '../../../assets', UNION_BUNDLE_ASSET))
          );
        });
      });

      describe('_prepareContext', () => {
        it('validates the KMS key against the resolved CA roots', async () => {
          const kmsStaticPubKey = {kid: 'kms://kms.example.com'};
          const validationError = new Error('stop after validation');

          sinon.stub(kms, '_getKMSStaticPubKey').resolves(kmsStaticPubKey);
          sinon.stub(kms, '_getCaroots').resolves(configuredCaroots);
          sinon.stub(kms, '_getAuthorization').resolves('token');
          sinon.stub(kms, '_validateKMSStaticPubKey').rejects(validationError);

          await assert.isRejected(kms._prepareContext(), validationError);
          assert.calledOnceWithExactly(
            kms._validateKMSStaticPubKey,
            kmsStaticPubKey,
            configuredCaroots
          );
        });
      });

      describe('_getContext', () => {
        it('retries the negotiation after a failed attempt', async () => {
          const context = {
            ephemeralKey: {expirationDate: Date.now() + 60 * 60 * 1000},
            clientInfo: {credential: {}},
          };

          sinon.stub(kms, '_getAuthorization').resolves('token');
          sinon
            .stub(kms, '_prepareContext')
            .onFirstCall()
            .rejects(new Error('CA roots unavailable'))
            .onSecondCall()
            .resolves(context);

          await assert.isRejected(kms._getContext(), /CA roots unavailable/);

          assert.equal(await kms._getContext(), context);
          assert.calledTwice(kms._prepareContext);
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

      it('includes the Webex tracking ID in KMS timeout errors', () => {
        const error = new KmsTimeoutError({
          timeout: 6000,
          trackingId: 'webex-js-sdk_test_1',
          request: {
            method: 'create',
            uri: '/keys',
            requestId: 'kms-request-id',
          },
        });

        assert.include(error.message, 'KMS_REQUEST: create /keys');
        assert.include(error.message, 'KMS_REQUEST_ID: kms-request-id');
        assert.include(error.message, 'WEBEX_TRACKING_ID: webex-js-sdk_test_1');
      });
    });
  });
});
