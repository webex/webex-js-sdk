/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Exception} from '@webex/common';

/**
 * Exception thrown when a websocket gets closed
 */
export class ConnectionError extends Exception {
  static defaultMessage = 'Failed to connect to socket';

  /**
   * @param {CloseEvent} event
   * @returns {string}
   */
  parse(event = {}) {
    Object.defineProperties(this, {
      code: {
        value: event.code,
      },
      reason: {
        value: event.reason,
      },
    });

    return event.reason;
  }
}

/**
 * thrown for CloseCode 4400
 */
export class UnknownResponse extends ConnectionError {
  static defaultMessage =
    'UnknownResponse is produced by IE when we receive a 4XXX. You probably want to treat this like a NotFound';
}

/**
 * thrown for CloseCode 4400
 */
export class BadRequest extends ConnectionError {
  static defaultMessage =
    'BadRequest usually implies an attempt to use service account credentials';
}

/**
 * thrown for CloseCode 4401
 */
export class NotAuthorized extends ConnectionError {
  static defaultMessage = 'Please refresh your access token';
}

/**
 * thrown for CloseCode 4403
 */
export class Forbidden extends ConnectionError {
  static defaultMessage = 'Forbidden usually implies these credentials are not entitled for Webex';
}

// /**
//  * thrown for CloseCode 4404
//  */
// export class NotFound extends ConnectionError {
//   static defaultMessage = `Please refresh your Mercury registration (typically via a WDM refresh)`;
// }
