/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import {assert} from '@webex/test-helper-chai';
import {browserOnly} from '@webex/test-helper-mocha';
import WebexCore from '@webex/webex-core';
import sinon from 'sinon';

import {validKey} from '../../fixtures/kms-certificate';

describe('Encryption', function () {
  this.timeout(30000);

  describe('KMS CA roots', () => {
    describe('background report-only roots', () => {
      let kms;
      let report;
      let metric;

      beforeEach(() => {
        const webex = new WebexCore({
          config: {encryption: {shouldValidateKMSCertificateReportOnly: true}},
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

        assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
        await report.returnValues[0];
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
        const getBytes = sinon.stub(kms, '_getCarootsAssetBytes').returns(
          new Promise((resolve) => {
            complete = resolve;
          })
        );

        try {
          assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
          assert.calledOnceWithExactly(getBytes);
          assert.notCalled(metric);
        } finally {
          complete(new Uint8Array([1, 2, 3]));
          if (report.called) await report.returnValues[0];
        }
        assert.equal(metric.firstCall.args[0], 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED');
        assert.calledOnce(metric);
      });

      browserOnly(it)(
        'reports a failed application-hosted request without rejecting the key',
        async () => {
          kms.config.assetsBaseUrl = '/assets/does-not-exist/';

          assert.equal(await kms._validateKMSStaticPubKey(validKey), validKey);
          await report.returnValues[0];
          assert.calledOnceWithExactly(metric, 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED', {
            fields: {success: false},
            tags: {
              reason: sinon.match(/HTTP 404/),
              assetsBaseUrl: '/assets/does-not-exist/',
            },
          });
        }
      );
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
