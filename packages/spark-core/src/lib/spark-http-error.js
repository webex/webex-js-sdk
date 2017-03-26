/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import extendError from 'extend-error';
import {HttpError} from '@ciscospark/http-core';
import {isArray, pick} from 'lodash';

const SparkHttpError = extendError(HttpError, {
  parseFn(res, ...rest) {
    /* eslint prefer-reflect: [0] */
    let message = HttpError.prototype.parseFn.call(this, res, ...rest);

    let rawMessage;
    try {
      rawMessage = JSON.parse(message);
      rawMessage = parseDescription(rawMessage);
    }
    catch (error) {
      rawMessage = message;
    }

    Reflect.defineProperty(this, `options`, {
      enumerable: false,
      value: res.options
    });

    Reflect.defineProperty(this, `rawMessage`, {
      enumerable: false,
      value: rawMessage || ``
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

/**
 * @param {object} body
 * @private
 * @returns {string}
 */
function parseDescription(body) {
  // if explanation is an array, recurse and try again with first element
  if (isArray(body) && body.length) {
    return parseDescription(body[0]);
  }

  // Search body for common names of error strings
  const messages = Object.values(pick(body, `description`));

  // If no error candidate was found, stringify the entire body
  if (messages.length === 0) {
    return JSON.stringify(body, null, 2);
  }

  // Assume the first key found was the error explanation
  const message = messages[0];

  // If the explanation is an object, recurse and try again
  if (typeof message === `object`) {
    return parseDescription(message);
  }

  // Return the first key
  return message;
}

export default SparkHttpError;
