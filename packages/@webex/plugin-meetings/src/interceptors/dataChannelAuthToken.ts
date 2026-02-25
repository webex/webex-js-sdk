/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {DATA_CHANNEL_AUTH_HEADER, MAX_RETRY, RETRY_INTERVAL} from './constant';

/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

const retryCountMap = new WeakMap();

/**
 * @class
 */
export default class DataChannelAuthTokenInterceptor extends Interceptor {
  private _refreshDataChannelToken: () => Promise<string>;
  private _isDataChannelTokenEnabled: () => boolean;
  constructor(options) {
    super(options);

    this._refreshDataChannelToken = options.refreshDataChannelToken;
    this._isDataChannelTokenEnabled = options.isDataChannelTokenEnabled;
  }

  /**
   * @returns {DataChannelAuthTokenInterceptor}
   */
  static create() {
    // @ts-ignore
    return new DataChannelAuthTokenInterceptor({
      webex: this,

      isDataChannelTokenEnabled: () => {
        // @ts-ignore
        return this.internal.llm.isDataChannelTokenEnabled();
      },

      refreshDataChannelToken: async () => {
        const {datachannelToken, dataChannelTokenType} =
          // @ts-ignore
          await this.internal.llm.refreshDataChannelToken();

        // @ts-ignore
        this.internal.llm.setDatachannelToken(datachannelToken, dataChannelTokenType);

        return datachannelToken;
      },
    });
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
    const enabled = await this._isDataChannelTokenEnabled();

    if (!token || !enabled) {
      return Promise.reject(reason);
    }

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
          const newToken = await this._refreshDataChannelToken();

          options.headers[DATA_CHANNEL_AUTH_HEADER] = newToken;

          // @ts-ignore
          const res = await this.webex.request(options);

          retryCountMap.set(this, 0);

          resolve(res);
        } catch (e) {
          reject(new Error(`DataChannel token refresh failed: ${e.message}`));
        }
      }, RETRY_INTERVAL);
    });
  }
}
