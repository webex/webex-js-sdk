/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// @ts-expect-error `@webex/common` is still JS-only and does not ship declarations.
import {Exception} from '@webex/common';
import type {SocketCloseEvent} from './socket/types';

/**
 * Exception thrown when a websocket gets closed
 */
export class ConnectionError extends Exception {
  static defaultMessage = 'Failed to connect to socket';

  code?: number;

  reason?: string;

  // eslint-disable-next-line no-useless-constructor
  constructor(event?: SocketCloseEvent) {
    super(event);
  }

  /**
   * @param event
   */
  parse(event: SocketCloseEvent = {}) {
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

  // eslint-disable-next-line no-useless-constructor
  constructor(event?: SocketCloseEvent) {
    super(event);
  }
}

/**
 * thrown for CloseCode 4400
 */
export class BadRequest extends ConnectionError {
  static defaultMessage =
    'BadRequest usually implies an attempt to use service account credentials';

  // eslint-disable-next-line no-useless-constructor
  constructor(event?: SocketCloseEvent) {
    super(event);
  }
}

/**
 * thrown for CloseCode 4401
 */
export class NotAuthorized extends ConnectionError {
  static defaultMessage = 'Please refresh your access token';

  // eslint-disable-next-line no-useless-constructor
  constructor(event?: SocketCloseEvent) {
    super(event);
  }
}

/**
 * thrown for CloseCode 4403
 */
export class Forbidden extends ConnectionError {
  static defaultMessage = 'Forbidden usually implies these credentials are not entitled for Webex';

  // eslint-disable-next-line no-useless-constructor
  constructor(event?: SocketCloseEvent) {
    super(event);
  }
}
