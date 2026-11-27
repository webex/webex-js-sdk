/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

const inboundTransformPromise = Symbol('inboundTransformPromise');

/**
 * @class
 */
export default class PayloadTransformerInterceptor extends Interceptor {
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

    if (!this.webex.config.payloadTransformer.skipRepeatedInboundTransforms) {
      return this.webex.transform('inbound', response);
    }

    if (response[inboundTransformPromise]) {
      return response[inboundTransformPromise];
    }

    const transformPromise = this.webex.transform('inbound', response).catch((error) => {
      Reflect.deleteProperty(response, inboundTransformPromise);

      throw error;
    });

    // Store the in-flight promise so concurrent interceptor pipelines share the same transform.
    Object.defineProperty(response, inboundTransformPromise, {
      configurable: true,
      value: transformPromise,
    });

    return transformPromise;
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    if (options.disableTransform) {
      return Promise.reject(reason);
    }

    return this.webex.transform('inbound', reason).then((r) => Promise.reject(r || reason));
  }
}
