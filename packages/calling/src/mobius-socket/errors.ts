/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// @ts-expect-error `@webex/common` is still JS-only and does not ship declarations.
import {Exception} from '@webex/common';
import type {SocketCloseEvent, SocketResponse} from './socket/types';
import {MobiusSocketResponseError} from './types';

/**
 * Exception thrown when a websocket gets closed.
 */
export class ConnectionError extends Exception {
  static defaultMessage = 'Failed to connect to socket';

  code?: number;

  reason?: string;

  constructor(event: SocketCloseEvent = {}) {
    super(event);
    this.code = event.code;
    this.reason = event.reason;
  }

  /**
   * Parses a close event and sets the code and reason properties.
   * @param event - Socket close event to parse
   * @returns The reason string from the event
   */
  parse(event: SocketCloseEvent = {}) {
    return event.reason;
  }
}

/**
 * Thrown for CloseCode 1005.
 * UnknownResponse is produced by IE when we receive a 4XXX close code.
 * This should typically be treated like a NotFound error.
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
 * Thrown for CloseCode 4400.
 * BadRequest usually implies an attempt to use service account credentials.
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
 * Thrown for CloseCode 4401.
 * Indicates an authorization failure requiring a token refresh.
 */
export class NotAuthorized extends ConnectionError {
  static defaultMessage = 'Please refresh your access token';

  // eslint-disable-next-line no-useless-constructor
  constructor(event?: SocketCloseEvent) {
    super(event);
  }
}

/**
 * Thrown for CloseCode 4403.
 * Forbidden usually implies the credentials are not entitled for Webex.
 */
export class Forbidden extends ConnectionError {
  static defaultMessage = 'Forbidden usually implies these credentials are not entitled for Webex';

  // eslint-disable-next-line no-useless-constructor
  constructor(event?: SocketCloseEvent) {
    super(event);
  }
}

/**
 * Creates a MobiusSocketResponseError from a socket response.
 *
 * @param response - The socket response that triggered the error
 * @param statusCode - HTTP-style status code for the error
 * @param statusMessage - Human-readable status message
 * @returns A formatted error object with response details
 */
export function createWssResponseError(
  response: SocketResponse,
  statusCode?: number,
  statusMessage?: string
): MobiusSocketResponseError {
  const error = new Error(
    statusMessage || `Mobius websocket request failed with status ${statusCode || 'unknown'}`
  ) as MobiusSocketResponseError;

  error.name = 'MobiusSocketResponseError';
  error.statusCode = statusCode;
  error.statusMessage = statusMessage;
  error.response = response;
  error.trackingId = response?.trackingId;

  return error;
}

/**
 * Creates a timeout error for a socket request that didn't receive a response.
 *
 * @param request - The socket request that timed out
 * @returns A timeout error with status code 408
 */
export function createTimeoutError(request: SocketResponse): MobiusSocketResponseError {
  const errorPayload = {
    type: 'response_event',
    subtype: request.type,
    trackingId: request.trackingId,
  };

  return createWssResponseError(errorPayload, 408, 'Mobius websocket response timed out');
}
