/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import extendError from 'extend-error';
import makeSubTypes from './http-error-subtypes';
import {pick} from 'lodash';

/**
 * @class HttpError
 * @extends Error
 */
const HttpError = extendError({
  parseFn: function parseFn(res) {
    /* eslint complexity: [0] */
    let body = res.body;
    let message;
    switch (typeof body) {
    case `string`:
      try {
        body = JSON.parse(body);
        message = parseObject(body);
      }
      catch (error) {
        message = body;
      }
      break;
    case `object`:
      message = parseObject(body);
      break;
    default:
      // do nothing
    }

    if (!message) {
      message = this.defaultMessage;
    }

    Object.defineProperties(this, {
      body: {
        enumerable: false,
        value: body
      },
      httpVersion: {
        enumerable: false,
        value: res.httpVersion
      },
      headers: {
        enumerable: false,
        value: res.headers || {}
      },
      rawHeaders: {
        enumerable: false,
        value: res.rawHeaders || []
      },
      trailers: {
        enumerable: false,
        value: res.trailers || {}
      },
      rawTrailers: {
        enumerable: false,
        value: res.rawTrailers || []
      },
      method: {
        enumerable: false,
        value: res.method
      },
      url: {
        enumerable: false,
        value: res.url
      },
      statusCode: {
        enumerable: false,
        value: res.statusCode
      },
      statusMessage: {
        enumerable: false,
        value: res.statusMessage
      },
      socket: {
        enumerable: false,
        value: res.socket
      },
      _res: {
        enumerable: false,
        value: res
      }
    });

    return message;
  },
  properties: {
    defaultMessage: `An error was received while trying to fulfill the request`
  },
  subTypeName: `HttpError`
});

/**
 * @param {object} body
 * @private
 * @returns {string}
 */
function parseObject(body) {
  // Search body for common names of error strings
  const messages = Object.values(pick(body, `message`, `error`, `errorString`, `response`, `errorResponse`, `msg`));

  // If no error candidate was found, stringify the entire body
  if (messages.length === 0) {
    return JSON.stringify(body, null, 2);
  }

  // Assume the first key found was the error explanation
  const message = messages[0];

  // If the explanation is an object, recurse and try again
  if (typeof message === `object`) {
    return parseObject(message);
  }

  // Return the first key
  return message;
}


makeSubTypes(HttpError);
HttpError.makeSubTypes = makeSubTypes;

export default HttpError;
