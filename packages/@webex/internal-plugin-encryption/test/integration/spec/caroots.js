/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import {assert} from '@webex/test-helper-chai';
import {browserOnly} from '@webex/test-helper-mocha';
import WebexCore from '@webex/webex-core';

describe('Encryption', function () {
  this.timeout(30000);

  describe('KMS CA roots', () => {
    // Node reads the package's own asset; browsers download it from the default
    // assetsBaseUrl (/assets/internal-plugin-encryption/), served by the test server.
    it('loads and verifies the shipped Cisco Union bundle', async () => {
      const webex = new WebexCore();

      const caroots = await webex.internal.encryption.kms._getCaroots();

      assert.isAbove(caroots.length, 100);
      caroots.forEach((root) => assert.match(root, /^MII[A-Za-z0-9+/]+=*$/));
    });

    browserOnly(it)('fails closed when the asset cannot be downloaded', async () => {
      const webex = new WebexCore({
        config: {encryption: {assetsBaseUrl: '/assets/does-not-exist/'}},
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
