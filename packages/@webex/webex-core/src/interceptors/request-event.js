/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {get} from 'lodash';
import {Interceptor} from '@webex/http-core';

/**
 * @class
 */
export default class RequestEventInterceptor extends Interceptor {
  /**
   * @returns {RequestEventInterceptor}
   */
  static create() {
    return new RequestEventInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    const logger = get(this, 'webex.logger', console);

    try {
      this.webex.trigger('request:start', options);
    } catch (error) {
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
    const logger = get(this, 'webex.logger', console);

    try {
      this.webex.trigger('request:end', options, reason);
      this.webex.trigger('request:failure', options, reason);
    } catch (error) {
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
    const logger = get(this, 'webex.logger', console);

    try {
      this.webex.trigger('request:success', response.options, response);
    } catch (error) {
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
    const logger = get(this, 'webex.logger', console);

    try {
      this.webex.trigger('request:end', options, reason);
      this.webex.trigger('request:failure', options, reason);
    } catch (error) {
      logger.warn('event handler for request:failure failed ', error);
    }

    return Promise.reject(reason);
  }
}
