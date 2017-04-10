/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {HttpError} from '@ciscospark/http-core';

/**
 * Spark-specific http error class
 */
export default class SparkHttpError extends HttpError {
  /**
   * Very similar to {@link HttpError#parse()}, but additionally adds some
   * useful headers to the message string
   * @param {HttpResponse} res
   * @returns {string}
   */
  parse(res) {
    let message = Reflect.apply(HttpError.prototype.parse, this, [res]);

    Reflect.defineProperty(this, `options`, {
      enumerable: false,
      value: res.options
    });

    if (this.options.url) {
      message += `\n${this.options.method} ${this.options.url}`;
    }
    else if (this.options.uri) {
      message += `\n${this.options.method} ${this.options.uri}`;
    }
    else {
      message += `\n${this.options.method} ${this.options.service.toUpperCase()}/${this.options.resource}`;
    }
    message += `\nWEBEX_TRACKING_ID: ${this.options.headers.trackingid}`;
    if (this.options.headers && this.options.headers[`x-trans-id`]) {
      message += `\nX-Trans-Id: ${this.options.headers[`x-trans-id`]}`;
    }
    message += `\n`;

    return message;
  }
}

HttpError.makeSubTypes(SparkHttpError);
