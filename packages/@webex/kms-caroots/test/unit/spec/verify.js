/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {
  verifyUnionBundle,
  UnionBundleVerificationError,
  TRS_BUNDLE_ROOT_CA,
} from '@webex/kms-caroots/verify';

import {createSigningChain, createBundle, DAY} from '../lib/bundle-factory';

// Cisco Union bundle signed 2026-10-22, pinned so tests don't depend on asset refreshes.
const FIXTURE_VERSION = 20261022;
const FIXTURE_SIGNING_TIME = '2026-10-22T04:41:57.000Z';
const FIXTURE_ROOT_COUNT = 231;
const TRS_ROOT_FINGERPRINT = 'dec669e322e07cd7c60a56904bf50c29fa1e75071723fc103577e27b226968d5';

const FIXTURE_NAME = 'ios_union.p7b';

let fixturePromise;

// Shared binary fixtures live in @webex/test-helper-server/static, which Karma
// serves under /fixtures/.
const readFixture = () => {
  if (typeof window === 'undefined') {
    // eslint-disable-next-line global-require
    const {readFileSync} = require('fs');
    // eslint-disable-next-line global-require
    const {join} = require('path');

    return Promise.resolve(
      new Uint8Array(
        readFileSync(join(__dirname, '../../../../test-helper-server/static', FIXTURE_NAME))
      )
    );
  }

  return fetch(`/fixtures/${FIXTURE_NAME}`).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load fixture ${FIXTURE_NAME}: HTTP ${response.status}`);
    }

    return response.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  });
};

const loadFixture = () => {
  if (!fixturePromise) {
    fixturePromise = readFixture();
  }

  return fixturePromise.then((bytes) => bytes.slice());
};

let chainPromise;

const getForgedChain = () => {
  if (!chainPromise) {
    chainPromise = createSigningChain();
  }

  return chainPromise;
};

const assertRejectsWithReason = async (promise, reason) => {
  const error = await promise.then(
    () => assert.fail('expected verification to fail'),
    (e) => e
  );

  assert.instanceOf(error, UnionBundleVerificationError);
  assert.equal(error.reason, reason, error.message);
};

describe('kms-caroots', () => {
  describe('verifyUnionBundle()', function () {
    // RSA key generation for forged bundles can be slow in browsers.
    if (this && this.timeout) {
      this.timeout(60000);
    }

    afterEach(() => {
      sinon.restore();
    });

    describe('with the real Cisco Union bundle', () => {
      it('verifies the bundle and extracts every CA root', async () => {
        const result = await verifyUnionBundle(await loadFixture());

        assert.equal(result.bundleName, 'Trusted Union Bundle');
        assert.equal(result.bundleVersion, FIXTURE_VERSION);
        assert.equal(result.signingTime.toISOString(), FIXTURE_SIGNING_TIME);
        assert.lengthOf(result.caroots, FIXTURE_ROOT_COUNT);
        assert.lengthOf(new Set(result.caroots), FIXTURE_ROOT_COUNT);
        result.caroots.forEach((root) => assert.match(root, /^MII[A-Za-z0-9+/]+=*$/));
      });

      it('accepts an ArrayBuffer', async () => {
        const result = await verifyUnionBundle((await loadFixture()).buffer);

        assert.lengthOf(result.caroots, FIXTURE_ROOT_COUNT);
      });

      it('still verifies years after the short-lived signing certificate expired', async () => {
        sinon.useFakeTimers({now: new Date(FIXTURE_SIGNING_TIME).getTime() + 5 * 365 * DAY});

        const result = await verifyUnionBundle(await loadFixture());

        assert.lengthOf(result.caroots, FIXTURE_ROOT_COUNT);
      });

      it('rejects a bundle whose content was modified', async () => {
        const bytes = await loadFixture();

        // Flip a byte inside the embedded certificate content.
        bytes[2000] ^= 1;

        await assertRejectsWithReason(verifyUnionBundle(bytes), 'signature');
      });

      it('rejects a bundle whose signature was modified', async () => {
        const bytes = await loadFixture();

        bytes[bytes.length - 300] ^= 1;

        await assertRejectsWithReason(verifyUnionBundle(bytes), 'signature');
      });

      it('rejects the bundle when it does not chain to the trust anchor', async () => {
        const {rootBase64} = await getForgedChain();

        await assertRejectsWithReason(
          verifyUnionBundle(await loadFixture(), {trustAnchors: [rootBase64]}),
          'signature'
        );
      });

      it('rejects a bundle older than minBundleVersion', async () => {
        await assertRejectsWithReason(
          verifyUnionBundle(await loadFixture(), {minBundleVersion: FIXTURE_VERSION + 1}),
          'version'
        );
      });

      it('accepts a bundle equal to minBundleVersion', async () => {
        const result = await verifyUnionBundle(await loadFixture(), {
          minBundleVersion: FIXTURE_VERSION,
        });

        assert.equal(result.bundleVersion, FIXTURE_VERSION);
      });

      it('rejects a bundle signed in the future', async () => {
        await assertRejectsWithReason(
          verifyUnionBundle(await loadFixture(), {
            now: new Date(new Date(FIXTURE_SIGNING_TIME).getTime() - 2 * DAY),
          }),
          'signing-time'
        );
      });
    });

    describe('with a forged bundle', () => {
      it('rejects a bundle signed by a self-signed root shipped inside the bundle', async () => {
        const bundle = await createBundle(await getForgedChain());

        await assertRejectsWithReason(verifyUnionBundle(bundle), 'signature');
      });

      it('verifies when the forged root is explicitly trusted', async () => {
        const chain = await getForgedChain();
        const result = await verifyUnionBundle(await createBundle(chain), {
          trustAnchors: [chain.rootBase64],
        });

        assert.deepEqual(result.caroots, [chain.rootBase64]);
      });

      it('removes duplicate certificates from the content', async () => {
        const chain = await getForgedChain();
        const bundle = await createBundle(chain, {
          contentCertificates: [chain.root.certificate, chain.root.certificate],
        });
        const result = await verifyUnionBundle(bundle, {trustAnchors: [chain.rootBase64]});

        assert.deepEqual(result.caroots, [chain.rootBase64]);
      });

      [
        {
          title: 'a different bundle name',
          options: {bundleName: 'Trusted Core Bundle'},
          reason: 'name',
        },
        {title: 'a malformed version', options: {bundleVersion: 'latest'}, reason: 'version'},
        {title: 'a short version', options: {bundleVersion: '2026'}, reason: 'version'},
        {
          title: 'an impossible version date',
          options: {bundleVersion: '20261340'},
          reason: 'version',
        },
        {
          title: 'a version dated after its signing time',
          options: {
            bundleVersion: new Date(Date.now() + 3 * DAY)
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, ''),
          },
          reason: 'version',
        },
        {
          title: 'a version older than minBundleVersion',
          options: {bundleVersion: '20250101'},
          verifyOptions: {minBundleVersion: 20261022},
          reason: 'version',
        },
      ].forEach(({title, options, verifyOptions = {}, reason}) => {
        it(`rejects a validly signed bundle with ${title}`, async () => {
          const chain = await getForgedChain();
          const bundle = await createBundle(chain, options);

          await assertRejectsWithReason(
            verifyUnionBundle(bundle, {...verifyOptions, trustAnchors: [chain.rootBase64]}),
            reason
          );
        });
      });

      it('rejects a retired signing key backdating a bundle to claim a newer version', async () => {
        const signerNotAfter = new Date(Date.now() - 870 * DAY);
        const chain = await createSigningChain({
          signerNotBefore: new Date(Date.now() - 900 * DAY),
          signerNotAfter,
        });
        const bundle = await createBundle(chain, {
          bundleVersion: '99991231',
          signingTime: new Date(signerNotAfter.getTime() - DAY),
        });

        await assertRejectsWithReason(
          verifyUnionBundle(bundle, {
            minBundleVersion: FIXTURE_VERSION,
            trustAnchors: [chain.rootBase64],
          }),
          'version'
        );
      });

      it('rejects a bundle signed when the signing certificate was not valid', async () => {
        const chain = await createSigningChain({
          signerNotBefore: new Date(Date.now() - 400 * DAY),
          signerNotAfter: new Date(Date.now() - 35 * DAY),
        });
        const bundle = await createBundle(chain, {signingTime: new Date(Date.now() - DAY)});

        await assertRejectsWithReason(
          verifyUnionBundle(bundle, {trustAnchors: [chain.rootBase64]}),
          'signature'
        );
      });
    });

    describe('with invalid input', () => {
      [
        {title: 'empty bytes', input: new Uint8Array(0)},
        {title: 'non-DER bytes', input: new Uint8Array([1, 2, 3, 4])},
        {title: 'a single certificate', input: TRS_BUNDLE_ROOT_CA},
      ].forEach(({title, input}) => {
        it(`rejects ${title}`, async () => {
          const bytes =
            typeof input === 'string'
              ? Uint8Array.from(atob(input), (char) => char.charCodeAt(0))
              : input;

          await assertRejectsWithReason(verifyUnionBundle(bytes), 'parse');
        });
      });

      it('rejects a non-binary input', async () => {
        await assertRejectsWithReason(verifyUnionBundle('not bytes'), 'parse');
      });
    });

    it('pins the documented TRS Bundle Root CA', async () => {
      const der = Uint8Array.from(atob(TRS_BUNDLE_ROOT_CA), (char) => char.charCodeAt(0));
      const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', der));
      const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');

      assert.equal(hex, TRS_ROOT_FINGERPRINT);
    });
  });
});
