/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import 'jsdom-global/register';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import {assert} from '@webex/test-helper-chai';

import {generateCsrWithPkijs, pemToUint8Array, pemToUint8Arrays} from '../../../src/utils';

describe('identity utils', () => {
  describe('generateCsrWithPkijs', () => {
    it('generates a P-256 CSR with the contact ID as subject and a valid signature', async () => {
      const contactId = 'user@example.com';
      const {privKeyDer, csr} = await generateCsrWithPkijs(contactId);
      const csrBytes = Uint8Array.from(atob(csr), (character) => character.charCodeAt(0));
      const parsedCsr = asn1js.fromBER(csrBytes.buffer);
      const request = new pkijs.CertificationRequest({schema: parsedCsr.result});

      assert.instanceOf(privKeyDer, Uint8Array);
      assert.notEqual(parsedCsr.offset, -1);
      assert.equal(request.subject.typesAndValues[0].value.valueBlock.value, `email:${contactId}`);
      assert.isTrue(await request.verify());
    });
  });

  describe('pemToUint8Array', () => {
    it('decodes one PEM certificate block to DER bytes', () => {
      const pem = '-----BEGIN CERTIFICATE-----\nQU\nJD\n-----END CERTIFICATE-----';

      assert.deepEqual(Array.from(pemToUint8Array(pem)), [65, 66, 67]);
    });
  });

  describe('pemToUint8Arrays', () => {
    it('decodes each certificate in a concatenated PEM chain', () => {
      const pem = [
        '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----',
        '-----BEGIN CERTIFICATE-----\nREVG\n-----END CERTIFICATE-----',
      ].join('\n');

      assert.deepEqual(
        pemToUint8Arrays(pem).map((certificate) => Array.from(certificate)),
        [
          [65, 66, 67],
          [68, 69, 70],
        ]
      );
    });

    it('returns an empty chain when the response has no certificate blocks', () => {
      assert.deepEqual(pemToUint8Arrays('no certificates'), []);
    });
  });
});
