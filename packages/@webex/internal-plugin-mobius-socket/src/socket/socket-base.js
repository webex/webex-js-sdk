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
import {SOCKET_READY_STATE} from './constants';

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
      type: 'event_ack',
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
    return new Promise((resolve, reject) => {
      this.logger.info(`socket,${this._domain}: authorizing`);
      let authResponseTimer;

      const cleanup = () => {
        clearTimeout(authResponseTimer);
        this.off('message', waitForAuthResponse);
      };

      const waitForAuthResponse = (event) => {
        if (event.data?.type !== 'auth.response') {
          return;
        }

        cleanup();

        const statusCode = event.data?.status?.code;

        if (statusCode >= 200 && statusCode < 300) {
          resolve();

          return;
        }

        reject(
          new NotAuthorized({
            code: statusCode,
            reason: event.data?.status?.message || 'Mobius auth failed',
          })
        );
      };

      this.on('message', waitForAuthResponse);
      authResponseTimer = safeSetTimeout(() => {
        cleanup();
        reject(
          new NotAuthorized({
            reason: 'Mobius auth response not received before timeout',
          })
        );
      }, this.authResponseTimeout || 10000);

      this.send({
        type: 'auth',
        trackingId: this._createTrackingId(),
        payload: {
          token: this.token,
        },
      }).catch((error) => {
        cleanup();
        reject(error);
      });
    });
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
