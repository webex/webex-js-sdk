/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import HttpError from '../http-error';
import Interceptor from '../lib/interceptor';

const LOCUS_REDIRECT_ERROR = 2000002;

/**
 * @class
 */
export default class HttpStatusInterceptor extends Interceptor {
  /**
   * @param {Object} webex
   * @param {Object} options
   * @returns {HttpStatusInterceptor}
   */
  constructor(webex, options) {
    super(webex);
    const ErrorConstructor = (options && (options.error || options.ErrorConstructor)) || HttpError;

    Object.defineProperties(this, {
      ErrorConstructor: {
        value: ErrorConstructor,
      },
    });
  }

  /**
   * @param {Object} options
   * @returns {HttpStatusInterceptor}
   */
  static create(options) {
    return new HttpStatusInterceptor(this, options);
  }

  /**
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Promise}
   */
  onResponse(options, response) {
    if (response.statusCode) {
      if (response.statusCode < 400) {
        return Promise.resolve(response);
      }
      // to handle locus redirects
      if (
        response.statusCode === 404 &&
        response.body &&
        response.body.errorCode === LOCUS_REDIRECT_ERROR
      ) {
        return Promise.resolve(response);
      }
    }

    // Note: the extra parenthesis below are required to make sure `new` is
    // applied to the correct method (i.e., the result of `select()`, not
    // `select()` itself).
    return Promise.reject(new (this.ErrorConstructor.select(response.statusCode))(response));
  }
}
