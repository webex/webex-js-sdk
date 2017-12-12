/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {get} from 'lodash';
import {Interceptor} from '@ciscospark/http-core';

/**
 * @class
 */
export default class RequestEventInterceptor extends Interceptor {
  /**
   * @returns {RequestEventInterceptor}
   */
  static create() {
    return new RequestEventInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    const logger = get(this, 'spark.logger', console);
    try {
      this.spark.trigger('request:start', options);
    }
    catch (error) {
      logger.warn('event handler for request:start failed ', error);
    }
    return Promise.resolve(options);
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onRequestError(options, reason) {
    // We need to do the normal onRequest logging, but then log how the request
    // failed since the response logger won't be called.
    const logger = get(this, 'spark.logger', console);
    try {
      this.spark.trigger('request:end', options, reason);
      this.spark.trigger('request:failure', options, reason);
    }
    catch (error) {
      logger.warn('event handler for request:end failed ', error);
    }
    return Promise.reject(reason);
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    const logger = get(this, 'spark.logger', console);
    try {
      this.spark.trigger('request:success', response.options, response);
    }
    catch (error) {
      logger.warn('event handler for request:success failed ', error);
    }
    return Promise.resolve(response);
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    const logger = get(this, 'spark.logger', console);
    try {
      this.spark.trigger('request:end', options, reason);
      this.spark.trigger('request:failure', options, reason);
    }
    catch (error) {
      logger.warn('event handler for request:failure failed ', error);
    }
    return Promise.reject(reason);
  }
}
