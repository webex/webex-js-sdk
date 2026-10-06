/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';

import type {CertSigningRequest} from './types';

/**
 * Generates an EC P-256 key pair and a matching PKCS#10 CSR (subject CN = "email:<contactId>").
 * @param {string} contactId
 * @returns {Promise<CertSigningRequest>}
 */
export async function generateCsrWithPkijs(contactId: string): Promise<CertSigningRequest> {
  const keyPair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, [
    'sign',
    'verify',
  ]);

  const privKeyDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const pkcs10 = new pkijs.CertificationRequest();

  pkcs10.subject.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({
      type: '2.5.4.3',
      value: new asn1js.Utf8String({value: `email:${contactId}`}),
    })
  );

  await pkcs10.subjectPublicKeyInfo.importKey(keyPair.publicKey);
  await pkcs10.sign(keyPair.privateKey, 'SHA-256');

  const csrDer = pkcs10.toSchema().toBER(false);
  const csr = Buffer.from(csrDer).toString('base64');

  return {privKeyDer: new Uint8Array(privKeyDer), csr};
}

/**
 * Converts one PEM certificate block to DER bytes.
 * @param {string} pem
 * @returns {Uint8Array}
 */
export function pemToUint8Array(pem: string): Uint8Array {
  const contents = pem
    .split('\n')
    .filter((line) => !line.includes('-----BEGIN') && !line.includes('-----END'))
    .join('');
  const binary = atob(contents);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Converts concatenated PEM certificates to DER byte arrays.
 * @param {string} pemString
 * @returns {Uint8Array[]}
 */
export function pemToUint8Arrays(pemString: string): Uint8Array[] {
  const matches =
    pemString.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];

  return matches.map(pemToUint8Array);
}
