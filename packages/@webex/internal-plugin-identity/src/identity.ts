/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';

import {
  CERTIFICATE_AUTHORITY_SERVICE,
  WEBEX_CA_FEDRAMP_ROOTS,
  WEBEX_CA_INTEGRATION_ROOTS,
  WEBEX_CA_PRODUCTION_ROOTS,
} from './constants';
import type {IdentityCredentials, IdentityTrustAnchors} from './types';
import {
  CERTIFICATE_RENEWAL_WINDOW_MS,
  generateCsr,
  isCertificateExpiringSoon,
  pemToUint8Arrays,
} from './utils';

// PKCS#8 P-256: the raw 32-byte EC private key starts at this offset in the DER encoding.
const PKCS8_P256_RAW_KEY_OFFSET = 36;
const RAW_EC_P256_KEY_LENGTH = 32;

class Identity extends WebexPlugin {
  namespace = 'Identity';
  credentialsCache: Map<string, Promise<IdentityCredentials>>;

  constructor(attrs = {}, options = {}) {
    super(attrs, options);
    this.credentialsCache = new Map();
  }

  /**
   * @returns {IdentityTrustAnchors} trust anchors for validating member certificates.
   */
  getTrustAnchors(): IdentityTrustAnchors {
    const isIntegrationEnvironment =
      this.webex.internal?.services?.isIntegrationEnvironment?.() ?? false;
    const webexCaRoots = isIntegrationEnvironment
      ? WEBEX_CA_INTEGRATION_ROOTS
      : `${WEBEX_CA_PRODUCTION_ROOTS}\n${WEBEX_CA_FEDRAMP_ROOTS}`;

    this.logger.info(
      `identity: getTrustAnchors returning ${
        isIntegrationEnvironment ? 'integration' : 'production'
      } trust anchors`
    );

    return {
      webexCaRoots,
      userIdentityRoots: '',
    };
  }

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
        const leafCertificate = credentials.certChain[0];

        if (leafCertificate && !isCertificateExpiringSoon(leafCertificate)) {
          this.logger.info('identity: getCredentials: returning cached credentials');

          return credentials;
        }

        this.logger.info(
          `identity: getCredentials: cached certificate expires within ${CERTIFICATE_RENEWAL_WINDOW_MS}ms, requesting new credentials`
        );

        return this.refreshCredentials(contactId, cachedCredentials);
      });
    }

    this.logger.info('identity: getCredentials: cache miss, requesting new credentials');

    return this.cacheCredentials(contactId);
  }

  /**
   * Replaces a cached credential request if it is still the current cache entry. This prevents
   * concurrent callers from triggering duplicate renewals for the same contact.
   * @param {string} contactId
   * @param {Promise<IdentityCredentials>} cachedCredentials
   * @returns {Promise<IdentityCredentials>}
   */
  private refreshCredentials(
    contactId: string,
    cachedCredentials: Promise<IdentityCredentials>
  ): Promise<IdentityCredentials> {
    if (this.credentialsCache.get(contactId) !== cachedCredentials) {
      return this.credentialsCache.get(contactId) ?? this.cacheCredentials(contactId);
    }

    return this.cacheCredentials(contactId);
  }

  /**
   * Requests credentials and caches the in-flight promise so concurrent callers share it.
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials>}
   */
  private cacheCredentials(contactId: string): Promise<IdentityCredentials> {
    const credentials = this.requestCredentials(contactId);

    this.credentialsCache.set(contactId, credentials);
    credentials.catch(() => {
      if (this.credentialsCache.get(contactId) === credentials) {
        this.credentialsCache.delete(contactId);
      }
    });

    return credentials;
  }

  /**
   * Requests credentials from the CA and returns the certificate chain and raw key.
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials>}
   */
  private async requestCredentials(contactId: string): Promise<IdentityCredentials> {
    this.logger.info('identity: requestCredentials: generating CSR');
    const {privKeyDer, csr} = await generateCsr(contactId);

    this.logger.info('identity: requestCredentials: requesting certificate from CA');
    const response = await this.webex.request({
      method: 'POST',
      service: CERTIFICATE_AUTHORITY_SERVICE,
      resource: 'certificates',
      headers: {'include-root-cert': 'false'},
      body: {csr},
    });

    this.logger.info('identity: requestCredentials: received signed certificate from CA');
    const certChain = pemToUint8Arrays(response.body);

    if (certChain.length === 0 || certChain.some((certificate) => certificate.length === 0)) {
      throw new Error('Certificate authority response did not contain a certificate chain');
    }

    const privateKey = privKeyDer.slice(
      PKCS8_P256_RAW_KEY_OFFSET,
      PKCS8_P256_RAW_KEY_OFFSET + RAW_EC_P256_KEY_LENGTH
    );

    return {privateKey, certChain};
  }
}

interface Identity {
  logger: any;
  webex: any;
}

export default Identity;
