/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

export const DEFAULT_RETRY_AFTER_DELAY = 30_000;
export const MAX_RETRY_AFTER_DELAY = 3_600_000;
export const MAX_REPLAYS = 3;

const RETRY_AFTER_HEADER = 'retry-after';

const wait = (delay) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay);
  });

export const getRetryAfterDelay = (reason = {}) => {
  const headers = reason.headers || {};
  const headerName = Object.keys(headers).find((name) => name.toLowerCase() === RETRY_AFTER_HEADER);
  const retryAfter = headerName ? headers[headerName] : reason.retryAfter;

  if (retryAfter === undefined || retryAfter === null || String(retryAfter).trim() === '') {
    return DEFAULT_RETRY_AFTER_DELAY;
  }

  const retryAfterSeconds = Number(String(retryAfter ?? '').trim());

  if (Number.isFinite(retryAfterSeconds)) {
    if (retryAfterSeconds < 0) {
      return DEFAULT_RETRY_AFTER_DELAY;
    }

    return Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_DELAY);
  }

  const retryAfterDate = Date.parse(String(retryAfter));

  if (!Number.isFinite(retryAfterDate)) {
    return DEFAULT_RETRY_AFTER_DELAY;
  }

  return Math.min(Math.max(retryAfterDate - Date.now(), 0), MAX_RETRY_AFTER_DELAY);
};

export default class ConversationRetryAfterInterceptor extends Interceptor {
  static create() {
    return new ConversationRetryAfterInterceptor({webex: this});
  }

  constructor(...args) {
    super(...args);
    // Replays traverse the interceptor chain again; track them to prevent a nested retry loop.
    this.replayingOptions = new WeakSet();
  }

  onResponseError(options, reason) {
    if (this.replayingOptions.has(options) || !this.shouldRetry(options, reason)) {
      return Promise.reject(reason);
    }

    return this.replay(options, reason);
  }

  shouldRetry(options, reason) {
    return (
      this.isConversationRequest(options) &&
      this.isRetryableMethod(options) &&
      reason?.statusCode === 429
    );
  }

  isRetryableMethod(options = {}) {
    return (options.method || 'GET').toUpperCase() === 'GET';
  }

  isConversationRequest(options = {}) {
    const service = options.service || options.api;

    if (typeof service === 'string' && service.toLowerCase() === 'conversation') {
      return true;
    }

    const requestUrl = options.uri || options.url;

    if (typeof requestUrl !== 'string') {
      return false;
    }

    try {
      return (
        this.webex.internal.services.getServiceFromUrl(requestUrl)?.name?.toLowerCase() ===
        'conversation'
      );
    } catch {
      return false;
    }
  }

  // Each request owns its wait/retry loop so unrelated 429 responses cannot delay one another.
  async replay(options, reason) {
    let replayReason = reason;

    for (let replayCount = 0; replayCount < MAX_REPLAYS; replayCount += 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(getRetryAfterDelay(replayReason));
      this.replayingOptions.add(options);

      try {
        // eslint-disable-next-line no-await-in-loop
        return await this.webex.request(options);
      } catch (nextReason) {
        if (!this.shouldRetry(options, nextReason)) {
          throw nextReason;
        }

        replayReason = nextReason;
      } finally {
        this.replayingOptions.delete(options);
      }
    }

    throw replayReason;
  }
}
