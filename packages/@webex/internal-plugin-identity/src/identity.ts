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
import type {
  IdentityCredentials,
  IdentityTrustAnchors,
  UserIdentityCertificateProvider,
  UserIdentityCredentialsInput,
  UserIdentityRoots,
} from './types';
import {
  CERTIFICATE_RENEWAL_WINDOW_MS,
  generateCsr,
  isCertificateExpiringSoon,
  parseUserIdentityCredentials,
  pemToUint8Arrays,
} from './utils';

// PKCS#8 P-256: the raw 32-byte EC private key starts at this offset in the DER encoding.
const PKCS8_P256_RAW_KEY_OFFSET = 36;
const RAW_EC_P256_KEY_LENGTH = 32;

class Identity extends WebexPlugin {
  namespace = 'Identity';
  credentialsCache: Map<string, Promise<IdentityCredentials>>;
  private userIdentityRoots = '';
  private userIdentityCredentials = new Map<string, Promise<IdentityCredentials>>();
  private userIdentityProviderCredentials = new Map<string, Promise<IdentityCredentials>>();
  private userIdentityCertificateProvider?: UserIdentityCertificateProvider;

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
      userIdentityRoots: this.userIdentityRoots,
    };
  }

  /**
   * Sets the customer CA certificates trusted to verify customer-provided member identity
   * certificates. `userIdentityRootsPem` must contain one or more PEM-encoded CA certificates
   * (each in a `-----BEGIN CERTIFICATE-----` block). Concatenate the PEM blocks when providing
   * multiple roots. Pass an empty string to remove the configured customer roots.
   *
   * These roots are trust anchors for E2EE identity verification. They do not include the
   * member's identity certificate or private key; provide those through the credentials API.
   *
   * @param {UserIdentityRoots} roots - Object containing the trusted customer CA certificates.
   */
  public setUserIdentityRoots(roots: UserIdentityRoots): void {
    this.userIdentityRoots = roots.userIdentityRootsPem;
  }

  /**
   * Registers the provider that issues certificates for SDK-generated identity keys.
   * @param {UserIdentityCertificateProvider} provider - Customer certificate provider.
   */
  public setUserIdentityCertificateProvider(provider: UserIdentityCertificateProvider): void {
    if (typeof provider?.issueCertificate !== 'function') {
      throw new Error('A user identity certificate provider with issueCertificate is required');
    }

    this.userIdentityCertificateProvider = provider;
    this.userIdentityProviderCredentials.clear();
  }

  /**
   * Sets credentials for a contact. Pass undefined to resume CA-issued credentials for that contact.
   * @param {string} contactId
   * @param {UserIdentityCredentialsInput} credentials
   * @returns {Promise<void>}
   */
  public setUserIdentityCredentials(
    contactId: string,
    credentials?: UserIdentityCredentialsInput
  ): Promise<void> {
    if (!contactId?.trim()) {
      return Promise.reject(new Error('contactId is required to set user identity credentials'));
    }

    if (!credentials) {
      this.userIdentityCredentials.delete(contactId);

      return Promise.resolve();
    }

    const parsedCredentialsPromise = parseUserIdentityCredentials(
      credentials.privateKeyPkcs8Pem,
      credentials.certificateChainPem
    );

    this.userIdentityCredentials.set(contactId, parsedCredentialsPromise);

    return parsedCredentialsPromise.then(
      () => undefined,
      (error) => {
        if (this.userIdentityCredentials.get(contactId) === parsedCredentialsPromise) {
          this.userIdentityCredentials.delete(contactId);
        }

        throw error;
      }
    );
  }

  /**
   * Returns customer-provided credentials followed by Webex-issued credentials when available.
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials[]>}
   */
  getCredentials(contactId: string): Promise<IdentityCredentials[]> {
    const userIdentityCredentials =
      this.userIdentityCredentials.get(contactId) ??
      (this.userIdentityCertificateProvider
        ? this.getUserIdentityProviderCredentials(contactId)
        : undefined);

    if (userIdentityCredentials) {
      // The SDK's Core-JS 2 Promise shim does not implement allSettled().
      const settle = <T>(promise: Promise<T>) =>
        promise.then(
          (value) => ({status: 'fulfilled' as const, value}),
          (reason: unknown) => ({status: 'rejected' as const, reason})
        );

      return Promise.all([
        settle(userIdentityCredentials),
        settle(this.getWebexCredentials(contactId)),
      ]).then(([userResult, webexResult]) => {
        const credentials: IdentityCredentials[] = [];

        if (userResult.status === 'fulfilled') {
          credentials.push(userResult.value);
        }

        if (webexResult.status === 'fulfilled') {
          credentials.push(webexResult.value);
        }

        if (credentials.length > 0) {
          return credentials;
        }

        if (userResult.status === 'rejected' && webexResult.status === 'rejected') {
          throw userResult.reason;
        }

        return credentials;
      });
    }

    return this.getWebexCredentials(contactId).then((credentials) => [credentials]);
  }

  /**
   * Returns customer-issued credentials for the given contact, generating and caching them on
   * first use.
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials>}
   */
  private getUserIdentityProviderCredentials(contactId: string): Promise<IdentityCredentials> {
    const cachedCredentials = this.userIdentityProviderCredentials.get(contactId);

    if (cachedCredentials) {
      return cachedCredentials.then((credentials) => {
        const leafCertificate = credentials.certChain[0];

        if (leafCertificate && !isCertificateExpiringSoon(leafCertificate)) {
          return credentials;
        }

        return this.cacheUserIdentityProviderCredentials(contactId, cachedCredentials);
      });
    }

    return this.cacheUserIdentityProviderCredentials(contactId);
  }

  /**
   * Requests customer-issued credentials and caches the in-flight promise per contact.
   * @param {string} contactId
   * @param {Promise<IdentityCredentials>} [cachedCredentials]
   * @returns {Promise<IdentityCredentials>}
   */
  private cacheUserIdentityProviderCredentials(
    contactId: string,
    cachedCredentials?: Promise<IdentityCredentials>
  ): Promise<IdentityCredentials> {
    if (
      cachedCredentials &&
      this.userIdentityProviderCredentials.get(contactId) !== cachedCredentials
    ) {
      return (
        this.userIdentityProviderCredentials.get(contactId) ??
        this.cacheUserIdentityProviderCredentials(contactId)
      );
    }

    const provider = this.userIdentityCertificateProvider;

    if (!provider) {
      return Promise.reject(new Error('No user identity certificate provider is configured'));
    }

    const credentials = this.requestUserIdentityProviderCredentials(contactId, provider);

    this.userIdentityProviderCredentials.set(contactId, credentials);
    credentials.catch(() => {
      if (this.userIdentityProviderCredentials.get(contactId) === credentials) {
        this.userIdentityProviderCredentials.delete(contactId);
      }
    });

    return credentials;
  }

  /**
   * Requests a customer-signed certificate for an SDK-generated identity key.
   * @param {string} contactId
   * @param {UserIdentityCertificateProvider} provider
   * @returns {Promise<IdentityCredentials>}
   */
  private async requestUserIdentityProviderCredentials(
    contactId: string,
    provider: UserIdentityCertificateProvider
  ): Promise<IdentityCredentials> {
    const user = await this.webex.internal.user.get();
    const email = user?.email || user?.emailAddress || user?.entryEmail;

    if (!email) {
      throw new Error('Current user email is required for customer identity certificate issuance');
    }

    const {privKeyDer, csrPem} = await generateCsr(contactId);
    const {certificateChainPem} = await provider.issueCertificate({
      contactId,
      identity: {email},
      csrPem,
    });
    const privateKeyPkcs8Pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(privKeyDer)
      .toString('base64')
      .match(/.{1,64}/g)
      ?.join('\n')}\n-----END PRIVATE KEY-----`;

    return parseUserIdentityCredentials(privateKeyPkcs8Pem, certificateChainPem);
  }

  /**
   * Returns Webex-issued credentials for the given contact, generating and caching them on first
   * use.
   * @param {string} contactId
   * @returns {Promise<IdentityCredentials>}
   */
  private getWebexCredentials(contactId: string): Promise<IdentityCredentials> {
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
    this.logger.info(`identity: requestCredentials: generating CSR for contactId=${contactId}`);
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
