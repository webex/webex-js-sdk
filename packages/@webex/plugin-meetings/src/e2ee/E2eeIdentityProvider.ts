/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';

import LoggerProxy from '../common/logs/logger-proxy';
import {CERTIFICATE_AUTHORITY_SERVICE, WEBEX_CA_PRODUCTION_ROOTS} from './constants';
import type {WebexRequestMethod} from '../common/types';
import type {E2eeCredentials, E2eeTrustAnchors} from './types';

// PKCS#8 P-256: the raw 32-byte EC private key starts at this offset in the DER encoding.
const PKCS8_P256_RAW_KEY_OFFSET = 36;
const RAW_EC_P256_KEY_LENGTH = 32;

/** A generated certificate signing request plus its private key (PKCS#8 DER). */
export interface CertSigningRequest {
  privKeyDer: Uint8Array;
  csr: string; // base64-encoded DER (no PEM headers)
}

/** Generates a CSR; injectable so the identity provider can be tested without WebCrypto/pkijs. */
export type CsrGenerator = (contactId: string) => Promise<CertSigningRequest>;

/**
 * Generates an EC P-256 key pair and a matching PKCS#10 CSR (subject CN = "email:<contactId>").
 * @param {string} contactId
 * @returns {Promise<CertSigningRequest>}
 */
async function generateCsrWithPkijs(contactId: string): Promise<CertSigningRequest> {
  const keyPair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, [
    'sign',
    'verify',
  ]);

  const privKeyDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const pkcs10 = new pkijs.CertificationRequest();

  pkcs10.subject.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({
      type: '2.5.4.3', // Common Name
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
 * Converts a single PEM block to DER (ArrayBuffer).
 * @param {string} pem
 * @returns {ArrayBuffer}
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
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
 * Converts one-or-more concatenated PEM certificates to an array of DER ArrayBuffers.
 * @param {string} pemString
 * @returns {ArrayBuffer[]}
 */
function pemToArrayBuffers(pemString: string): ArrayBuffer[] {
  const matches =
    pemString.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];

  return matches.map(pemToArrayBuffer);
}

/**
 * Meetings-plugin-level singleton that provides the per-device E2EE identity: it generates a CSR,
 * has it signed by the Webex Certificate Authority, and returns the resulting credentials (cached
 * per user for reuse across meetings) plus the MLS trust anchors.
 */
export default class E2eeIdentityProvider {
  private readonly webexRequest: WebexRequestMethod;

  private readonly generateCsr: CsrGenerator;

  private readonly credentialsCache = new Map<string, Promise<E2eeCredentials>>();

  /**
   * @param {Object} deps
   * @param {WebexRequestMethod} deps.webexRequest - The (bound) webex.request method.
   * @param {CsrGenerator} [deps.generateCsr] - CSR generator override (used by tests).
   */
  constructor({
    webexRequest,
    generateCsr,
  }: {
    webexRequest: WebexRequestMethod;
    generateCsr?: CsrGenerator;
  }) {
    this.webexRequest = webexRequest;
    this.generateCsr = generateCsr ?? generateCsrWithPkijs;
  }

  /**
   * @returns {E2eeTrustAnchors} trust anchors for validating member certificates.
   */
  getTrustAnchors(): E2eeTrustAnchors {
    LoggerProxy.logger.info('e2ee: E2eeIdentityProvider --> getTrustAnchors');

    return {
      webexCaRoots: WEBEX_CA_PRODUCTION_ROOTS,
      domainNameRoots: '',
      userIdentityRoots: '',
    };
  }

  /**
   * Returns E2EE credentials for the given contact/user, generating and caching them on first use.
   * @param {string} contactId
   * @returns {Promise<E2eeCredentials>}
   */
  getCredentials(contactId: string): Promise<E2eeCredentials> {
    let credentials = this.credentialsCache.get(contactId);

    if (!credentials) {
      LoggerProxy.logger.info(
        'e2ee: E2eeIdentityProvider --> getCredentials: cache miss, requesting new credentials'
      );
      credentials = this.requestCredentials(contactId);
      this.credentialsCache.set(contactId, credentials);
      // Don't cache a rejected attempt: allow a retry on the next call.
      credentials.catch(() => this.credentialsCache.delete(contactId));
    } else {
      LoggerProxy.logger.info(
        'e2ee: E2eeIdentityProvider --> getCredentials: returning cached credentials'
      );
    }

    return credentials;
  }

  /**
   * @param {string} contactId
   * @returns {Promise<E2eeCredentials>}
   */
  private async requestCredentials(contactId: string): Promise<E2eeCredentials> {
    LoggerProxy.logger.info('e2ee: E2eeIdentityProvider --> requestCredentials: generating CSR');
    const {privKeyDer, csr} = await this.generateCsr(contactId);

    LoggerProxy.logger.info(
      'e2ee: E2eeIdentityProvider --> requestCredentials: requesting certificate from CA'
    );
    const response = await this.webexRequest({
      method: 'POST',
      service: CERTIFICATE_AUTHORITY_SERVICE,
      resource: 'certificates',
      headers: {'include-root-cert': 'true'},
      body: {csr},
    });

    LoggerProxy.logger.info(
      'e2ee: E2eeIdentityProvider --> requestCredentials: received signed certificate from CA'
    );
    const privateKey = privKeyDer.slice(
      PKCS8_P256_RAW_KEY_OFFSET,
      PKCS8_P256_RAW_KEY_OFFSET + RAW_EC_P256_KEY_LENGTH
    );

    return {privateKey, certChain: pemToArrayBuffers(response.body)};
  }
}
