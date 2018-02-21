/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@ciscospark/http-core';

/**
 * @class
 */
export default class PayloadTransformerInterceptor extends Interceptor {
  /**
   * @param {Object} options
   * @returns {PayloadTransformerInterceptor}
   */
  static create() {
    return new PayloadTransformerInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    if (options.noTransform) {
      return options;
    }
    return this.spark.transform('outbound', options);
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    return this.spark.transform('inbound', response);
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    return this.spark.transform('inbound', reason)
      .then((r) => Promise.reject(r || reason));
  }
}
