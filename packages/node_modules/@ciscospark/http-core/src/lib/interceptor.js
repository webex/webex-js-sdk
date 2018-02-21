/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

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
          value
        });
      });
    }
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
   * @param {SparkHttpError} reason
   * @returns {Promise<SparkHttpError>}
   */
  onResponseError(options, reason) {
    return Promise.reject(reason);
  }
}
