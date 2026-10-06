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
  const csr = btoa(String.fromCharCode(...new Uint8Array(csrDer)));

  return {privKeyDer: new Uint8Array(privKeyDer), csr};
}

/**
 * Converts one PEM certificate block to DER.
 * @param {string} pem
 * @returns {ArrayBuffer}
 */
export function pemToArrayBuffer(pem: string): ArrayBuffer {
  const contents = pem
    .split('\n')
    .filter((line) => !line.includes('-----BEGIN') && !line.includes('-----END'))
    .join('');
  const binary = atob(contents);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Converts concatenated PEM certificates to DER buffers.
 * @param {string} pemString
 * @returns {ArrayBuffer[]}
 */
export function pemToArrayBuffers(pemString: string): ArrayBuffer[] {
  const matches =
    pemString.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];

  return matches.map(pemToArrayBuffer);
}
