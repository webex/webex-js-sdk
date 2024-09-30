import fetch, {Response} from 'node-fetch';

import {APPLICATION_ID_PREFIX, PRODUCTION_BASE_URL} from '../constants';
import {TokenResponse, OrgServiceAppAuthorization, ServiceAppToken} from '../types';
import {TokenStorageAdapter} from '../token-storage-adapter/types';
import {InMemoryTokenStorageAdapter} from '../token-storage-adapter';

/**
 * The token manager for the BYoDS SDK.
 */
export default class TokenManager {
  private clientId: string;
  private clientSecret: string;
  private serviceAppId: string;
  private baseUrl: string;
  private tokenStorageAdapter: TokenStorageAdapter;

  /**
   * Creates an instance of TokenManager.
   *
   * @param clientId - The client ID of the service app.
   * @param clientSecret - The client secret of the service app.
   * @param baseUrl - The base URL for the API. Defaults to `PRODUCTION_BASE_URL`.
   * @example
   * const tokenManager = new TokenManager('your-client-id', 'your-client-secret');
   */
  constructor(
    clientId: string,
    clientSecret: string,
    baseUrl: string = PRODUCTION_BASE_URL,
    tokenStorageAdapter: TokenStorageAdapter = new InMemoryTokenStorageAdapter()
  ) {
    if (!clientId || !clientSecret) {
      throw new Error('clientId and clientSecret are required');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
    this.serviceAppId = Buffer.from(`${APPLICATION_ID_PREFIX}${clientId}`).toString('base64');
    this.tokenStorageAdapter = tokenStorageAdapter;
  }

  /**
   * Update the tokens and their expiration times.
   * @param {TokenResponse} data - The token response data.
   * @param {string} orgId - The organization ID.
   * @returns {void}
   * @example
   * await tokenManager.updateServiceAppToken(tokenResponse, 'org-id');
   */
  public async updateServiceAppToken(data: TokenResponse, orgId: string): Promise<void> {
    const serviceAppToken: ServiceAppToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000), // Adding 1000 here to represent milliseconds
      refreshAccessTokenExpiresAt: new Date(Date.now() + data.refresh_token_expires_in * 1000), // Adding 1000 here to represent milliseconds
    };
    await this.tokenStorageAdapter.setToken(orgId, {
      orgId,
      serviceAppToken,
    });
  }

  /**
   * Get the service app ID.
   * @returns {string}
   * @example
   * const serviceAppId = tokenManager.getServiceAppId();
   */
  public getServiceAppId(): string {
    return this.serviceAppId;
  }

  /**
   * Get the service app authorization data for a given organization ID.
   * @param {string} orgId - The organization ID.
   * @returns {Promise<OrgServiceAppAuthorization>}
   * @example
   * const authorization = await tokenManager.getOrgServiceAppAuthorization('org-id');
   */
  public async getOrgServiceAppAuthorization(orgId: string): Promise<OrgServiceAppAuthorization> {
    try {
      let token = await this.getTokenFromAdapter(orgId);
      const currentTime = new Date();
      if (token.serviceAppToken.expiresAt <= currentTime) {
        await this.saveServiceAppRegistrationData(orgId, token.serviceAppToken.refreshToken);
        token = await this.getTokenFromAdapter(orgId); // Fetch the refreshed token
      }

      return token;
    } catch (error) {
      console.error('Error fetching token:', error);
      throw error;
    }
  }

  /**
   * List all stored tokens.
   * @returns {Promise<OrgServiceAppAuthorization[]>} List of tokens
   * @example
   * const tokens = await tokenManager.listTokens();
   */
  public async listTokens(): Promise<OrgServiceAppAuthorization[]> {
    return this.tokenStorageAdapter.listTokens();
  }

  /**
   * Delete a token for a given orgId.
   * @param {string} orgId - The organization ID.
   * @returns {Promise<void>}
   * @example
   * await tokenManager.deleteToken('org-id');
   */
  public async deleteToken(orgId: string): Promise<void> {
    await this.tokenStorageAdapter.deleteToken(orgId);
  }

  /**
   * Remove all tokens stored in the TokenStorageAdapter.
   * @returns {Promise<void>}
   * @example
   * await tokenManager.resetTokens();
   */
  public async resetTokens(): Promise<void> {
    await this.tokenStorageAdapter.resetTokens();
  }

  /**
   * Retrieve a new service app token using the service app owner's personal access token(PAT).
   * @param {string} orgId - The organization ID.
   * @param {string} personalAccessToken - The service app owner's personal access token or token from an integration that has the scope `spark:applications_token`.
   * @returns {Promise<void>}
   * await tokenManager.getServiceAppTokenUsingPAT('org-id', 'personal-access-token');
   */
  public async getServiceAppTokenUsingPAT(
    orgId: string,
    personalAccessToken: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    try {
      const response: Response = await fetch(
        `${this.baseUrl}/applications/${this.serviceAppId}/token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${personalAccessToken}`,
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            targetOrgId: orgId,
            clientId: this.clientId,
            clientSecret: this.clientSecret,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to retrieve token: ${response.statusText}`);
      }

      const data: TokenResponse = (await response.json()) as TokenResponse;
      this.updateServiceAppToken(data, orgId);
    } catch (error) {
      console.error('Error retrieving token after authorization:', error);
      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   * @param {string} orgId - The organization ID.
   * @returns {Promise<void>}
   * await tokenManager.refreshServiceAppAccessToken('org-id');
   */
  public async refreshServiceAppAccessToken(
    orgId: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    if (!orgId) {
      throw new Error('orgId not provided');
    }

    let serviceAppAuthorization: OrgServiceAppAuthorization;
    try {
      serviceAppAuthorization = await this.getTokenFromAdapter(orgId);
    } catch (error) {
      console.error('Error fetching token:', error);
      throw error;
    }
    const refreshToken = serviceAppAuthorization?.serviceAppToken.refreshToken;

    if (!refreshToken) {
      throw new Error(`Refresh token was not found for org:${orgId}`);
    }

    await this.saveServiceAppRegistrationData(orgId, refreshToken, headers);
  }

  /**
   * Save the service app registration using the provided refresh token.
   * After saving, it can be fetched by using the {@link getOrgServiceAppAuthorization} method.
   * @param {string} orgId - The organization ID.
   * @param {string} refreshToken - The refresh token.
   * @returns {Promise<void>}
   * @example
   * await tokenManager.saveServiceAppRegistrationData('org-id', 'refresh-token');
   */
  public async saveServiceAppRegistrationData(
    orgId: string,
    refreshToken: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    try {
      const response: Response = await fetch(`${this.baseUrl}/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // https://developer.webex.com/docs/login-with-webex#access-token-endpoint
          ...headers,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save service app registration: ${response.statusText}`);
      }

      const data: TokenResponse = (await response.json()) as TokenResponse;
      await this.updateServiceAppToken(data, orgId);
    } catch (error) {
      console.error('Error saving service app registration:', error);
      throw error;
    }
  }

  /**
   * Proxy for extracting the token from the token adapter
   * @param {string} orgId - The organization ID.
   * @returns {Promise<OrgServiceAppAuthorization>}
   * @private
   */
  private async getTokenFromAdapter(orgId: string): Promise<OrgServiceAppAuthorization> {
    return this.tokenStorageAdapter.getToken(orgId);
  }
}
