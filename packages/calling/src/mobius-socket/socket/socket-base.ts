/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';

// @ts-expect-error `@webex/common` is still JS-only and does not ship declarations.
import {checkRequired} from '@webex/common';
// @ts-expect-error `@webex/common-timers` is still JS-only and does not ship declarations.
import {safeSetTimeout} from '@webex/common-timers';
import {defaults, has, isObject} from 'lodash';

import {BadRequest, ConnectionError, Forbidden, NotAuthorized, UnknownResponse} from '../errors';
import {MESSAGE_TYPES, SOCKET_READY_STATE} from './constants';
import type {
  SocketCloseEvent,
  SocketLogger,
  SocketMessageEvent,
  PendingResponseEntry,
  SendRequestOptions,
  SocketOpenOptions,
  SocketResponse,
  SocketTransport,
  SocketTransportConstructor,
} from './types';

const sockets = new WeakMap<Socket, SocketTransport>();
const UnknownResponseCtor = UnknownResponse as unknown as new (
  event?: SocketCloseEvent
) => UnknownResponse;
const BadRequestCtor = BadRequest as unknown as new (event?: SocketCloseEvent) => BadRequest;
const NotAuthorizedCtor = NotAuthorized as unknown as new (
  event?: SocketCloseEvent
) => NotAuthorized;
const ForbiddenCtor = Forbidden as unknown as new (event?: SocketCloseEvent) => Forbidden;
const ConnectionErrorCtor = ConnectionError as unknown as new (
  event?: SocketCloseEvent
) => ConnectionError;

/**
 * Generalized socket abstraction
 */
export default class Socket extends EventEmitter {
  private domain: string;

  private pendingResponses: Map<string, PendingResponseEntry>;

  forceCloseDelay!: number;

  logger!: SocketLogger;

  refreshToken?: (response: SocketResponse) => unknown;

  token!: string;

  trackingId!: string;

  wssResponseTimeout?: number;

  /**
   * constructor
   * @returns {Socket}
   */
  public constructor() {
    super();
    this.domain = 'unknown-domain';
    this.pendingResponses = new Map();
    this.onmessage = this.onmessage.bind(this);
    this.onclose = this.onclose.bind(this);
    this.setMaxListeners(10);
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  public get binaryType() {
    return sockets.get(this)!.binaryType;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {number}
   */
  public get bufferedAmount() {
    return sockets.get(this)!.bufferedAmount;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  public get extensions() {
    return sockets.get(this)!.extensions;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  public get protocol() {
    return sockets.get(this)!.protocol;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {number}
   */
  public get readyState() {
    return sockets.get(this)!.readyState;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  public get url() {
    return sockets.get(this)!.url;
  }

  /**
   * Provides the environmentally appropriate constructor (ws in NodeJS,
   * WebSocket in browsers)
   * @returns {WebSocket}
   */
  public static getWebSocketConstructor(): unknown {
    throw new Error(
      'Socket.getWebSocketConstructor() must be implemented in an environmentally appropriate way'
    );
  }

  /**
   * Closes the socket
   * @param {Object} options
   * @param {string} options.reason
   * @param {number} options.code
   * @returns {Promise}
   */
  public close(options?: {reason?: string; code?: number}) {
    return new Promise<SocketCloseEvent | void>((resolve, reject) => {
      const socket = sockets.get(this);

      if (!socket) {
        // Open has not been called yet so there is no socket to close
        resolve();

        return;
      }
      // logger is defined once open is called
      this.logger.info(`socket,${this.domain}: closing`);

      if (
        socket.readyState === SOCKET_READY_STATE.CLOSING ||
        socket.readyState === SOCKET_READY_STATE.CLOSED
      ) {
        this.logger.info(`socket,${this.domain}: already closed`);
        resolve();

        return;
      }

      const originalCode = options?.code;
      const originalReason = options?.reason;

      const resolvedOptions = defaults(options || {}, {
        code: 1000,
        reason: 'Done',
      }) as {code: number; reason: string};

      if (
        resolvedOptions.code &&
        resolvedOptions.code !== 1000 &&
        (resolvedOptions.code < 3000 || resolvedOptions.code > 4999)
      ) {
        reject(new Error('`options.code` must be 1000 or between 3000 and 4999 (inclusive)'));

        return;
      }

      const closeTimer = safeSetTimeout(() => {
        try {
          this.logger.info(`socket,${this.domain}: no close event received, forcing closure`);
          resolve(
            this.onclose(
              originalCode
                ? {code: originalCode, reason: originalReason || 'Done (unknown)'}
                : {
                    code: 1000,
                    reason: 'Done (forced)',
                  }
            )
          );
        } catch (error) {
          this.logger.warn(`socket,${this.domain}: force-close failed`, error);
        }
      }, this.forceCloseDelay);

      socket.onclose = (event) => {
        this.logger.info(`socket,${this.domain}: close event fired`, event.code, event.reason);
        clearTimeout(closeTimer);
        this.onclose(event);
        resolve(event);
      };

      // If socket is still connecting, manually trigger close handler with desired code
      // because calling close() on a CONNECTING socket may not preserve custom codes
      if (socket.readyState === SOCKET_READY_STATE.CONNECTING) {
        this.logger.info(
          `socket,${this.domain}: socket still connecting, triggering close manually`
        );
        clearTimeout(closeTimer);
        const closeEvent: SocketCloseEvent = {
          code: resolvedOptions.code,
          reason: resolvedOptions.reason,
        };
        this.onclose(closeEvent);
        resolve(closeEvent);
        try {
          socket.close(resolvedOptions.code, resolvedOptions.reason);
        } catch (error) {
          this.logger.info(
            `socket,${this.domain}: error while closing CONNECTING socket, likely due to browser incompatibility with custom close codes`,
            error
          );
        }
      } else {
        socket.close(resolvedOptions.code, resolvedOptions.reason);
      }
    });
  }

  /**
   * Opens a WebSocket
   * @param {string} url
   * @param {options} options
   * @param {number} options.forceCloseDelay (required)
   * @param {string} options.token (required)
   * @param {string} options.trackingId (required)
   * @param {Logger} options.logger (required)
   * @returns {Promise}
   */
  public open(url: string, options?: SocketOpenOptions) {
    try {
      this.domain = new URL(url).hostname;
    } catch {
      this.domain = url;
    }

    return new Promise<void>((resolve, reject) => {
      /* eslint complexity: [0] */
      if (!url) {
        reject(new Error('`url` is required'));

        return;
      }

      if (sockets.get(this)) {
        reject(new Error('Socket#open() can only be called once per instance'));

        return;
      }

      const resolvedOptions = (options || {}) as SocketOpenOptions;

      checkRequired(['forceCloseDelay', 'token', 'trackingId', 'logger'], resolvedOptions);

      Object.keys(resolvedOptions).forEach((key) => {
        Reflect.defineProperty(this, key, {
          enumerable: false,
          value: resolvedOptions[key],
        });
      });

      const WebSocket = Socket.getWebSocketConstructor() as SocketTransportConstructor;

      this.logger.info(`socket,${this.domain}: creating WebSocket`);
      const socket = new WebSocket(url, [], resolvedOptions);

      socket.binaryType = 'arraybuffer';
      socket.onmessage = this.onmessage;

      socket.onclose = (event) => {
        event = this.fixCloseCode(event);
        this.logger.info(`socket,${this.domain}: closed before open`, event.code, event.reason);
        switch (event.code) {
          case 1005:
            // IE 11 doesn't seem to allow 4XXX codes, so if we get a 1005, assume
            // it's a bad websocket url. That'll trigger a device refresh; if it
            // turns out we had a bad token, the device refresh should 401 and
            // trigger a token refresh.
            return reject(new UnknownResponseCtor(event));
          case 4400:
            return reject(new BadRequestCtor(event));
          case 4401:
            return reject(new NotAuthorizedCtor(event));
          case 4403:
            return reject(new ForbiddenCtor(event));
          default:
            return reject(new ConnectionErrorCtor(event));
        }
      };

      socket.onopen = () => {
        this.logger.info(`socket,${this.domain}: connected`);
        this.authorize(this.token)
          .then(() => {
            this.logger.info(`socket,${this.domain}: authorized`);
            socket.onclose = this.onclose;
            resolve();
          })
          .catch(reject);
      };

      socket.onerror = (event) => {
        this.logger.warn(`socket,${this.domain}: error event fired`, event);
      };

      sockets.set(this, socket);
      this.logger.info(`socket,${this.domain}: waiting for server`);
    });
  }

  /**
   * Handles incoming CloseEvents
   * @param {CloseEvent} event
   * @returns {undefined}
   */
  public onclose(event: SocketCloseEvent) {
    this.logger.info(`socket,${this.domain}: closed`, event.code, event.reason);

    event = this.fixCloseCode(event);
    this.rejectPendingResponses(new ConnectionErrorCtor(event));
    this.emit('close', event);

    // Remove all listeners to (a) avoid reacting to late pongs and (b) ensure
    // we don't have a retain cycle.
    this.removeAllListeners();
  }

  /**
   * Handles incoming message events
   * @param {MessageEvent} event
   * @returns {undefined}
   */
  public onmessage(event: SocketMessageEvent<string>) {
    try {
      const data = JSON.parse(event.data) as SocketResponse;
      const processedEvent = {data};

      if (data.type === 'async_event') {
        this.acknowledge(processedEvent).catch((error) => {
          this.logger.warn(`socket,${this.domain}: failed to acknowledge async event`, error);
        });
      }

      // Match pending request/response promises before emitting the public message event.
      // The message is still emitted afterward for any external listeners that care about it.
      this.handlePendingResponse(data);
      this.emit('message', processedEvent);
    } catch (error) {
      /* istanbul ignore next */
      this.logger.warn(`socket,${this.domain}: error while receiving WebSocket message`, error);
    }
  }

  /**
   * Sends a message up the socket
   * @param {mixed} data
   * @returns {Promise}
   */
  public send(data: string | Record<string, unknown>) {
    return new Promise<void>((resolve, reject) => {
      if (this.readyState !== SOCKET_READY_STATE.OPEN) {
        reject(new Error('INVALID_STATE_ERROR'));

        return;
      }

      if (isObject(data)) {
        data = JSON.stringify(data);
      }

      const socket = sockets.get(this);

      if (!socket) {
        reject(new Error('INVALID_STATE_ERROR'));

        return;
      }

      socket.send(data);

      resolve();
    });
  }

  /**
   * Sends a request and resolves when the matching response arrives.
   * @param {Object} data
   * @param {Object} [options={}]
   * @param {Function} [options.matchesResponse]
   * @param {Function} [options.createError]
   * @param {Function} [options.createTimeoutError]
   * @param {Function} [options.getStatusCode]
   * @param {Function} [options.getStatusMessage]
   * @param {number} [options.timeout]
   * @returns {Promise<Object>}
   */
  public sendRequest(data: SocketResponse, options: SendRequestOptions = {}) {
    if (!isObject(data)) {
      return Promise.reject(new Error('`data` is required'));
    }

    const request = {...data};
    const trackingId = request.trackingId || this.createTrackingId();
    const timeout = options.timeout || this.wssResponseTimeout || 10000;
    const matchesResponse =
      options.matchesResponse ||
      ((response) => response?.trackingId === trackingId && response?.type === 'response_event');
    const getStatusCode = options.getStatusCode || ((response) => response?.statusCode);
    const getStatusMessage = options.getStatusMessage || ((response) => response?.statusMessage);
    const createError =
      options.createError ||
      ((response, statusCode, statusMessage) =>
        new ConnectionErrorCtor({
          code: statusCode,
          reason: statusMessage || response?.reason || 'Socket request failed',
        }));
    const createTimeoutError =
      options.createTimeoutError ||
      (() =>
        new ConnectionErrorCtor({
          reason: 'Socket response not received before timeout',
        }));

    if (this.pendingResponses.has(trackingId)) {
      return Promise.reject(
        new Error(`socket request already pending for trackingId ${trackingId}`)
      );
    }

    request.trackingId = trackingId;

    return new Promise<SocketResponse>((resolve, reject) => {
      const timeoutId = safeSetTimeout(() => {
        this.clearPendingResponse(trackingId);
        reject(createTimeoutError(request));
      }, timeout);

      this.pendingResponses.set(trackingId, {
        request,
        matchesResponse,
        getStatusCode,
        getStatusMessage,
        createError,
        resolve: (response) => {
          this.clearPendingResponse(trackingId);
          resolve(response);
        },
        reject: (error) => {
          this.clearPendingResponse(trackingId);
          reject(error);
        },
        timeoutId,
      });

      this.send(request).catch((error) => {
        this.clearPendingResponse(trackingId);
        reject(error);
      });
    });
  }

  /**
   * Sends an acknowledgment for a specific event
   * @param {MessageEvent} event
   * @returns {Promise}
   */
  private acknowledge(event: SocketMessageEvent<SocketResponse>) {
    if (!event) {
      return Promise.reject(new Error('`event` is required'));
    }

    if (!has(event, 'data.eventId')) {
      return Promise.reject(new Error('`event.data.eventId` is required'));
    }

    // Don't try to acknowledge if socket is not in open state
    if (this.readyState !== SOCKET_READY_STATE.OPEN) {
      return Promise.resolve();
    }

    return this.send({
      type: MESSAGE_TYPES.EVENT_ACK,
      trackingId: event.data.trackingId || this.createTrackingId(),
      eventId: event.data.eventId,
    }).catch((error) => {
      if (error.message === 'INVALID_STATE_ERROR') {
        return Promise.resolve();
      }
      throw error;
    });
  }

  public refresh(token: string | {toString(): string}) {
    if (!token) {
      return Promise.reject(new Error('`token` is required for Socket#refresh()'));
    }

    let refreshedToken;

    if (typeof token === 'string') {
      refreshedToken = token;
    } else if (token && typeof token.toString === 'function') {
      refreshedToken = token.toString();
    } else {
      refreshedToken = String(token);
    }

    return this.authorize(refreshedToken);
  }

  /**
   * Sends an auth message up the socket with a refreshed token.
   * @param {string} token
   * @returns {Promise}
   */
  private authorize(token: string) {
    this.logger.info(`socket,${this.domain}: authorizing`);

    return this.sendRequest(
      {
        type: MESSAGE_TYPES.AUTH,
        data: {
          token,
        },
      },
      {
        matchesResponse: (response, request) =>
          response?.type === 'response_event' &&
          response?.subtype === MESSAGE_TYPES.AUTH &&
          response?.trackingId === request.trackingId,
        getStatusCode: (response) => response?.statusCode,
        getStatusMessage: (response) => response?.statusMessage,
        createError: (response, statusCode, statusMessage) =>
          new NotAuthorizedCtor({
            code: statusCode,
            reason: statusMessage || 'Mobius auth failed',
          }),
        createTimeoutError: () =>
          new NotAuthorizedCtor({
            reason: 'Mobius auth response not received before timeout',
          }),
      }
    );
  }

  /**
   * Creates a unique tracking ID
   * @private
   * @returns {string}
   */
  private createTrackingId() {
    return `${this.trackingId}_${crypto.randomUUID()}`;
  }

  /**
   * Clears a pending response entry.
   * @param {string} trackingId
   * @returns {void}
   */
  private clearPendingResponse(trackingId: string) {
    const pendingResponse = this.pendingResponses.get(trackingId);

    if (pendingResponse?.timeoutId) {
      clearTimeout(pendingResponse.timeoutId);
    }

    this.pendingResponses.delete(trackingId);
  }

  /**
   * Rejects all pending responses with the provided error.
   * @param {Error} error
   * @returns {void}
   */
  private rejectPendingResponses(error: unknown) {
    if (!this.pendingResponses.size) {
      return;
    }

    Array.from(this.pendingResponses.values()).forEach((pendingResponse) => {
      pendingResponse.reject(error);
    });
  }

  /**
   * Handles incoming responses for pending requests.
   * @param {Object} response
   * @returns {boolean}
   */
  private handlePendingResponse(response: SocketResponse) {
    if (!response) {
      return false;
    }

    // Pending request correlation currently requires trackingId on the response.
    const pendingResponse = response.trackingId
      ? this.pendingResponses.get(response.trackingId)
      : undefined;

    if (!pendingResponse) {
      return false;
    }

    if (!pendingResponse.matchesResponse(response, pendingResponse.request)) {
      return false;
    }

    const statusCode = pendingResponse.getStatusCode(response);
    const statusMessage = pendingResponse.getStatusMessage(response);

    if (statusCode === 440 && response?.subtype !== MESSAGE_TYPES.AUTH) {
      if (typeof this.refreshToken === 'function') {
        Promise.resolve(this.refreshToken(response)).catch((error) => {
          this.logger.warn(`socket,${this.domain}: failed token-expiry re-auth`, error);
        });
      } else {
        this.logger.warn(
          `socket,${this.domain}: refreshToken callback is unavailable for statusCode 440`
        );
      }
    }

    if (statusCode === undefined) {
      pendingResponse.reject(
        pendingResponse.createError(
          response,
          statusCode,
          statusMessage || 'Socket response missing status code'
        )
      );
    } else if (statusCode >= 200 && statusCode < 300) {
      pendingResponse.resolve(response);
    } else {
      pendingResponse.reject(pendingResponse.createError(response, statusCode, statusMessage));
    }

    return true;
  }

  /**
   * Deals with the fact that some browsers drop some close codes (but not
   * close reasons).
   * @param {CloseEvent} event
   * @private
   * @returns {CloseEvent}
   */
  private fixCloseCode(event: SocketCloseEvent) {
    if (event.code === 1005 && event.reason) {
      switch (event.reason.toLowerCase()) {
        case 'replaced':
          this.logger.info(
            `socket,${this.domain}: fixing CloseEvent code for reason: `,
            event.reason
          );
          event.code = 4000;
          break;
        case 'authentication failed':
        case 'authentication did not happen within the timeout window of 30000 seconds.':
          this.logger.info(
            `socket,${this.domain}: fixing CloseEvent code for reason: `,
            event.reason
          );
          event.code = 1008;
          break;
        default:
        // do nothing
      }
    }

    return event;
  }
}
