/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import extendError from 'extend-error';
import {HttpError} from '@ciscospark/http-core';

const SparkHttpError = extendError(HttpError, {
  parseFn(res, ...rest) {
    /* eslint prefer-reflect: [0] */
    let message = HttpError.prototype.parseFn.call(this, res, ...rest);

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
  },
  subTypeName: `SparkHttpError`
});

HttpError.makeSubTypes(SparkHttpError);

export default SparkHttpError;
