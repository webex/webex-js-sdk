import {jwksCache, createRemoteJWKSet, JWKSCacheInput, jwtVerify} from 'jose';
import BaseClient from '../base-client';
import DataSourceClient from '../data-source-client';
import {
  USER_AGENT,
  PRODUCTION_JWKS_URL,
  INTEGRATION_JWKS_URL,
  PRODUCTION_BASE_URL,
  INTEGRATION_BASE_URL,
  BYODS_MODULE,
  DEFAULT_LOGGER_CONFIG,
} from '../constants';
import {SDKConfig, JWSTokenVerificationResult} from '../types';
import TokenManager from '../token-manager';
import log from '../Logger';
import {LOGGER} from '../Logger/types';
import {ERROR_TYPE} from '../Errors/types';
import ExtendedError from '../Errors/catalog/ExtendedError';
import {InMemoryTokenStorageAdapter} from '../token-storage-adapter';

/**
 * The BYoDS SDK.
 */
export default class BYODS {
  private headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
  };

  private jwksCache: JWKSCacheInput = {};
  private jwks: any; // No defined interface for return type of createRemoteJWKSet
  private env: 'production' | 'integration';
  private config: SDKConfig;
  private baseUrl: string;

  /**
   * The token manager for the SDK.
   */
  public readonly tokenManager: TokenManager;

  /** The organization used by this SDK instance. */
  public readonly orgId: string;

  /** The data source client for the configured organization. */
  public readonly dataSource: DataSourceClient;

  /**
   * Constructs a new instance of the BYODS SDK.
   *
   * @param {SDKConfig} config - The Service App credentials and organization.
   * @example
   * const sdk = new BYODS({ clientId: 'your-client-id', clientSecret: 'your-client-secret', orgId: 'org-id' });
   */
  constructor({
    clientId,
    clientSecret,
    orgId,
    tokenStorageAdapter = new InMemoryTokenStorageAdapter(),
    logger = DEFAULT_LOGGER_CONFIG,
  }: SDKConfig) {
    this.config = {clientId, clientSecret, orgId, tokenStorageAdapter, logger};
    log.setLogger(this.config.logger?.level || LOGGER.INFO, BYODS_MODULE);

    /**
     * The environment variable `process.env.BYODS_ENVIRONMENT` determines the environment in which the SDK operates.
     * It can be set to either 'production' or 'integration'. If not set, it defaults to 'production'.
     */
    const parsedEnv = process.env.BYODS_ENVIRONMENT || 'production';
    let jwksUrl = PRODUCTION_JWKS_URL;

    switch (parsedEnv) {
      case 'production':
        this.env = 'production';
        this.baseUrl = PRODUCTION_BASE_URL;
        jwksUrl = PRODUCTION_JWKS_URL;
        break;
      case 'integration':
        this.env = 'integration';
        this.baseUrl = INTEGRATION_BASE_URL;
        jwksUrl = INTEGRATION_JWKS_URL;
        break;
      default:
        this.env = 'production';
        this.baseUrl = PRODUCTION_BASE_URL;
        jwksUrl = PRODUCTION_JWKS_URL;
    }

    // Create token manager
    this.tokenManager = new TokenManager(this.config, this.baseUrl);
    this.orgId = orgId.trim();
    this.dataSource = new BaseClient(
      this.baseUrl,
      this.headers,
      this.tokenManager,
      this.config.logger
    ).dataSource;

    // Create a remote JWK Set
    this.jwks = createRemoteJWKSet(new URL(jwksUrl), {
      [jwksCache]: this.jwksCache,
      cacheMaxAge: 600000, // 10 minutes
      cooldownDuration: 30000, // 30 seconds
    });
  }

  /**
   * Verifies a JWS token using the public key.
   * @param {string} jws - The JWS token to verify.
   * @returns {Promise<JWSTokenVerificationResult>} A promise that resolves to an object containing the result of the verification.
   * @example
   * const result = await sdk.verifyJWSToken('jws-token');
   */
  public async verifyJWSToken(jws: string): Promise<JWSTokenVerificationResult> {
    const result: JWSTokenVerificationResult = {isValid: false};
    try {
      await jwtVerify(jws, this.jwks);
      result.isValid = true;
    } catch (error: any) {
      log.error(new ExtendedError('Error verifying JWS token', ERROR_TYPE.TOKEN_ERROR), {
        file: BYODS_MODULE,
        method: 'verifyJWSToken',
      });
      result.isValid = false;
      result.error = error.message || 'Unknown error';
    }

    return result;
  }
}
