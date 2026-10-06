/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import {WebexPlugin} from '@webex/webex-core';

import {CERTIFICATE_AUTHORITY_SERVICE, WEBEX_CA_PRODUCTION_ROOTS} from './constants';
import type {CertSigningRequest, IdentityCredentials, IdentityTrustAnchors} from './types';

// PKCS#8 P-256: the raw 32-byte EC private key starts at this offset in the DER encoding.
const PKCS8_P256_RAW_KEY_OFFSET = 36;
const RAW_EC_P256_KEY_LENGTH = 32;

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
 * Converts concatenated PEM certificates to DER buffers.
 * @param {string} pemString
 * @returns {ArrayBuffer[]}
 */
function pemToArrayBuffers(pemString: string): ArrayBuffer[] {
  const matches =
    pemString.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];

  return matches.map(pemToArrayBuffer);
}

const Identity = WebexPlugin.extend({
  namespace: 'Identity',

  /** @type {Map<string, Promise<IdentityCredentials>>} */
  credentialsCache: new Map(),

  /** @returns {undefined} */
  initialize(...args) {
    Reflect.apply(WebexPlugin.prototype.initialize, this, args);
    this.credentialsCache = new Map();
    this._generateCsr = generateCsrWithPkijs;
  },

  /**
   * @returns {IdentityTrustAnchors} trust anchors for validating member certificates.
   */
  getTrustAnchors(): IdentityTrustAnchors {
    this.logger.info('identity: getTrustAnchors');

    return {
      webexCaRoots: WEBEX_CA_PRODUCTION_ROOTS,
      domainNameRoots: '', // todo (ucf uses domain_name_roots.p7b file)
      userIdentityRoots: '',
    };
  },

  /**
   * Returns credentials for the given contact, generating and caching them on first use.
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials>}
   */
  getCredentials(contactId: string): Promise<IdentityCredentials> {
    let credentials = this.credentialsCache.get(contactId);

    if (!credentials) {
      this.logger.info('identity: getCredentials: cache miss, requesting new credentials');
      credentials = this._requestCredentials(contactId);
      this.credentialsCache.set(contactId, credentials);
      credentials.catch(() => this.credentialsCache.delete(contactId));
    } else {
      this.logger.info('identity: getCredentials: returning cached credentials');
    }

    return credentials;
  },

  /**
   * CSR generation is an overridable seam for unit tests and alternate identity backends.
   * @param {string} contactId
   * @returns {Promise<CertSigningRequest>}
   * @private
   */
  _generateCsr(contactId: string): Promise<CertSigningRequest> {
    return generateCsrWithPkijs(contactId);
  },

  /**
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials>}
   * @private
   */
  async _requestCredentials(contactId: string): Promise<IdentityCredentials> {
    this.logger.info('identity: requestCredentials: generating CSR');
    const {privKeyDer, csr} = await this._generateCsr(contactId);

    this.logger.info('identity: requestCredentials: requesting certificate from CA');
    const response = await this.webex.request({
      method: 'POST',
      service: CERTIFICATE_AUTHORITY_SERVICE,
      resource: 'certificates',
      headers: {'include-root-cert': 'true'},
      body: {csr},
    });

    this.logger.info('identity: requestCredentials: received signed certificate from CA');
    const privateKey = privKeyDer.slice(
      PKCS8_P256_RAW_KEY_OFFSET,
      PKCS8_P256_RAW_KEY_OFFSET + RAW_EC_P256_KEY_LENGTH
    );

    return {privateKey, certChain: pemToArrayBuffers(response.body)};
  },
});

export default Identity;
