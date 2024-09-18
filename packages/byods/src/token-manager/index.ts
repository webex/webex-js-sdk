import fetch, {Response} from 'node-fetch';

import {APPLICATION_ID_PREFIX, PRODUCTION_BASE_URL} from '../constants';
import {TokenResponse, OrgServiceAppAuthorization, ServiceAppAuthorizationMap} from '../types';

/**
 * The token manager for the BYoDS SDK.
 */
export default class TokenManager {
  private serviceAppAuthorizations: ServiceAppAuthorizationMap = {};
  private clientId: string;
  private clientSecret: string;
  private serviceAppId: string;
  private baseUrl: string;

  /**
   * Creates an instance of TokenManager.
   *
   * @param clientId - The client ID of the service app.
   * @param clientSecret - The client secret of the service app.
   * @param baseUrl - The base URL for the API. Defaults to `PRODUCTION_BASE_URL`.
   * @example
   * const tokenManager = new TokenManager('your-client-id', 'your-client-secret');
   */
  constructor(clientId: string, clientSecret: string, baseUrl: string = PRODUCTION_BASE_URL) {
    if (!clientId || !clientSecret) {
      throw new Error('clientId and clientSecret are required');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
    this.serviceAppId = Buffer.from(`${APPLICATION_ID_PREFIX}${clientId}`).toString('base64');
  }

  /**
   * Update the tokens and their expiration times.
   * @param {TokenResponse} data - The token response data.
   * @param {string} orgId - The organization ID.
   * @returns {void}
   * @example
   * tokenManager.updateServiceAppToken(tokenResponse, 'org-id');
   */
  public updateServiceAppToken(data: TokenResponse, orgId: string): void {
    this.serviceAppAuthorizations[orgId] = {
      orgId,
      serviceAppToken: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        refreshAccessTokenExpiresAt: new Date(Date.now() + data.refresh_token_expires_in * 1000),
      },
    };
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
    if (!this.serviceAppAuthorizations[orgId]) {
      return Promise.reject(new Error('Service app authorization not found'));
    }

    return Promise.resolve(this.serviceAppAuthorizations[orgId]);
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

    const serviceAppAuthorization = await this.getOrgServiceAppAuthorization(orgId);
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
      this.updateServiceAppToken(data, orgId);
    } catch (error) {
      console.error('Error saving service app registration:', error);
      throw error;
    }
  }
}
