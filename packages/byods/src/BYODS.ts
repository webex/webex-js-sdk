import {jwksCache, createRemoteJWKSet} from 'jose';
import BaseClient from './BaseClient';
import {USER_AGENT, JWKS_URL, DEFAULT_BASE_URL} from './constants';
import {SDKConfig, ServiceAppAuthorizations} from './types';
import TokenManager from './TokenManager';

export default class BYODS {
  private serviceAppId: string;
  private headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
  };

  private jwksCache: Record<string, never> = {};
  private jwks: any;

  private config: SDKConfig;
  private serviceAppAuthorizations: ServiceAppAuthorizations = {};

  public tokenManager: TokenManager;

  constructor({clientId, clientSecret, baseUrl = DEFAULT_BASE_URL}: SDKConfig) {
    this.config = {clientId, clientSecret, baseUrl};
    this.serviceAppId = Buffer.from(`ciscospark://us/APPLICATION/${clientId}`).toString('base64');
    this.tokenManager = new TokenManager(clientId, clientSecret);

    // Create a remote JWK Set
    this.jwks = createRemoteJWKSet(new URL(JWKS_URL), {
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
   */
  public getClientForOrg(orgId: string): BaseClient {
    return new BaseClient(
      this.config.baseUrl || DEFAULT_BASE_URL,
      this.headers,
      this.tokenManager,
      orgId
    );
  }
}
