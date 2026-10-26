/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Identity from '../../../src/identity';
import {
  WEBEX_CA_FEDRAMP_ROOTS,
  WEBEX_CA_INTEGRATION_ROOTS,
  WEBEX_CA_PRODUCTION_ROOTS,
} from '@webex/internal-plugin-identity/src/constants';
import * as identityUtils from '../../../src/utils';

// 'ABC' -> base64 'QUJD'; 'DEF' -> base64 'REVG'.
const LEAF_PEM = '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----';
const ROOT_PEM = '-----BEGIN CERTIFICATE-----\nREVG\n-----END CERTIFICATE-----';

describe('plugin-identity', () => {
  describe('Identity', () => {
    let webex;
    let webexRequest;
    let generateCsrStub;
    let identity;
    let privKeyDer;

    beforeEach(() => {
      privKeyDer = new Uint8Array(100);
      for (let i = 0; i < privKeyDer.length; i += 1) {
        privKeyDer[i] = i;
      }
      generateCsrStub = sinon
        .stub(identityUtils, 'generateCsr')
        .resolves({privKeyDer, csr: 'BASE64CSR'});
      webex = MockWebex();
      webexRequest = sinon.stub().resolves({body: `${LEAF_PEM}\n${ROOT_PEM}`});
      webex.request = webexRequest;
      webex.internal = {
        services: {isIntegrationEnvironment: sinon.stub().returns(false)},
      };
      identity = new Identity({webex}, {parent: webex});
      sinon.stub(identityUtils, 'isCertificateExpiringSoon').returns(false);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('getTrustAnchors', () => {
      it('returns the Webex CA root and empty user identity anchors', () => {
        assert.deepEqual(identity.getTrustAnchors(), {
          webexCaRoots: `${WEBEX_CA_PRODUCTION_ROOTS}\n${WEBEX_CA_FEDRAMP_ROOTS}`,
          userIdentityRoots: '',
        });
      });

      it('returns the integration CA roots for integration environments', () => {
        webex.internal.services.isIntegrationEnvironment.returns(true);

        assert.deepEqual(identity.getTrustAnchors(), {
          webexCaRoots: WEBEX_CA_INTEGRATION_ROOTS,
          userIdentityRoots: '',
        });
      });

      it('defaults to production trust anchors when the environment cannot be determined', () => {
        webex.internal = undefined;

        assert.deepEqual(identity.getTrustAnchors(), {
          webexCaRoots: `${WEBEX_CA_PRODUCTION_ROOTS}\n${WEBEX_CA_FEDRAMP_ROOTS}`,
          userIdentityRoots: '',
        });
      });
    });

    describe('getCredentials', () => {
      it('creates a credential cache for each plugin instance', () => {
        const secondWebex = MockWebex();
        const secondIdentity = new Identity({webex: secondWebex}, {parent: secondWebex});

        assert.notStrictEqual(identity.credentialsCache, secondIdentity.credentialsCache);
      });

      it('generates a CSR, submits it to the CA and returns the raw key + cert chain', async () => {
        const credentials = await identity.getCredentials('user-1');

        assert.calledOnceWithExactly(generateCsrStub, 'user-1');

        const args = webexRequest.firstCall.args[0];

        assert.equal(args.method, 'POST');
        assert.equal(args.service, 'webex-certificate-authority');
        assert.equal(args.resource, 'certificates');
        assert.deepEqual(args.headers, {'include-root-cert': 'false'});
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
        assert.calledOnce(generateCsrStub);
        assert.calledOnce(webexRequest);
      });

      it('shares a single request for concurrent cache-miss callers', async () => {
        const [first, second] = await Promise.all([
          identity.getCredentials('user-1'),
          identity.getCredentials('user-1'),
        ]);

        assert.equal(first, second);
        assert.calledOnce(generateCsrStub);
        assert.calledOnce(webexRequest);
      });

      it('rejects and does not cache a response without a certificate chain', async () => {
        webexRequest.onFirstCall().resolves({body: '<html>certificate not found</html>'});
        webexRequest.onSecondCall().resolves({body: `${LEAF_PEM}\n${ROOT_PEM}`});

        await assert.isRejected(
          identity.getCredentials('user-1'),
          /Certificate authority response did not contain a certificate chain/
        );
        assert.isFalse(identity.credentialsCache.has('user-1'));

        const credentials = await identity.getCredentials('user-1');

        assert.equal(credentials.certChain.length, 2);
        assert.calledTwice(generateCsrStub);
        assert.calledTwice(webexRequest);
        // The empty-chain short-circuit must skip the expiry check entirely.
        assert.notCalled(identityUtils.isCertificateExpiringSoon);
      });

      it('does not cache a failed CSR generation and never calls the CA', async () => {
        generateCsrStub.onFirstCall().rejects(new Error('CSR failed'));

        await assert.isRejected(identity.getCredentials('user-1'), /CSR failed/);

        assert.notCalled(webexRequest);

        const credentials = await identity.getCredentials('user-1');

        assert.equal(credentials.certChain.length, 2);
        assert.calledTwice(generateCsrStub);
        assert.calledOnce(webexRequest);
      });

      it('renews credentials when the cached leaf certificate is within one day of expiry', async () => {
        identityUtils.isCertificateExpiringSoon.onCall(0).returns(true);

        const first = await identity.getCredentials('user-1');
        const renewed = await identity.getCredentials('user-1');
        const cachedRenewal = await identity.getCredentials('user-1');

        assert.notEqual(first, renewed);
        assert.equal(renewed, cachedRenewal);
        assert.calledTwice(generateCsrStub);
        assert.calledTwice(webexRequest);
      });

      it('shares one renewal when concurrent callers find a near-expiry certificate', async () => {
        await identity.getCredentials('user-1');
        identityUtils.isCertificateExpiringSoon.returns(true);

        const [first, second] = await Promise.all([
          identity.getCredentials('user-1'),
          identity.getCredentials('user-1'),
        ]);

        assert.equal(first, second);
        assert.calledTwice(generateCsrStub);
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
