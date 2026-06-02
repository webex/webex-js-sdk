/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';
import LLMChannel from '@webex/internal-plugin-llm';
import LoggerProxy from '../common/logs/logger-proxy';
import {DATA_CHANNEL_AUTH_HEADER, MAX_RETRY, RETRY_INTERVAL, RETRY_KEY} from './constant';
import {isJwtTokenExpired} from './utils';
import {LLM_DEFAULT_SESSION, LLM_PRACTICE_SESSION, LOCUS_URL} from '../constants';

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

      // Route refresh by request URL in two steps:
      // 1) Match active LLM sessions (supports non-default/multiple sessions)
      // 2) If no session matches, resolve locusUrl and refresh via owning meeting
      // If neither route matches, fall back to the default-session refresh.
      refreshDataChannelToken: async (requestUrl?: string) => {
        let sessionId;
        let meeting;

        if (typeof requestUrl === 'string') {
          // @ts-ignore
          sessionId = this.internal.llm.getSessionIdByDatachannelUrl?.(requestUrl);

          if (!sessionId) {
            // @ts-ignore
            const locusUrl = this.internal.llm.getLocusUrlByDatachannelUrl?.(requestUrl);

            if (locusUrl) {
              // @ts-ignore
              meeting = this.meetings?.getMeetingByType?.(LOCUS_URL, locusUrl);
            }
          }

          if (!meeting) {
            // Fallback: registerAndConnect() pre-populates datachannelUrl in
            // connections before calling register(), so getSessionIdByDatachannelUrl
            // above should normally resolve. This scan covers any residual gap
            // where connections are not yet populated (e.g. if setRefreshHandler
            // is called on a session that has no connection entry at all).
            // @ts-ignore
            const allMeetings = this.meetings?.getAllMeetings?.() || {};

            meeting = Object.values(allMeetings).find((activeMeeting: any) => {
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

            if (!sessionId) {
              // @ts-ignore
              const info = meeting?.locusInfo?.info || {};

              if (
                info.practiceSessionDatachannelUrl &&
                LLMChannel.matchesDatachannelRequestUrl(
                  requestUrl,
                  info.practiceSessionDatachannelUrl
                )
              ) {
                sessionId = LLM_PRACTICE_SESSION;
              } else if (
                info.datachannelUrl &&
                LLMChannel.matchesDatachannelRequestUrl(requestUrl, info.datachannelUrl)
              ) {
                sessionId = LLM_DEFAULT_SESSION;
              }
            }
          }
        }

        let result;
        if (meeting) {
          result = await meeting.refreshDataChannelToken();
        } else {
          // @ts-ignore
          result = await this.internal.llm.refreshDataChannelToken(sessionId);
        }

        if (!result?.body) {
          throw new Error('DataChannel token refresh returned no payload');
        }
        const {datachannelToken, dataChannelTokenType} = result.body;
        const tokenStoreKey = dataChannelTokenType || sessionId;
        const ownerMeetingId =
          // @ts-ignore
          meeting?.id || this.internal.llm.getOwnerMeetingId?.(tokenStoreKey);
        // @ts-ignore
        this.internal.llm.setDatachannelToken(datachannelToken, tokenStoreKey, ownerMeetingId);

        return datachannelToken;
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
