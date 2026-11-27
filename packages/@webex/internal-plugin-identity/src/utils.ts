/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';

import type {CertSigningRequest} from './types';

export const CERTIFICATE_RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Returns whether an X.509 certificate expires within the renewal window.
 * An unreadable certificate is treated as expiring so malformed cached credentials are refreshed.
 * @param {Uint8Array} certificateDer
 * @param {number} [now]
 * @returns {boolean}
 */
export function isCertificateExpiringSoon(certificateDer: Uint8Array, now = Date.now()): boolean {
  try {
    const {offset, result} = asn1js.fromBER(certificateDer);

    if (offset === -1) {
      return true;
    }

    const certificate = new pkijs.Certificate({schema: result});

    return certificate.notAfter.value.getTime() - now < CERTIFICATE_RENEWAL_WINDOW_MS;
  } catch (_error) {
    return true;
  }
}

/**
 * Generates an EC P-256 key pair and a matching PKCS#10 CSR (subject CN = "email:<contactId>").
 * @param {string} contactId
 * @returns {Promise<CertSigningRequest>}
 */
export async function generateCsr(contactId: string): Promise<CertSigningRequest> {
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
  const csrBase64 = Buffer.from(csrDer).toString('base64');
  const csrPem = `-----BEGIN CERTIFICATE REQUEST-----\n${csrBase64
    .match(/.{1,64}/g)
    ?.join('\n')}\n-----END CERTIFICATE REQUEST-----`;

  return {privKeyDer: new Uint8Array(privKeyDer), csr: csrBase64, csrPem};
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

/**
 * Converts a PKCS#8 P-256 private key and leaf-first PEM certificate chain to meeting credentials.
 * @param {string} privateKeyPkcs8Pem
 * @param {string} certificateChainPem
 * @returns {Promise<{privateKey: Uint8Array, certChain: Uint8Array[]}>}
 */
export async function parseUserIdentityCredentials(
  privateKeyPkcs8Pem: string,
  certificateChainPem: string
): Promise<{privateKey: Uint8Array; certChain: Uint8Array[]}> {
  const privateKeyPem = privateKeyPkcs8Pem.match(
    /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/
  )?.[0];

  if (!privateKeyPem) {
    throw new Error('Private key must be an unencrypted PKCS#8 PEM block');
  }

  const privateKeyDer = pemToUint8Array(privateKeyPem);
  const certChain = pemToUint8Arrays(certificateChainPem);

  if (certChain.length === 0 || certChain.some((certificate) => certificate.length === 0)) {
    throw new Error('Certificate chain PEM must contain at least one certificate');
  }

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyDer.buffer as ArrayBuffer,
    {name: 'ECDSA', namedCurve: 'P-256'},
    true,
    ['sign']
  );
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', privateKey);

  if (!privateKeyJwk.d) {
    throw new Error('Unable to read the P-256 private key');
  }

  const privateKeyBase64 = privateKeyJwk.d.replace(/-/g, '+').replace(/_/g, '/');
  const rawPrivateKey = Uint8Array.from(
    atob(`${privateKeyBase64}${'='.repeat((4 - (privateKeyBase64.length % 4)) % 4)}`),
    (character) => character.charCodeAt(0)
  );

  if (rawPrivateKey.length !== 32) {
    throw new Error('Private key must be an EC P-256 key');
  }

  const {offset, result} = asn1js.fromBER(certChain[0]);

  if (offset === -1) {
    throw new Error('Leaf certificate is not valid DER');
  }

  const leafCertificate = new pkijs.Certificate({schema: result});
  const publicKeyDer = leafCertificate.subjectPublicKeyInfo.toSchema().toBER(false);
  const publicKey = await crypto.subtle.importKey(
    'spki',
    publicKeyDer,
    {name: 'ECDSA', namedCurve: 'P-256'},
    false,
    ['verify']
  );
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const signature = await crypto.subtle.sign(
    {name: 'ECDSA', hash: 'SHA-256'},
    privateKey,
    challenge
  );
  const keyMatchesCertificate = await crypto.subtle.verify(
    {name: 'ECDSA', hash: 'SHA-256'},
    publicKey,
    signature,
    challenge
  );

  if (!keyMatchesCertificate) {
    throw new Error('Private key does not match the leaf certificate');
  }

  return {privateKey: rawPrivateKey, certChain};
}
