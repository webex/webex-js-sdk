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
    describe('emulated asset delivery failures', () => {
      const fixtureUrl = (scenario) =>
        makeLocalUrl(`/assets/kms-diagnostics/${scenario}/`, {full: true});
      const assertNoRawContent = (payload) => {
        const serialized = JSON.stringify(payload);

        [
          'private@example.invalid',
          'synthetic-secret-token',
          'fixture-private-cookie',
          '<html>',
          'Private title',
          'proxy.private.corp',
        ].forEach((secret) => assert.notInclude(serialized, secret));
      };
      let webex;
      let kms;
      let metric;

      beforeEach(() => {
        webex = new WebexCore({
          config: {
            services: {skipPreauthCatalogOnUnauthenticated: true},
            defaultRequestOptions: {timeout: 5000},
            encryption: {reportOnlyAssetsBaseUrl: fixtureUrl('html')},
          },
        });
        kms = webex.internal.encryption.kms;
        metric = sinon.stub(kms, '_submitMetric');
      });

      afterEach(() => sinon.restore());

      [
        {
          scenario: 'html',
          status: 200,
          mime: 'text/html',
          kind: 'html',
          htmlKind: 'access-denied',
          vendor: 'zscaler',
        },
        {
          scenario: 'html-binary',
          status: 200,
          mime: 'application/octet-stream',
          kind: 'html',
          htmlKind: 'access-denied',
          vendor: 'zscaler',
        },
        {
          scenario: 'cdn403',
          status: 403,
          mime: 'text/html',
          kind: 'http',
          htmlKind: 'access-denied',
          vendor: 'unknown',
        },
        {
          scenario: 'generic403',
          status: 403,
          mime: 'text/html',
          kind: 'http',
          htmlKind: 'access-denied',
          vendor: 'unknown',
        },
        {
          scenario: 'generic-html',
          status: 200,
          mime: 'text/html',
          kind: 'html',
          htmlKind: 'unknown',
          vendor: 'unknown',
        },
        {
          scenario: 'app-shell',
          status: 200,
          mime: 'text/html',
          kind: 'html',
          htmlKind: 'app-shell',
          vendor: 'unknown',
        },
        {
          scenario: 'hidden-headers',
          status: 200,
          mime: 'text/html',
          kind: 'html',
          htmlKind: 'access-denied',
          vendor: 'zscaler',
        },
      ].forEach(({scenario, status, mime, kind, htmlKind, vendor}) => {
        browserOnly(it)(
          `captures ${scenario} through a real request without blocking report-only setup`,
          async () => {
            kms.config.reportOnlyAssetsBaseUrl = fixtureUrl(scenario);
            const report = sinon.spy(kms, '_reportKMSStaticPubKey');

            assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
            await report.returnValues[0];
            assert.calledOnce(metric);
            const [name, payload] = metric.firstCall.args;

            assert.equal(name, 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED');
            assert.equal(payload.fields.success, false);
            assert.equal(payload.fields.httpStatus, status);
            assert.isAtLeast(payload.fields.durationMs, 0);
            assert.isAbove(payload.fields.responseBytes, 0);
            assert.isAtMost(payload.fields.inspectedBytes, 8192);
            assert.equal(payload.fields.responseContentType, mime);
            assert.match(payload.fields.htmlStructureHash, /^[a-f0-9]{64}$/);
            assert.equal(payload.tags.validationMode, 'report-only');
            assert.equal(payload.tags.failureKind, kind);
            assert.equal(payload.tags.htmlKind, htmlKind);
            assert.equal(payload.tags.htmlVendorHint, vendor);
            if (scenario === 'cdn403') {
              assert.equal(payload.fields.cdnRequestId, 'fixture-cdn-request');
              assert.equal(payload.fields.cdnPop, 'IAD55-P1');
              assert.equal(payload.fields.responseCache, 'Error from cloudfront');
            } else if (scenario.startsWith('html')) {
              assert.equal(payload.fields.cdnRequestId, 'fixture-hidden-request');
            } else assert.notProperty(payload.fields, 'cdnRequestId');
            if (scenario === 'hidden-headers') assert.notProperty(payload.fields, 'responseServer');
            assert.notProperty(payload.fields, 'responseVia');
            assertNoRawContent(payload);
          }
        );
      });

      ['html', 'html-binary', 'cdn403', 'generic403'].forEach((scenario) => {
        browserOnly(it)(`still rejects enforced root loading for ${scenario}`, async () => {
          kms.config.shouldValidateKMSCertificate = true;
          kms.config.assetsBaseUrl = fixtureUrl(scenario);

          await assert.isRejected(kms._getCaroots(), 'could not be loaded');
          assert.calledOnce(metric);
          assert.equal(metric.firstCall.args[1].tags.validationMode, 'enforced');
        });
      });

      ['network', 'cors-denied'].forEach((scenario) =>
        browserOnly(it)(`reports ${scenario} without fabricated response metadata`, async () => {
          // Direct access avoids the Karma proxy translating a reset connection into HTTP 502.
          kms.config.reportOnlyAssetsBaseUrl = fixtureUrl(scenario);
          const report = sinon.spy(kms, '_reportKMSStaticPubKey');

          assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
          await report.returnValues[0];
          assert.calledOnce(metric);
          const payload = metric.firstCall.args[1];

          assert.deepEqual(Object.keys(payload.fields).sort(), [
            'durationMs',
            'httpStatus',
            'success',
          ]);
          assert.equal(payload.fields.httpStatus, 0);
          assert.isAtLeast(payload.fields.durationMs, 0);
          assert.equal(payload.tags.failureKind, 'network');
          assert.equal(payload.tags.validationMode, 'report-only');
        })
      );

      browserOnly(it)(
        'verifies the same signed roots under explicit p7b and bin names without implicit fallback',
        async () => {
          const request = sinon.spy(StaticAssetLoader.prototype, 'request');
          const originalName = kms.config.carootsAsset;

          kms.config.shouldValidateKMSCertificate = true;
          kms.config.assetsBaseUrl = fixtureUrl('extension-block');
          await assert.isRejected(kms._getCaroots(), 'could not be loaded');
          assert.isTrue(request.getCalls().every(({args}) => !args[0].uri?.endsWith('.bin')));
          assert.equal(kms.config.carootsAsset, originalName);

          kms.config.carootsAsset = originalName.replace(/\.p7b$/, '.bin');
          const binRoots = await kms._getCaroots();

          kms.config.assetsBaseUrl = fixtureUrl('valid');
          kms.config.carootsAsset = originalName;
          assert.deepEqual(await kms._getCaroots(), binRoots);
          assert.lengthOf(binRoots, 231);
          assert.calledOnce(metric);
          request.getCalls().forEach(({args}) => assert.isFalse(args[0].addAuthHeader));
        }
      );

      browserOnly(it)(
        'rejects a tampered explicit bin alias and retries with the valid signed asset',
        async () => {
          kms.config.shouldValidateKMSCertificate = true;
          kms.config.carootsAsset = kms.config.carootsAsset.replace(/\.p7b$/, '.bin');
          kms.config.assetsBaseUrl = fixtureUrl('tampered');
          await assert.isRejected(kms._getCaroots(), 'failed verification');
          assert.calledOnce(metric);
          assert.equal(metric.firstCall.args[0], 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED');

          kms.config.assetsBaseUrl = fixtureUrl('valid');
          assert.lengthOf(await kms._getCaroots(), 231);
          assert.calledOnce(metric);
        }
      );
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
        assert.calledOnce(metric);
        assert.equal(metric.firstCall.args[0], 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED');
        assert.include(metric.firstCall.args[1].fields, {success: false, httpStatus: 404});
        assert.include(metric.firstCall.args[1].tags, {
          assetsBaseUrl: kms.config.reportOnlyAssetsBaseUrl,
          validationMode: 'report-only',
          failureKind: 'http',
        });
        assert.match(metric.firstCall.args[1].tags.reason, /HTTP 404/);
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

      const metric = sinon.stub(webex.internal.encryption.kms, '_submitMetric');

      try {
        const error = await webex.internal.encryption.kms._getCaroots().then(
          () => assert.fail('expected rejection'),
          (e) => e
        );

        assert.isTrue(error.kmsError);
        assert.include(error.message, 'HTTP 404');
      } finally {
        metric.restore();
      }
    });
  });
});
