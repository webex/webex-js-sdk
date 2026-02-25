/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {DATA_CHANNEL_AUTH_HEADER, MAX_RETRY, RETRY_INTERVAL} from './constant';

const retryCountMap = new WeakMap();

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
    // @ts-ignore
    const isDataChannelTokenEnabled = await this.webex.internal.llm.isDataChannelTokenEnabled();
    if (!token || !isDataChannelTokenEnabled) return Promise.reject(reason);

    if (reason.statusCode !== 401 && reason.statusCode !== 403) {
      return Promise.reject(reason);
    }

    const currentRetry = retryCountMap.get(this) || 0;
    if (currentRetry >= MAX_RETRY) {
      LoggerProxy.logger.error(`data channel token refresh exceeded max retry (${MAX_RETRY})`);
      retryCountMap.set(this, 0);

      return Promise.reject(reason);
    }

    retryCountMap.set(this, currentRetry + 1);

    return this.refreshTokenAndRetryWithDelay(options);
  }

  /**
   * Retry the failed data channel request after a delay.
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
          const {datachannelToken, dataChannelTokenType} = newToken.body;

          options.headers[DATA_CHANNEL_AUTH_HEADER] = datachannelToken;
          // @ts-ignore
          this.webex.internal.llm.setDatachannelToken(datachannelToken, dataChannelTokenType);

          // @ts-ignore
          const res = await this.webex.request(options);

          resolve(res);
        } catch (e) {
          reject(new Error(`DataChannel token refresh failed: ${e.message}`));
        }
      }, RETRY_INTERVAL);
    });
  }
}
