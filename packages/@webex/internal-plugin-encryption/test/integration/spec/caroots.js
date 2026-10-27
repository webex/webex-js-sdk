/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import {assert} from '@webex/test-helper-chai';
import {browserOnly} from '@webex/test-helper-mocha';
import WebexCore from '@webex/webex-core';
import sinon from 'sinon';

describe('Encryption', function () {
  this.timeout(30000);

  describe('KMS CA roots', () => {
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
