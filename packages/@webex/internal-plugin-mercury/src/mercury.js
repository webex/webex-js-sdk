/* eslint-disable require-jsdoc */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import url from 'url';

import {WebexPlugin} from '@webex/webex-core';
import {deprecated} from '@webex/common';
import {camelCase, get, set} from 'lodash';
import backoff from 'backoff';

import Socket from './socket';
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
  defaultSessionId: 'mercury-default-session',

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
    sockets: {
      default: () => new Map(),
      type: 'object',
    },
    backoffCalls: {
      default: () => new Map(),
      type: 'object',
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

  /**
   * Get all active socket connections
   * @returns {Map} Map of sessionId to socket instances
   */
  getSockets() {
    return this.sockets;
  },

  /**
   * Get a specific socket by connection ID
   * @param {string} sessionId - The connection identifier
   * @returns {Socket|undefined} The socket instance or undefined if not found
   */
  getSocket(sessionId = this.defaultSessionId) {
    return this.sockets.get(sessionId);
  },

  /**
   * Check if any sockets are connected
   * @returns {boolean} True if at least one socket is connected
   */
  hasConnectedSockets() {
    for (const socket of this.sockets.values()) {
      if (socket && socket.connected) {
        return true;
      }
    }

    return false;
  },

  /**
   * Check if any sockets are connecting
   * @returns {boolean} True if at least one socket is connected
   */
  hasConnectingSockets() {
    for (const socket of this.sockets.values()) {
      if (socket && socket.connecting) {
        return true;
      }
    }

    return false;
  },

  // @oneFlight
  connect(webSocketUrl, sessionId = this.defaultSessionId) {
    const existingSocket = this.sockets.get(sessionId);
    if (existingSocket?.connected || existingSocket?.connecting) {
      this.logger.info(
        `${this.namespace}: connection ${sessionId} already connected, will not connect again`
      );

      return Promise.resolve();
    }

    this.connecting = true;

    this.logger.info(`${this.namespace}: starting connection attempt for ${sessionId}`);
    this.logger.info(
      `${this.namespace}: debug_mercury_logging stack: `,
      new Error('debug_mercury_logging').stack
    );

    return Promise.resolve(
      this.webex.internal.device.registered || this.webex.internal.device.register()
    ).then(() => {
      this.logger.info(`${this.namespace}: connecting ${sessionId}`);

      return this._connectWithBackoff(webSocketUrl, sessionId);
    });
  },

  logout() {
    this.logger.info(`${this.namespace}: logout() called`);
    this.logger.info(
      `${this.namespace}: debug_mercury_logging stack: `,
      new Error('debug_mercury_logging').stack
    );

    return this.disconnectAll(
      this.config.beforeLogoutOptionsCloseReason &&
        !normalReconnectReasons.includes(this.config.beforeLogoutOptionsCloseReason)
        ? {code: 3050, reason: this.config.beforeLogoutOptionsCloseReason}
        : undefined
    );
  },

  // @oneFlight
  disconnect(options, sessionId = this.defaultSessionId) {
    return new Promise((resolve) => {
      const backoffCall = this.backoffCalls.get(sessionId);
      if (backoffCall) {
        this.logger.info(`${this.namespace}: aborting connection ${sessionId}`);
        backoffCall.abort();
        this.backoffCalls.delete(sessionId);
      }

      const socket = this.sockets.get(sessionId);
      const suffix = sessionId === this.defaultSessionId ? '' : `:${sessionId}`;

      if (socket) {
        socket.removeAllListeners('message');
        socket.connecting = false;
        socket.connected = false;
        this.once(sessionId === this.defaultSessionId ? 'offline' : `offline${suffix}`, resolve);
        resolve(socket.close(options || undefined));
      }
      resolve();

      // Update overall connected status
      this.connected = this.hasConnectedSockets();
    });
  },

  /**
   * Disconnect all socket connections
   * @param {object} options - Close options
   * @returns {Promise} Promise that resolves when all connections are closed
   */
  disconnectAll(options) {
    const disconnectPromises = [];

    for (const sessionId of this.sockets.keys()) {
      disconnectPromises.push(this.disconnect(options, sessionId));
    }

    return Promise.all(disconnectPromises).then(() => {
      this.connected = false;
      this.sockets.clear();
      this.backoffCalls.clear();
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

  _attemptConnection(socketUrl, sessionId, callback) {
    const socket = new Socket();
    socket.connecting = true;
    let attemptWSUrl;
    const suffix = sessionId === this.defaultSessionId ? '' : `:${sessionId}`;

    socket.on('close', (...args) => this._onclose(sessionId, ...args));
    socket.on('message', (...args) => this._onmessage(sessionId, ...args));
    socket.on('pong', (...args) => this._setTimeOffset(sessionId, ...args));
    socket.on('sequence-mismatch', (...args) => this._emit(`sequence-mismatch${suffix}`, ...args));
    socket.on('ping-pong-latency', (...args) => this._emit(`ping-pong-latency${suffix}`, ...args));

    Promise.all([this._prepareUrl(socketUrl), this.webex.credentials.getUserToken()])
      .then(([webSocketUrl, token]) => {
        const backoffCall = this.backoffCalls.get(sessionId);
        if (!backoffCall) {
          const msg = `${this.namespace}: prevent socket open when backoffCall no longer defined for ${sessionId}`;

          this.logger.info(msg);

          return Promise.reject(new Error(msg));
        }

        attemptWSUrl = webSocketUrl;

        let options = {
          forceCloseDelay: this.config.forceCloseDelay,
          pingInterval: this.config.pingInterval,
          pongTimeout: this.config.pongTimeout,
          token: token.toString(),
          trackingId: `${this.webex.sessionId}_${sessionId}_${Date.now()}`,
          logger: this.logger,
        };

        // if the consumer has supplied request options use them
        if (this.webex.config.defaultMercuryOptions) {
          this.logger.info(`${this.namespace}: setting custom options for ${sessionId}`);
          options = {...options, ...this.webex.config.defaultMercuryOptions};
        }

        // Set the socket before opening it. This allows a disconnect() to close
        // the socket if it is in the process of being opened.
        this.sockets.set(sessionId, socket);
        this.socket = this.sockets.get(this.defaultSessionId) || socket;

        this.logger.info(`${this.namespace} connection url for ${sessionId}: ${webSocketUrl}`);

        return socket.open(webSocketUrl, options);
      })
      .then(() => {
        this.logger.info(
          `${this.namespace}: connected to mercury, success, action: connected, sessionId: ${sessionId}, url: ${attemptWSUrl}`
        );
        callback();

        return this.webex.internal.feature
          .getFeature('developer', 'web-high-availability')
          .then((haMessagingEnabled) => {
            if (haMessagingEnabled) {
              return this.webex.internal.device.refresh();
            }

            return Promise.resolve();
          });
      })
      .catch((reason) => {
        this.lastError = reason; // remember the last error

        const backoffCall = this.backoffCalls.get(sessionId);
        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && backoffCall && backoffCall?.getNumRetries() > 0) {
          this._emit(`connection_failed${suffix}`, reason, {
            sessionId,
            retries: backoffCall?.getNumRetries(),
          });
        }
        this.logger.info(
          `${this.namespace}: connection attempt failed for ${sessionId}`,
          reason,
          backoffCall?.getNumRetries() === 0 ? reason.stack : ''
        );
        // UnknownResponse is produced by IE for any 4XXX; treated it like a bad
        // web socket url and let WDM handle the token checking
        if (reason instanceof UnknownResponse) {
          this.logger.info(
            `${this.namespace}: received unknown response code for ${sessionId}, refreshing device registration`
          );

          return this.webex.internal.device.refresh().then(() => callback(reason));
        }
        // NotAuthorized implies expired token
        if (reason instanceof NotAuthorized) {
          this.logger.info(
            `${this.namespace}: received authorization error for ${sessionId}, reauthorizing`
          );

          return this.webex.credentials.refresh({force: true}).then(() => callback(reason));
        }
        // // NotFound implies expired web socket url
        // else if (reason instanceof NotFound) {
        //   this.logger.info(`mercury: received not found error, refreshing device registration`);
        //   return this.webex.internal.device.refresh()
        //     .then(() => callback(reason));
        // }
        // BadRequest implies current credentials are for a Service Account
        // Forbidden implies current user is not entitle for Webex
        if (reason instanceof BadRequest || reason instanceof Forbidden) {
          this.logger.warn(
            `${this.namespace}: received unrecoverable response from mercury for ${sessionId}`
          );
          backoffCall?.abort();

          return callback(reason);
        }
        if (reason instanceof ConnectionError) {
          return this.webex.internal.feature
            .getFeature('developer', 'web-high-availability')
            .then((haMessagingEnabled) => {
              if (haMessagingEnabled) {
                this.logger.info(
                  `${this.namespace}: received a generic connection error for ${sessionId}, will try to connect to another datacenter. failed, action: 'failed', url: ${attemptWSUrl} error: ${reason.message}`
                );

                return this.webex.internal.services.markFailedUrl(attemptWSUrl);
              }

              return null;
            })
            .then(() => callback(reason));
        }

        return callback(reason);
      })
      .catch((reason) => {
        this.logger.error(
          `${this.namespace}: failed to handle connection failure for ${sessionId}`,
          reason
        );
        callback(reason);
      });
  },

  _connectWithBackoff(webSocketUrl, sessionId) {
    return new Promise((resolve, reject) => {
      // eslint gets confused about whether or not call is actually used
      // eslint-disable-next-line prefer-const
      let call;
      const onComplete = (err, sid = sessionId) => {
        this.backoffCalls.delete(sid);
        if (err) {
          this.logger.info(
            `${
              this.namespace
            }: failed to connect ${sid} after ${call.getNumRetries()} retries; log statement about next retry was inaccurate; ${err}`
          );

          return reject(err);
        }
        // Update overall connected status
        const sessionSocket = this.sockets.get(sid);
        if (sessionSocket) {
          sessionSocket.connecting = false;
          sessionSocket.connected = true;
        }
        // @ts-ignore
        this.connecting = this.hasConnectingSockets();
        this.connected = this.hasConnectedSockets();
        this.hasEverConnected = true;
        const suffix = sid === this.defaultSessionId ? '' : `:${sid}`;
        this._emit(`online${suffix}`, {sessionId: sid});
        this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(true);

        return resolve();
      };
      // eslint-disable-next-line prefer-reflect
      call = backoff.call(
        (callback) => {
          this.logger.info(
            `${
              this.namespace
            }: executing connection attempt ${call.getNumRetries()} for ${sessionId}`
          );
          this._attemptConnection(webSocketUrl, sessionId, callback);
        },
        (err) => onComplete(err, sessionId)
      );

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
        this.logger.info(`${this.namespace}: connection aborted for ${sessionId}`);
        reject(new Error(`Mercury Connection Aborted for ${sessionId}`));
      });

      call.on('callback', (err) => {
        if (err) {
          const number = call.getNumRetries();
          const delay = Math.min(call.strategy_.nextBackoffDelay_, this.config.backoffTimeMax);

          this.logger.info(
            `${this.namespace}: failed to connect ${sessionId}; attempting retry ${
              number + 1
            } in ${delay} ms`
          );
          /* istanbul ignore if */
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`${this.namespace}: `, err, err.stack);
          }

          return;
        }
        this.logger.info(`${this.namespace}: connected ${sessionId}`);
      });

      call.start();

      this.backoffCalls.set(sessionId, call);
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

  _onclose(sessionId, event) {
    // I don't see any way to avoid the complexity or statement count in here.
    /* eslint complexity: [0] */

    try {
      const reason = event.reason && event.reason.toLowerCase();
      let socket = this.sockets.get(sessionId);
      const socketUrl = socket?.url;
      const suffix = sessionId === this.defaultSessionId ? '' : `:${sessionId}`;
      event.sessionId = sessionId;
      this.sockets.delete(sessionId);

      if (socket) {
        socket.removeAllListeners();
        socket = null;
        this._emit(`offline${suffix}`, event);
      }

      // Update overall connected status
      this.connecting = this.hasConnectingSockets();
      this.connected = this.hasConnectedSockets();

      if (!this.connected) {
        this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(false);
      }

      switch (event.code) {
        case 1003:
          // metric: disconnect
          this.logger.info(
            `${this.namespace}: Mercury service rejected last message for ${sessionId}; will not reconnect: ${event.reason}`
          );
          this._emit(`offline.permanent${suffix}`, event);
          break;
        case 4000:
          // metric: disconnect
          this.logger.info(`${this.namespace}: socket ${sessionId} replaced; will not reconnect`);
          this._emit(`offline.replaced${suffix}`, event);
          break;
        case 1001:
        case 1005:
        case 1006:
        case 1011:
          this.logger.info(`${this.namespace}: socket ${sessionId} disconnected; reconnecting`);
          this._emit(`offline.transient${suffix}`, event);
          this._reconnect(socketUrl, sessionId);
          // metric: disconnect
          // if (code == 1011 && reason !== ping error) metric: unexpected disconnect
          break;
        case 1000:
        case 3050: // 3050 indicates logout form of closure, default to old behavior, use config reason defined by consumer to proceed with the permanent block
          if (normalReconnectReasons.includes(reason)) {
            this.logger.info(`${this.namespace}: socket ${sessionId} disconnected; reconnecting`);
            this._emit(`offline.transient${suffix}`, event);
            this._reconnect(socketUrl, sessionId);
            // metric: disconnect
            // if (reason === done forced) metric: force closure
          } else {
            this.logger.info(
              `${this.namespace}: socket ${sessionId} disconnected; will not reconnect: ${event.reason}`
            );
            this._emit(`offline.permanent${suffix}`, event);
          }
          break;
        default:
          this.logger.info(
            `${this.namespace}: socket ${sessionId} disconnected unexpectedly; will not reconnect`
          );
          // unexpected disconnect
          this._emit(`offline.permanent${suffix}`, event);
      }
    } catch (error) {
      this.logger.error(
        `${this.namespace}: error occurred in close handler for ${sessionId}`,
        error
      );
    }
  },

  _onmessage(sessionId, event) {
    this._setTimeOffset(sessionId, event);
    const envelope = event.data;

    if (process.env.ENABLE_MERCURY_LOGGING) {
      this.logger.debug(`${this.namespace}: message envelope from ${sessionId}: `, envelope);
    }

    envelope.sessionId = sessionId;
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
                `${this.namespace}: error occurred in autowired event handler for ${data.eventType} from ${sessionId}`,
                reason
              )
            );
          }),
        Promise.resolve()
      )
      .then(() => {
        const suffix = sessionId === this.defaultSessionId ? '' : `:${sessionId}`;

        this._emit(`event${suffix}`, envelope);
        const [namespace] = data.eventType.split('.');

        if (namespace === data.eventType) {
          this._emit(`event:${namespace}${suffix}`, envelope);
        } else {
          this._emit(`event:${namespace}${suffix}`, envelope);
          this._emit(`event:${data.eventType}${suffix}`, envelope);
        }
      })
      .catch((reason) => {
        this.logger.error(
          `${this.namespace}: error occurred processing socket message from ${sessionId}`,
          reason
        );
      });
  },

  _setTimeOffset(sessionId, event) {
    const {wsWriteTimestamp} = event.data;
    if (typeof wsWriteTimestamp === 'number' && wsWriteTimestamp > 0) {
      this.mercuryTimeOffset = Date.now() - wsWriteTimestamp;
    }
  },

  _reconnect(webSocketUrl, sessionId = this.defaultSessionId) {
    this.logger.info(`${this.namespace}: reconnecting ${sessionId}`);

    return this.connect(webSocketUrl, sessionId);
  },
});

export default Mercury;
