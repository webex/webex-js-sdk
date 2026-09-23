/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeIdentityProvider from '@webex/plugin-meetings/src/e2ee/E2eeIdentityProvider';
import {WEBEX_CA_PRODUCTION_ROOTS} from '@webex/plugin-meetings/src/e2ee/constants';

// 'ABC' -> base64 'QUJD'; 'DEF' -> base64 'REVG'.
const LEAF_PEM = '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----';
const ROOT_PEM = '-----BEGIN CERTIFICATE-----\nREVG\n-----END CERTIFICATE-----';

describe('plugin-meetings', () => {
  describe('E2eeIdentityProvider', () => {
    let webex;
    let generateCsr;
    let provider;
    let privKeyDer;

    beforeEach(() => {
      privKeyDer = new Uint8Array(100);
      for (let i = 0; i < privKeyDer.length; i += 1) {
        privKeyDer[i] = i;
      }
      generateCsr = sinon.stub().resolves({privKeyDer, csr: 'BASE64CSR'});
      webex = {request: sinon.stub().resolves({body: `${LEAF_PEM}\n${ROOT_PEM}`})};
      provider = new E2eeIdentityProvider({webex, generateCsr});
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('getTrustAnchors', () => {
      it('returns the webex CA root and empty domain/user anchors', () => {
        assert.deepEqual(provider.getTrustAnchors(), {
          webexCaRoots: WEBEX_CA_PRODUCTION_ROOTS,
          domainNameRoots: '',
          userIdentityRoots: '',
        });
      });
    });

    describe('getCredentials', () => {
      it('generates a CSR, submits it to the CA and returns the raw key + cert chain', async () => {
        const credentials = await provider.getCredentials('user-1');

        assert.calledOnceWithExactly(generateCsr, 'user-1');

        const args = webex.request.firstCall.args[0];

        assert.equal(args.method, 'POST');
        assert.equal(args.service, 'webex-certificate-authority');
        assert.equal(args.resource, 'certificates');
        assert.deepEqual(args.headers, {'include-root-cert': 'true'});
        assert.deepEqual(args.body, {csr: 'BASE64CSR'});

        // The raw EC P-256 key is bytes 36..67 of the PKCS#8 DER.
        assert.deepEqual(Array.from(credentials.privateKey), Array.from(privKeyDer.slice(36, 68)));
        assert.equal(credentials.certChain.length, 2);
        assert.deepEqual(Array.from(new Uint8Array(credentials.certChain[0])), [65, 66, 67]);
        assert.deepEqual(Array.from(new Uint8Array(credentials.certChain[1])), [68, 69, 70]);
      });

      it('caches credentials per contact and only requests once', async () => {
        const first = await provider.getCredentials('user-1');
        const second = await provider.getCredentials('user-1');

        assert.equal(first, second);
        assert.calledOnce(generateCsr);
        assert.calledOnce(webex.request);
      });

      it('does not cache a failed attempt', async () => {
        webex.request.onFirstCall().rejects(new Error('CA down'));
        webex.request.onSecondCall().resolves({body: LEAF_PEM});

        await assert.isRejected(provider.getCredentials('user-1'), /CA down/);

        const credentials = await provider.getCredentials('user-1');

        assert.equal(credentials.certChain.length, 1);
        assert.calledTwice(webex.request);
      });
    });
  });
});
