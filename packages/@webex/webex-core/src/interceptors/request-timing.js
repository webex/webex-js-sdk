/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

/**
 * @class
 */
export default class RequestTimingInterceptor extends Interceptor {
  /**
   * @param {Object} options
   * @returns {RequestTimingInterceptor}
   */
  static create(options) {
    return new RequestTimingInterceptor(this, options);
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    options.$timings = options.$timings || {};
    options.$timings.requestStart = Date.now();

    return options;
  }

  /**
   * @see Interceptor#onRequestError
   * @param {Object} options
   * @returns {Object}
   */
  onRequestError(options) {
    options.$timings.requestEnd = options.$timings.requestFail = Date.now();

    return Promise.reject(options);
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    options.$timings.requestEnd = Date.now();

    return Promise.resolve(response);
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    options.$timings.requestEnd = options.$timings.requestFail = Date.now();

    return Promise.reject(reason);
  }
}
