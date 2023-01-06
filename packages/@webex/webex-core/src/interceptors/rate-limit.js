/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

// contains the system time in milliseconds at which the retry after associated with a 429 expires
// mapped by the API name, e.g.: idbroker.webex.com/doStuff would be mapped as 'doStuff'
const rateLimitExpiryTime = new WeakMap();

// extracts the common identity API being called
const idBrokerRegex = /.*(idbroker|identity)(bts)?.ciscospark.com\/([^/]+)/;

/**
 * @class
 */
export default class RateLimitInterceptor extends Interceptor {
  /**
   * @returns {RateLimitInterceptor}
   */
  static create() {
    return new RateLimitInterceptor({webex: this});
  }

  /**
   * constructor
   * @param {mixed} args
   * @returns {Exception}
   */
  constructor(...args) {
    super(...args);
    rateLimitExpiryTime.set(this, new Map());
  }

  /**
   * @see {@link Interceptor#onRequest}
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    if (this.isRateLimited(options.uri)) {
      return Promise.reject(new Error(`API rate limited ${options.uri}`));
    }

    return Promise.resolve(options);
  }

  /**
   * @see {@link Interceptor#onResponseError}
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    if (
      reason.statusCode === 429 &&
      (options.uri.includes('idbroker') || options.uri.includes('identity'))
    ) {
      // set the retry after in the map, setting to milliseconds
      this.setRateLimitExpiry(options.uri, this.extractRetryAfterTime(options));
    }

    return Promise.reject(reason);
  }

  /**
   * @param {object} options associated with the request
   * @returns {number} retry after time in milliseconds
   */
  extractRetryAfterTime(options) {
    // 1S * 1K === 1MS
    const milliMultiplier = 1000;
    const retryAfter = options.headers['retry-after'] || null;

    // set 60 retry if no usable time defined
    if (retryAfter === null || retryAfter <= 0) {
      return 60 * milliMultiplier;
    }
    // set max to 3600 S (1 hour) if greater than 1 hour
    if (retryAfter > 3600) {
      return 3600 * milliMultiplier;
    }

    return retryAfter * milliMultiplier;
  }

  /**
   * Set the system time at which the rate limiting
   * will expire in the rateLimitExpiryTime map.
   * Assumes retryAfter is in milliseconds
   * @param {string} uri API issuing the rate limiting
   * @param {number} retryAfter milliseconds until rate limiting expires
   * @returns {bool} true is value was successfully set
   */
  setRateLimitExpiry(uri, retryAfter) {
    const apiName = this.getApiName(uri);

    if (!apiName) {
      return false;
    }

    const currTimeMilli = new Date().getTime();
    const expiry = currTimeMilli + retryAfter;
    const dict = rateLimitExpiryTime.get(this);

    return dict.set(apiName, expiry);
  }

  /**
   * returns true if the API is currently rate limited
   * @param {string} uri
   * @returns {Boolean} indicates whether or not the API is rate currently rate limited
   */
  getRateLimitStatus(uri) {
    const apiName = this.getApiName(uri);

    if (!apiName) {
      return false;
    }

    const currTimeMilli = new Date().getTime();
    const dict = rateLimitExpiryTime.get(this);
    const expiryTime = dict.get(apiName);

    // if no rate limit expiry has been registered in the map, return false.
    if (expiryTime === undefined) {
      return false;
    }

    // return true, indicating rate limiting, if the system time is less than the expiry time
    return currTimeMilli < dict.get(apiName);
  }

  /**
   * split the URI and returns the API name of idBroker
   * @param {string} uri
   * @returns {string}
   */
  getApiName(uri) {
    if (!uri) {
      return null;
    }

    const results = uri.match(idBrokerRegex);

    if (!results) {
      return null;
    }

    // group 0 = full match of URL, group 1 = identity or idbroker base
    // group 2 = api name
    return results[2];
  }

  /**
   * check URI against list of currently rate limited
   * URIs, and determines if retry-after
   * @param {String} uri pattern to check
   * @returns {bool}
   */
  isRateLimited(uri) {
    // determine if the URI is associated with a common identity API
    if (uri && (uri.includes('idbroker') || uri.includes('identity'))) {
      return this.getRateLimitStatus(uri);
    }

    return false;
  }
}
