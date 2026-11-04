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
const MERCURY_CLOSE_4000_METRIC = 'JS_SDK_MERCURY_CLOSE_4000';

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
    localClusterServiceUrls: 'object',
    mercuryTimeOffset: {
      default: undefined,
      type: 'number',
    },
    backoffCall: 'object',
    _connectPromise: 'object',
    _shutdownSwitchoverBackoffCall: 'object',
    _shutdownSwitchoverId: 'string',
    // Store the resolved (pre-proxy) URL so reconnection uses a catalog-valid host
    // instead of the potentially rewritten socket.url from an interceptor.
    resolvedWebSocketUrl: 'string',
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
   * @returns {void}
   */
  _attachSocketEventListeners(socket) {
    socket.on('close', (event) => this._onclose(event, socket));
    socket.on('message', (...args) => this._onmessage(...args));
    socket.on('pong', (...args) => this._setTimeOffset(...args));
    socket.on('sequence-mismatch', (...args) => this._emit('sequence-mismatch', ...args));
    socket.on('ping-pong-latency', (...args) => this._emit('ping-pong-latency', ...args));
  },

  /**
   * Handle imminent shutdown by establishing a new connection while keeping
   * the current one alive (make-before-break).
   * Idempotent: will no-op if already in progress.
   * @returns {void}
   */
  _handleImminentShutdown() {
    const oldSocket = this.socket;

    try {
      if (this._shutdownSwitchoverBackoffCall) {
        this.logger.info(`${this.namespace}: [shutdown] switchover already in progress`);

        return;
      }
      this._shutdownSwitchoverId = `${Date.now()}`;
      this.logger.info(
        `${this.namespace}: [shutdown] switchover start, id=${this._shutdownSwitchoverId}`
      );

      this._connectWithBackoff(undefined, {
        isShutdownSwitchover: true,
        attemptOptions: {
          isShutdownSwitchover: true,
          onSuccess: (newSocket, webSocketUrl) => {
            this.logger.info(
              `${this.namespace}: [shutdown] switchover connected, url: ${webSocketUrl}`
            );

            // Atomically switch active socket reference
            this.socket = newSocket;
            this.connected = true; // remain connected throughout

            this._emit('event:mercury_shutdown_switchover_complete', {url: webSocketUrl});

            if (oldSocket) {
              this.logger.info(
                `${this.namespace}: [shutdown] old socket retained; server will close with 4001`
              );
            }
          },
        },
      })
        .then(() => {
          this.logger.info(`${this.namespace}: [shutdown] switchover completed successfully`);
        })
        .catch((err) => {
          this.logger.info(
            `${this.namespace}: [shutdown] switchover exhausted retries; will fall back to normal reconnection`,
            err
          );
          this._emit('event:mercury_shutdown_switchover_failed', {reason: err});
          // Old socket will eventually close with 4001, triggering normal reconnection
        });
    } catch (e) {
      this.logger.error(`${this.namespace}: [shutdown] error during switchover`, e);
      this._shutdownSwitchoverBackoffCall = undefined;
      this._emit('event:mercury_shutdown_switchover_failed', {reason: e});
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
   * Get the underlying WebSocket.
   * @returns {any} The socket instance, or undefined if not connected.
   */
  getSocket() {
    return this.socket;
  },

  connect(webSocketUrl) {
    if (this.connected) {
      this.logger.info(`${this.namespace}: already connected, will not connect again`);

      return Promise.resolve();
    }

    // If already connecting, return the existing promise so callers can await it
    if (this._connectPromise) {
      this.logger.info(
        `${this.namespace}: connection already in progress, returning existing promise`
      );

      return this._connectPromise;
    }

    this.connecting = true;

    this.logger.info(`${this.namespace}: starting connection attempt`);

    this._connectPromise = Promise.resolve(
      this.webex.internal.device.registered || this.webex.internal.device.register()
    )
      .then(() => {
        this.logger.info(`${this.namespace}: connecting`);

        return this._connectWithBackoff(webSocketUrl);
      })
      .finally(() => {
        this._connectPromise = null;
      });

    return this._connectPromise;
  },

  disconnect(options) {
    this.logger.info(
      `${this.namespace}#disconnect: connecting state: ${this.connecting}, connected state: ${
        this.connected
      }, socket exists: ${!!this.socket}, options: ${JSON.stringify(options)}`
    );

    return new Promise((resolve) => {
      if (this.backoffCall) {
        this.logger.info(`${this.namespace}: aborting connection`);
        this.backoffCall.abort();
      }

      if (this._shutdownSwitchoverBackoffCall) {
        this.logger.info(`${this.namespace}: aborting shutdown switchover`);
        this._shutdownSwitchoverBackoffCall.abort();
      }

      if (this.socket) {
        this.socket.removeAllListeners('message');
        this.once('offline', () => {
          this._emit('disconnected');
          resolve();
        });
        this.socket.close(options);

        return;
      }
      this._emit('disconnected');
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

  _attemptConnection(socketUrl, callback, options = {}) {
    const {isShutdownSwitchover = false, onSuccess = null} = options;

    const socket = new Socket();
    let newWSUrl;

    this._attachSocketEventListeners(socket);

    // Check appropriate backoff call based on connection type
    if (isShutdownSwitchover && !this._shutdownSwitchoverBackoffCall) {
      const msg = `${this.namespace}: prevent socket open when switchover backoff call no longer defined`;
      const err = new Error(msg);

      this.logger.info(msg);

      // Call the callback with the error before rejecting
      callback(err);

      return Promise.reject(err);
    }

    if (!isShutdownSwitchover && !this.backoffCall) {
      const msg = `${this.namespace}: prevent socket open when backoffCall no longer defined`;
      const err = new Error(msg);

      this.logger.info(msg);

      // Call the callback with the error before rejecting
      callback(err);

      // eslint-disable-next-line no-unreachable
      return Promise.reject(err);
    }

    // For shutdown switchover, don't set socket yet (make-before-break)
    // For normal connection, set socket before opening to allow disconnect() to close it
    if (!isShutdownSwitchover) {
      this.socket = socket;
    }

    return this._prepareAndOpenSocket(socket, socketUrl, isShutdownSwitchover)
      .then((webSocketUrl) => {
        newWSUrl = webSocketUrl;
        this.logger.info(
          `${this.namespace}: ${
            isShutdownSwitchover ? '[shutdown] switchover' : ''
          } connected to mercury, success, action: connected, url: ${newWSUrl}`
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
          this.logger.info(`${this.namespace}: [shutdown] switchover attempt failed`, reason);

          return callback(reason);
        }

        // Normal connection error handling (existing complex logic)
        this.lastError = reason; // remember the last error

        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && this.backoffCall && this.backoffCall?.getNumRetries() > 0) {
          this._emit('connection_failed', reason, {retries: this.backoffCall?.getNumRetries()});
        }
        this.logger.info(
          `${this.namespace}: connection attempt failed`,
          reason,
          this.backoffCall?.getNumRetries() === 0 ? reason.stack : ''
        );
        // UnknownResponse is produced by IE for any 4XXX; treated it like a bad
        // web socket url and let WDM handle the token checking
        if (reason instanceof UnknownResponse) {
          this.logger.info(
            `${this.namespace}: received unknown response code, refreshing device registration`
          );

          return this.webex.internal.device.refresh().then(() => callback(reason));
        }
        // NotAuthorized implies expired token
        if (reason instanceof NotAuthorized) {
          this.logger.info(`${this.namespace}: received authorization error, reauthorizing`);

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
          this.logger.warn(`${this.namespace}: received unrecoverable response from mercury`);
          this.backoffCall.abort();

          return callback(reason);
        }
        if (reason instanceof ConnectionError) {
          return this.webex.internal.feature
            .getFeature('developer', 'web-high-availability')
            .then((haMessagingEnabled) => {
              const wsUrl = newWSUrl || reason.webSocketUrl;

              if (haMessagingEnabled) {
                this.logger.info(
                  `${this.namespace}: received a generic connection error, will try to connect to another datacenter. failed, action: 'failed', url: ${wsUrl} error: ${reason.message}`
                );

                if (wsUrl) {
                  this.logger.info(
                    `${this.namespace}: marking ${wsUrl} as failed due to connection error`
                  );

                  return this.webex.internal.services.markFailedUrl(wsUrl);
                }

                this.logger.info(
                  `${this.namespace}: no socket url available to mark as failed due to connection error`
                );
              }

              return null;
            })
            .then(() => callback(reason));
        }

        return callback(reason);
      })
      .catch((reason) => {
        this.logger.error(`${this.namespace}: failed to handle connection failure`, reason);
        callback(reason);
      });
  },

  _prepareAndOpenSocket(socket, socketUrl, isShutdownSwitchover = false) {
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

        this.logger.info(`${this.namespace}: ${logPrefix} url: ${webSocketUrl}`);

        // Store the resolved URL before socket.open(), which may be rewritten by
        // an interceptor (e.g. same-site websocket proxy). On reconnection we need
        // the original catalog-valid URL, not the post-proxy one from socket.url.
        if (!isShutdownSwitchover) {
          this.resolvedWebSocketUrl = webSocketUrl;
        }

        return socket
          .open(webSocketUrl, options)
          .then(() => webSocketUrl)
          .catch((err) => {
            err.webSocketUrl = webSocketUrl;

            return Promise.reject(err);
          });
      }
    );
  },

  _connectWithBackoff(webSocketUrl, context = {}) {
    const {isShutdownSwitchover = false, attemptOptions = {}} = context;

    return new Promise((resolve, reject) => {
      // eslint gets confused about whether or not call is actually used
      // eslint-disable-next-line prefer-const
      let call;
      const onComplete = (err) => {
        // Clear state flags based on connection type
        if (isShutdownSwitchover) {
          this._shutdownSwitchoverBackoffCall = undefined;
        } else {
          this.connecting = false;
          this.backoffCall = undefined;
        }

        if (err) {
          const msg = isShutdownSwitchover
            ? `[shutdown] switchover failed after ${call.getNumRetries()} retries`
            : `failed to connect after ${call.getNumRetries()} retries`;

          this.logger.info(
            `${this.namespace}: ${msg}; log statement about next retry was inaccurate; ${err}`
          );

          return reject(err);
        }

        // Default success handling for normal connections
        if (!isShutdownSwitchover) {
          this.connected = true;
          this.hasEverConnected = true;
          this._emit('online');
          this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(true);
        }

        return resolve();
      };

      // eslint-disable-next-line prefer-reflect
      call = backoff.call((callback) => {
        const attemptNum = call.getNumRetries();
        const logPrefix = isShutdownSwitchover ? '[shutdown] switchover' : 'connection';

        this.logger.info(`${this.namespace}: executing ${logPrefix} attempt ${attemptNum}`);
        this._attemptConnection(webSocketUrl, callback, attemptOptions);
      }, onComplete);

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

      call.on('abort', () => {
        const msg = isShutdownSwitchover ? 'Shutdown Switchover' : 'Connection';

        this.logger.info(`${this.namespace}: ${msg} aborted`);
        reject(new Error(`Mercury ${msg} Aborted`));
      });

      call.on('callback', (err) => {
        if (err) {
          const number = call.getNumRetries();
          const delay = Math.min(call.strategy_.nextBackoffDelay_, this.config.backoffTimeMax);
          const logPrefix = isShutdownSwitchover ? '[shutdown] switchover' : '';

          this.logger.info(
            `${this.namespace}: ${logPrefix} failed to connect; attempting retry ${
              number + 1
            } in ${delay} ms`
          );
          /* istanbul ignore if */
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`${this.namespace}: `, err, err.stack);
          }

          return;
        }
        this.logger.info(`${this.namespace}: connected`);
      });

      // Store backoff call reference BEFORE starting (so it's available in _attemptConnection)
      if (isShutdownSwitchover) {
        this._shutdownSwitchoverBackoffCall = call;
      } else {
        this.backoffCall = call;
      }

      call.start();
    });
  },

  _emit(...args) {
    try {
      this.trigger(...args);
    } catch (error) {
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
    if (!eventType) {
      return [];
    }

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

  _submitMercuryClose4000Metric(event, options) {
    const {action, isActiveSocket, messageType} = options;

    try {
      this.webex.internal.metrics.submitClientMetrics(MERCURY_CLOSE_4000_METRIC, {
        fields: {
          action,
          close_code: event.code,
          close_reason: event.reason || '',
          is_active_socket: isActiveSocket,
          message_type: messageType,
        },
        tags: {
          action,
          message_type: messageType,
        },
      });
    } catch (error) {
      this.logger.warn(`${this.namespace}: failed to submit Mercury 4000 close metric`, error);
    }
  },

  _onclose(event, sourceSocket) {
    // I don't see any way to avoid the complexity or statement count in here.
    /* eslint complexity: [0] */

    try {
      const isActiveSocket = sourceSocket === this.socket;
      const reason = event.reason && event.reason.toLowerCase();

      // Use the stored resolved URL for reconnection instead of sourceSocket.url,
      // which may have been rewritten by an interceptor to a non-catalog host.
      const socketUrl = this.resolvedWebSocketUrl || (sourceSocket && sourceSocket.url);

      if (isActiveSocket) {
        // Only tear down state if the currently active socket closed
        if (this.socket) {
          this.socket.removeAllListeners();
        }
        this.unset('socket');
        this.connected = false;
        this._emit('offline', event);
        this.webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus(false);
      } else {
        // Old socket closed; do not flip connection state
        this.logger.info(
          `${this.namespace}: [shutdown] non-active socket closed, code=${event.code}`
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
            `${this.namespace}: Mercury service rejected last message; will not reconnect: ${event.reason}`
          );
          if (isActiveSocket) this._emit('offline.permanent', event);
          break;
        case 4000:
          // metric: disconnect, check reason
          if (reason === 'replaced') {
            this._submitMercuryClose4000Metric(event, {
              action: 'no_action',
              isActiveSocket,
              messageType: 'replaced',
            });
            this.logger.info(`${this.namespace}: socket replaced; will not reconnect`);
            if (isActiveSocket) this._emit('offline.replaced', event);
          } else {
            this._submitMercuryClose4000Metric(event, {
              action: isActiveSocket ? 'reconnect' : 'ignore_non_active',
              isActiveSocket,
              messageType: 'other',
            });
            this.logger.info(
              `${this.namespace}: socket disconnected with 4000: ${event.reason}; reconnecting`
            );
            if (isActiveSocket) {
              this._emit('offline.transient', event);
              this._reconnect(socketUrl);
            }
          }
          break;
        case 4001:
          // replaced during shutdown
          if (isActiveSocket) {
            // Server closed active socket with 4001, meaning it expected this connection
            // to be replaced, but the switchover in _handleImminentShutdown failed.
            // This is a permanent failure - do not reconnect.
            this.logger.warn(
              `${this.namespace}: active socket closed with 4001; shutdown switchover failed`
            );
            this._emit('offline.permanent', event);
          } else {
            // Expected: old socket closed after successful switchover
            this.logger.info(
              `${this.namespace}: old socket closed with 4001 (replaced during shutdown); no reconnect needed`
            );
            this._emit('offline.replaced', event);
          }
          break;
        case 1001:
        case 1005:
        case 1006:
        case 1011:
          this.logger.info(`${this.namespace}: socket disconnected; reconnecting`);
          if (isActiveSocket) {
            this._emit('offline.transient', event);
            this.logger.info(`${this.namespace}: [shutdown] reconnecting active socket to recover`);
            this._reconnect(socketUrl);
          }
          // metric: disconnect
          // if (code == 1011 && reason !== ping error) metric: unexpected disconnect
          break;
        case 1000:
        case 3050: // 3050 indicates logout form of closure, default to old behavior, use config reason defined by consumer to proceed with the permanent block
          if (normalReconnectReasons.includes(reason)) {
            this.logger.info(`${this.namespace}: socket disconnected; reconnecting`);
            if (isActiveSocket) {
              this._emit('offline.transient', event);
              this.logger.info(`${this.namespace}: [shutdown] reconnecting due to normal close`);
              this._reconnect(socketUrl);
            }
            // metric: disconnect
            // if (reason === done forced) metric: force closure
          } else {
            this.logger.info(
              `${this.namespace}: socket disconnected; will not reconnect: ${event.reason}`
            );
            if (isActiveSocket) this._emit('offline.permanent', event);
          }
          break;
        default:
          this.logger.info(
            `${this.namespace}: socket disconnected unexpectedly; will not reconnect`
          );
          // unexpected disconnect
          if (isActiveSocket) this._emit('offline.permanent', event);
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

    // Handle shutdown message shape: { type: 'shutdown' }
    if (envelope && envelope.type === 'shutdown') {
      this.logger.info(`${this.namespace}: [shutdown] imminent shutdown message received`);
      this._emit('event:mercury_shutdown_imminent', envelope);

      this._handleImminentShutdown();

      return Promise.resolve();
    }

    const {data} = envelope;

    if (!data || !data.eventType) {
      this._emit('event', envelope);

      return Promise.resolve();
    }

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
        const [namespace] = data.eventType ? data.eventType.split('.') : [];

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
});

export default Mercury;
