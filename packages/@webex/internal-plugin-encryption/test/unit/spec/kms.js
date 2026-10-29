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
import {JS_SDK_KMS_CAROOTS_ASSET_LOAD_RESULT} from '../../../dist/constants';
import {caroots, unrelatedCaroots, validKey, invalidKey} from '../../fixtures/kms-certificate';

describe('internal-plugin-encryption', () => {
  const assertLoadResult = (metric, outcome = 'success', validationMode = 'enforced') => {
    assert.calledOnceWithExactly(
      metric.withArgs(JS_SDK_KMS_CAROOTS_ASSET_LOAD_RESULT),
      JS_SDK_KMS_CAROOTS_ASSET_LOAD_RESULT,
      {
        fields: {success: outcome === 'success'},
        tags: {outcome, validationMode, carootsAsset: UNION_BUNDLE_ASSET},
      }
    );
  };
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
        webex.internal.encryption.config.carootsReportOnly = undefined;
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

      it('resolves without a metric when no report-only bundle is configured', async () => {
        const result = await webex.internal.encryption.kms._validateKMSStaticPubKey(
          validKey,
          caroots
        );

        assert.equal(result, validKey);
        assert.notCalled(webex.internal.metrics.submitClientMetrics);
      });

      it('resolves without a metric when the report-only bundle also validates', async () => {
        webex.internal.encryption.config.carootsReportOnly = caroots;

        const result = await webex.internal.encryption.kms._validateKMSStaticPubKey(
          validKey,
          caroots
        );

        assert.equal(result, validKey);
        assert.notCalled(webex.internal.metrics.submitClientMetrics);
      });

      // Explicit report-only roots are checked independently of enforcement; failures never block.
      [true, false].forEach((shouldValidateKMSCertificate) => {
        it(`resolves and reports an untrusted report-only chain with enforced chain validation ${
          shouldValidateKMSCertificate ? 'enabled' : 'disabled'
        }`, async () => {
          webex.internal.encryption.config.shouldValidateKMSCertificate =
            shouldValidateKMSCertificate;
          webex.internal.encryption.config.carootsReportOnly = unrelatedCaroots;

          const result = await webex.internal.encryption.kms._validateKMSStaticPubKey(
            validKey,
            caroots
          );

          assert.equal(result, validKey);
          assert.calledOnce(webex.internal.metrics.submitClientMetrics);

          const [name, payload] = webex.internal.metrics.submitClientMetrics.args[0];

          assert.equal(name, 'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED');
          assert.deepEqual(payload.fields, {success: false});
          assert.equal(payload.tags.kid, 'kms://kms.example.com');
          assert.equal(payload.tags.validationMode, 'report-only');
          assert.match(payload.tags.reason, /INVALID KMS/);
        });
      });

      describe('independent report-only asset source', () => {
        const reportUrl = 'https://candidate.example.com/roots/';
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
            carootsAsset: UNION_BUNDLE_ASSET,
            reportOnlyAssetsBaseUrl: reportUrl,
            caroots: undefined,
            carootsReportOnly: undefined,
            assetsBaseUrl: 'https://enforced.example.com/roots/',
          });
          webex.internal.device = {url: 'https://device.example.com/device', userId: 'user'};
          sinon.stub(kms, '_getKMSStaticPubKey').resolves(validKey);
          sinon.stub(kms, '_getAuthorization').resolves('token');
          sinon.stub(kms, '_getKMSCluster').resolves('https://kms.example.com');
          sinon.stub(kms, '_getCarootsAssetBytes').resolves(bundle.slice());
          sinon.stub(kms, '_getReportOnlyCarootsAssetBytes').resolves(bundle.slice());
          sinon.stub(kms, 'request').resolves({key: {}});
          sinon
            .stub(Context.prototype, 'createECDHKey')
            .resolves({asKey: () => Promise.resolve(localKey)});
          sinon.stub(Context.prototype, 'deriveEphemeralKey').resolves(finalKey);
          report = sinon.spy(kms, '_reportKMSStaticPubKey');
        });

        afterEach(() => sinon.restore());

        const assertContext = (context) => {
          assert.equal(context.serverInfo.key, validKey);
          assert.equal(context.ephemeralKey.expirationDate, finalKey.expirationDate);
          assert.calledWithExactly(kms.request, {
            uri: 'https://kms.example.com/ecdhe',
            method: 'create',
            jwk: {kty: 'EC'},
          });
        };

        const assertReportChainFailure = () => {
          assert.calledTwice(webex.internal.metrics.submitClientMetrics);
          assertLoadResult(webex.internal.metrics.submitClientMetrics, 'success', 'report-only');
          assert.calledOnceWithExactly(
            webex.internal.metrics.submitClientMetrics.withArgs(
              'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED'
            ),
            'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
            {
              fields: {success: false},
              tags: {
                reason: sinon.match(/^INVALID KMS: Certificate Validation failed/),
                kid: validKey.kid,
                validationMode: 'report-only',
              },
            }
          );
        };

        [undefined, null, ''].forEach((reportOnlyAssetsBaseUrl) => {
          it(`does not fetch report-only roots when the URL is ${JSON.stringify(
            reportOnlyAssetsBaseUrl
          )}`, async () => {
            kms.config.reportOnlyAssetsBaseUrl = reportOnlyAssetsBaseUrl;
            assertContext(await kms._prepareContext());
            assert.notCalled(report);
            assert.notCalled(kms._getReportOnlyCarootsAssetBytes);
            assert.notCalled(kms._getCarootsAssetBytes);
            assert.notCalled(webex.internal.metrics.submitClientMetrics);
          });
        });

        it('completes context setup while the report-only download remains pending', async () => {
          let complete;
          kms._getReportOnlyCarootsAssetBytes.returns(
            new Promise((resolve) => {
              complete = resolve;
            })
          );
          try {
            assertContext(await kms._prepareContext());
            assert.calledOnceWithExactly(
              kms._getReportOnlyCarootsAssetBytes,
              reportUrl,
              UNION_BUNDLE_ASSET
            );
            assert.calledOnceWithExactly(report, validKey);
            assert.notCalled(webex.internal.metrics.submitClientMetrics);
          } finally {
            complete(bundle.slice());
            await Promise.all(report.returnValues);
          }
          assertReportChainFailure();
        });

        [false, true].forEach((enforced) => {
          it(`uses the report-only asset independently of supplied roots with enforcement ${enforced}`, async () => {
            kms.config.caroots = caroots;
            kms.config.shouldValidateKMSCertificate = enforced;
            assertContext(await kms._prepareContext());
            await report.returnValues[0];
            assert.calledOnceWithExactly(
              kms._getReportOnlyCarootsAssetBytes,
              reportUrl,
              UNION_BUNDLE_ASSET
            );
            assert.notCalled(kms._getCarootsAssetBytes);
            assertReportChainFailure();
          });
        });

        ['download', 'signature', 'version', 'synchronous download'].forEach((failure) => {
          it(`reports ${failure} failure without rejecting context setup`, async () => {
            if (failure === 'download') {
              kms._getReportOnlyCarootsAssetBytes.rejects(new Error('asset offline'));
            } else if (failure === 'synchronous download') {
              kms._getReportOnlyCarootsAssetBytes.throws(new Error('invalid asset URL'));
            } else if (failure === 'version') {
              sinon
                .stub(kmsCaroots, 'verifyUnionBundle')
                .rejects(
                  new kmsCaroots.UnionBundleVerificationError('version', 'bundle is too old')
                );
            } else {
              const tampered = bundle.slice();
              tampered[2000] = (tampered[2000] + 1) % 256;
              kms._getReportOnlyCarootsAssetBytes.resolves(tampered);
            }
            assertContext(await kms._prepareContext());
            await report.returnValues[0];
            assert.calledTwice(webex.internal.metrics.submitClientMetrics);
            assertLoadResult(
              webex.internal.metrics.submitClientMetrics,
              failure.includes('download') ? 'download-failed' : 'verification-failed',
              'report-only'
            );
            const [name, payload] = webex.internal.metrics.submitClientMetrics.firstCall.args;
            assert.equal(
              name,
              failure.includes('download')
                ? 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED'
                : 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED'
            );
            assert.deepEqual(payload.fields, {success: false});
            assert.equal(payload.tags.validationMode, 'report-only');
            assert.calledWithMatch(
              kms.logger.warn,
              'kms: report-only CA roots unavailable',
              sinon.match.has('message', sinon.match('encryption.reportOnlyAssetsBaseUrl'))
            );
            assert.notCalled(kms._getCarootsAssetBytes);
          });
        });

        [
          {title: 'valid', roots: caroots, failures: 0},
          {title: 'empty', roots: [], failures: 1},
          {title: 'untrusted', roots: unrelatedCaroots, failures: 1},
        ].forEach(({title, roots, failures}) => {
          it(`retains the explicit ${title} legacy array instead of the report-only URL`, async () => {
            kms.config.carootsReportOnly = roots;
            assertContext(await kms._prepareContext());
            assert.notCalled(report);
            assert.notCalled(kms._getReportOnlyCarootsAssetBytes);
            assert.notCalled(kms._getCarootsAssetBytes);
            assert.equal(webex.internal.metrics.submitClientMetrics.callCount, failures);
          });
        });

        ['download', 'signature', 'version', 'chain'].forEach((failure) => {
          it(`still rejects enforced ${failure} failure when a report-only URL is configured`, async () => {
            kms.config.shouldValidateKMSCertificate = true;
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
              kms.config.caroots = unrelatedCaroots;
            }
            await assert.isRejected(kms._prepareContext());
            assert.notCalled(report);
            assert.notCalled(kms._getReportOnlyCarootsAssetBytes);
            assert.notCalled(Context.prototype.createECDHKey);
            assert.notCalled(kms.request);
          });
        });

        it('rejects invalid mandatory key metadata before starting the new check', async () => {
          kms._getKMSStaticPubKey.resolves(invalidKey);
          await assert.isRejected(kms._prepareContext(), /INVALID KMS/);
          assert.notCalled(report);
          assert.notCalled(kms._getReportOnlyCarootsAssetBytes);
          assert.notCalled(kms.request);
        });

        it('shares a verified load between concurrent report-only contexts', async () => {
          let complete;
          kms._getReportOnlyCarootsAssetBytes.returns(
            new Promise((resolve) => {
              complete = resolve;
            })
          );
          try {
            (await Promise.all([kms._prepareContext(), kms._prepareContext()])).forEach(
              assertContext
            );
            assert.calledOnceWithExactly(
              kms._getReportOnlyCarootsAssetBytes,
              reportUrl,
              UNION_BUNDLE_ASSET
            );
            complete(bundle.slice());
            await Promise.all(report.returnValues);
            assert.lengthOf(await kms._loadCaroots({reportOnly: true}), 231);
            assert.calledOnce(kms._getReportOnlyCarootsAssetBytes);
            assertLoadResult(webex.internal.metrics.submitClientMetrics, 'success', 'report-only');
            assert.calledThrice(webex.internal.metrics.submitClientMetrics);
          } finally {
            complete(bundle.slice());
            await Promise.all(report.returnValues);
          }
        });

        it('keeps distinct URLs separate and reuses an earlier verified URL', async () => {
          const checkUrl = async (url) => {
            kms.config.reportOnlyAssetsBaseUrl = url;
            assertContext(await kms._prepareContext());
            await report.lastCall.returnValue;
          };
          await checkUrl(reportUrl);
          await checkUrl('https://another.example.com/roots/');
          await checkUrl(reportUrl);
          assert.deepEqual(kms._getReportOnlyCarootsAssetBytes.args, [
            [reportUrl, UNION_BUNDLE_ASSET],
            ['https://another.example.com/roots/', UNION_BUNDLE_ASSET],
          ]);
          assert.notCalled(kms._getCarootsAssetBytes);
        });

        it('keeps the enforced packaged source separate from the explicit URL at the same base', async () => {
          kms.config.reportOnlyAssetsBaseUrl = kms.config.assetsBaseUrl;
          const trialRoots = await kms._loadCaroots({reportOnly: true});
          kms.config.shouldValidateKMSCertificate = true;
          const enforcedRoots = await kms._getCaroots();
          assert.lengthOf(trialRoots, 231);
          assert.lengthOf(enforcedRoots, 231);
          assert.notEqual(trialRoots, enforcedRoots);
          assert.calledOnceWithExactly(
            kms._getReportOnlyCarootsAssetBytes,
            kms.config.assetsBaseUrl,
            UNION_BUNDLE_ASSET
          );
          assert.calledOnceWithExactly(
            kms._getCarootsAssetBytes,
            kms.config.assetsBaseUrl,
            kms.config.carootsAsset
          );
        });

        it('evicts a failed report-only load without discarding enforced roots', async () => {
          kms._getReportOnlyCarootsAssetBytes.onFirstCall().rejects(new Error('offline'));
          assertContext(await kms._prepareContext());
          await report.lastCall.returnValue;
          kms.config.shouldValidateKMSCertificate = true;
          const enforcedRoots = await kms._getCaroots();
          kms.config.shouldValidateKMSCertificate = false;
          assertContext(await kms._prepareContext());
          await report.lastCall.returnValue;
          kms.config.shouldValidateKMSCertificate = true;
          assert.equal(await kms._getCaroots(), enforcedRoots);
          assert.calledTwice(kms._getReportOnlyCarootsAssetBytes);
          assert.calledOnce(kms._getCarootsAssetBytes);
        });

        it('does not reuse roots when the requested asset filename changes', async () => {
          await kms._loadCaroots({reportOnly: true});
          kms.config.carootsAsset = 'candidate.p7b';
          await kms._loadCaroots({reportOnly: true});
          assert.calledTwice(kms._getReportOnlyCarootsAssetBytes);
        });

        [false, true].forEach((reportOnly) => {
          it(`captures the complete ${
            reportOnly ? 'report-only' : 'enforced'
          } source before a deferred fetch`, async () => {
            const firstUrl = reportOnly
              ? kms.config.reportOnlyAssetsBaseUrl
              : kms.config.assetsBaseUrl;
            const firstAsset = kms.config.carootsAsset;
            const first = kms._loadCaroots({reportOnly});
            kms.config.assetsBaseUrl = 'https://changed.example.com/roots/';
            kms.config.reportOnlyAssetsBaseUrl = 'https://changed.example.com/roots/';
            kms.config.carootsAsset = 'candidate.p7b';
            const second = kms._loadCaroots({reportOnly});
            const [firstRoots, secondRoots] = await Promise.all([first, second]);
            const getter = reportOnly
              ? kms._getReportOnlyCarootsAssetBytes
              : kms._getCarootsAssetBytes;
            assert.deepEqual(getter.args, [
              [firstUrl, firstAsset],
              ['https://changed.example.com/roots/', 'candidate.p7b'],
            ]);
            assert.notEqual(firstRoots, secondRoots);
            kms.config.assetsBaseUrl = firstUrl;
            kms.config.reportOnlyAssetsBaseUrl = firstUrl;
            kms.config.carootsAsset = firstAsset;
            assert.equal(await kms._loadCaroots({reportOnly}), firstRoots);
            assert.calledTwice(getter);
          });
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
            assert.calledOnceWithExactly(
              kms._getCarootsAssetBytes,
              kms.config.assetsBaseUrl,
              kms.config.carootsAsset
            );
            assertLoadResult(webex.internal.metrics.submitClientMetrics);
          });
        });

        it('caches the verified CA roots', async () => {
          const [first, second] = await Promise.all([kms._getCaroots(), kms._getCaroots()]);
          const third = await kms._getCaroots();

          assert.equal(first, second);
          assert.equal(first, third);
          assert.calledOnce(kms._getCarootsAssetBytes);
          assertLoadResult(webex.internal.metrics.submitClientMetrics);
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
              webex.internal.metrics.submitClientMetrics.withArgs(
                'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED'
              ),
              'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED',
              {
                fields: {success: false},
                tags: {
                  reason,
                  assetsBaseUrl: 'https://cdn.example.com/assets/internal-plugin-encryption/',
                  validationMode: 'enforced',
                },
              }
            );
            assert.calledTwice(webex.internal.metrics.submitClientMetrics);
            assertLoadResult(webex.internal.metrics.submitClientMetrics, 'download-failed');

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
          assert.calledTwice(webex.internal.metrics.submitClientMetrics);
          assertLoadResult(webex.internal.metrics.submitClientMetrics, 'verification-failed');

          const [name, payload] = webex.internal.metrics.submitClientMetrics.args[0];

          assert.equal(name, 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED');
          assert.deepEqual(payload.fields, {success: false});
          assert.equal(payload.tags.reason, 'signature');
          assert.equal(payload.tags.validationMode, 'enforced');

          assert.lengthOf(await kms._getCaroots(), 231);
          assert.calledTwice(kms._getCarootsAssetBytes);
        });

        [false, true].forEach((reportOnly) => {
          it(`reports a stale asset in ${
            reportOnly ? 'report-only' : 'enforced'
          } mode but still uses it`, async () => {
            clock.setSystemTime(FIXTURE_SIGNING_TIME + 400 * DAY);
            if (reportOnly) {
              kms.config.reportOnlyAssetsBaseUrl = 'https://candidate.example.com/roots/';
              sinon.stub(kms, '_getReportOnlyCarootsAssetBytes').resolves(bundle.slice());
            }
            assert.lengthOf(await kms._loadCaroots({reportOnly}), 231);
            assert.calledOnceWithExactly(
              webex.internal.metrics.submitClientMetrics.withArgs('JS_SDK_KMS_CAROOTS_ASSET_STALE'),
              'JS_SDK_KMS_CAROOTS_ASSET_STALE',
              {
                fields: {ageInDays: 400},
                tags: {
                  bundleVersion: 20261022,
                  validationMode: reportOnly ? 'report-only' : 'enforced',
                },
              }
            );
            assert.calledTwice(webex.internal.metrics.submitClientMetrics);
            assertLoadResult(
              webex.internal.metrics.submitClientMetrics,
              'success',
              reportOnly ? 'report-only' : 'enforced'
            );
          });
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
