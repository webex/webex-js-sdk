/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

const rateLimitExpiryTime = new WeakMap();
/**
 * @class
 */
export default class LocusRetryStatusInterceptor extends Interceptor {
  /**
   * @returns {LocusRetryStatusInterceptor}
   */
  static create() {
    // @ts-ignore
    return new LocusRetryStatusInterceptor({webex: this});
  }

  /**
   * Check whether a URI is a Locus /hashtree or /sync endpoint.
   * @param {string} uri
   * @returns {boolean}
   */
  private static isLocusHashtreeOrSync(uri: string): boolean {
    try {
      const {pathname} = new URL(uri);

      return (
        pathname.includes('/locus/') &&
        (pathname.endsWith('/hashtree') || pathname.endsWith('/sync'))
      );
    } catch {
      return false;
    }
  }

  onResponseError(options, reason) {
    // Don't retry /hashtree or /sync calls for 429 or any 5xx — during a sync storm retries
    // make things worse. The normal sync timers will handle recovery for these endpoints.
    if (
      (reason.statusCode === 429 || reason.statusCode >= 500) &&
      LocusRetryStatusInterceptor.isLocusHashtreeOrSync(options.uri)
    ) {
      return Promise.reject(reason);
    }

    if ((reason.statusCode === 503 || reason.statusCode === 429) && options.uri.includes('locus')) {
      const hasRetriedLocusRequest = rateLimitExpiryTime.get(this);
      const retryAfterTime = options.headers['retry-after'] || 2000;

      if (hasRetriedLocusRequest) {
        rateLimitExpiryTime.set(this, false);

        return Promise.reject(options);
      }
      rateLimitExpiryTime.set(this, true);

      return this.handleRetryRequestLocusServiceError(options, retryAfterTime);
    }

    return Promise.reject(reason);
  }

  /**
   * Handle retries for locus service unavailable errors
   * @param {Object} options associated with the request
   * @param {number} retryAfterTime retry after time in milliseconds
   * @returns {Promise}
   */
  handleRetryRequestLocusServiceError(options, retryAfterTime) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);

        // @ts-ignore
        this.webex
          .request({
            method: options.method,
            uri: options.uri,
            body: options.body,
          })
          .then(resolve)
          .catch(reject);
      }, retryAfterTime);
    });
  }
}
