/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor} from '@ciscospark/http-core';
import uuid from 'uuid';

/**
 * @class
 */
export default class SparkTrackingIdInterceptor extends Interceptor {
  /**
   * @constructor
   * @param {ProxySpark} spark
   * @param {Object} options
   * @returns {SparkTrackingIdInterceptor}
   */
  constructor(spark, options) {
    super({spark});

    if (!options || !options.prefix) {
      throw new Error(`\`options.prefix\` is required. Did you forget to specify it at config.trackingIdPrefix?`);
    }

    let sequence = 0;
    const base = options.base || uuid.v4();
    const prefix = options.prefix || `spark-js-sdk`;

    Object.defineProperties(this, {
      base: {
        writable: false,
        value: base
      },
      prefix: {
        writable: false,
        value: prefix
      },
      sequence: {
        get: function get() {
          sequence += 1;
          return sequence;
        }
      }
    });
  }

  /**
   * @param {Object} options
   * @returns {SparkTrackingIdInterceptor}
   */
  static create(options) {
    return new SparkTrackingIdInterceptor(this, options);
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    if (this.requiresTrackingId(options)) {
      options.headers.trackingid = this._generateTrackingId(options);
    }
    return options;
  }

  /**
   * Determines whether or not include a tracking id
   * @param {Object} options
   * @returns {boolean}
   */
  requiresTrackingId(options) {
    return !options.headers.trackingid;
  }

  /**
   * Generates a tracking id
   * @private
   * @returns {string}
   */
  _generateTrackingId() {
    return `${this.prefix}_${this.base}_${this.sequence}`;
  }
}
