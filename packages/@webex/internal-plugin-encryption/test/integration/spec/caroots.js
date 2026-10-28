/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import {assert} from '@webex/test-helper-chai';
import {browserOnly} from '@webex/test-helper-mocha';
import WebexCore, {StaticAssetLoader} from '@webex/webex-core';
import makeLocalUrl from '@webex/test-helper-make-local-url';
import sinon from 'sinon';

import {caroots as providedRoots, validKey} from '../../fixtures/kms-certificate';

describe('Encryption', function () {
  this.timeout(30000);

  describe('KMS CA roots', () => {
    describe('independent report-only asset URL', () => {
      const assetUrl = (directory) =>
        typeof window === 'undefined'
          ? makeLocalUrl(`/assets/${directory}/`)
          : `/assets/${directory}/`;
      let webex;
      let kms;
      let report;
      let metric;

      beforeEach(() => {
        webex = new WebexCore({
          config: {encryption: {reportOnlyAssetsBaseUrl: assetUrl('internal-plugin-encryption')}},
        });

        kms = webex.internal.encryption.kms;
        report = sinon.spy(kms, '_reportKMSStaticPubKey');
        metric = sinon.stub(kms, '_submitMetric');
      });

      afterEach(() => {
        sinon.restore();
      });

      it('loads verified asset roots and reports the fixture chain without rejecting the key', async () => {
        const roots = sinon.spy(kms, '_loadCaroots');
        const request = sinon.spy(StaticAssetLoader.prototype, 'request');

        assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
        await report.returnValues[0];
        const assetRequests = request
          .getCalls()
          .filter(({args}) => args[0].uri?.includes(kms.config.carootsAsset));
        assert.lengthOf(assetRequests, 1);
        assert.equal(
          assetRequests[0].args[0].uri,
          `${kms.config.reportOnlyAssetsBaseUrl}${kms.config.carootsAsset}`
        );
        assert.isFalse(assetRequests[0].args[0].addAuthHeader);
        assert.isAbove((await roots.returnValues[0]).length, 100);
        assert.calledOnceWithExactly(metric, 'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED', {
          fields: {success: false},
          tags: {
            reason: sinon.match(/^INVALID KMS: Certificate Validation failed/),
            kid: validKey.kid,
            validationMode: 'report-only',
          },
        });
      });

      it('returns the checked key before a pending asset request settles', async () => {
        let complete;
        let notifyStarted;
        const started = new Promise((resolve) => {
          notifyStarted = resolve;
        });
        const pendingBytes = new Promise((resolve) => {
          complete = resolve;
        });
        const getBytes = sinon.stub(kms, '_getReportOnlyCarootsAssetBytes').callsFake(() => {
          notifyStarted();

          return pendingBytes;
        });

        try {
          assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
          await started;
          assert.calledOnceWithExactly(
            getBytes,
            kms.config.reportOnlyAssetsBaseUrl,
            kms.config.carootsAsset
          );
          assert.notCalled(metric);
        } finally {
          complete(new Uint8Array([1, 2, 3]));
          if (report.called) await report.returnValues[0];
        }
        assert.equal(metric.firstCall.args[0], 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED');
        assert.calledOnce(metric);
      });

      it('reports a failed application-hosted request without rejecting the key', async () => {
        kms.config.reportOnlyAssetsBaseUrl = assetUrl('does-not-exist');

        assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
        await report.returnValues[0];
        assert.calledOnceWithExactly(metric, 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED', {
          fields: {success: false},
          tags: {
            reason: sinon.match(/HTTP 404/),
            assetsBaseUrl: kms.config.reportOnlyAssetsBaseUrl,
            validationMode: 'report-only',
          },
        });
      });
      it('enforces supplied roots while independently trialling fetched roots', async () => {
        kms.config.shouldValidateKMSCertificate = true;
        kms.config.caroots = providedRoots;
        const getEnforcedAsset = sinon.spy(kms, '_getCarootsAssetBytes');

        assert.equal(
          await kms._validateKMSStaticPubKey(validKey, await kms._getCaroots()),
          validKey
        );
        await report.returnValues[0];
        assert.notCalled(getEnforcedAsset);
        assert.calledOnceWithExactly(metric, 'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED', {
          fields: {success: false},
          tags: {
            reason: sinon.match(/^INVALID KMS: Certificate Validation failed/),
            kid: validKey.kid,
            validationMode: 'report-only',
          },
        });
      });
    });

    [undefined, {caroots: ['MIIconfigured']}].forEach((encryption) => {
      it(`does not load CA roots by default${
        encryption ? ' even with configured roots' : ''
      }`, async () => {
        const webex = new WebexCore({config: {encryption}});
        const {kms} = webex.internal.encryption;
        const getAssetBytes = sinon
          .stub(kms, '_getCarootsAssetBytes')
          .rejects(new Error('unexpected asset load'));

        try {
          assert.isFalse(webex.config.encryption.shouldValidateKMSCertificate);
          assert.isUndefined(await kms._getCaroots());
          assert.notCalled(getAssetBytes);
        } finally {
          getAssetBytes.restore();
        }
      });
    });

    // Node reads the package's own asset; browsers download it from the default
    // assetsBaseUrl (/assets/internal-plugin-encryption/), served by the test server.
    it('loads and verifies the shipped Cisco Union bundle', async () => {
      const webex = new WebexCore({
        config: {encryption: {shouldValidateKMSCertificate: true}},
      });

      const caroots = await webex.internal.encryption.kms._getCaroots();

      assert.isTrue(webex.config.encryption.shouldValidateKMSCertificate);
      assert.isAbove(caroots.length, 100);
      caroots.forEach((root) => assert.match(root, /^MII[A-Za-z0-9+/]+=*$/));
    });

    browserOnly(it)('fails closed when the asset cannot be downloaded', async () => {
      const webex = new WebexCore({
        config: {
          encryption: {
            shouldValidateKMSCertificate: true,
            assetsBaseUrl: '/assets/does-not-exist/',
          },
        },
      });

      const error = await webex.internal.encryption.kms._getCaroots().then(
        () => assert.fail('expected rejection'),
        (e) => e
      );

      assert.isTrue(error.kmsError);
      assert.include(error.message, 'HTTP 404');
    });
  });
});
