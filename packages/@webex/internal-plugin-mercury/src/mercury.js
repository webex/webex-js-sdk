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
    _shutdownSwitchoverBackoffCalls: {
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
    /*
     * When Cluster Migrations, notify clients using ActiveClusterStatusEvent via mercury
     * https://wwwin-github.cisco.com/pages/Webex/crr-docs/techdocs/rr-002.html#wip-notifying-clients-of-cluster-migrations
     * */
    this.on('event:ActiveClusterStatusEvent', (envelope) => {
      if (
        typeof this.webex.internal.services?.switchActiveClusterIds === 'function' &&
        envelope &&
        envelope.data
      ) {
        this.webex.internal.services.switchActiveClusterIds(envelope.data?.activeClusters);
      }
    });
    /*
     * Using cache-invalidation via mercury to instead the method of polling via the new /timestamp endpoint from u2c
     * https://wwwin-github.cisco.com/pages/Webex/crr-docs/techdocs/rr-005.html#websocket-notifications
     * */
    this.on('event:u2c.cache-invalidation', (envelope) => {
      if (
        typeof this.webex.internal.services?.invalidateCache === 'function' &&
        envelope &&
        envelope.data
      ) {
        this.webex.internal.services.invalidateCache(envelope.data?.timestamp);
      }
    });
  },

  /**
   * Attach event listeners to a socket.
   * @param {Socket} socket - The socket to attach listeners to
   * @param {sessionId} sessionId - The socket related session ID
   * @returns {void}
   */
  _attachSocketEventListeners(socket, sessionId) {
    socket.on('close', (event) => this._onclose(sessionId, event, socket));
    socket.on('message', (...args) => this._onmessage(sessionId, ...args));
    socket.on('pong', (...args) => this._setTimeOffset(sessionId, ...args));
    socket.on('sequence-mismatch', (...args) =>
      this._emit(sessionId, 'sequence-mismatch', ...args)
    );
    socket.on('ping-pong-latency', (...args) =>
      this._emit(sessionId, 'ping-pong-latency', ...args)
    );
  },

  /**
   * Handle imminent shutdown by establishing a new connection while keeping
   * the current one alive (make-before-break).
   * Idempotent: will no-op if already in progress.
   * @param {string} sessionId - The session ID for which the shutdown is imminent
   * @returns {void}
   */
  _handleImminentShutdown(sessionId) {
    const oldSocket = this.sockets.get(sessionId);

    try {
      // Idempotent: if we already have a switchover backoff call for this session,
      // a switchover is in progress – do nothing.
      if (this._shutdownSwitchoverBackoffCalls.get(sessionId)) {
        this.logger.info(
          `${this.namespace}: [shutdown] switchover already in progress for ${sessionId}`
        );

        return;
      }

      this._shutdownSwitchoverId = `${Date.now()}`;
      this.logger.info(
        `${this.namespace}: [shutdown] switchover start, id=${this._shutdownSwitchoverId} for ${sessionId}`
      );

      this._connectWithBackoff(undefined, sessionId, {
        isShutdownSwitchover: true,
        attemptOptions: {
          isShutdownSwitchover: true,
          onSuccess: (newSocket, webSocketUrl) => {
            this.logger.info(
              `${this.namespace}: [shutdown] switchover connected, url: ${webSocketUrl} for ${sessionId}`
            );

            // Atomically switch active socket reference
            this.socket = this.sockets.get(this.defaultSessionId);
            this.connected = this.hasConnectedSockets(); // remain connected throughout

            this._emit(sessionId, 'event:mercury_shutdown_switchover_complete', {
              url: webSocketUrl,
            });

            if (oldSocket) {
              this.logger.info(
                `${this.namespace}: [shutdown] old socket retained; server will close with 4001`
              );
            }
          },
        },
      })
        .then(() => {
          this.logger.info(
            `${this.namespace}: [shutdown] switchover completed successfully for ${sessionId}`
          );
        })
        .catch((err) => {
          this.logger.info(
            `${this.namespace}: [shutdown] switchover exhausted retries; will fall back to normal reconnection for ${sessionId}: `,
            err
          );
          this._emit(sessionId, 'event:mercury_shutdown_switchover_failed', {reason: err});
          // Old socket will eventually close with 4001, triggering normal reconnection
        });
    } catch (e) {
      this.logger.error(
        `${this.namespace}: [shutdown] error during switchover for ${sessionId}`,
        e
      );
      this._shutdownSwitchoverBackoffCalls.delete(sessionId);
      this._emit(sessionId, 'event:mercury_shutdown_switchover_failed', {reason: e});
    }
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
   * Check if a socket is connected
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier
   * @returns {boolean|undefined} True if the socket is connected
   */
  hasConnectedSockets(sessionId = this.defaultSessionId) {
    const socket = this.sockets.get(sessionId || this.defaultSessionId);

    return socket?.connected;
  },

  /**
   * Check if any sockets are connecting
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier
   * @returns {boolean|undefined} True if the socket is connecting
   */
  hasConnectingSockets(sessionId = this.defaultSessionId) {
    const socket = this.sockets.get(sessionId || this.defaultSessionId);

    return socket?.connecting;
  },

  /**
   * Connect to Mercury for a specific session.
   * @param {string} [webSocketUrl] - Optional websocket URL override. Falls back to the device websocket URL.
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier for this connection.
   * @returns {Promise<void>} Resolves when connection flow completes for the session.
   */
  connect(webSocketUrl, sessionId = this.defaultSessionId) {
    if (!this._connectPromises) this._connectPromises = new Map();

    // First check if there's already a connection promise for this session
    if (this._connectPromises.has(sessionId)) {
      this.logger.info(
        `${this.namespace}: connection ${sessionId} already in progress, returning existing promise`
      );

      return this._connectPromises.get(sessionId);
    }

    const sessionSocket = this.sockets.get(sessionId);
    if (sessionSocket?.connected || sessionSocket?.connecting) {
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

    const connectPromise = Promise.resolve(
      this.webex.internal.device.registered || this.webex.internal.device.register()
    )
      .then(() => {
        this.logger.info(`${this.namespace}: connecting ${sessionId}`);

        return this._connectWithBackoff(webSocketUrl, sessionId);
      })
      .finally(() => {
        this._connectPromises.delete(sessionId);
      });

    this._connectPromises.set(sessionId, connectPromise);

    return connectPromise;
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

  /**
   * Disconnect a Mercury socket for a specific session.
   * @param {object} [options] - Optional websocket close options (for example: `{code, reason}`).
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier to disconnect.
   * @returns {Promise<void>} Resolves after disconnect cleanup and close handling are initiated/completed.
   */
  disconnect(options, sessionId = this.defaultSessionId) {
    this.logger.info(
      `${this.namespace}#disconnect: connecting state: ${this.connecting}, connected state: ${
        this.connected
      }, socket exists: ${!!this.socket}, options: ${JSON.stringify(options)}`
    );

    return new Promise((resolve) => {
      const backoffCall = this.backoffCalls.get(sessionId);
      if (backoffCall) {
        this.logger.info(`${this.namespace}: aborting connection ${sessionId}`);
        backoffCall.abort();
        this.backoffCalls.delete(sessionId);
      }
      const shutdownSwitchoverBackoffCall = this._shutdownSwitchoverBackoffCalls.get(sessionId);
      if (shutdownSwitchoverBackoffCall) {
        this.logger.info(`${this.namespace}: aborting shutdown switchover connection ${sessionId}`);
        shutdownSwitchoverBackoffCall.abort();
        this._shutdownSwitchoverBackoffCalls.delete(sessionId);
      }
      // Clean up any pending connection promises
      if (this._connectPromises) {
        this._connectPromises.delete(sessionId);
      }

      const sessionSocket = this.sockets.get(sessionId);
      const suffix = sessionId === this.defaultSessionId ? '' : `:${sessionId}`;

      if (sessionSocket) {
        sessionSocket.removeAllListeners('message');
        sessionSocket.connecting = false;
        sessionSocket.connected = false;
        this.once(sessionId === this.defaultSessionId ? 'offline' : `offline${suffix}`, resolve);
        resolve(sessionSocket.close(options || undefined));
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
      // Clear connection promises to prevent stale promises
      if (this._connectPromises) {
        this._connectPromises.clear();
      }
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
          let highPrioritySocketUrl;
          try {
            highPrioritySocketUrl =
              this.webex.internal.services.convertUrlToPriorityHostUrl(webSocketUrl);
          } catch (e) {
            this.logger.warn(`${this.namespace}: error converting to high priority url`, e);
          }
          if (!highPrioritySocketUrl) {
            const hostFromUrl = url.parse(webSocketUrl, true)?.host;
            const isValidHost = this.webex.internal.services.isValidHost(hostFromUrl);
            if (!isValidHost) {
              this.logger.error(
                `${this.namespace}: host ${hostFromUrl} is not a valid host from host catalog`
              );

              return '';
            }
          }

          return highPrioritySocketUrl || webSocketUrl;
        }

        return webSocketUrl;
      })
      .then((wsUrl) => {
        webSocketUrl = wsUrl;
      })
      .then(() => this.webex.internal.feature.getFeature('developer', 'web-shared-mercury'))
      .then((webSharedMercury) => {
        if (!webSocketUrl) {
          return '';
        }
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
        delete webSocketUrl.search;

        return url.format(webSocketUrl);
      });
  },

  _attemptConnection(socketUrl, sessionId, callback, options = {}) {
    const {isShutdownSwitchover = false, onSuccess = null} = options;

    const socket = new Socket();
    socket.connecting = true;
    let newWSUrl;

    this._attachSocketEventListeners(socket, sessionId);

    const backoffCall = isShutdownSwitchover
      ? this._shutdownSwitchoverBackoffCalls.get(sessionId)
      : this.backoffCalls.get(sessionId);

    // Check appropriate backoff call based on connection type
    if (!backoffCall) {
      const mode = isShutdownSwitchover ? 'switchover backoff call' : 'backoffCall';
      const msg = `${this.namespace}: prevent socket open when ${mode} no longer defined for ${sessionId}`;
      const err = new Error(msg);

      this.logger.info(msg);

      // Call the callback with the error before rejecting
      callback(err);

      return Promise.reject(err);
    }

    // For shutdown switchover, don't set socket yet (make-before-break)
    // For normal connection, set socket before opening to allow disconnect() to close it
    if (!isShutdownSwitchover) {
      this.sockets.set(sessionId, socket);
    }

    return this._prepareAndOpenSocket(socket, socketUrl, sessionId, isShutdownSwitchover)
      .then((webSocketUrl) => {
        newWSUrl = webSocketUrl;

        this.logger.info(
          `${this.namespace}: ${
            isShutdownSwitchover ? '[shutdown] switchover' : ''
          } connected to mercury, success, action: connected for ${sessionId}, url: ${newWSUrl}`
        );

        // Custom success handler for shutdown switchover
        if (onSuccess) {
          onSuccess(socket, webSocketUrl);
          callback();

          return Promise.resolve();
        }

        // Default behavior for normal connection
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
        // For shutdown, simpler error handling - just callback for retry
        if (isShutdownSwitchover) {
          this.logger.info(
            `${this.namespace}: [shutdown] switchover attempt failed for ${sessionId}`,
            reason
          );

          return callback(reason);
        }

        // Normal connection error handling (existing complex logic)
        this.lastError = reason; // remember the last error

        const backoffCallNormal = this.backoffCalls.get(sessionId);
        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && backoffCallNormal && backoffCallNormal?.getNumRetries() > 0) {
          this._emit(sessionId, 'connection_failed', reason, {
            sessionId,
            retries: backoffCallNormal?.getNumRetries(),
          });
        }
        this.logger.info(
          `${this.namespace}: connection attempt failed for ${sessionId}`,
          reason,
          backoffCallNormal?.getNumRetries() === 0 ? reason.stack : ''
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
          backoffCallNormal?.abort();

          return callback(reason);
        }
        if (reason instanceof ConnectionError) {
          return this.webex.internal.feature
            .getFeature('developer', 'web-high-availability')
            .then((haMessagingEnabled) => {
              if (haMessagingEnabled) {
                this.logger.info(
                  `${this.namespace}: received a generic connection error for ${sessionId}, will try to connect to another datacenter. failed, action: 'failed', url: ${newWSUrl} error: ${reason.message}`
                );

                return this.webex.internal.services.markFailedUrl(newWSUrl);
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

  _prepareAndOpenSocket(socket, socketUrl, sessionId, isShutdownSwitchover = false) {
    const logPrefix = isShutdownSwitchover ? '[shutdown] switchover' : 'connection';

    return Promise.all([this._prepareUrl(socketUrl), this.webex.credentials.getUserToken()]).then(
      ([webSocketUrl, token]) => {
        let options = {
          forceCloseDelay: this.config.forceCloseDelay,
          pingInterval: this.config.pingInterval,
          pongTimeout: this.config.pongTimeout,
          token: token.toString(),
          trackingId: `${this.webex.sessionId}_${Date.now()}`,
          logger: this.logger,
        };

        if (this.webex.config.defaultMercuryOptions) {
          const customOptionsMsg = isShutdownSwitchover
            ? 'setting custom options for switchover'
            : 'setting custom options';

          this.logger.info(`${this.namespace}: ${customOptionsMsg}`);
          options = {...options, ...this.webex.config.defaultMercuryOptions};
        }

        // Set the socket before opening it. This allows a disconnect() to close
        // the socket if it is in the process of being opened.
        this.sockets.set(sessionId, socket);
        this.socket = this.sockets.get(this.defaultSessionId);

        this.logger.info(`${this.namespace} ${logPrefix} url for ${sessionId}: ${webSocketUrl}`);

        return socket.open(webSocketUrl, options).then(() => webSocketUrl);
      }
    );
  },

  _connectWithBackoff(webSocketUrl, sessionId, context = {}) {
    const {isShutdownSwitchover = false, attemptOptions = {}} = context;

    return new Promise((resolve, reject) => {
      // eslint gets confused about whether call is actually used
      // eslint-disable-next-line prefer-const
      let call;
      const onComplete = (err, sid = sessionId) => {
        if (isShutdownSwitchover) {
          this._shutdownSwitchoverBackoffCalls.delete(sid);
        } else {
          this.backoffCalls.delete(sid);
        }
        const sessionSocket = this.sockets.get(sid);
        if (err) {
          const msg = isShutdownSwitchover
            ? `[shutdown] switchover failed after ${call.getNumRetries()} retries`
            : `failed to connect after ${call.getNumRetries()} retries`;

          this.logger.info(
            `${this.namespace}: ${msg}; log statement about next retry was inaccurate; ${err}`
          );
          if (sessionSocket) {
            sessionSocket.connecting = false;
            sessionSocket.connected = false;
          }

          return reject(err);
        }

        // Update overall connected status
        if (sessionSocket) {
          sessionSocket.connecting = false;
          sessionSocket.connected = true;
        }
        // Default success handling for normal connections
        if (!isShutdownSwitchover) {
          this.connecting = this.hasConnectingSockets();
          this.connected = this.hasConnectedSockets();
          this.hasEverConnected = true;
          this._emit(sid, 'online');
          if (this.connected) {
            this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(true);
          }
        }

        return resolve();
      };
      // eslint-disable-next-line prefer-reflect
      call = backoff.call(
        (callback) => {
          const attemptNum = call.getNumRetries();
          const logPrefix = isShutdownSwitchover ? '[shutdown] switchover' : 'connection';

          this.logger.info(
            `${this.namespace}: executing ${logPrefix} attempt ${attemptNum} for ${sessionId}`
          );
          this._attemptConnection(webSocketUrl, sessionId, callback, attemptOptions);
        },
        (err) => onComplete(err, sessionId)
      );

      call.setStrategy(
        new backoff.ExponentialStrategy({
          initialDelay: this.config.backoffTimeReset,
          maxDelay: this.config.backoffTimeMax,
        })
      );

      if (
        this.config.initialConnectionMaxRetries &&
        !this.hasEverConnected &&
        !isShutdownSwitchover
      ) {
        call.failAfter(this.config.initialConnectionMaxRetries);
      } else if (this.config.maxRetries) {
        call.failAfter(this.config.maxRetries);
      }

      // Store the call BEFORE setting up event handlers to prevent race conditions
      // Store backoff call reference BEFORE starting (so it's available in _attemptConnection)
      if (isShutdownSwitchover) {
        this._shutdownSwitchoverBackoffCalls.set(sessionId, call);
      } else {
        this.backoffCalls.set(sessionId, call);
      }

      call.on('abort', () => {
        const msg = isShutdownSwitchover ? 'Shutdown Switchover' : 'Connection';

        this.logger.info(`${this.namespace}: ${msg} aborted for ${sessionId}`);
        reject(new Error(`Mercury ${msg} Aborted for ${sessionId}`));
      });

      call.on('callback', (err) => {
        if (err) {
          const number = call.getNumRetries();
          const delay = Math.min(call.strategy_.nextBackoffDelay_, this.config.backoffTimeMax);

          const logPrefix = isShutdownSwitchover ? '[shutdown] switchover' : '';

          this.logger.info(
            `${this.namespace}: ${logPrefix} failed to connect; attempting retry ${
              number + 1
            } in ${delay} ms for ${sessionId}`
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
    });
  },

  _emit(...args) {
    try {
      if (!args || args.length === 0) {
        return;
      }

      // New signature: _emit(sessionId, eventName, ...rest)
      // Backwards compatibility: if the first arg isn't a known sessionId (or defaultSessionId),
      // treat the call as the old signature and forward directly to trigger(...)
      const [first, second, ...rest] = args;

      if (typeof first === 'string' && typeof second === 'string') {
        const sessionId = first;
        const eventName = second;
        const suffix = sessionId === this.defaultSessionId ? '' : `:${sessionId}`;

        this.trigger(`${eventName}${suffix}`, ...rest);
      } else {
        // Old usage: _emit(eventName, ...args)
        this.trigger(...args);
      }
    } catch (error) {
      // Safely handle errors without causing additional issues during cleanup
      try {
        this.logger.error(
          `${this.namespace}: error occurred in event handler:`,
          error,
          ' with args: ',
          args
        );
      } catch (logError) {
        // If even logging fails, just ignore to prevent cascading errors during cleanup
        // eslint-disable-next-line no-console
        console.error('Mercury _emit error handling failed:', logError);
      }
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

  _onclose(sessionId, event, sourceSocket) {
    // I don't see any way to avoid the complexity or statement count in here.
    /* eslint complexity: [0] */

    try {
      const reason = event.reason && event.reason.toLowerCase();
      const sessionSocket = this.sockets.get(sessionId);
      let socketUrl;
      event.sessionId = sessionId;

      const isActiveSocket = sourceSocket === sessionSocket;
      if (sourceSocket) {
        socketUrl = sourceSocket.url;
      }
      this.sockets.delete(sessionId);

      if (isActiveSocket) {
        // Only tear down state if the currently active socket closed
        if (sessionSocket) {
          sessionSocket.removeAllListeners();
          if (sessionId === this.defaultSessionId) this.unset('socket');
          this._emit(sessionId, 'offline', event);
        }
        // Update overall connected status
        this.connecting = this.hasConnectingSockets();
        this.connected = this.hasConnectedSockets();

        if (!this.connected) {
          this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(false);
        }
      } else {
        // Old socket closed; do not flip connection state
        this.logger.info(
          `${this.namespace}: [shutdown] non-active socket closed, code=${event.code} for ${sessionId}`
        );
        // Clean up listeners from old socket now that it's closed
        if (sourceSocket) {
          sourceSocket.removeAllListeners();
        }
      }

      switch (event.code) {
        case 1003:
          // metric: disconnect
          this.logger.info(
            `${this.namespace}: Mercury service rejected last message for ${sessionId}; will not reconnect: ${event.reason}`
          );
          if (isActiveSocket) this._emit(sessionId, 'offline.permanent', event);
          break;
        case 4000:
          // metric: disconnect
          this.logger.info(`${this.namespace}: socket ${sessionId} replaced; will not reconnect`);
          if (isActiveSocket) this._emit(sessionId, 'offline.replaced', event);
          // If not active, nothing to do
          break;
        case 4001:
          // replaced during shutdown
          if (isActiveSocket) {
            // Server closed active socket with 4001, meaning it expected this connection
            // to be replaced, but the switchover in _handleImminentShutdown failed.
            // This is a permanent failure - do not reconnect.
            this.logger.warn(
              `${this.namespace}: active socket closed with 4001; shutdown switchover failed for ${sessionId}`
            );
            this._emit(sessionId, 'offline.permanent', event);
          } else {
            // Expected: old socket closed after successful switchover
            this.logger.info(
              `${this.namespace}: old socket closed with 4001 (replaced during shutdown); no reconnect needed for ${sessionId}`
            );
            this._emit(sessionId, 'offline.replaced', event);
          }
          break;
        case 1001:
        case 1005:
        case 1006:
        case 1011:
          this.logger.info(`${this.namespace}: socket ${sessionId} disconnected; reconnecting`);
          if (isActiveSocket) {
            this._emit(sessionId, 'offline.transient', event);
            this.logger.info(
              `${this.namespace}: [shutdown] reconnecting active socket to recover for ${sessionId}`
            );
            this._reconnect(socketUrl, sessionId);
          }
          // metric: disconnect
          // if (code == 1011 && reason !== ping error) metric: unexpected disconnect
          break;
        case 1000:
        case 3050: // 3050 indicates logout form of closure, default to old behavior, use config reason defined by consumer to proceed with the permanent block
          if (normalReconnectReasons.includes(reason)) {
            this.logger.info(`${this.namespace}: socket ${sessionId} disconnected; reconnecting`);
            if (isActiveSocket) {
              this._emit(sessionId, 'offline.transient', event);
              this.logger.info(
                `${this.namespace}: [shutdown] reconnecting due to normal close for ${sessionId}`
              );
              this._reconnect(socketUrl, sessionId);
            }
            // metric: disconnect
            // if (reason === done forced) metric: force closure
          } else {
            this.logger.info(
              `${this.namespace}: socket ${sessionId} disconnected; will not reconnect: ${event.reason}`
            );
            if (isActiveSocket) this._emit(sessionId, 'offline.permanent', event);
          }
          break;
        default:
          this.logger.info(
            `${this.namespace}: socket ${sessionId} disconnected unexpectedly; will not reconnect`
          );
          // unexpected disconnect
          if (isActiveSocket) this._emit(sessionId, 'offline.permanent', event);
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

    // Handle shutdown message shape: { type: 'shutdown' }
    if (envelope && envelope.type === 'shutdown') {
      this.logger.info(
        `${this.namespace}: [shutdown] imminent shutdown message received for ${sessionId}`
      );
      this._emit(sessionId, 'event:mercury_shutdown_imminent', envelope);

      this._handleImminentShutdown(sessionId);

      return Promise.resolve();
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
        this._emit(sessionId, 'event', envelope);
        const [namespace] = data.eventType.split('.');

        if (namespace === data.eventType) {
          this._emit(sessionId, `event:${namespace}`, envelope);
        } else {
          this._emit(sessionId, `event:${namespace}`, envelope);
          this._emit(sessionId, `event:${data.eventType}`, envelope);
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
