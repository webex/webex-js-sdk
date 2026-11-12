import {LoggerConfig} from '../types';
import TokenManager from '../token-manager';
import DataSourceClient from '../data-source-client';
import {HttpClient, ApiResponse} from '../http-client/types';
import {httpUtils, HttpRequestInit} from '../http-utils';
import {BYODS_BASE_CLIENT_MODULE, DEFAULT_LOGGER_CONFIG} from '../constants';
import log from '../Logger';
import ExtendedError from '../Errors/catalog/ExtendedError';
import {ERROR_TYPE} from '../Errors/types';

export default class BaseClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private tokenManager: TokenManager;
  private loggerConfig: LoggerConfig;
  public dataSource: DataSourceClient;

  /**
   * Creates an instance of BaseClient.
   * @param {string} baseUrl - The base URL for the API.
   * @param {Record<string, string>} headers - The additional headers to be used in requests.
   * @param {TokenManager} tokenManager - The token manager instance.
   * @example
   * const client = new BaseClient('https://webexapis.com/v1', { 'Your-Custom-Header': 'some value' }, tokenManager);
   */
  constructor(
    baseUrl: string,
    headers: Record<string, string>,
    tokenManager: TokenManager,
    loggerConfig: LoggerConfig = DEFAULT_LOGGER_CONFIG
  ) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.tokenManager = tokenManager;
    this.loggerConfig = loggerConfig;
    this.dataSource = new DataSourceClient(this.getHttpClient(), this.loggerConfig);
    log.setLogger(this.loggerConfig.level, BYODS_BASE_CLIENT_MODULE);
  }

  /**
   * Makes an HTTP request.
   * @param {string} endpoint - The API endpoint.
   * @param {HttpRequestInit} [options={}] - The request options.
   * @returns {Promise<ApiResponse<T>>} - The API response.
   * @template T
   * @example
   * const response = await client.request('/endpoint', { method: 'GET', headers: {} });
   */
  public async request<T>(
    endpoint: string,
    options: HttpRequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = await this.getToken();

    return httpUtils.request<T>(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Makes a POST request.
   * @param {string} endpoint - The API endpoint.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} [headers={}] - The request headers.
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
   * Get an HTTP client that uses the configured Service App token.
   * @returns {HttpClient} - An object containing methods for making HTTP requests.
   * @example
   * const httpClient = client.getHttpClient();
   * const response = await httpClient.get('/endpoint');
   */
  public getHttpClient(): HttpClient {
    return {
      get: <T>(endpoint: string) => this.get<T>(endpoint),
      delete: <T>(endpoint: string) => this.delete<T>(endpoint),
      post: <T>(endpoint: string, body: Record<string, any>) => this.post<T>(endpoint, body),
      put: <T>(endpoint: string, body: Record<string, any>) => this.put<T>(endpoint, body),
      patch: <T>(endpoint: string, body: Record<string, any>) => this.patch<T>(endpoint, body),
    };
  }

  private async getToken(): Promise<string> {
    try {
      const token = await this.tokenManager.getServiceAppToken();

      return token.accessToken;
    } catch (error) {
      log.error(new ExtendedError('Error obtaining token', ERROR_TYPE.TOKEN_ERROR), {
        file: BYODS_BASE_CLIENT_MODULE,
        method: 'getToken',
      });
      throw new Error('Failed to obtain token');
    }
  }
}
