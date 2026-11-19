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

const assertAssetStages = (metric, kms, outcome = 'success', validationMode = 'report-only') => {
  ['DOWNLOAD', 'VERIFICATION'].forEach((stage) => {
    const name = `JS_SDK_KMS_CAROOTS_ASSET_${stage}_SUCCESS`;
    const expected = stage === 'DOWNLOAD' ? outcome !== 'download-failed' : outcome === 'success';

    if (expected) {
      assert.calledOnceWithExactly(metric.withArgs(name), name, {
        fields: {success: true},
        tags: {validationMode, carootsAsset: kms.config.carootsAsset},
      });
    } else assert.notCalled(metric.withArgs(name));
  });
};

describe('Encryption', function () {
  this.timeout(30000);

  describe('KMS CA roots', () => {
    [false, true].forEach((enforced) => {
      it(`reports successful full certificate checks with enforcement ${enforced}`, async () => {
        const webex = new WebexCore({
          config: {
            services: {skipPreauthCatalogOnUnauthenticated: true},
            encryption: {
              shouldValidateKMSCertificate: enforced,
              carootsReportOnly: providedRoots,
            },
          },
        });
        const {kms} = webex.internal.encryption;
        const metric = sinon.stub(kms, '_submitMetric');

        try {
          assert.equal(await kms._validateKMSStaticPubKey(validKey, providedRoots), validKey);
          const expected = (validationMode) => [
            'JS_SDK_KMS_CERTIFICATE_VALIDATION_SUCCESS',
            {fields: {success: true}, tags: {validationMode, signatureValidation: 'enabled'}},
          ];

          assert.deepEqual(
            metric.args,
            enforced ? [expected('enforced'), expected('report-only')] : [expected('report-only')]
          );
        } finally {
          metric.restore();
        }
      });
    });

    it('does not report full certificate success for an identity-only check', async () => {
      const webex = new WebexCore({
        config: {services: {skipPreauthCatalogOnUnauthenticated: true}},
      });
      const {kms} = webex.internal.encryption;
      const metric = sinon.stub(kms, '_submitMetric');

      try {
        assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
        assert.notCalled(metric);
      } finally {
        metric.restore();
      }
    });

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
          config: {
            services: {skipPreauthCatalogOnUnauthenticated: true},
            encryption: {reportOnlyAssetsBaseUrl: assetUrl('internal-plugin-encryption')},
          },
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
        assertAssetStages(metric, kms);
        assert.equal(metric.callCount, kms.config.shouldValidateKMSCertificate ? 4 : 3);
        assert.calledOnceWithExactly(
          metric.withArgs('JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED'),
          'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: sinon.match(/^INVALID KMS: Certificate Validation failed/),
              kid: validKey.kid,
              validationMode: 'report-only',
              signatureValidation: 'enabled',
            },
          }
        );
        assert.isAbove((await kms._loadCaroots({reportOnly: true})).length, 100);
        assertAssetStages(metric, kms);
        assert.calledThrice(metric);
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
        assert.equal(metric.lastCall.args[0], 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED');
        assertAssetStages(metric, kms, 'verification-failed');
        assert.calledTwice(metric);
      });

      it('reports a failed application-hosted request without rejecting the key', async () => {
        kms.config.reportOnlyAssetsBaseUrl = assetUrl('does-not-exist');

        assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
        await report.returnValues[0];
        assertAssetStages(metric, kms, 'download-failed');
        assert.calledOnce(metric);
        assert.calledOnceWithExactly(
          metric.withArgs('JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED'),
          'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: sinon.match(/HTTP 404/),
              assetsBaseUrl: kms.config.reportOnlyAssetsBaseUrl,
              validationMode: 'report-only',
              carootsAsset: kms.config.carootsAsset,
            },
          }
        );
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
        assertAssetStages(metric, kms);
        assert.equal(metric.callCount, kms.config.shouldValidateKMSCertificate ? 4 : 3);
        assert.calledOnceWithExactly(
          metric.withArgs('JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED'),
          'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: sinon.match(/^INVALID KMS: Certificate Validation failed/),
              kid: validKey.kid,
              validationMode: 'report-only',
              signatureValidation: 'enabled',
            },
          }
        );
      });
    });

    [undefined, {caroots: ['MIIconfigured']}].forEach((encryption) => {
      it(`does not load CA roots by default${
        encryption ? ' even with configured roots' : ''
      }`, async () => {
        const webex = new WebexCore({
          config: {services: {skipPreauthCatalogOnUnauthenticated: true}, encryption},
        });
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
        config: {
          services: {skipPreauthCatalogOnUnauthenticated: true},
          encryption: {shouldValidateKMSCertificate: true},
        },
      });
      const {kms} = webex.internal.encryption;
      const metric = sinon.stub(kms, '_submitMetric');

      try {
        const caroots = await kms._getCaroots();

        assert.isTrue(webex.config.encryption.shouldValidateKMSCertificate);
        assert.isAbove(caroots.length, 100);
        caroots.forEach((root) => assert.match(root, /^MII[A-Za-z0-9+/]+=*$/));
        assert.equal(await kms._getCaroots(), caroots);
        assertAssetStages(metric, kms, 'success', 'enforced');
        assert.calledTwice(metric);
      } finally {
        metric.restore();
      }
    });

    browserOnly(it)('fails closed when the asset cannot be downloaded', async () => {
      const webex = new WebexCore({
        config: {
          services: {skipPreauthCatalogOnUnauthenticated: true},
          encryption: {
            shouldValidateKMSCertificate: true,
            assetsBaseUrl: '/assets/does-not-exist/',
          },
        },
      });

      const {kms} = webex.internal.encryption;
      const metric = sinon.stub(kms, '_submitMetric');

      try {
        const error = await kms._getCaroots().then(
          () => assert.fail('expected rejection'),
          (e) => e
        );

        assert.isTrue(error.kmsError);
        assert.include(error.message, 'HTTP 404');
        assertAssetStages(metric, kms, 'download-failed', 'enforced');
        assert.calledOnce(metric);
      } finally {
        metric.restore();
      }
    });
  });
});
