/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import {assert} from '@webex/test-helper-chai';
import {browserOnly} from '@webex/test-helper-mocha';
import WebexCore, {StaticAssetLoader} from '@webex/webex-core';
import makeLocalUrl from '@webex/test-helper-make-local-url';
import sinon from 'sinon';

import {JS_SDK_KMS_CAROOTS_ASSET_LOAD_RESULT} from '../../../dist/constants';
import {caroots as providedRoots, validKey} from '../../fixtures/kms-certificate';

const assertLoadResult = (metric, kms, outcome = 'success', validationMode = 'report-only') => {
  assert.calledOnceWithExactly(
    metric.withArgs(JS_SDK_KMS_CAROOTS_ASSET_LOAD_RESULT),
    JS_SDK_KMS_CAROOTS_ASSET_LOAD_RESULT,
    {
      fields: {success: outcome === 'success'},
      tags: {outcome, validationMode, carootsAsset: kms.config.carootsAsset},
    }
  );
};

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
        assertLoadResult(metric, kms);
        assert.calledTwice(metric);
        assert.calledOnceWithExactly(
          metric.withArgs('JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED'),
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
        assert.isAbove((await kms._loadCaroots({reportOnly: true})).length, 100);
        assertLoadResult(metric, kms);
        assert.calledTwice(metric);
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
        assertLoadResult(metric, kms, 'verification-failed');
        assert.calledTwice(metric);
      });

      it('reports a failed application-hosted request without rejecting the key', async () => {
        kms.config.reportOnlyAssetsBaseUrl = assetUrl('does-not-exist');

        assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
        await report.returnValues[0];
        assertLoadResult(metric, kms, 'download-failed');
        assert.calledTwice(metric);
        assert.calledOnceWithExactly(
          metric.withArgs('JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED'),
          'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED',
          {
            fields: {success: false},
            tags: {
              reason: sinon.match(/HTTP 404/),
              assetsBaseUrl: kms.config.reportOnlyAssetsBaseUrl,
              validationMode: 'report-only',
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
        assertLoadResult(metric, kms);
        assert.calledTwice(metric);
        assert.calledOnceWithExactly(
          metric.withArgs('JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED'),
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
        assertLoadResult(metric, kms, 'success', 'enforced');
        assert.calledOnce(metric);
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
        assertLoadResult(metric, kms, 'download-failed', 'enforced');
        assert.calledTwice(metric);
      } finally {
        metric.restore();
      }
    });
  });
});
