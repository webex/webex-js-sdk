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

    message += `\n${this.options.method} ${this.options.url}`;
    message += `\nWEBEX_TRACKING_ID: ${this.options.headers.trackingid}`;

    return message;
  },
  subTypeName: `SparkHttpError`
});

HttpError.makeSubTypes(SparkHttpError);

export default SparkHttpError;
