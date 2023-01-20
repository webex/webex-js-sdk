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
    this.onmessage = this.onmessage.bind(this);
    this.onclose = this.onclose.bind(this);
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
      this.logger.info('socket: closing');

      if (socket.readyState === 2 || socket.readyState === 3) {
        this.logger.info('socket: already closed');
        resolve();

        return;
      }

      options = options || {};
      if (options.code && options.code !== 1000 && (options.code < 3000 || options.code > 4999)) {
        reject(new Error('`options.code` must be 1000 or between 3000 and 4999 (inclusive)'));

        return;
      }

      options = defaults(options, {
        code: 1000,
        reason: 'Done',
      });

      const closeTimer = safeSetTimeout(() => {
        try {
          this.logger.info('socket: no close event received, forcing closure');
          resolve(
            this.onclose({
              code: 1000,
              reason: 'Done (forced)',
            })
          );
        } catch (error) {
          this.logger.warn('socket: force-close failed', error);
        }
      }, this.forceCloseDelay);

      socket.onclose = (event) => {
        this.logger.info('socket: close event fired', event.code, event.reason);
        clearTimeout(closeTimer);
        this.onclose(event);
        resolve(event);
      };

      socket.close(options.code, options.reason);
    });
  }

  /**
   * Opens a WebSocket
   * @param {string} url
   * @param {options} options
   * @param {number} options.forceCloseDelay (required)
   * @param {number} options.pingInterval (required)
   * @param {number} options.pongTimeout (required)
   * @param {string} options.token (required)
   * @param {string} options.trackingId (required)
   * @param {Logger} options.logger (required)
   * @param {string} options.logLevelToken
   * @returns {Promise}
   */
  open(url, options) {
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

      checkRequired(
        ['forceCloseDelay', 'pingInterval', 'pongTimeout', 'token', 'trackingId', 'logger'],
        options
      );

      Object.keys(options).forEach((key) => {
        Reflect.defineProperty(this, key, {
          enumerable: false,
          value: options[key],
        });
      });

      const WebSocket = Socket.getWebSocketConstructor();

      this.logger.info('socket: creating WebSocket');
      const socket = new WebSocket(url, [], options);

      socket.binaryType = 'arraybuffer';
      socket.onmessage = this.onmessage;

      socket.onclose = (event) => {
        event = this._fixCloseCode(event);
        this.logger.info('socket: closed before open', event.code, event.reason);
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
        this.logger.info('socket: connected');
        this._authorize()
          .then(() => {
            this.logger.info('socket: authorized');
            socket.onclose = this.onclose;
            resolve();
          })
          .catch(reject);
      };

      socket.onerror = (event) => {
        this.logger.warn('socket: error event fired', event);
      };

      sockets.set(this, socket);
      this.logger.info('socket: waiting for server');
    });
  }

  /**
   * Handles incoming CloseEvents
   * @param {CloseEvent} event
   * @returns {undefined}
   */
  onclose(event) {
    this.logger.info('socket: closed', event.code, event.reason);
    clearTimeout(this.pongTimer);
    clearTimeout(this.pingTimer);

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
      const sequenceNumber = parseInt(data.sequenceNumber, 10);

      this.logger.debug('socket: sequence number: ', sequenceNumber);
      if (this.expectedSequenceNumber && sequenceNumber !== this.expectedSequenceNumber) {
        this.logger.debug(
          `socket: sequence number mismatch indicates lost mercury message. expected: ${this.expectedSequenceNumber}, actual: ${sequenceNumber}`
        );
        this.emit('sequence-mismatch', sequenceNumber, this.expectedSequenceNumber);
      }
      this.expectedSequenceNumber = sequenceNumber + 1;

      // Yes, it's a little weird looking; we want to emit message events that
      // look like normal socket message events, but event.data cannot be
      // modified and we don't actually care about anything but the data property
      const processedEvent = {data};

      this._acknowledge(processedEvent);
      if (data.type === 'pong') {
        this.emit('pong', processedEvent);
      } else {
        this.emit('message', processedEvent);
      }
    } catch (error) {
      // The above code should only be able to throw if we receive an unparsable
      // message from Mercury. At this time, the only action we have is to
      // ignore it and move on.
      /* istanbul ignore next */
      this.logger.warn('socket: error while receiving WebSocket message', error);
    }
  }

  /**
   * Sends a message up the socket
   * @param {mixed} data
   * @returns {Promise}
   */
  send(data) {
    return new Promise((resolve, reject) => {
      if (this.readyState !== 1) {
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

    if (!has(event, 'data.id')) {
      return Promise.reject(new Error('`event.data.id` is required'));
    }

    return this.send({
      messageId: event.data.id,
      type: 'ack',
    });
  }

  /**
   * Sends an auth message up the socket
   * @private
   * @returns {Promise}
   */
  _authorize() {
    return new Promise((resolve) => {
      this.logger.info('socket: authorizing');
      this.send({
        id: uuid.v4(),
        type: 'authorization',
        data: {
          token: this.token,
        },
        trackingId: this.trackingId,
        logLevelToken: this.logLevelToken,
      });

      const waitForBufferState = (event) => {
        if (
          !event.data.type &&
          (event.data.data.eventType === 'mercury.buffer_state' ||
            event.data.data.eventType === 'mercury.registration_status')
        ) {
          this.removeListener('message', waitForBufferState);
          this._ping();
          resolve();
        }
      };

      this.once('message', waitForBufferState);
    });
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
          this.logger.info('socket: fixing CloseEvent code for reason: ', event.reason);
          event.code = 4000;
          break;
        case 'authentication failed':
        case 'authentication did not happen within the timeout window of 30000 seconds.':
          this.logger.info('socket: fixing CloseEvent code for reason: ', event.reason);
          event.code = 1008;
          break;
        default:
        // do nothing
      }
    }

    return event;
  }

  /**
   * Sends a ping up the socket and confirms we get it back
   * @param {[type]} id
   * @private
   * @returns {[type]}
   */
  _ping(id) {
    const confirmPongId = (event) => {
      try {
        this.logger.debug('socket: pong', event.data.id);
        if (event.data && event.data.id !== id) {
          this.logger.info('socket: received pong for wrong ping id, closing socket');
          this.logger.debug('socket: expected', id, 'received', event.data.id);
          this.close({
            code: 1000,
            reason: 'Pong mismatch',
          });
        }
      } catch (error) {
        // This try/catch block was added as a debugging step; to the best of my
        // knowledge, the above can never throw.
        /* istanbul ignore next */
        this.logger.error('socket: error occurred in confirmPongId', error);
      }
    };

    const onPongNotReceived = () => {
      try {
        this.logger.info('socket: pong not receive in expected period, closing socket');
        this.close({
          code: 1000,
          reason: 'Pong not received',
        }).catch((reason) => {
          this.logger.warn('socket: failed to close socket after missed pong', reason);
        });
      } catch (error) {
        // This try/catch block was added as a debugging step; to the best of my
        // knowledge, the above can never throw.
        /* istanbul ignore next */
        this.logger.error('socket: error occurred in onPongNotReceived', error);
      }
    };

    const scheduleNextPingAndCancelPongTimer = () => {
      try {
        clearTimeout(this.pongTimer);
        this.pingTimer = safeSetTimeout(() => this._ping(), this.pingInterval);
      } catch (error) {
        // This try/catch block was added as a debugging step; to the best of my
        // knowledge, the above can never throw.
        /* istanbul ignore next */
        this.logger.error('socket: error occurred in scheduleNextPingAndCancelPongTimer', error);
      }
    };

    id = id || uuid.v4();
    this.pongTimer = safeSetTimeout(onPongNotReceived, this.pongTimeout);
    this.once('pong', scheduleNextPingAndCancelPongTimer);
    this.once('pong', confirmPongId);

    this.logger.debug(`socket: ping ${id}`);

    return this.send({
      id,
      type: 'ping',
    });
  }
}
