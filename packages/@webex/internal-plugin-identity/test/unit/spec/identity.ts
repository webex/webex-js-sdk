/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Identity from '@webex/internal-plugin-identity';
import {WEBEX_CA_PRODUCTION_ROOTS} from '@webex/internal-plugin-identity/src/constants';

// 'ABC' -> base64 'QUJD'; 'DEF' -> base64 'REVG'.
const LEAF_PEM = '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----';
const ROOT_PEM = '-----BEGIN CERTIFICATE-----\nREVG\n-----END CERTIFICATE-----';

describe('plugin-identity', () => {
  describe('Identity', () => {
    let webex;
    let webexRequest;
    let generateCsr;
    let identity;
    let privKeyDer;

    beforeEach(() => {
      privKeyDer = new Uint8Array(100);
      for (let i = 0; i < privKeyDer.length; i += 1) {
        privKeyDer[i] = i;
      }
      generateCsr = sinon.stub().resolves({privKeyDer, csr: 'BASE64CSR'});
      webex = MockWebex({children: {identity: Identity}});
      webexRequest = sinon.stub().resolves({body: `${LEAF_PEM}\n${ROOT_PEM}`});
      webex.request = webexRequest;
      identity = webex.internal.identity;
      identity._generateCsr = generateCsr;
      identity._isCredentialExpiringSoon = sinon.stub().returns(false);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('getTrustAnchors', () => {
      it('returns the Webex CA root and empty domain/user anchors', () => {
        assert.deepEqual(identity.getTrustAnchors(), {
          webexCaRoots: WEBEX_CA_PRODUCTION_ROOTS,
          domainNameRoots: '',
          userIdentityRoots: '',
        });
      });
    });

    describe('getCredentials', () => {
      it('creates a credential cache for each plugin instance', () => {
        const secondWebex = MockWebex({children: {identity: Identity}});
        const secondIdentity = secondWebex.internal.identity;

        assert.notStrictEqual(identity.credentialsCache, secondIdentity.credentialsCache);
      });

      it('generates a CSR, submits it to the CA and returns the raw key + cert chain', async () => {
        const credentials = await identity.getCredentials('user-1');

        assert.calledOnceWithExactly(generateCsr, 'user-1');

        const args = webexRequest.firstCall.args[0];

        assert.equal(args.method, 'POST');
        assert.equal(args.service, 'webex-certificate-authority');
        assert.equal(args.resource, 'certificates');
        assert.deepEqual(args.headers, {'include-root-cert': 'true'});
        assert.deepEqual(args.body, {csr: 'BASE64CSR'});

        // The raw EC P-256 key is bytes 36..67 of the PKCS#8 DER.
        assert.deepEqual(Array.from(credentials.privateKey), Array.from(privKeyDer.slice(36, 68)));
        assert.equal(credentials.certChain.length, 2);
        assert.deepEqual(Array.from(credentials.certChain[0]), [65, 66, 67]);
        assert.deepEqual(Array.from(credentials.certChain[1]), [68, 69, 70]);
      });

      it('caches credentials per contact and only requests once', async () => {
        const first = await identity.getCredentials('user-1');
        const second = await identity.getCredentials('user-1');

        assert.equal(first, second);
        assert.calledOnce(generateCsr);
        assert.calledOnce(webexRequest);
      });

      it('renews credentials when the cached leaf certificate is within one day of expiry', async () => {
        identity._isCredentialExpiringSoon.onCall(0).returns(true);

        const first = await identity.getCredentials('user-1');
        const renewed = await identity.getCredentials('user-1');
        const cachedRenewal = await identity.getCredentials('user-1');

        assert.notEqual(first, renewed);
        assert.equal(renewed, cachedRenewal);
        assert.calledTwice(generateCsr);
        assert.calledTwice(webexRequest);
      });

      it('shares one renewal when concurrent callers find a near-expiry certificate', async () => {
        await identity.getCredentials('user-1');
        identity._isCredentialExpiringSoon.returns(true);

        const [first, second] = await Promise.all([
          identity.getCredentials('user-1'),
          identity.getCredentials('user-1'),
        ]);

        assert.equal(first, second);
        assert.calledTwice(generateCsr);
        assert.calledTwice(webexRequest);
      });

      it('does not cache a failed attempt', async () => {
        webexRequest.onFirstCall().rejects(new Error('CA down'));
        webexRequest.onSecondCall().resolves({body: LEAF_PEM});

        await assert.isRejected(identity.getCredentials('user-1'), /CA down/);

        const credentials = await identity.getCredentials('user-1');

        assert.equal(credentials.certChain.length, 1);
        assert.calledTwice(webexRequest);
      });
    });
  });
});
