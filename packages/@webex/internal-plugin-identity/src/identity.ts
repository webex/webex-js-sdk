/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';

import {CERTIFICATE_AUTHORITY_SERVICE, WEBEX_CA_PRODUCTION_ROOTS} from './constants';
import type {CertSigningRequest, IdentityCredentials, IdentityTrustAnchors} from './types';
import {
  CERTIFICATE_RENEWAL_WINDOW_MS,
  generateCsrWithPkijs,
  isCertificateExpiringSoon,
  pemToUint8Arrays,
} from './utils';

// PKCS#8 P-256: the raw 32-byte EC private key starts at this offset in the DER encoding.
const PKCS8_P256_RAW_KEY_OFFSET = 36;
const RAW_EC_P256_KEY_LENGTH = 32;

const Identity = WebexPlugin.extend({
  namespace: 'Identity',

  /** @returns {undefined} */
  initialize(...args) {
    Reflect.apply(WebexPlugin.prototype.initialize, this, args);
    this.credentialsCache = new Map();
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
    const cachedCredentials = this.credentialsCache.get(contactId);

    if (cachedCredentials) {
      this.logger.info('identity: getCredentials: checking cached certificate expiry');

      return cachedCredentials.then((credentials) => {
        if (!this._isCredentialExpiringSoon(credentials)) {
          this.logger.info('identity: getCredentials: returning cached credentials');

          return credentials;
        }

        this.logger.info(
          `identity: getCredentials: cached certificate expires within ${CERTIFICATE_RENEWAL_WINDOW_MS}ms, requesting new credentials`
        );

        return this._refreshCredentials(contactId, cachedCredentials);
      });
    }

    this.logger.info('identity: getCredentials: cache miss, requesting new credentials');

    return this._cacheCredentials(contactId);
  },

  /**
   * Returns whether the cached leaf certificate is near expiry.
   * @param {IdentityCredentials} credentials
   * @returns {boolean}
   * @private
   */
  _isCredentialExpiringSoon(credentials: IdentityCredentials): boolean {
    const leafCertificate = credentials.certChain[0];

    return !leafCertificate || isCertificateExpiringSoon(leafCertificate);
  },

  /**
   * Replaces a cached credential request if it is still the current cache entry. This prevents
   * concurrent callers from triggering duplicate renewals for the same contact.
   * @param {string} contactId
   * @param {Promise<IdentityCredentials>} cachedCredentials
   * @returns {Promise<IdentityCredentials>}
   * @private
   */
  _refreshCredentials(
    contactId: string,
    cachedCredentials: Promise<IdentityCredentials>
  ): Promise<IdentityCredentials> {
    if (this.credentialsCache.get(contactId) !== cachedCredentials) {
      return this.credentialsCache.get(contactId) ?? this._cacheCredentials(contactId);
    }

    return this._cacheCredentials(contactId);
  },

  /**
   * Requests credentials and caches the in-flight promise so concurrent callers share it.
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials>}
   * @private
   */
  _cacheCredentials(contactId: string): Promise<IdentityCredentials> {
    const credentials = this._requestCredentials(contactId);

    this.credentialsCache.set(contactId, credentials);
    credentials.catch(() => {
      if (this.credentialsCache.get(contactId) === credentials) {
        this.credentialsCache.delete(contactId);
      }
    });

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

    return {privateKey, certChain: pemToUint8Arrays(response.body)};
  },
});

export default Identity;
