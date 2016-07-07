/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import extendError from 'extend-error';

export const ConnectionError = extendError({
  parseFn(event) {
    Object.defineProperties(this, {
      code: {
        value: event.code
      },
      reason: {
        value: event.reason
      }
    });

    return event.reason;
  },

  subTypeName: `ConnectionError`
});

export const AuthorizationError = extendError(ConnectionError, {
  subTypeName: `AuthorizationError`
});
