/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

/**
 * @class
 */
export default class PayloadTransformerInterceptor extends Interceptor {
  /**
   * @param {Object} attrs
   */
  constructor(attrs) {
    super(attrs);
    this.successfullyTransformedInbound = new WeakSet();
  }

  /**
   * @param {Object} options
   * @returns {PayloadTransformerInterceptor}
   */
  static create() {
    return new PayloadTransformerInterceptor({webex: this});
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

    return this.webex.transform('outbound', options);
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    if (options.disableTransform) {
      return response;
    }

    return this.applyInboundTransforms(response);
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    return this.applyInboundTransforms(reason).then((r) => Promise.reject(r || reason));
  }

  /**
   * Applies inbound payload transforms, optionally skipping objects that completed transformation earlier.
   * A WeakSet prevents repeated mutation without retaining response or error objects after callers release them.
   *
   * @param {Object} value
   * @returns {Promise<Object>}
   */
  applyInboundTransforms(value) {
    const shouldSkipRepeatedTransforms =
      this.webex.config.payloadTransformer.skipRepeatedInboundTransforms;

    if (shouldSkipRepeatedTransforms && this.successfullyTransformedInbound.has(value)) {
      return Promise.resolve(value);
    }

    return this.webex.transform('inbound', value).then((result) => {
      if (shouldSkipRepeatedTransforms) {
        this.successfullyTransformedInbound.add(value);
      }

      return result;
    });
  }
}
