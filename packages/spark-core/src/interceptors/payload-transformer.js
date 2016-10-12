/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {isString, last} from 'lodash';
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
    return this.transform(`outbound`, options);
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    return this.transform(`inbound`, response);
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    return this.transform(`inbound`, reason)
      .then(() => Promise.reject(reason));
  }

  /**
   * Applies the directionally appropriate transforms to the specified object
   * @param {string} direction
   * @param {Object} object
   * @returns {Promise}
   */
  transform(direction, object) {
    const predicates = this.spark.config.payloadTransformer.predicates.filter((p) => !p.direction || p.direction === direction);
    return Promise.all(predicates.map((p) => p.test(object)
      .then((shouldTransform) => {
        if (!shouldTransform) {
          return object;
        }
        return p.extract(object)
          // eslint-disable-next-line max-nested-callbacks
          .then((target) => ({
            name: p.name,
            target
          }));
      })))
      // eslint-disable-next-line arrow-body-style
      .then((data) => {
        // two rules to disable on the next line for readability reasons
        // eslint-disable-next-line
        return data.reduce((promise, {name, target}) => promise.then(() => {
          return this.applyNamedTransform(direction, name, target);
        }), Promise.resolve());
      })
      .then(() => object);
  }

  /**
   * Applies the directionally appropriate transform to the specified parameters
   * @param {string} direction
   * @param {Object} ctx
   * @param {string} name
   * @returns {Promise}
   */
  applyNamedTransform(direction, ctx, name, ...rest) {
    if (isString(ctx)) {
      rest.unshift(name);
      name = ctx;
      ctx = {
        spark: this.spark,
        transform: (...args) => this.applyNamedTransform(direction, ctx, ...args)
      };
    }

    const transforms = ctx.spark.config.payloadTransformer.transforms.filter((tx) => tx.name === name && (!tx.direction || tx.direction === direction));
    // too many implicit returns on the same line is difficult to interpret
    // eslint-disable-next-line arrow-body-style
    return transforms.reduce((promise, tx) => promise.then(() => {
      return tx.fn(ctx, ...rest);
    }), Promise.resolve())
      .then(() => last(rest));
  }
}
