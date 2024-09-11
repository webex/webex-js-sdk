/* eslint-disable no-console */
import fetch, {RequestInit, Response} from 'node-fetch';
import {jwksCache, createRemoteJWKSet} from 'jose';

interface ApiResponse<T> {
  data: T;
  status: number;
}

interface SDKConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

const userAgent = 'BYoDS NodeJS SDK / 0.0.1';
const jwksUrl = 'https://idbroker.webex.com/idb/oauth2/v2/keys/verificationjwk';
const defaultBaseUrl = 'https://webexapis.com/v1';

/**
 * TokenResponse JSON shape from Webex APIs.
 * @interface
 * @property {string} access_token - The access token.
 * @property {number} expires_in - The expiration time of the access token in seconds.
 * @property {string} refresh_token - The refresh token.
 * @property {number} refresh_token_expires_in - The expiration time of the refresh token in seconds.
 * @property {string} token_type - The type of the token.
 */
interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  token_type: string;
}

/**
 * Represents a token with its expiration details.
 * @interface
 * @property {string} accessToken - The access token.
 * @property {string} refreshToken - The refresh token.
 * @property {Date} expiresAt - The expiration date of the access token.
 * @property {Date} refreshAccessTokenExpiresAt - The expiration date of the refresh token.
 */
interface Token {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshAccessTokenExpiresAt: Date;
}

/**
 * Represents a service app authorization for an organization.
 * @interface
 * @property {string} orgId - The organization ID.
 * @property {Token} token - The token details.
 */
interface ServiceAppAuthorization {
  orgId: string;
  token: Token;
}

/**
 * Represents a collection of service app authorizations.
 * @interface
 * @property {string} [orgId: string] - The organization ID mapped to its authorization details.
 */
interface ServiceAppAuthorizations {
  [orgId: string]: ServiceAppAuthorization;
}

export default class BYODS {
  private serviceAppId: string;
  private baseUrl: string;
  private headers: Record<string, string> = {
    'User-Agent': userAgent,
  };

  private jwksCache: Record<string, never> = {};
  private jwks: any;

  private config: SDKConfig;
  private serviceAppAuthorizations: ServiceAppAuthorizations = {};

  constructor(clientId: string, clientSecret: string, baseUrl = defaultBaseUrl) {
    this.baseUrl = baseUrl;
    this.config = {clientId, clientSecret, baseUrl};
    this.serviceAppId = Buffer.from(`ciscospark://us/APPLICATION/${clientId}`).toString('base64');

    // Create a remote JWK Set
    this.jwks = createRemoteJWKSet(new URL(jwksUrl), {
      [jwksCache]: this.jwksCache,
      cacheMaxAge: 600000, // 10 minutes
      cooldownDuration: 30000, // 30 seconds
    });
  }

  /**
   * Save the service app registration using the provided refresh token.
   * @param {string} orgId - The organization ID.
   * @param {string} refreshToken - The refresh token.
   * @returns {Promise<void>}
   */
  public async saveServiceAppRegistration(orgId: string, refreshToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...this.headers,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
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

  /**
   * Creates a service app authorization.
   *
   * @param orgId - The organization ID.
   * @param personalAccessToken - The personal access token of the developer of the service app.
   * @returns A promise that resolves to void.
   * @throws If the request fails or an error occurs during the process.
   */
  public async createServiceAppAuthorization(
    orgId: string,
    personalAccessToken: string
  ): Promise<TokenResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/applications/${this.serviceAppId}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${personalAccessToken}`,
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: new URLSearchParams({
          targetOrgId: orgId,
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create service app authorization: ${response.statusText}`);
      }

      const data: TokenResponse = (await response.json()) as TokenResponse;
      this.updateServiceAppToken(data, orgId);

      return data;
    } catch (error) {
      console.error('Error creating service app authorization:', error);
      throw error;
    }
  }

  /**
   * Retrieve a new service app token after authorization.
   * @param {string} orgId - The organization ID.
   * @param {string} token - The service app owner's personal access token or token from an integration that has the scope `spark:applications_token`.
   * @returns {Promise<void>}
   */
  public async retrieveTokenAfterAuthorization(orgId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/applications/${this.serviceAppId}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...this.headers,
        },
        body: new URLSearchParams({
          targetOrgId: orgId,
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
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
  public async refreshServiceAppAccessToken(orgId: string): Promise<void> {
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
          ...this.headers,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
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
      throw error;
    }
  }

  /**
   * Make an authenticated request to the specified endpoint.
   * @param {string} orgId - The organization ID.
   * @param {string} endpoint - The endpoint to make the request to.
   * @param {RequestInit} [options={}] - The request options.
   * @returns {Promise<ApiResponse<T>>}
   */
  public async request<T>(
    orgId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const serviceAppAuthorizationToken = (await this.getServiceAppAuthorization(orgId)).token;
    if (
      serviceAppAuthorizationToken &&
      new Date() >= new Date(serviceAppAuthorizationToken.expiresAt)
    ) {
      await this.refreshServiceAppAccessToken(orgId);
    }
    const response: Response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${serviceAppAuthorizationToken.accessToken}`,
        'Content-Type': 'application/json',
        ...this.headers,
        ...options.headers,
      },
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${data.message}`);
    }

    return {data, status: response.status};
  }

  /**
   * Make a POST request to the specified endpoint.
   * @param {string} orgId - The organization ID.
   * @param {string} endpoint - The endpoint to make the request to.
   * @param {Record<string, any>} body - The request body.
   * @returns {Promise<ApiResponse<T>>}
   */
  public async post<T>(
    orgId: string,
    endpoint: string,
    body: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(orgId, endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Make a PUT request to the specified endpoint.
   * @param {string} orgId - The organization ID.
   * @param {string} endpoint - The endpoint to make the request to.
   * @param {Record<string, any>} body - The request body.
   * @returns {Promise<ApiResponse<T>>}
   */
  public async put<T>(
    orgId: string,
    endpoint: string,
    body: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(orgId, endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Make a GET request to the specified endpoint.
   * @param {string} orgId - The organization ID.
   * @param {string} endpoint - The endpoint to make the request to.
   * @returns {Promise<ApiResponse<T>>}
   */
  public async get<T>(orgId: string, endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(orgId, endpoint, {
      method: 'GET',
    });
  }

  /**
   * Make a DELETE request to the specified endpoint.
   * @param {string} orgId - The organization ID.
   * @param {string} endpoint - The endpoint to make the request to.
   * @returns {Promise<ApiResponse<T>>}
   */
  public async delete<T>(orgId: string, endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(orgId, endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Get an HTTP client for a specific organization.
   * @param {string} orgId - The organization ID.
   * @returns {object} - An object containing methods for making HTTP requests.
   */
  public getHttpClientForOrg(orgId: string) {
    return {
      get: <T>(endpoint: string) => this.get<T>(orgId, endpoint),
      delete: <T>(endpoint: string) => this.delete<T>(orgId, endpoint),
      post: <T>(endpoint: string, body: Record<string, any>) => this.post<T>(orgId, endpoint, body),
      put: <T>(endpoint: string, body: Record<string, any>) => this.put<T>(orgId, endpoint, body),
    };
  }

  /**
   * Update the tokens and their expiration times.
   * @param {TokenResponse} data - The token response data.
   * @param {string} orgId - The organization ID.
   * @returns {void}
   */
  private updateServiceAppToken(data: TokenResponse, orgId: string): void {
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
}

export {BYODS, Token};
