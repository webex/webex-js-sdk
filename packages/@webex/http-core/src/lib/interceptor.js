/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {get} from 'lodash';

/**
 * @class
 */
export default class Interceptor {
  /**
   * @constructor
   * @param {Object} attrs
   * @returns {UrlInterceptor}
   */
  constructor(attrs) {
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        const value = attrs[key];

        Reflect.defineProperty(this, key, {
          enumerable: true,
          value,
        });
      });
    }
  }

  /**
   * Logs the options of a request. This should be utilized
   * during the intercepting process, but can be used at any
   * time otherwise.
   * @param {object} options
   * @returns {void}
   */
  logOptions(options = {}) {
    const logger = get(this, 'webex.logger', console);

    if (!process.env.ENABLE_VERBOSE_NETWORK_LOGGING || !logger) {
      return;
    }

    // prepend a header for the interceptor
    logger.info('/***** Interceptor ****************************************************\\');

    logger.info(`${this.constructor.name} - ${JSON.stringify(options, null, 2)}`);
  }

  /**
   * @abstract
   * @returns {Interceptor}
   */
  static create() {
    throw new Error('`Interceptor.create()` must be defined');
  }

  /**
   * Transform request options before sending them
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  onRequest(options) {
    return Promise.resolve(options);
  }

  /**
   * Handle request failures
   * @param {Object} options
   * @param {Error} reason
   * @returns {RejectedPromise<Error>}
   */
  onRequestError(options, reason) {
    return Promise.reject(reason);
  }

  /**
   * Transform response before returning it
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Promise<HttpResponse>}
   */
  onResponse(options, response) {
    return Promise.resolve(response);
  }

  /**
   * Handle response errors
   * @param {Object} options
   * @param {WebexHttpError} reason
   * @returns {Promise<WebexHttpError>}
   */
  onResponseError(options, reason) {
    return Promise.reject(reason);
  }
}
