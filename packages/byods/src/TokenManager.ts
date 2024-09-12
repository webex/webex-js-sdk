import {DEFAULT_BASE_URL} from './constants';
import {TokenResponse, ServiceAppAuthorization, ServiceAppAuthorizations} from './types';

export default class TokenManager {
  private serviceAppAuthorizations: ServiceAppAuthorizations = {};
  private clientId: string;
  private clientSecret: string;
  private serviceAppId: string;
  private baseUrl: string;

  /**
   * Creates an instance of TokenManager.
   *
   * @param clientId - The client ID for the application.
   * @param clientSecret - The client secret for the application.
   * @param baseUrl - The base URL for the API. Defaults to `DEFAULT_BASE_URL`.
   */
  constructor(clientId: string, clientSecret: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
    this.serviceAppId = Buffer.from(`ciscospark://us/APPLICATION/${clientId}`).toString('base64');
  }

  /**
   * Update the tokens and their expiration times.
   * @param {TokenResponse} data - The token response data.
   * @param {string} orgId - The organization ID.
   * @returns {void}
   */
  public updateServiceAppToken(data: TokenResponse, orgId: string): void {
    this.serviceAppAuthorizations[orgId] = {
      orgId,
      token: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        refreshAccessTokenExpiresAt: new Date(Date.now() + data.refresh_token_expires_in * 1000),
      },
    };
  }

  /**
   * Get the service app authorization for a given organization ID.
   * @param {string} orgId - The organization ID.
   * @returns {Promise<ServiceAppAuthorization>}
   */
  public async getServiceAppAuthorization(orgId: string): Promise<ServiceAppAuthorization> {
    if (!this.serviceAppAuthorizations[orgId]) {
      return Promise.reject(new Error('Service app authorization not found'));
    }

    return Promise.resolve(this.serviceAppAuthorizations[orgId]);
  }

  /**
   * Refresh the access token using the refresh token.
   * @param {string} orgId - The organization ID.
   * @returns {Promise<void>}
   */
  public async refreshServiceAppAccessToken(
    orgId: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    const serviceAppAuthorization = await this.getServiceAppAuthorization(orgId);
    const refreshToken = serviceAppAuthorization?.token.refreshToken;
    if (!refreshToken) {
      throw new Error('Refresh token is undefined');
    }
    try {
      const response = await fetch(`${this.baseUrl}/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
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
        throw new Error(`Failed to refresh access token: ${response.statusText}`);
      }

      const data: TokenResponse = (await response.json()) as TokenResponse;
      this.updateServiceAppToken(data, orgId);
    } catch (error) {
      console.error('Error refreshing access token:', error);
      // Remove the serviceAppAuthorization token from here since we can't do anything more with it
      // TODO: Have an event mechanism to notify the user of the error
      delete this.serviceAppAuthorizations[orgId];
      throw error;
    }
  }

  /**
   * Retrieve a new service app token after authorization.
   * @param {string} orgId - The organization ID.
   * @param {string} personalAccessToken - The service app owner's personal access token or token from an integration that has the scope `spark:applications_token`.
   * @returns {Promise<void>}
   */
  public async retrieveTokenAfterAuthorization(
    orgId: string,
    personalAccessToken: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/applications/${this.serviceAppId}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${personalAccessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...headers,
        },
        body: new URLSearchParams({
          targetOrgId: orgId,
          clientId: this.clientId,
          clientSecret: this.clientSecret,
        }),
      });

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
   * Save the service app registration using the provided refresh token.
   * @param {string} orgId - The organization ID.
   * @param {string} refreshToken - The refresh token.
   * @returns {Promise<void>}
   */
  public async saveServiceAppRegistration(
    orgId: string,
    refreshToken: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
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
