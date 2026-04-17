/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';

import {checkRequired} from '@webex/common';
import {safeSetTimeout} from '@webex/common-timers';
import {defaults, has, isObject} from 'lodash';
import uuid from 'uuid';

import {
  BadRequest,
  ConnectionError,
  Forbidden,
  NotAuthorized,
  UnknownResponse,
  // NotFound
} from '../errors';
import {MESSAGE_TYPES, SOCKET_READY_STATE} from './constants';

const sockets = new WeakMap();

/**
 * Generalized socket abstraction
 */
export default class Socket extends EventEmitter {
  /**
   * constructor
   * @returns {Socket}
   */
  constructor() {
    super();
    this._domain = 'unknown-domain';
    this._pendingResponses = new Map();
    this.onmessage = this.onmessage.bind(this);
    this.onclose = this.onclose.bind(this);
    // Increase max listeners to avoid memory leak warning in tests
    this.setMaxListeners(10);
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  get binaryType() {
    return sockets.get(this).binaryType;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {number}
   */
  get bufferedAmount() {
    return sockets.get(this).bufferedAmount;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  get extensions() {
    return sockets.get(this).extensions;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  get protocol() {
    return sockets.get(this).protocol;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {number}
   */
  get readyState() {
    return sockets.get(this).readyState;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @returns {string}
   */
  get url() {
    return sockets.get(this).url;
  }

  /**
   * Provides the environmentally appropriate constructor (ws in NodeJS,
   * WebSocket in browsers)
   * @returns {WebSocket}
   */
  static getWebSocketConstructor() {
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
  close(options) {
    return new Promise((resolve, reject) => {
      const socket = sockets.get(this);

      if (!socket) {
        // Open has not been called yet so there is no socket to close
        resolve();

        return;
      }
      // logger is defined once open is called
      this.logger.info(`socket,${this._domain}: closing`);

      if (
        socket.readyState === SOCKET_READY_STATE.CLOSING ||
        socket.readyState === SOCKET_READY_STATE.CLOSED
      ) {
        this.logger.info(`socket,${this._domain}: already closed`);
        resolve();

        return;
      }

      options = options || {};
      if (options.code && options.code !== 1000 && (options.code < 3000 || options.code > 4999)) {
        reject(new Error('`options.code` must be 1000 or between 3000 and 4999 (inclusive)'));

        return;
      }

      const originalCode = options.code;
      const originalReason = options.reason;

      options = defaults(options, {
        code: 1000,
        reason: 'Done',
      });

      const closeTimer = safeSetTimeout(() => {
        try {
          this.logger.info(`socket,${this._domain}: no close event received, forcing closure`);
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
          this.logger.warn(`socket,${this._domain}: force-close failed`, error);
        }
      }, this.forceCloseDelay);

      socket.onclose = (event) => {
        this.logger.info(`socket,${this._domain}: close event fired`, event.code, event.reason);
        clearTimeout(closeTimer);
        this.onclose(event);
        resolve(event);
      };

      // If socket is still connecting, manually trigger close handler with desired code
      // because calling close() on a CONNECTING socket may not preserve custom codes
      if (socket.readyState === SOCKET_READY_STATE.CONNECTING) {
        this.logger.info(
          `socket,${this._domain}: socket still connecting, triggering close manually`
        );
        clearTimeout(closeTimer);
        const closeEvent = {code: options.code, reason: options.reason};
        this.onclose(closeEvent);
        resolve(closeEvent);
        try {
          socket.close(options.code, options.reason);
        } catch (error) {
          this.logger.info(
            `socket,${this._domain}: error while closing CONNECTING socket, likely due to browser incompatibility with custom close codes`,
            error
          );
        }
      } else {
        socket.close(options.code, options.reason);
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
  open(url, options) {
    try {
      this._domain = new URL(url).hostname;
    } catch {
      this._domain = url;
    }

    return new Promise((resolve, reject) => {
      /* eslint complexity: [0] */
      if (!url) {
        reject(new Error('`url` is required'));

        return;
      }

      if (sockets.get(this)) {
        reject(new Error('Socket#open() can only be called once per instance'));

        return;
      }

      options = options || {};

      checkRequired(['forceCloseDelay', 'token', 'trackingId', 'logger'], options);

      Object.keys(options).forEach((key) => {
        Reflect.defineProperty(this, key, {
          enumerable: false,
          value: options[key],
        });
      });

      const WebSocket = Socket.getWebSocketConstructor();

      this.logger.info(`socket,${this._domain}: creating WebSocket`);
      const socket = new WebSocket(url, [], options);

      socket.binaryType = 'arraybuffer';
      socket.onmessage = this.onmessage;

      socket.onclose = (event) => {
        event = this._fixCloseCode(event);
        this.logger.info(`socket,${this._domain}: closed before open`, event.code, event.reason);
        switch (event.code) {
          case 1005:
            // IE 11 doesn't seem to allow 4XXX codes, so if we get a 1005, assume
            // it's a bad websocket url. That'll trigger a device refresh; if it
            // turns out we had a bad token, the device refresh should 401 and
            // trigger a token refresh.
            return reject(new UnknownResponse(event));
          case 4400:
            return reject(new BadRequest(event));
          case 4401:
            return reject(new NotAuthorized(event));
          case 4403:
            return reject(new Forbidden(event));
          // case 4404:
          //   return reject(new NotFound(event));
          default:
            return reject(new ConnectionError(event));
        }
      };

      socket.onopen = () => {
        this.logger.info(`socket,${this._domain}: connected`);
        this._authorize()
          .then(() => {
            this.logger.info(`socket,${this._domain}: authorized`);
            socket.onclose = this.onclose;
            resolve();
          })
          .catch(reject);
      };

      socket.onerror = (event) => {
        this.logger.warn(`socket,${this._domain}: error event fired`, event);
      };

      sockets.set(this, socket);
      this.logger.info(`socket,${this._domain}: waiting for server`);
    });
  }

  /**
   * Handles incoming CloseEvents
   * @param {CloseEvent} event
   * @returns {undefined}
   */
  onclose(event) {
    this.logger.info(`socket,${this._domain}: closed`, event.code, event.reason);

    event = this._fixCloseCode(event);
    this._rejectPendingResponses(new ConnectionError(event));
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
  onmessage(event) {
    try {
      const data = JSON.parse(event.data);
      const processedEvent = {data};

      if (data.type === 'async_event') {
        this._acknowledge(processedEvent).catch((error) => {
          this.logger.warn(`socket,${this._domain}: failed to acknowledge async event`, error);
        });
      }

      // Match pending request/response promises before emitting the public message event.
      // The message is still emitted afterward for any external listeners that care about it.
      this._handlePendingResponse(data);
      this.emit('message', processedEvent);
    } catch (error) {
      /* istanbul ignore next */
      this.logger.warn(`socket,${this._domain}: error while receiving WebSocket message`, error);
    }
  }

  /**
   * Sends a message up the socket
   * @param {mixed} data
   * @returns {Promise}
   */
  send(data) {
    return new Promise((resolve, reject) => {
      if (this.readyState !== SOCKET_READY_STATE.OPEN) {
        return reject(new Error('INVALID_STATE_ERROR'));
      }

      if (isObject(data)) {
        data = JSON.stringify(data);
      }

      const socket = sockets.get(this);

      socket.send(data);

      return resolve();
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
  sendRequest(data, options = {}) {
    if (!isObject(data)) {
      return Promise.reject(new Error('`data` is required'));
    }

    const request = {...data};
    const trackingId = request.trackingId || this._createTrackingId();
    const timeout = options.timeout || this.wssResponseTimeout || 10000;
    const matchesResponse =
      options.matchesResponse ||
      ((response) => response?.trackingId === trackingId && response?.type === 'response_event');
    const getStatusCode = options.getStatusCode || ((response) => response?.statusCode);
    const getStatusMessage = options.getStatusMessage || ((response) => response?.statusMessage);
    const createError =
      options.createError ||
      ((response, statusCode, statusMessage) =>
        new ConnectionError({
          code: statusCode,
          reason: statusMessage || response?.reason || 'Socket request failed',
        }));
    const createTimeoutError =
      options.createTimeoutError ||
      (() =>
        new ConnectionError({
          reason: 'Socket response not received before timeout',
        }));

    if (this._pendingResponses.has(trackingId)) {
      return Promise.reject(
        new Error(`socket request already pending for trackingId ${trackingId}`)
      );
    }

    request.trackingId = trackingId;

    return new Promise((resolve, reject) => {
      const timeoutId = safeSetTimeout(() => {
        this._clearPendingResponse(trackingId);
        reject(createTimeoutError(request));
      }, timeout);

      this._pendingResponses.set(trackingId, {
        request,
        matchesResponse,
        getStatusCode,
        getStatusMessage,
        createError,
        resolve: (response) => {
          this._clearPendingResponse(trackingId);
          resolve(response);
        },
        reject: (error) => {
          this._clearPendingResponse(trackingId);
          reject(error);
        },
        timeoutId,
      });

      this.send(request).catch((error) => {
        this._clearPendingResponse(trackingId);
        reject(error);
      });
    });
  }

  /**
   * Sends an acknowledgment for a specific event
   * @param {MessageEvent} event
   * @returns {Promise}
   */
  _acknowledge(event) {
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
      trackingId: event.data.trackingId || this._createTrackingId(),
      eventId: event.data.eventId,
    }).catch((error) => {
      if (error.message === 'INVALID_STATE_ERROR') {
        return Promise.resolve();
      }
      throw error;
    });
  }

  /**
   * Sends an auth message up the socket
   * @private
   * @returns {Promise}
   */
  _authorize() {
    this.logger.info(`socket,${this._domain}: authorizing`);

    return this.sendRequest(
      {
        type: MESSAGE_TYPES.AUTH,
        data: {
          token: this.token,
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
          new NotAuthorized({
            code: statusCode,
            reason: statusMessage || 'Mobius auth failed',
          }),
        createTimeoutError: () =>
          new NotAuthorized({
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
  _createTrackingId() {
    return `${this.trackingId}_${uuid.v4()}`;
  }

  /**
   * Clears a pending response entry.
   * @param {string} trackingId
   * @returns {void}
   */
  _clearPendingResponse(trackingId) {
    const pendingResponse = this._pendingResponses.get(trackingId);

    if (pendingResponse?.timeoutId) {
      clearTimeout(pendingResponse.timeoutId);
    }

    this._pendingResponses.delete(trackingId);
  }

  /**
   * Rejects all pending responses with the provided error.
   * @param {Error} error
   * @returns {void}
   */
  _rejectPendingResponses(error) {
    if (!this._pendingResponses.size) {
      return;
    }

    Array.from(this._pendingResponses.values()).forEach((pendingResponse) => {
      pendingResponse.reject(error);
    });
  }

  /**
   * Handles incoming responses for pending requests.
   * @param {Object} response
   * @returns {boolean}
   */
  _handlePendingResponse(response) {
    if (!response) {
      return false;
    }

    // Pending request correlation currently requires trackingId on the response.
    const pendingResponse = response.trackingId
      ? this._pendingResponses.get(response.trackingId)
      : undefined;

    if (!pendingResponse) {
      return false;
    }

    if (!pendingResponse.matchesResponse(response, pendingResponse.request)) {
      return false;
    }

    const statusCode = pendingResponse.getStatusCode(response);
    const statusMessage = pendingResponse.getStatusMessage(response);

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
  _fixCloseCode(event) {
    if (event.code === 1005 && event.reason) {
      switch (event.reason.toLowerCase()) {
        case 'replaced':
          this.logger.info(
            `socket,${this._domain}: fixing CloseEvent code for reason: `,
            event.reason
          );
          event.code = 4000;
          break;
        case 'authentication failed':
        case 'authentication did not happen within the timeout window of 30000 seconds.':
          this.logger.info(
            `socket,${this._domain}: fixing CloseEvent code for reason: `,
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
