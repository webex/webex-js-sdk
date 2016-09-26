/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import extendError from 'extend-error';

/**
 * @class
 */
const KmsError = extendError({
  /**
   * @param {Object} body
   * @returns {string}
   */
  parseFn(body) {
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
  },

  properties: {
    defaultMessage: `An error was received while communicating with the KMS`
  },

  subTypeName: `KmsError`
});

export default KmsError;
