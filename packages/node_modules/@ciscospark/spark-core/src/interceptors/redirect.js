/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {clone} from 'lodash';
import {Interceptor} from '@ciscospark/http-core';

const requestHeaderName = `cisco-no-http-redirect`;
const responseHeaderName = `cisco-location`;

/**
 * @class
 */
export default class RedirectInterceptor extends Interceptor {
  /**
   * @returns {RedirectInterceptor}
   */
  static create() {
    return new RedirectInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    if (options.uri.includes(this.spark.config.credentials.samlUrl) || options.uri.includes(this.spark.config.credentials.oauth.tokenUrl) || options.uri.includes(this.spark.config.credentials.oauth.authorizationUrl)) {
      return options;
    }

    options.headers[requestHeaderName] = true;
    options.$redirectCount = options.$redirectCount || 0;
    return options;
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    if (response.headers && response.headers[responseHeaderName]) {
      options = clone(options);
      options.uri = response.headers[responseHeaderName];
      options.$redirectCount += 1;
      if (options.$redirectCount > this.spark.config.maxAppLevelRedirects) {
        return Promise.reject(new Error(`Maximum redirects exceeded`));
      }

      return this.spark.request(options);
    }

    return response;
  }
}
