import {randomUUID} from 'crypto';

import {ApiResponse} from '../http-client/types';
import {BYODS_PACKAGE_NAME, USER_AGENT} from '../constants';

export interface HttpRequestInit {
  body?: string | null;
  headers?: Record<string, string>;
  method?: string;
}

/**
 * Makes an HTTP request.
 * @param {string} url - The URL for the request.
 * @param {HttpRequestInit} [options=\{\}] - The request options.
 * @returns {Promise<ApiResponse<T>>} - The API response.
 * @example
 * const response = await request('https://webexapis.com/v1/endpoint', { method: 'GET', headers: {} });
 */
async function request<T>(url: string, options: HttpRequestInit = {}): Promise<ApiResponse<T>> {
  // TODO: Fix this issue (which is being tracked in node_fetch) https://github.com/node-fetch/node-fetch/issues/1809
  const fetch = (await import('node-fetch')).default;
  const optionsWithHeaders = {
    ...options,
    headers: {
      Trackingid: `${BYODS_PACKAGE_NAME}_${randomUUID()}`,
      'User-Agent': USER_AGENT,
      ...options.headers,
    },
  };

  const response = await fetch(url, optionsWithHeaders);

  if (!response.ok) {
    throw new Error(`HTTP Error Response: ${response.status} ${response.statusText}`);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return {data: {} as T, status: response.status};
  }

  const data = (await response.json()) as T;

  return {data, status: response.status};
}

/**
 * Makes an HTTP GET request.
 * @param {string} url - The URL for the request.
 * @param {HttpRequestInit} [options=\{\}] - The request options.
 * @returns {Promise<ApiResponse<T>>} - The API response.
 * @example
 * const response = await get('https://webexapis.com/v1/endpoint', { headers: {} });
 */
async function get<T>(url: string, options: HttpRequestInit = {}): Promise<ApiResponse<T>> {
  return httpUtils.request<T>(url, {...options, method: 'GET'});
}

/**
 * Makes an HTTP POST request.
 * @param {string} url - The URL for the request.
 * @param {HttpRequestInit} [options=\{\}] - The request options.
 * @returns {Promise<ApiResponse<T>>} - The API response.
 * @example
 * const response = await post('https://webexapis.com/v1/endpoint', { headers: {} });
 */
async function post<T>(url: string, options: HttpRequestInit = {}): Promise<ApiResponse<T>> {
  return httpUtils.request<T>(url, {...options, method: 'POST'});
}

/**
 * Makes an HTTP PUT request.
 * @param {string} url - The URL for the request.
 * @param {HttpRequestInit} [options=\{\}] - The request options.
 * @returns {Promise<ApiResponse<T>>} - The API response.
 * @example
 * const response = await put('https://webexapis.com/v1/endpoint', { headers: {} });
 */
export async function put<T>(url: string, options: HttpRequestInit = {}): Promise<ApiResponse<T>> {
  return httpUtils.request<T>(url, {...options, method: 'PUT'});
}

/**
 * Makes an HTTP DELETE request.
 * @param {string} url - The URL for the request.
 * @param {HttpRequestInit} [options=\{\}] - The request options.
 * @returns {Promise<ApiResponse<T>>} - The API response.
 * @example
 * const response = await del('https://webexapis.com/v1/endpoint', { headers: {} });
 */
async function del<T>(url: string, options: HttpRequestInit = {}): Promise<ApiResponse<T>> {
  return httpUtils.request<T>(url, {...options, method: 'DELETE'});
}

/**
 * Makes an HTTP PATCH request.
 * @param {string} url - The URL for the request.
 * @param {HttpRequestInit} [options=\{\}] - The request options.
 * @returns {Promise<ApiResponse<T>>} - The API response.
 * @example
 * const response = await patch('https://webexapis.com/v1/endpoint', { headers: {} });
 */
async function patch<T>(url: string, options: HttpRequestInit = {}): Promise<ApiResponse<T>> {
  return httpUtils.request<T>(url, {...options, method: 'PATCH'});
}

export const httpUtils = {
  request,
  get,
  post,
  put,
  del,
  patch,
};
