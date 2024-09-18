import {jwksCache, createRemoteJWKSet, JWKSCacheInput} from 'jose';

import BaseClient from '../base-client';
import {
  USER_AGENT,
  PRODUCTION_JWKS_URL,
  INTEGRATION_JWKS_URL,
  PRODUCTION_BASE_URL,
  INTEGRATION_BASE_URL,
} from '../constants';
import {SDKConfig} from '../types';
import TokenManager from '../token-manager';

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
  public tokenManager: TokenManager;

  /**
   * Constructs a new instance of the BYODS SDK.
   *
   * @param {SDKConfig} config - The configuration object containing clientId and clientSecret.
   * @example
   * const sdk = new BYODS({ clientId: 'your-client-id', clientSecret: 'your-client-secret' });
   */
  constructor({clientId, clientSecret}: SDKConfig) {
    this.config = {clientId, clientSecret};
    this.tokenManager = new TokenManager(clientId, clientSecret);

    /**
     * The environment variable `process.env.BYODS_ENVIRONMENT` determines the environment in which the SDK operates.
     * It can be set to either 'production' or 'integration'. If not set, it defaults to 'production'.
     */
    const parsedEnv = process.env.BYODS_ENVIRONMENT || 'production';
    let jwksUrl = PRODUCTION_BASE_URL;

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

    // Create a remote JWK Set
    this.jwks = createRemoteJWKSet(new URL(jwksUrl), {
      [jwksCache]: this.jwksCache,
      cacheMaxAge: 600000, // 10 minutes
      cooldownDuration: 30000, // 30 seconds
    });
  }

  /**
   * Retrieves a client instance for a specific organization.
   *
   * @param {string} orgId - The unique identifier of the organization.
   * @returns {BaseClient} A new instance of BaseClient configured for the specified organization.
   * @example
   * const client = sdk.getClientForOrg('org-id');
   */
  public getClientForOrg(orgId: string): BaseClient {
    if (!orgId) {
      throw new Error(`orgId is required`);
    }

    return new BaseClient(this.baseUrl, this.headers, this.tokenManager, orgId);
  }
}
