import fetch, {Response, RequestInit} from 'node-fetch';

import TokenManager from '../token-manager';
import DataSourceClient from '../data-source-client';
import {HttpClient, ApiResponse} from '../http-client/types';

export default class BaseClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private tokenManager: TokenManager;
  private orgId: string;

  public dataSource: DataSourceClient;

  /**
   * Creates an instance of BaseClient.
   * @param {string} baseUrl - The base URL for the API.
   * @param {Record<string, string>} headers - The additional headers to be used in requests.
   * @param {TokenManager} tokenManager - The token manager instance.
   * @param {string} orgId - The organization ID.
   * @example
   * const client = new BaseClient('https://webexapis.com/v1', { 'Your-Custom-Header': 'some value' }, tokenManager, 'org123');
   */
  constructor(
    baseUrl: string,
    headers: Record<string, string>,
    tokenManager: TokenManager,
    orgId: string
  ) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.tokenManager = tokenManager;
    this.orgId = orgId;
    this.dataSource = new DataSourceClient(this.getHttpClientForOrg());
  }

  /**
   * Makes an HTTP request.
   * @param {string} endpoint - The API endpoint.
   * @param {RequestInit} [options=\{\}] - The request options.
   * @returns {Promise<ApiResponse<T>>} - The API response.
   * @template T
   * @example
   * const response = await client.request('/endpoint', { method: 'GET', headers: {} });
   */
  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = await this.getToken();

    const response: Response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
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
   * Makes a POST request.
   * @param {string} endpoint - The API endpoint.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} [headers=\{\}] - The request headers.
   * @returns {Promise<ApiResponse<T>>} - The API response.
   * @template T
   * @example
   * const response = await client.post('/endpoint', { key: 'value' });
   */
  public async post<T>(
    endpoint: string,
    body: Record<string, any>,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {'Content-Type': 'application/json', ...headers},
    });
  }

  /**
   * Makes a PUT request.
   * @param {string} endpoint - The API endpoint.
   * @param {Record<string, any>} body - The request body.
   * @returns {Promise<ApiResponse<T>>} - The API response.
   * @template T
   * @example
   * const response = await client.put('/endpoint', { key: 'value' });
   */
  public async put<T>(
    endpoint: string,
    body: Record<string, any>,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {'Content-Type': 'application/json', ...headers},
    });
  }

  /**
   * Makes a PATCH request.
   * @param {string} endpoint - The API endpoint.
   * @param {Record<string, any>} body - The request body.
   * @returns {Promise<ApiResponse<T>>} - The API response.
   * @template T
   * @example
   * const response = await client.patch('/endpoint', { key: 'value' });
   */
  public async patch<T>(
    endpoint: string,
    body: Record<string, any>,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {'Content-Type': 'application/json', ...headers},
    });
  }

  /**
   * Makes a GET request.
   * @param {string} endpoint - The API endpoint.
   * @returns {Promise<ApiResponse<T>>} - The API response.
   * @template T
   * @example
   * const response = await client.get('/endpoint');
   */
  public async get<T>(
    endpoint: string,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  /**
   * Makes a DELETE request.
   * @param {string} endpoint - The API endpoint.
   * @returns {Promise<ApiResponse<T>>} - The API response.
   * @template T
   * @example
   * const response = await client.delete('/endpoint');
   */
  public async delete<T>(
    endpoint: string,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers,
    });
  }

  /**
   * Get an HTTP client for a specific organization.
   * @returns {HttpClient} - An object containing methods for making HTTP requests.
   * @example
   * const httpClient = client.getHttpClientForOrg();
   * const response = await httpClient.get('/endpoint');
   */
  public getHttpClientForOrg(): HttpClient {
    return {
      get: <T>(endpoint: string) => this.get<T>(endpoint),
      delete: <T>(endpoint: string) => this.delete<T>(endpoint),
      post: <T>(endpoint: string, body: Record<string, any>) => this.post<T>(endpoint, body),
      put: <T>(endpoint: string, body: Record<string, any>) => this.put<T>(endpoint, body),
      patch: <T>(endpoint: string, body: Record<string, any>) => this.patch<T>(endpoint, body),
    };
  }

  private async getToken(): Promise<string> {
    const serviceAppAuthorization = await this.tokenManager.getOrgServiceAppAuthorization(
      this.orgId
    );
    let token = serviceAppAuthorization.serviceAppToken.accessToken;

    if (new Date() >= new Date(serviceAppAuthorization.serviceAppToken.expiresAt)) {
      await this.tokenManager.refreshServiceAppAccessToken(this.orgId, this.headers);
      const refreshedAuthorization = await this.tokenManager.getOrgServiceAppAuthorization(
        this.orgId
      );
      token = refreshedAuthorization.serviceAppToken.accessToken;
    }
    // TODO: Handle refresh token expiration

    return token;
  }
}
