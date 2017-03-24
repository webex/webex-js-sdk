/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {Exception} from '@ciscospark/common';

/**
 * Exception thrown when a websocket gets closed
 */
export class ConnectionError extends Exception {
  /**
   * @param {CloseEvent} event
   * @returns {string}
   */
  parse(event = {}) {
    Object.defineProperties(this, {
      code: {
        value: event.code
      },
      reason: {
        value: event.reason
      }
    });

    return event.reason;
  }
}

/**
 * Exception thrown when a websocket gets closed for auth reasons
 */
export class AuthorizationError extends ConnectionError {}
