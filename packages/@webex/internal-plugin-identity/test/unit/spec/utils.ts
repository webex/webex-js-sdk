/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import 'jsdom-global/register';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import {assert} from '@webex/test-helper-chai';

import {
  generateCsrWithPkijs,
  isCertificateExpiringSoon,
  pemToUint8Array,
  pemToUint8Arrays,
} from '../../../src/utils';

async function makeCertificate(notAfter: Date): Promise<Uint8Array> {
  const certificate = new pkijs.Certificate();

  certificate.version = 2;
  certificate.serialNumber = new asn1js.Integer({value: 1});
  certificate.issuer.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({
      type: '2.5.4.3',
      value: new asn1js.Utf8String({value: 'Test'}),
    })
  );
  certificate.subject.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({
      type: '2.5.4.3',
      value: new asn1js.Utf8String({value: 'Test'}),
    })
  );
  certificate.notBefore.value = new Date('2026-01-01T00:00:00Z');
  certificate.notAfter.value = notAfter;

  const keyPair = await crypto.subtle.generateKey(
    {name: 'ECDSA', namedCurve: 'P-256'},
    true,
    ['sign', 'verify']
  );

  await certificate.subjectPublicKeyInfo.importKey(keyPair.publicKey);
  await certificate.sign(keyPair.privateKey, 'SHA-256');

  return new Uint8Array(certificate.toSchema().toBER(false));
}

describe('identity utils', () => {
  describe('isCertificateExpiringSoon', () => {
    it('returns true when the leaf certificate expires within one day', async () => {
      const now = new Date('2026-10-08T12:00:00Z');
      const certificate = await makeCertificate(new Date(now.getTime() + 23 * 60 * 60 * 1000));

      assert.isTrue(isCertificateExpiringSoon(certificate, now.getTime()));
    });

    it('returns false when the leaf certificate expires after one day', async () => {
      const now = new Date('2026-10-08T12:00:00Z');
      const certificate = await makeCertificate(new Date(now.getTime() + 25 * 60 * 60 * 1000));

      assert.isFalse(isCertificateExpiringSoon(certificate, now.getTime()));
    });

    it('treats an unreadable certificate as needing renewal', () => {
      assert.isTrue(isCertificateExpiringSoon(new Uint8Array([1, 2, 3])));
    });
  });

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
