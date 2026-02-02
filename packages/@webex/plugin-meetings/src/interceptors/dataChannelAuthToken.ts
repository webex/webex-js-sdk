/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

const DATA_CHANNEL_AUTH_HEADER = 'Data-Channel-Auth-Token';
const retryCountMap = new WeakMap();
const MAX_RETRY = 5;
const RETRY_INTERVAL = 2000;

/**
 * @class
 */
export default class DataChannelAuthTokenInterceptor extends Interceptor {
  /**
   * @returns {DataChannelAuthTokenInterceptor}
   */
  static create() {
    // @ts-ignore
    return new DataChannelAuthTokenInterceptor({webex: this});
  }

  // Helper function to get header value case insensitively
  private getHeader(headers: Record<string, string>, name: string) {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());

    return key ? headers[key] : undefined;
  }

  /**
   * Intercept responses and, on 401/403 with `Data-Channel-Auth-Token` header,
   * attempt to refresh the data channel token and retry the original request once.
   *
   * @param {Object} options
   * @param {Object} reason
   * @returns {Promise<HttpResponse>}
   */
  async onResponseError(options, reason) {
    const token = this.getHeader(options.headers, DATA_CHANNEL_AUTH_HEADER);
    if (!token) return Promise.reject(reason);

    if (reason.statusCode !== 401 && reason.statusCode !== 403) {
      return Promise.reject(reason);
    }

    const currentRetry = retryCountMap.get(this) || 0;

    if (currentRetry >= MAX_RETRY) {
      console.warn(`DataChannel token refresh exceeded max retry (${MAX_RETRY})`);
      retryCountMap.set(this, 0);

      return Promise.reject(reason);
    }

    retryCountMap.set(this, currentRetry + 1);

    return this.refreshTokenAndRetryWithDelay(options);
  }

  /**
   * Retry the failed DataChannel request after a delay.
   * Refreshes the Data-Channel-Auth-Token and re-sends the original request.
   *
   * @param {Object} options - Original request options.
   * @returns {Promise<HttpResponse>} - Resolves on successful retry.
   */
  refreshTokenAndRetryWithDelay(options) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          // @ts-ignore
          const newToken = await this.webex.internal.llm.refreshDataChannelToken();

          options.headers[DATA_CHANNEL_AUTH_HEADER] = newToken.body.datachannelToken;

          // @ts-ignore
          const res = await this.webex.request(options);

          resolve(res);
        } catch (e) {
          reject(e);
        }
      }, RETRY_INTERVAL);
    });
  }
}
