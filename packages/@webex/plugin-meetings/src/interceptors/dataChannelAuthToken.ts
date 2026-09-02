/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

// @ts-ignore - internal-plugin-llm types
import LLMChannel from '@webex/internal-plugin-llm';
import LoggerProxy from '../common/logs/logger-proxy';
import Meeting from '../meeting';
import {DATA_CHANNEL_AUTH_HEADER, MAX_RETRY, RETRY_INTERVAL, RETRY_KEY} from './constant';
import {isJwtTokenExpired} from './utils';

const retryCountMap = new Map();
interface HttpLikeError extends Error {
  statusCode?: number;
  original?: any;
}
/**
 * @class
 */
export default class DataChannelAuthTokenInterceptor extends Interceptor {
  private _refreshDataChannelToken: (requestUrl?: string) => Promise<string>;
  private _isDataChannelTokenEnabled: () => Promise<boolean>;
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

      isDataChannelTokenEnabled: async () => {
        // @ts-ignore
        return this.internal.llm.isDataChannelTokenEnabled();
      },

      // Route refresh by request URL:
      // 1) Find the LLM channel that matches the request URL
      // 2) If found, use its refresh handler
      // 3) If no channel matches, fall back to finding the meeting by locusUrl
      refreshDataChannelToken: async (requestUrl?: string) => {
        // @ts-ignore
        const channel = this.internal.llm.getChannelByDatachannelUrl(requestUrl);

        if (channel) {
          // Channel found - use its refresh handler
          const result = await channel.refreshDataChannelToken();

          if (!result?.body) {
            throw new Error('DataChannel token refresh returned no payload');
          }

          const {datachannelToken} = result.body;
          channel.setDatachannelToken(datachannelToken);

          return datachannelToken;
        }

        // No channel found - fallback to finding meeting by matching datachannel URLs
        // @ts-ignore
        const allMeetings: Record<string, Meeting> = this.meetings?.getAllMeetings() || {};

        const meeting = Object.values(allMeetings).find((activeMeeting) => {
          const info = activeMeeting?.locusInfo?.info || {};

          return (
            (info.practiceSessionDatachannelUrl &&
              LLMChannel.matchesDatachannelRequestUrl(
                requestUrl,
                info.practiceSessionDatachannelUrl
              )) ||
            (info.datachannelUrl &&
              LLMChannel.matchesDatachannelRequestUrl(requestUrl, info.datachannelUrl))
          );
        });

        if (meeting) {
          const result = await meeting.refreshDataChannelToken();

          if (!result?.body) {
            throw new Error('DataChannel token refresh returned no payload');
          }

          const {datachannelToken} = result.body;

          // Store token on the meeting's LLM channel if available
          meeting.setLLMChannelDataToken(datachannelToken);

          return datachannelToken;
        }

        throw new Error('No LLM channel or meeting found for request URL');
      },
    });
  }

  private getRetryKey(options) {
    if (!options[RETRY_KEY]) {
      options[RETRY_KEY] = `${Date.now()}-${Math.random()}`;
    }

    return options[RETRY_KEY];
  }

  // Helper function to get header value case insensitively
  private getHeader(headers: Record<string, string>, name: string) {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());

    return key ? headers[key] : undefined;
  }

  /**
   * Intercepts outgoing requests and refreshes the Data-Channel-Auth-Token
   * if the current JWT token is expired before the request is sent.
   *
   * @param {Object} options - The original request options.
   * @returns {Promise<Object>} Updated request options with refreshed token if needed.
   */
  async onRequest(options) {
    const token = this.getHeader(options.headers, DATA_CHANNEL_AUTH_HEADER);
    const enabled = await this._isDataChannelTokenEnabled();

    if (!token || !enabled) {
      return options;
    }

    if (isJwtTokenExpired(token)) {
      try {
        const newToken = await this._refreshDataChannelToken(options.uri || options.url);
        options.headers[DATA_CHANNEL_AUTH_HEADER] = newToken;
      } catch (e) {
        LoggerProxy.logger.warn(`DataChannelAuthTokenInterceptor: refresh failed: ${e.message}`);
      }
    }

    return options;
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

    const key = this.getRetryKey(options);
    const retryCount = retryCountMap.get(key) || 0;

    if (retryCount >= MAX_RETRY) {
      LoggerProxy.logger.error(`data channel token refresh exceeded max retry (${MAX_RETRY})`);
      retryCountMap.delete(key);

      return Promise.reject(reason);
    }

    retryCountMap.set(key, retryCount + 1);

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
        const key = this.getRetryKey(options);
        try {
          const newToken = await this._refreshDataChannelToken(options.uri || options.url);

          options.headers[DATA_CHANNEL_AUTH_HEADER] = newToken;

          // @ts-ignore
          const res = await this.webex.request(options);
          retryCountMap.delete(key);

          resolve(res);
        } catch (e) {
          retryCountMap.delete(key);

          const msg = e?.message || String(e);

          const err: HttpLikeError = new Error(`DataChannel token refresh failed: ${msg}`);
          err.statusCode = e?.statusCode;
          err.original = e;

          reject(err);
        }
      }, RETRY_INTERVAL);
    });
  }
}
