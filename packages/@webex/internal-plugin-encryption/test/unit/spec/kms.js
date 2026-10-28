/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */
import fs from 'fs';
import path from 'path';

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {Context} from 'node-kms';
import kmsCaroots from '@webex/kms-caroots';
import Encryption from '@webex/internal-plugin-encryption';
import {KmsError, KmsTimeoutError} from '../../../dist/kms-errors';
import {UNION_BUNDLE_ASSET} from '../../../dist/union-bundle';
import {caroots, unrelatedCaroots, validKey, invalidKey} from '../../fixtures/kms-certificate';

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

      describe('asset-backed report-only validation', () => {
        const bundle = new Uint8Array(
          fs.readFileSync(
            path.join(__dirname, '../../../../test-helper-server/static/ios_union.p7b')
          )
        );
        const localKey = {toJSON: () => ({kty: 'EC'})};
        const finalKey = {expirationDate: 12345};
        let kms;
        let report;

        beforeEach(() => {
          kms = webex.internal.encryption.kms;
          Object.assign(webex.internal.encryption.config, {
            shouldValidateKMSCertificate: false,
            shouldValidateKMSCertificateReportOnly: true,
            caroots: undefined,
            assetsBaseUrl: 'https://cdn.example.com/assets/internal-plugin-encryption/',
          });
          webex.internal.device = {url: 'https://device.example.com/device', userId: 'user'};
          sinon.stub(kms, '_getKMSStaticPubKey').resolves(validKey);
          sinon.stub(kms, '_getAuthorization').resolves('token');
          sinon.stub(kms, '_getKMSCluster').resolves('https://kms.example.com');
          sinon.stub(kms, '_getCarootsAssetBytes').resolves(bundle.slice());
          sinon.stub(kms, 'request').resolves({key: {}});
          sinon
            .stub(Context.prototype, 'createECDHKey')
            .resolves({asKey: () => Promise.resolve(localKey)});
          sinon.stub(Context.prototype, 'deriveEphemeralKey').resolves(finalKey);
          report = sinon.spy(kms, '_reportKMSStaticPubKey');
        });

        afterEach(() => {
          sinon.restore();
        });

        const assertContext = (context) => {
          assert.equal(context.serverInfo.key, validKey);
          assert.equal(context.ephemeralKey.expirationDate, finalKey.expirationDate);
          assert.calledWithExactly(kms.request, {
            uri: 'https://kms.example.com/ecdhe',
            method: 'create',
            jwk: {kty: 'EC'},
          });
        };

        it('leaves root loading disabled without either opt-in', async () => {
          webex.internal.encryption.config.shouldValidateKMSCertificateReportOnly = false;

          assertContext(await kms._prepareContext());
          assert.notCalled(report);
          assert.notCalled(kms._getCarootsAssetBytes);
          assert.notCalled(webex.internal.metrics.submitClientMetrics);
        });

        it('completes context setup while the asset request is unresolved', async () => {
          let complete;

          kms._getCarootsAssetBytes.returns(
            new Promise((resolve) => {
              complete = resolve;
            })
          );
          try {
            assertContext(await kms._prepareContext());
            assert.calledOnceWithExactly(kms._getCarootsAssetBytes);
            assert.calledOnceWithExactly(report, validKey);
            assert.notCalled(webex.internal.metrics.submitClientMetrics);
          } finally {
            complete(bundle.slice());
            if (report.called) await report.returnValues[0];
          }
        });

        it('uses configured roots successfully without fetching an asset', async () => {
          webex.internal.encryption.config.caroots = caroots;

          assertContext(await kms._prepareContext());
          assert.isUndefined(await report.returnValues[0]);

          assert.notCalled(kms._getCarootsAssetBytes);
          assert.notCalled(webex.internal.metrics.submitClientMetrics);
        });

        it('reports an untrusted chain without rejecting context setup', async () => {
          webex.internal.encryption.config.caroots = unrelatedCaroots;

          assertContext(await kms._prepareContext());
          await report.returnValues[0];

          assert.notCalled(kms._getCarootsAssetBytes);
          assert.calledOnceWithExactly(
            webex.internal.metrics.submitClientMetrics,
            'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
            {
              fields: {success: false},
              tags: {
                reason: sinon.match(/^INVALID KMS: Certificate Validation failed/),
                kid: 'kms://kms.example.com',
                validationMode: 'report-only',
              },
            }
          );
        });

        [
          {title: 'download', metric: 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED'},
          {title: 'signature', metric: 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED'},
          {title: 'version', metric: 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED'},
        ].forEach(({title, metric}) => {
          it(`reports ${title} failure without rejecting context setup`, async () => {
            if (title === 'download') {
              kms._getCarootsAssetBytes.rejects(new Error('asset offline'));
            } else if (title === 'version') {
              sinon
                .stub(kmsCaroots, 'verifyUnionBundle')
                .rejects(
                  new kmsCaroots.UnionBundleVerificationError('version', 'bundle is too old')
                );
            } else {
              const tampered = bundle.slice();

              tampered[2000] = (tampered[2000] + 1) % 256;
              kms._getCarootsAssetBytes.resolves(tampered);
            }

            assertContext(await kms._prepareContext());
            await report.returnValues[0];

            assert.calledOnce(webex.internal.metrics.submitClientMetrics);
            assert.equal(webex.internal.metrics.submitClientMetrics.firstCall.args[0], metric);
            assert.calledWithMatch(kms.logger.warn, 'kms: report-only CA roots unavailable');
          });
        });

        it('enforces configured roots when both flags are enabled', async () => {
          Object.assign(webex.internal.encryption.config, {
            shouldValidateKMSCertificate: true,
            caroots,
          });

          assertContext(await kms._prepareContext());
          assert.notCalled(report);
          assert.notCalled(kms._getCarootsAssetBytes);
          assert.notCalled(webex.internal.metrics.submitClientMetrics);
        });

        ['download', 'signature', 'version', 'chain'].forEach((failure) => {
          it(`still rejects enforced ${failure} failure with both flags enabled`, async () => {
            webex.internal.encryption.config.shouldValidateKMSCertificate = true;
            if (failure === 'download') {
              kms._getCarootsAssetBytes.rejects(new Error('asset offline'));
            } else if (failure === 'signature') {
              const tampered = bundle.slice();

              tampered[2000] = (tampered[2000] + 1) % 256;
              kms._getCarootsAssetBytes.resolves(tampered);
            } else if (failure === 'version') {
              sinon
                .stub(kmsCaroots, 'verifyUnionBundle')
                .rejects(
                  new kmsCaroots.UnionBundleVerificationError('version', 'bundle is too old')
                );
            } else {
              webex.internal.encryption.config.caroots = unrelatedCaroots;
            }

            await assert.isRejected(kms._prepareContext());
            assert.notCalled(report);
            assert.notCalled(Context.prototype.createECDHKey);
            assert.notCalled(kms.request);
          });
        });

        it('rejects invalid mandatory key metadata before starting report-only work', async () => {
          kms._getKMSStaticPubKey.resolves(invalidKey);

          await assert.isRejected(kms._prepareContext(), /INVALID KMS/);
          assert.notCalled(report);
          assert.notCalled(kms._getCarootsAssetBytes);
          assert.notCalled(kms.request);
        });

        it('shares a verified asset between concurrent background checks and enforcement', async () => {
          let complete;

          kms._getCarootsAssetBytes.returns(
            new Promise((resolve) => {
              complete = resolve;
            })
          );
          try {
            const contexts = await Promise.all([kms._prepareContext(), kms._prepareContext()]);

            contexts.forEach(assertContext);
            assert.calledOnceWithExactly(kms._getCarootsAssetBytes);
            complete(bundle.slice());
            await Promise.all(report.returnValues);
            webex.internal.encryption.config.shouldValidateKMSCertificate = true;
            assert.lengthOf(await kms._getCaroots(), 231);
            assert.calledOnceWithExactly(kms._getCarootsAssetBytes);
          } finally {
            complete(bundle.slice());
            await Promise.all(report.returnValues);
          }
        });

        it('retries after a background download failure without weakening enforcement', async () => {
          kms._getCarootsAssetBytes.onFirstCall().rejects(new Error('asset offline'));
          kms._getCarootsAssetBytes.onSecondCall().resolves(bundle.slice());

          assertContext(await kms._prepareContext());
          await report.returnValues[0];
          webex.internal.encryption.config.shouldValidateKMSCertificate = true;

          await assert.isRejected(kms._prepareContext(), /INVALID KMS/);
          assert.calledTwice(kms._getCarootsAssetBytes);
          assert.calledOnce(report);
        });

        it('owns an unexpected background task rejection', async () => {
          const reason = new Error('background failure');

          report.restore();
          report = sinon.stub(kms, '_reportKMSStaticPubKey').rejects(reason);
          assertContext(await kms._prepareContext());
          assert.calledWithExactly(
            kms.logger.warn,
            'kms: report-only validation task failed',
            reason
          );
        });
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

        [undefined, []].forEach((configuredRoots) => {
          it(`loads and verifies the asset when caroots is ${JSON.stringify(
            configuredRoots
          )}`, async () => {
            webex.internal.encryption.config.caroots = configuredRoots;

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
