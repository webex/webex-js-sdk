/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Exception} from '@ciscospark/common';

/**
 * Error class for KMS errors
 */
export default class KmsError extends Exception {
  static defaultMessage = `An error was received while communicating with the KMS`;

  /**
   * @param {HttpResponse} body
   * @returns {string}
   */
  parse(body) {
    body = body.body || body;

    Object.defineProperties(this, {
      body: {
        enumerable: false,
        value: body
      },
      reason: {
        enumerable: false,
        value: body.reason
      },
      requestId: {
        enumerable: false,
        value: body.requestId
      },
      status: {
        enumerable: false,
        value: body.status
      }
    });

    return body.reason;
  }
}
