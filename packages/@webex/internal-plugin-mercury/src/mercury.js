/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable valid-jsdoc */
/* eslint-disable consistent-return */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import url from 'url';

import {WebexPlugin} from '@webex/webex-core';
import {deprecated, oneFlight} from '@webex/common';
import {camelCase, get, set} from 'lodash';
import backoff from 'backoff';

import Socket from './socket';
import mercuryWorkerStr from './mercury-worker-str';
import {MercuryWorkerMessageType} from './mercury-worker-types';
import {
  BadRequest,
  Forbidden,
  NotAuthorized,
  UnknownResponse,
  ConnectionError,
  // NotFound
} from './errors';

const normalReconnectReasons = ['idle', 'done (forced)', 'pong not received', 'pong mismatch'];

const Mercury = WebexPlugin.extend({
  namespace: 'Mercury',
  lastError: undefined,

  session: {
    connected: {
      default: false,
      type: 'boolean',
    },
    connecting: {
      default: false,
      type: 'boolean',
    },
    hasEverConnected: {
      default: false,
      type: 'boolean',
    },
    socket: 'object',
    mercuryWorker: 'object',
    useWorker: {
      default: true,
      type: 'boolean',
    },
    localClusterServiceUrls: 'object',
    mercuryTimeOffset: {
      default: undefined,
      type: 'number',
    },
  },

  derived: {
    listening: {
      deps: ['connected'],
      fn() {
        return this.connected;
      },
    },
  },

  initialize() {
    /*
      When one of these legacy feature gets updated, this event would be triggered
        * group-message-notifications
        * mention-notifications
        * thread-notifications
    */
    this.on('event:featureToggle_update', (envelope) => {
      if (envelope && envelope.data) {
        this.webex.internal.feature.updateFeature(envelope.data.featureToggle);
      }
    });
  },

  /**
   * Get the last error.
   * @returns {any} The last error.
   */
  getLastError() {
    return this.lastError;
  },

  @oneFlight
  connect(webSocketUrl) {
    if (this.connected) {
      this.logger.info(`${this.namespace}: already connected, will not connect again`);

      return Promise.resolve();
    }

    this.connecting = true;

    this.logger.info(`${this.namespace}: starting connection attempt`);
    this.logger.info(
      `${this.namespace}: debug_mercury_logging stack: `,
      new Error('debug_mercury_logging').stack
    );

    return Promise.resolve(
      this.webex.internal.device.registered || this.webex.internal.device.register()
    ).then(() => {
      this.logger.info(`${this.namespace}: connecting`);

      return this._connectWithBackoff(webSocketUrl);
    });
  },

  logout() {
    this.logger.info(`${this.namespace}: logout() called`);
    this.logger.info(
      `${this.namespace}: debug_mercury_logging stack: `,
      new Error('debug_mercury_logging').stack
    );

    return this.disconnect(
      this.config.beforeLogoutOptionsCloseReason &&
        !normalReconnectReasons.includes(this.config.beforeLogoutOptionsCloseReason)
        ? {code: 3050, reason: this.config.beforeLogoutOptionsCloseReason}
        : undefined
    );
  },

  @oneFlight
  disconnect(options) {
    return new Promise((resolve) => {
      if (this.backoffCall) {
        this.logger.info(`${this.namespace}: aborting connection`);
        this.backoffCall.abort();
      }

      if (this.mercuryWorker) {
        this.mercuryWorker.postMessage({
          type: MercuryWorkerMessageType.DISCONNECT,
          data: options || {},
        });
        this._destroyMercuryWorker();
        this.once('offline', resolve);
      }

      resolve();
    });
  },

  @deprecated('Mercury#listen(): Use Mercury#connect() instead')
  listen() {
    /* eslint no-invalid-this: [0] */
    return this.connect();
  },

  @deprecated('Mercury#stopListening(): Use Mercury#disconnect() instead')
  stopListening() {
    /* eslint no-invalid-this: [0] */
    return this.disconnect();
  },

  processRegistrationStatusEvent(message) {
    this.localClusterServiceUrls = message.localClusterServiceUrls;
  },

  _applyOverrides(event) {
    if (!event || !event.headers) {
      return;
    }
    const headerKeys = Object.keys(event.headers);

    headerKeys.forEach((keyPath) => {
      set(event, keyPath, event.headers[keyPath]);
    });
  },

  _prepareUrl(webSocketUrl) {
    if (!webSocketUrl) {
      webSocketUrl = this.webex.internal.device.webSocketUrl;
    }

    return this.webex.internal.feature
      .getFeature('developer', 'web-high-availability')
      .then((haMessagingEnabled) => {
        if (haMessagingEnabled) {
          return this.webex.internal.services.convertUrlToPriorityHostUrl(webSocketUrl);
        }

        return webSocketUrl;
      })
      .then((wsUrl) => {
        webSocketUrl = wsUrl;
      })
      .then(() => this.webex.internal.feature.getFeature('developer', 'web-shared-mercury'))
      .then((webSharedMercury) => {
        webSocketUrl = url.parse(webSocketUrl, true);
        Object.assign(webSocketUrl.query, {
          outboundWireFormat: 'text',
          bufferStates: true,
          aliasHttpStatus: true,
        });

        if (webSharedMercury) {
          Object.assign(webSocketUrl.query, {
            mercuryRegistrationStatus: true,
            isRegistrationRefreshEnabled: true,
          });
          Reflect.deleteProperty(webSocketUrl.query, 'bufferStates');
        }

        if (get(this, 'webex.config.device.ephemeral', false)) {
          webSocketUrl.query.multipleConnections = true;
        }

        webSocketUrl.query.clientTimestamp = Date.now();

        return url.format(webSocketUrl);
      });
  },

  _attemptConnection(socketUrl, callback) {
    console.log('WS: attempting connection', this.useWorker);
    if (this.useWorker) {
      console.log('WS: attempting worker connection');

      return this._attemptWorkerConnection(socketUrl, callback);
    }
  },

  _connectWithBackoff(webSocketUrl) {
    return new Promise((resolve, reject) => {
      // eslint gets confused about whether or not call is actually used
      // eslint-disable-next-line prefer-const
      let call;
      const onComplete = (err) => {
        this.connecting = false;

        this.backoffCall = undefined;
        if (err) {
          this.logger.info(
            `${
              this.namespace
            }: failed to connect after ${call.getNumRetries()} retries; log statement about next retry was inaccurate; ${err}`
          );

          return reject(err);
        }
        this.connected = true;
        this.hasEverConnected = true;
        this._emit('online');
        this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(true);

        return resolve();
      };

      // eslint-disable-next-line prefer-reflect
      call = backoff.call((callback) => {
        this.logger.info(`${this.namespace}: executing connection attempt ${call.getNumRetries()}`);
        this._attemptConnection(webSocketUrl, callback);
      }, onComplete);

      call.setStrategy(
        new backoff.ExponentialStrategy({
          initialDelay: this.config.backoffTimeReset,
          maxDelay: this.config.backoffTimeMax,
        })
      );

      if (this.config.initialConnectionMaxRetries && !this.hasEverConnected) {
        call.failAfter(this.config.initialConnectionMaxRetries);
      } else if (this.config.maxRetries) {
        call.failAfter(this.config.maxRetries);
      }

      call.on('abort', () => {
        this.logger.info(`${this.namespace}: connection aborted`);
        reject(new Error('Mercury Connection Aborted'));
      });

      call.on('callback', (err) => {
        if (err) {
          const number = call.getNumRetries();
          const delay = Math.min(call.strategy_.nextBackoffDelay_, this.config.backoffTimeMax);

          this.logger.info(
            `${this.namespace}: failed to connect; attempting retry ${number + 1} in ${delay} ms`
          );
          /* istanbul ignore if */
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`${this.namespace}: `, err, err.stack);
          }

          return;
        }
        this.logger.info(`${this.namespace}: connected`);
      });

      call.start();

      this.backoffCall = call;
    });
  },

  _emit(...args) {
    try {
      this.trigger(...args);
    } catch (error) {
      this.logger.error(
        `${this.namespace}: error occurred in event handler:`,
        error,
        ' with args: ',
        args
      );
    }
  },

  _getEventHandlers(eventType) {
    console.log('eventType', eventType);
    const [namespace, name] = eventType.split('.');
    const handlers = [];

    if (!this.webex[namespace] && !this.webex.internal[namespace]) {
      return handlers;
    }

    const handlerName = camelCase(`process_${name}_event`);

    if ((this.webex[namespace] || this.webex.internal[namespace])[handlerName]) {
      handlers.push({
        name: handlerName,
        namespace,
      });
    }

    return handlers;
  },

  _onclose(event) {
    // I don't see any way to avoid the complexity or statement count in here.
    /* eslint complexity: [0] */

    try {
      const reason = event.reason && event.reason.toLowerCase();
      const socketUrl = this.socket.url;

      this.socket.removeAllListeners();
      this.unset('socket');
      this.connected = false;
      this._emit('offline', event);
      this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(false);

      switch (event.code) {
        case 1003:
          // metric: disconnect
          this.logger.info(
            `${this.namespace}: Mercury service rejected last message; will not reconnect: ${event.reason}`
          );
          this._emit('offline.permanent', event);
          break;
        case 4000:
          // metric: disconnect
          this.logger.info(`${this.namespace}: socket replaced; will not reconnect`);
          this._emit('offline.replaced', event);
          break;
        case 1001:
        case 1005:
        case 1006:
        case 1011:
          this.logger.info(`${this.namespace}: socket disconnected; reconnecting`);
          this._emit('offline.transient', event);
          this._reconnect(socketUrl);
          // metric: disconnect
          // if (code == 1011 && reason !== ping error) metric: unexpected disconnect
          break;
        case 1000:
        case 3050: // 3050 indicates logout form of closure, default to old behavior, use config reason defined by consumer to proceed with the permanent block
          if (normalReconnectReasons.includes(reason)) {
            this.logger.info(`${this.namespace}: socket disconnected; reconnecting`);
            this._emit('offline.transient', event);
            this._reconnect(socketUrl);
            // metric: disconnect
            // if (reason === done forced) metric: force closure
          } else {
            this.logger.info(
              `${this.namespace}: socket disconnected; will not reconnect: ${event.reason}`
            );
            this._emit('offline.permanent', event);
          }
          break;
        default:
          this.logger.info(
            `${this.namespace}: socket disconnected unexpectedly; will not reconnect`
          );
          // unexpected disconnect
          this._emit('offline.permanent', event);
      }
    } catch (error) {
      this.logger.error(`${this.namespace}: error occurred in close handler`, error);
    }
  },

  _onmessage(event) {
    this._setTimeOffset(event);
    const envelope = event.data;

    if (process.env.ENABLE_MERCURY_LOGGING) {
      this.logger.debug(`${this.namespace}: message envelope: `, envelope);
    }

    const {data} = envelope;

    this._applyOverrides(data);

    return this._getEventHandlers(data.eventType)
      .reduce(
        (promise, handler) =>
          promise.then(() => {
            const {namespace, name} = handler;

            return new Promise((resolve) =>
              resolve((this.webex[namespace] || this.webex.internal[namespace])[name](data))
            ).catch((reason) =>
              this.logger.error(
                `${this.namespace}: error occurred in autowired event handler for ${data.eventType}`,
                reason
              )
            );
          }),
        Promise.resolve()
      )
      .then(() => {
        this._emit('event', event.data);
        const [namespace] = data.eventType.split('.');

        if (namespace === data.eventType) {
          this._emit(`event:${namespace}`, envelope);
        } else {
          this._emit(`event:${namespace}`, envelope);
          this._emit(`event:${data.eventType}`, envelope);
        }
      })
      .catch((reason) => {
        this.logger.error(`${this.namespace}: error occurred processing socket message`, reason);
      });
  },

  _setTimeOffset(event) {
    const {wsWriteTimestamp} = event.data;
    if (typeof wsWriteTimestamp === 'number' && wsWriteTimestamp > 0) {
      this.mercuryTimeOffset = Date.now() - wsWriteTimestamp;
    }
  },

  _reconnect(webSocketUrl) {
    this.logger.info(`${this.namespace}: reconnecting`);

    return this.connect(webSocketUrl);
  },

  /**
   * Creates and manages Mercury web worker
   */
  _createMercuryWorker() {
    console.log('WS: creating worker');
    if (this.mercuryWorker) {
      this._destroyMercuryWorker();
    }

    const blob = new Blob([mercuryWorkerStr], {type: 'application/javascript'});
    const blobUrl = URL.createObjectURL(blob);

    this.mercuryWorker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);

    this.mercuryWorker.onmessage = (event) => {
      console.log('WS: worker message received', event);

      this._handleWorkerMessage(event);
    };

    this.mercuryWorker.onerror = (error) => {
      this.logger.error(`${this.namespace}: worker error`, error);
      this._emit('connection_failed', error);
    };

    console.log('WS: worker created', this.mercuryWorker);

    return this.mercuryWorker;
  },

  /**
   * Destroys Mercury web worker
   */
  _destroyMercuryWorker() {
    if (this.mercuryWorker) {
      this.mercuryWorker.terminate();
      this.mercuryWorker = null;
    }
  },

  /**
   * Handles messages from Mercury web worker
   */
  _handleWorkerMessage(event) {
    console.log('WS: worker message received', event);

    const {type, data, timestamp} = event.data;

    switch (type) {
      case MercuryWorkerMessageType.CONNECTED:
        this.logger.info(`${this.namespace}: worker connected successfully`);
        break;

      case MercuryWorkerMessageType.DISCONNECTED:
        this.logger.info(`${this.namespace}: worker disconnected`, data);
        this._handleWorkerDisconnection(data);
        break;

      case MercuryWorkerMessageType.MESSAGE_RECEIVED:
        this._processMercuryEvent(data);
        break;

      case MercuryWorkerMessageType.CONNECTION_ERROR:
        this.logger.error(`${this.namespace}: worker connection error`, data);
        this._handleWorkerError(data);
        break;

      case MercuryWorkerMessageType.SEQUENCE_MISMATCH:
        this.logger.warn(`${this.namespace}: sequence mismatch`, data);
        this._emit('sequence-mismatch', data.actual, data.expected);
        break;

      case MercuryWorkerMessageType.PING_PONG_LATENCY:
        this._emit('ping-pong-latency', data.latency);
        break;

      case MercuryWorkerMessageType.AUTHORIZATION_COMPLETE:
        this.logger.info(`${this.namespace}: authorization completed via worker`);
        break;

      default:
        this.logger.warn(`${this.namespace}: unknown worker message type: ${type}`);
    }
  },

  /**
   * Processes Mercury event messages from worker
   */
  _processMercuryEvent(messageData) {
    const {data, wsWriteTimestamp} = messageData;

    // Set time offset if available
    if (typeof wsWriteTimestamp === 'number' && wsWriteTimestamp > 0) {
      this.mercuryTimeOffset = Date.now() - wsWriteTimestamp;
    }

    // Some messages might not be Mercury events (e.g., auth responses, pings, etc.)
    if (!data || !data.eventType) {
      this.logger.debug(`${this.namespace}: skipping message without eventType`, data);

      return Promise.resolve();
    }

    this._applyOverrides(data);

    console.log('WS: processing Mercury event', data);

    return this._getEventHandlers(data.eventType)
      .reduce(
        (promise, handler) =>
          promise.then(() => {
            const {namespace, name} = handler;

            return new Promise((resolve) =>
              resolve((this.webex[namespace] || this.webex.internal[namespace])[name](data))
            ).catch((reason) =>
              this.logger.error(
                `${this.namespace}: error occurred in autowired event handler for ${data.eventType}`,
                reason
              )
            );
          }),
        Promise.resolve()
      )
      .then(() => {
        this._emit('event', {data});
        const [namespace] = data.eventType.split('.');

        if (namespace === data.eventType) {
          this._emit(`event:${namespace}`, {data});
        } else {
          this._emit(`event:${namespace}`, {data});
          this._emit(`event:${data.eventType}`, {data});
        }
      })
      .catch((reason) => {
        this.logger.error(`${this.namespace}: error occurred processing worker message`, reason);
      });
  },

  /**
   * Handles worker disconnection events
   */
  _handleWorkerDisconnection(data) {
    this.connected = false;
    this._emit('offline', data);
    this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(false);

    // Handle different close codes similar to _onclose
    const {code, reason} = data;
    const normalReconnectReasons = ['idle', 'done (forced)', 'pong not received', 'pong mismatch'];

    switch (code) {
      case 1003:
        this.logger.info(
          `${this.namespace}: Mercury service rejected last message; will not reconnect: ${reason}`
        );
        this._emit('offline.permanent', data);
        break;
      case 4000:
        this.logger.info(`${this.namespace}: socket replaced; will not reconnect`);
        this._emit('offline.replaced', data);
        break;
      case 1001:
      case 1005:
      case 1006:
      case 1011:
        this.logger.info(`${this.namespace}: socket disconnected; reconnecting`);
        this._emit('offline.transient', data);
        this._reconnectWorker();
        break;
      case 1000:
      case 3050:
        if (normalReconnectReasons.includes(reason?.toLowerCase())) {
          this.logger.info(`${this.namespace}: socket disconnected; reconnecting`);
          this._emit('offline.transient', data);
          this._reconnectWorker();
        } else {
          this.logger.info(`${this.namespace}: socket disconnected; will not reconnect: ${reason}`);
          this._emit('offline.permanent', data);
        }
        break;
      default:
        this.logger.info(`${this.namespace}: socket disconnected unexpectedly; will not reconnect`);
        this._emit('offline.permanent', data);
    }
  },

  /**
   * Handles worker connection errors
   */
  _handleWorkerError(errorData) {
    this.lastError = errorData;
    this._emit('connection_failed', errorData);
  },

  /**
   * Reconnects using worker
   */
  _reconnectWorker() {
    this.logger.info(`${this.namespace}: reconnecting via worker`);

    return this.connect();
  },

  /**
   * Attempts connection using web worker
   */
  _attemptWorkerConnection(socketUrl, callback) {
    if (!this.mercuryWorker) {
      this._createMercuryWorker();
    }

    Promise.all([this._prepareUrl(socketUrl), this.webex.credentials.getUserToken()])
      .then(([webSocketUrl, token]) => {
        if (!this.backoffCall) {
          const msg = `${this.namespace}: prevent worker connection when backoffCall no longer defined`;
          this.logger.info(msg);

          return Promise.reject(new Error(msg));
        }

        const connectionData = {
          url: webSocketUrl,
          token: token.toString(),
          trackingId: `${this.webex.sessionId}_${Date.now()}`,
          pingInterval: this.config.pingInterval,
          pongTimeout: this.config.pongTimeout,
          forceCloseDelay: this.config.forceCloseDelay,
          logLevelToken: this.webex.config.defaultMercuryOptions?.logLevelToken,
        };

        this.mercuryWorker.postMessage({
          type: MercuryWorkerMessageType.CONNECT,
          data: connectionData,
        });

        this.logger.info(`${this.namespace} worker connection initiated: ${webSocketUrl}`);

        // Set up connection success handler
        const onWorkerConnected = (event) => {
          if (event.data.type === MercuryWorkerMessageType.AUTHORIZATION_COMPLETE) {
            this.mercuryWorker.removeEventListener('message', onWorkerConnected);
            this.logger.info(`${this.namespace}: worker connected and authorized successfully`);
            this.connected = true;
            this.hasEverConnected = true;
            this._emit('online');
            this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(true);
            callback();
          }
        };

        this.mercuryWorker.addEventListener('message', onWorkerConnected);

        return Promise.resolve();
      })
      .catch((reason) => {
        this.lastError = reason;
        this.logger.info(`${this.namespace}: worker connection attempt failed`, reason);
        callback(reason);
      });
  },
});

export default Mercury;
