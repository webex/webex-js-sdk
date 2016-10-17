/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {deprecated} from 'core-decorators';
import {oneFlight} from '@ciscospark/common';
import {set} from 'lodash';
import S from 'string';
import backoff from 'backoff';
import Socket from './socket';
import {AuthorizationError} from './errors';

const normalReconnectReasons = [
  `idle`,
  `done (forced)`,
  `pong not received`,
  `pong mismatch`
];

const Mercury = SparkPlugin.extend({
  namespace: `Mercury`,

  session: {
    connected: {
      default: false,
      type: `boolean`
    },
    connecting: {
      default: false,
      type: `boolean`
    },
    socket: `object`
  },

  derived: {
    listening: {
      deps: [`connected`],
      fn() {
        return this.connected;
      }
    }
  },

  @oneFlight
  connect() {
    if (this.connected) {
      this.logger.info(`mercury: already connected, will not connect again`);
      return Promise.resolve();
    }

    this.connecting = true;
    return Promise.resolve(this.spark.device.registered || this.spark.device.register())
      .then(() => {
        this.logger.info(`mercury: connecting`);

        return this._connectWithBackoff();
      });
  },

  @oneFlight
  disconnect() {
    return new Promise((resolve) => {
      if (this.backoffCall) {
        this.logger.info(`mercury: aborting connection`);
        this.backoffCall.abort();
      }

      if (this.socket) {
        this.socket.removeAllListeners(`message`);
        this.once(`offline`, resolve);
        this.socket.close();
        return;
      }

      resolve();
    });
  },

  @deprecated(`Mercury#listen(): Use Mercury#connect() instead`)
  listen() {
    /* eslint no-invalid-this: [0] */
    return this.connect();
  },

  @deprecated(`Mercury#stopListening(): Use Mercury#disconnect() instead`)
  stopListening() {
    /* eslint no-invalid-this: [0] */
    return this.disconnect();
  },

  _applyOverrides(event) {
    if (!event.headers) {
      return;
    }
    const headerKeys = Object.keys(event.headers);
    headerKeys.forEach((keyPath) => {
      set(event, keyPath, event.headers[keyPath]);
    });
  },

  _attemptConnection(callback) {
    const socket = new Socket();
    socket.on(`close`, (...args) => this._onclose(...args));
    socket.on(`message`, (...args) => this._onmessage(...args));
    socket.on(`sequence-mismatch`, (...args) => this._emit(`sequence-mismatch`, ...args));

    this.spark.credentials.getAuthorization()
      .then((authorization) => socket.open(this.spark.device.webSocketUrl, {
        forceCloseDelay: this.config.forceCloseDelay,
        pingInterval: this.config.pingInterval,
        pongTimeout: this.config.pongTimeout,
        token: authorization,
        trackingId: `${this.spark.sessionId}_${Date.now()}`,
        logger: this.logger
      }))
      .then(() => {
        this.socket = socket;
        callback();
      })
      .catch((reason) => {
        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && this.backoffCall.getNumRetries() > 0) {
          this._emit(`connection_failed`, reason, {retries: this.backoffCall.getNumRetries()});
        }
        this.logger.info(`mercury: connection attempt failed`, reason);
        if (reason instanceof AuthorizationError) {
          this.logger.info(`mercury: received authorization error, reauthorizing`);
          return this.spark.refresh()
            .then(() => callback(reason));
        }

        return callback(reason);
      })
      .catch((reason) => {
        this.logger.error(`mercury: failed to handle connection failured`, reason);
        callback(reason);
      });
  },

  _connectWithBackoff() {
    return new Promise((resolve, reject) => {
      // eslint gets confused about whether or not call is actually used
      // eslint-disable-next-line prefer-const
      let call;
      const onComplete = (err) => {
        this.connecting = false;

        this.backoffCall = undefined;
        if (err) {
          this.logger.info(`mercury: failed to connect after ${call.getNumRetries()} retries; log statement about next retry was inaccurate`);
          return reject(err);
        }
        this.connected = true;
        this._emit(`online`);
        return resolve();
      };

      // eslint-disable-next-line prefer-reflect
      call = backoff.call((callback) => {
        this.logger.info(`mercury: executing connection attempt ${call.getNumRetries()}`);
        this._attemptConnection(callback);
      }, onComplete);

      call.setStrategy(new backoff.ExponentialStrategy({
        initialDelay: this.config.backoffTimeReset,
        maxDelay: this.config.backoffTimeMax
      }));

      if (this.config.maxRetries) {
        call.failAfter(this.config.maxRetries);
      }

      call.on(`abort`, () => {
        this.logger.info(`mercury: connection aborted`);
        reject();
      });

      call.on(`callback`, (err) => {
        if (err) {
          const number = call.getNumRetries();
          const delay = Math.min(call.strategy_.nextBackoffDelay_, this.config.backoffTimeMax);

          this.logger.info(`mercury: failed to connect; attempting retry ${number + 1} in ${delay} ms`);
          /* istanbul ignore if */
          if (process.env.NODE_ENV === `development`) {
            this.logger.debug(`mercury: `, err, err.stack);
          }
          return;
        }
        this.logger.info(`mercury: connected`);
      });

      call.start();

      this.backoffCall = call;
    });
  },

  _emit(...args) {
    try {
      this.trigger(...args);
    }
    catch (error) {
      this.logger.error(`mercury: error occurred in event handler`, error);
    }
  },

  _getEventHandlers(eventType) {
    const [namespace, name] = eventType.split(`.`);
    const handlers = [];

    if (!this.spark[namespace]) {
      return handlers;
    }

    const handlerName = S(`process_${name}_event`).camelize().s;
    if (this.spark[namespace][handlerName]) {
      handlers.push({
        name: handlerName,
        namespace
      });
    }
    return handlers;
  },

  _onclose(event) {
    // I don't see any way to avoid the complexity or statement count in here.
    /* eslint complexity: [0] */

    try {
      const reason = event.reason && event.reason.toLowerCase();
      this.socket.removeAllListeners();
      this.unset(`socket`);
      this.connected = false;
      this._emit(`offline`, event);

      switch (event.code) {
      case 1003:
        // metric: disconnect
        this.logger.info(`mercury: Mercury service rejected last message; will not reconnect: ${event.reason}`);
        this._emit(`offline.permanent`, event);
        break;
      case 4000:
        // metric: disconnect
        this.logger.info(`mercury: socket replaced; will not reconnect`);
        this._emit(`offline.replaced`, event);
        break;
      case 1001:
      case 1005:
      case 1006:
      case 1011:
        this.logger.info(`mercury: socket disconnected; reconnecting`);
        this._emit(`offline.transient`, event);
        this._reconnect();
        // metric: disconnect
        // if (code == 1011 && rason !== ping error) metric: unexpected disconnect
        break;
      case 1000:
        if (normalReconnectReasons.includes(reason)) {
          this.logger.info(`mercury: socket disconnected; reconnecting`);
          this._emit(`offline.transient`, event);
          this._reconnect();
          // metric: disconnect
          // if (reason === done forced) metric: force closure
        }
        else {
          this.logger.info(`mercury: socket disconnected; will not reconnect`);
          this._emit(`offline.permanent`, event);
        }
        break;
      default:
        this.logger.info(`mercury: socket disconnected unexpectedly; will not reconnect`);
        // unexpected disconnect
        this._emit(`offline.permanent`, event);
      }
    }
    catch (error) {
      this.logger.error(`mercury: error occurred in close handler`, error);
    }
  },

  _onmessage(event) {
    const envelope = event.data;
    if (process.env.ENABLE_MERCURY_LOGGING) {
      this.logger.debug(`mercury: message envelope: `, envelope);
    }

    const data = envelope.data;
    this._applyOverrides(data);
    return this._getEventHandlers(data.eventType)
      .reduce((promise, handler) => promise.then(() => {
        const {namespace, name} = handler;
        return new Promise((resolve) => resolve(this.spark[namespace][name](data)))
          .catch((reason) => this.logger.error(`mercury: error occurred in autowired event handler for ${data.eventType}`, reason));
      }), Promise.resolve())
      .then(() => {
        this._emit(`event`, event.data);
        this._emit(`event:${data.eventType}`, envelope);
      })
      .catch((reason) => {
        this.logger.error(`mercury: error occurred processing socket message`, reason);
      });
  },

  _reconnect() {
    this.logger.info(`mercury: reconnecting`);
    return this.connect();
  }
});

export default Mercury;
