// @ts-nocheck
/* eslint-disable require-jsdoc */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file
 */

import {EventEmitter} from 'events';
import {camelCase, set} from 'lodash';
import backoff from 'backoff';

import type {WebexSDK} from '../SDKConnector/types';
import Socket from './socket';
import {BadRequest, Forbidden, NotAuthorized, UnknownResponse} from './errors';
import type {MobiusSocketConfig} from './config';
import type {SocketResponse} from './socket/types';
import type {
  MobiusSocketCloseOptions,
  MobiusSocketDisconnectResult,
  MobiusSocketRequestOptions,
  MobiusSocketRequestPayload,
  MobiusSocketResponseError,
} from './types';

const normalReconnectReasons = ['idle', 'done (forced)'];
const DEFAULT_MOBIUS_WEBSOCKET_SESSION = 'mobius-websocket-session';
const MOBIUS_SOCKET_NAMESPACE = 'MobiusSocket';
const TOKEN_REFRESH_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour

type MobiusSocketLogger = Pick<Console, 'debug' | 'error' | 'info' | 'log' | 'warn'>;

function normalizeMobiusAuthToken(token: string) {
  return token.replace(/^Bearer\s+/i, '');
}

class MobiusSocket extends EventEmitter {
  constructor(webex: WebexSDK, config: Partial<MobiusSocketConfig> = {}) {
    super();

    if (!webex) {
      throw new Error('A Webex instance is required when initializing MobiusSocket');
    }

    this.webex = webex;
    this.config = config;
    this.logger = (webex.logger as unknown as MobiusSocketLogger) || console;
    this.defaultSessionId = DEFAULT_MOBIUS_WEBSOCKET_SESSION;
    this.connected = false;
    this.connecting = false;
    this.hasEverConnected = false;
    this.socket = undefined;
    this.sockets = new Map();
    this.backoffCalls = new Map();
    this.shutdownSwitchoverBackoffCalls = new Map();
    this.seenAsyncEventIdsBySession = new Map();
    this.connectPromises = new Map();
    this.mercuryTimeOffset = undefined;
    this.tokenRefreshTimer = undefined;
    this.tokenRefreshInFlight = undefined;

    this.bindInternalEvents();
  }

  public off(eventName: string, listener?: (...args: unknown[]) => void) {
    if (listener) {
      return super.off(eventName, listener);
    }

    this.removeAllListeners(eventName);

    return this;
  }

  private bindInternalEvents() {
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
  }

  /**
   * Attach event listeners to a socket.
   * @param {Socket} socket - The socket to attach listeners to
   * @param {sessionId} sessionId - The socket related session ID
   * @returns {void}
   */
  private attachSocketEventListeners(socket, sessionId) {
    socket.on('close', (event) => this.onclose(sessionId, event, socket));
    socket.on('message', (...args) => this.onmessage(sessionId, ...args));
    socket.on('pong', (...args) => this.setTimeOffset(sessionId, ...args));
    socket.on('sequence-mismatch', (...args) =>
      this.emitEvent(sessionId, 'sequence-mismatch', ...args)
    );
    socket.on('ping-pong-latency', (...args) =>
      this.emitEvent(sessionId, 'ping-pong-latency', ...args)
    );
  }

  /**
   * Returns the per-session cache of seen async_event IDs, creating it on first access.
   * @param {string} sessionId - The session identifier.
   * @returns {Map<string, boolean>} Ordered cache of seen event IDs for the session.
   */
  private getSeenAsyncEventIds(sessionId) {
    let seenAsyncEventIds = this.seenAsyncEventIdsBySession.get(sessionId);

    if (!seenAsyncEventIds) {
      seenAsyncEventIds = new Map();
      this.seenAsyncEventIdsBySession.set(sessionId, seenAsyncEventIds);
    }

    return seenAsyncEventIds;
  }

  /**
   * Clears the dedup cache for one session or for all sessions when omitted.
   * @param {string} [sessionId] - Optional session identifier.
   * @returns {void}
   */
  private clearSeenAsyncEventIds(sessionId) {
    if (sessionId) {
      this.seenAsyncEventIdsBySession.delete(sessionId);

      return;
    }

    this.seenAsyncEventIdsBySession.clear();
  }

  /**
   * Tracks a newly seen async_event ID and reports whether a duplicate should be suppressed.
   * @param {string} sessionId - The session identifier.
   * @param {object} envelope - Parsed websocket message envelope.
   * @returns {boolean} True when the event has already been seen for this session.
   */
  private trackAsyncEventAndShouldSuppressDuplicate(sessionId, envelope) {
    if (envelope?.type !== 'async_event' || !envelope.eventId) {
      return false;
    }

    const seenAsyncEventIds = this.getSeenAsyncEventIds(sessionId);

    if (seenAsyncEventIds.has(envelope.eventId)) {
      const previousValue = seenAsyncEventIds.get(envelope.eventId);

      // Refresh recency so frequently retransmitted eventIds stay protected longer.
      seenAsyncEventIds.delete(envelope.eventId);
      seenAsyncEventIds.set(envelope.eventId, previousValue);
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: duplicate async_event suppressed for ${sessionId}, eventId=${envelope.eventId}`
      );

      return true;
    }

    this.logger.info(
      `${MOBIUS_SOCKET_NAMESPACE}: tracking async_event for ${sessionId}, eventId=${envelope.eventId}`
    );
    seenAsyncEventIds.set(envelope.eventId, true);

    if (seenAsyncEventIds.size > this.config.dedupCacheMaxSize) {
      const oldestEventId = seenAsyncEventIds.keys().next().value;

      seenAsyncEventIds.delete(oldestEventId);
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: evicted oldest async_event from dedup cache for ${sessionId}, eventId=${oldestEventId}`
      );
    }

    return false;
  }

  /**
   * Handle imminent shutdown by establishing a new connection while keeping
   * the current one alive (make-before-break).
   * Idempotent: will no-op if already in progress.
   * @param {string} sessionId - The session ID for which the shutdown is imminent
   * @returns {void}
   */
  private handleImminentShutdown(sessionId) {
    const oldSocket = this.sockets.get(sessionId);

    try {
      // Idempotent: if we already have a switchover backoff call for this session,
      // a switchover is in progress – do nothing.
      if (this.shutdownSwitchoverBackoffCalls.get(sessionId)) {
        this.logger.info(
          `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover already in progress for ${sessionId}`
        );

        return;
      }

      const switchoverId = `${Date.now()}`;
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover start, id=${switchoverId} for ${sessionId}`
      );

      this.connectWithBackoff(undefined, sessionId, {
        isShutdownSwitchover: true,
        attemptOptions: {
          isShutdownSwitchover: true,
          onSuccess: (newSocket, webSocketUrl) => {
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover connected, url: ${webSocketUrl} for ${sessionId}`
            );

            // Atomically switch active socket reference
            this.socket = this.sockets.get(this.defaultSessionId);
            this.connected = this.hasConnectedSockets(); // remain connected throughout

            this.emitEvent(sessionId, 'event:mercury_shutdown_switchover_complete', {
              url: webSocketUrl,
            });

            if (oldSocket) {
              this.logger.info(
                `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] old socket retained; server will close with 4001`
              );
            }
          },
        },
      })
        .then(() => {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover completed successfully for ${sessionId}`
          );
        })
        .catch((err) => {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover exhausted retries; will fall back to normal reconnection for ${sessionId}: `,
            err
          );
          this.emitEvent(sessionId, 'event:mercury_shutdown_switchover_failed', {reason: err});
          // Old socket will eventually close with 4001, triggering normal reconnection
        });
    } catch (e) {
      this.logger.error(
        `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] error during switchover for ${sessionId}`,
        e
      );
      this.shutdownSwitchoverBackoffCalls.delete(sessionId);
      this.emitEvent(sessionId, 'event:mercury_shutdown_switchover_failed', {reason: e});
    }
  }

  /**
   * Get a specific socket by connection ID
   * @param {string} sessionId - The connection identifier
   * @returns {Socket|undefined} The socket instance or undefined if not found
   */
  public getSocket(sessionId = this.defaultSessionId) {
    return this.sockets.get(sessionId);
  }

  /**
   * Get the websocket URL for a currently connected session.
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier.
   * @returns {string|undefined} The connected websocket URL, or undefined when not connected.
   */
  public getConnectedWebSocketUrl(sessionId = this.defaultSessionId): string | undefined {
    const socket = this.getSocket(sessionId);

    if (!socket?.connected) {
      return undefined;
    }

    return socket.url;
  }

  /**
   * Sends a websocket request and resolves when the matching response arrives.
   * @param {Object} payload - The websocket request payload.
   * @param {string|Object} [sessionIdOrRequestOptions=this.defaultSessionId] - Session ID or request options.
   * @param {Object} [options={}] - Additional request options.
   * @returns {Promise<Object>}
   */
  public sendWssRequest(
    payload: MobiusSocketRequestPayload,
    sessionIdOrRequestOptions: string | MobiusSocketRequestOptions = this.defaultSessionId,
    options: MobiusSocketRequestOptions = {}
  ): Promise<SocketResponse> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return Promise.reject(new Error('`payload` is required'));
    }

    let sessionId = this.defaultSessionId;
    let requestOptions = options;

    if (typeof sessionIdOrRequestOptions === 'string') {
      sessionId = sessionIdOrRequestOptions;
    } else if (sessionIdOrRequestOptions && typeof sessionIdOrRequestOptions === 'object') {
      requestOptions = sessionIdOrRequestOptions;
    }

    const socket = this.getSocket(sessionId);

    if (!socket || !socket.connected) {
      return Promise.reject(new Error(`Mobius socket is not connected for session ${sessionId}`));
    }

    return socket.sendRequest(payload, {
      timeout: requestOptions.timeout,
      matchesResponse: (response, request) =>
        response?.type === 'response_event' &&
        response?.subtype === request.type &&
        response?.trackingId === request.trackingId,
      getStatusCode: (response) => response?.statusCode,
      getStatusMessage: (response) => response?.statusMessage,
      createError: (response, statusCode, statusMessage) =>
        this.createWssResponseError(response, statusCode, statusMessage),
      createTimeoutError: (request) =>
        this.createWssResponseError(
          {
            type: 'response_event',
            subtype: request.type,
            trackingId: request.trackingId,
          },
          408,
          'Mobius websocket response timed out'
        ),
    });
  }

  /**
   * Check if the plugin is connected
   * @returns {boolean} True if connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Check if a socket is connected
   * @param {string} [sessionId] - Optional session identifier
   * @returns {boolean|undefined} True if the socket is connected
   */
  public hasConnectedSockets(sessionId): boolean {
    if (sessionId) {
      return Boolean(this.sockets.get(sessionId)?.connected);
    }

    for (const socket of this.sockets.values()) {
      if (socket?.connected) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if any sockets are connecting
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier
   * @returns {boolean|undefined} True if the socket is connecting
   */
  public hasConnectingSockets(sessionId = this.defaultSessionId): boolean {
    const socket = this.sockets.get(sessionId || this.defaultSessionId);

    return Boolean(socket?.connecting);
  }

  /**
   * Connect to Mobius for a specific session.
   * @param {string} [webSocketUrl] - Optional websocket URL override. Falls back to the device websocket URL.
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier for this connection.
   * @returns {Promise<void>} Resolves when connection flow completes for the session.
   */
  public connect(webSocketUrl?: string, sessionId = this.defaultSessionId): Promise<void> {
    // First check if there's already a connection promise for this session
    if (this.connectPromises.has(sessionId)) {
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: connection ${sessionId} already in progress, returning existing promise`
      );

      return this.connectPromises.get(sessionId);
    }

    const sessionSocket = this.sockets.get(sessionId);
    if (sessionSocket?.connected || sessionSocket?.connecting) {
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: connection ${sessionId} already connected, will not connect again`
      );

      return Promise.resolve();
    }

    // Treat a connect() call that targets a different Mobius websocket URL
    // as a fresh initial connection for retry purposes.
    if (webSocketUrl && this.socketUrl && webSocketUrl !== this.socketUrl) {
      this.hasEverConnected = false;
    }

    // Cache the caller-provided URL for reconnect
    const resolvedUrl = webSocketUrl || this.socketUrl;
    if (webSocketUrl) {
      this.socketUrl = webSocketUrl;
    }

    this.connecting = true;

    this.logger.info(
      `${MOBIUS_SOCKET_NAMESPACE}: starting connection attempt for ${sessionId}${
        Number(this.config.initialConnectionMaxRetries) === 0 && !this.hasEverConnected
          ? ' (initial retries disabled)'
          : ''
      }`
    );

    const connectPromise = Promise.resolve(
      this.webex.internal.device.registered || this.webex.internal.device.register()
    )
      .then(() => {
        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: connecting ${sessionId}`);

        return this.connectWithBackoff(resolvedUrl, sessionId);
      })
      .finally(() => {
        this.connectPromises.delete(sessionId);
      });

    this.connectPromises.set(sessionId, connectPromise);

    return connectPromise;
  }

  /**
   * Disconnect a Mobius socket for a specific session.
   * @param {object} [options] - Optional websocket close options (for example: `{code, reason}`).
   * @param {string} [sessionId=this.defaultSessionId] - The session identifier to disconnect.
   * @returns {Promise<void>} Resolves after disconnect cleanup and close handling are initiated/completed.
   */
  public disconnect(
    options?: MobiusSocketCloseOptions,
    sessionId = this.defaultSessionId
  ): MobiusSocketDisconnectResult {
    this.logger.info(
      `${MOBIUS_SOCKET_NAMESPACE}#disconnect: connecting state: ${
        this.connecting
      }, connected state: ${this.connected}, socket exists: ${!!this
        .socket}, options: ${JSON.stringify(options)}`
    );

    const backoffCall = this.backoffCalls.get(sessionId);
    if (backoffCall) {
      this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: aborting connection ${sessionId}`);
      backoffCall.abort();
      this.backoffCalls.delete(sessionId);
    }
    const shutdownSwitchoverBackoffCall = this.shutdownSwitchoverBackoffCalls.get(sessionId);
    if (shutdownSwitchoverBackoffCall) {
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: aborting shutdown switchover connection ${sessionId}`
      );
      shutdownSwitchoverBackoffCall.abort();
      this.shutdownSwitchoverBackoffCalls.delete(sessionId);
    }
    // Clean up any pending connection promises
    this.connectPromises.delete(sessionId);

    const sessionSocket = this.sockets.get(sessionId);

    this.clearSeenAsyncEventIds(sessionId);

    if (!sessionSocket) {
      this.connected = this.hasConnectedSockets();
      if (!this.hasConnectedSockets()) {
        this.stopTokenRefreshTimer();
      }

      return Promise.resolve();
    }

    sessionSocket.removeAllListeners('message');
    sessionSocket.connecting = false;
    sessionSocket.connected = false;

    return Promise.resolve(sessionSocket.close(options || undefined)).finally(() => {
      this.connected = this.hasConnectedSockets();
      if (!this.hasConnectedSockets()) {
        this.stopTokenRefreshTimer();
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private createWssResponseError(
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

  // eslint-disable-next-line class-methods-use-this
  private applyOverrides(event) {
    if (!event || !event.headers) {
      return;
    }
    const headerKeys = Object.keys(event.headers);

    headerKeys.forEach((keyPath) => {
      set(event, keyPath, event.headers[keyPath]);
    });
  }

  private prepareUrl(webSocketUrl) {
    if (!webSocketUrl) {
      webSocketUrl = this.webex.internal.device.webSocketUrl;
    }

    return Promise.resolve(webSocketUrl);
  }

  private attemptConnection(socketUrl, sessionId, callback, options = {}) {
    const {isShutdownSwitchover = false, onSuccess = null} = options;

    const socket = new Socket();
    socket.connecting = true;
    let newWSUrl;

    this.attachSocketEventListeners(socket, sessionId);

    const backoffCall = isShutdownSwitchover
      ? this.shutdownSwitchoverBackoffCalls.get(sessionId)
      : this.backoffCalls.get(sessionId);

    // Check appropriate backoff call based on connection type
    if (!backoffCall) {
      const mode = isShutdownSwitchover ? 'switchover backoff call' : 'backoffCall';
      const msg = `${MOBIUS_SOCKET_NAMESPACE}: prevent socket open when ${mode} no longer defined for ${sessionId}`;
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

    return this.prepareAndOpenSocket(socket, socketUrl, sessionId, isShutdownSwitchover)
      .then((webSocketUrl) => {
        newWSUrl = webSocketUrl;

        this.logger.info(
          `${MOBIUS_SOCKET_NAMESPACE}: ${
            isShutdownSwitchover ? '[shutdown] switchover' : ''
          } connected to mobius socket, success, action: connected for ${sessionId}, url: ${newWSUrl}`
        );

        // Custom success handler for shutdown switchover
        if (onSuccess) {
          onSuccess(socket, webSocketUrl);
          callback();

          return Promise.resolve();
        }

        // Default behavior for normal connection
        callback();

        return Promise.resolve();
      })
      .catch((reason) => {
        // For shutdown, simpler error handling - just callback for retry
        if (isShutdownSwitchover) {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover attempt failed for ${sessionId}`,
            reason
          );

          return callback(reason);
        }

        // Normal connection error handling (existing complex logic)
        const backoffCallNormal = this.backoffCalls.get(sessionId);
        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && backoffCallNormal && backoffCallNormal?.getNumRetries() > 0) {
          this.emitEvent(sessionId, 'connection_failed', reason, {
            sessionId,
            retries: backoffCallNormal?.getNumRetries(),
          });
        }
        this.logger.info(
          `${MOBIUS_SOCKET_NAMESPACE}: connection attempt failed for ${sessionId}`,
          reason,
          backoffCallNormal?.getNumRetries() === 0 ? reason.stack : ''
        );
        // UnknownResponse is produced by IE for any 4XXX; treated it like a bad
        // web socket url and let WDM handle the token checking
        if (reason instanceof UnknownResponse) {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: received unknown response code for ${sessionId}, refreshing device registration`
          );

          return this.webex.internal.device.refresh().then(() => callback(reason));
        }
        // NotAuthorized implies expired token
        if (reason instanceof NotAuthorized) {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: received authorization error for ${sessionId}, reauthorizing`
          );

          return this.webex.credentials.refresh({force: true}).then(() => callback(reason));
        }
        // BadRequest implies current credentials are for a Service Account
        // Forbidden implies current user is not entitled for Webex
        if (reason instanceof BadRequest || reason instanceof Forbidden) {
          this.logger.warn(
            `${MOBIUS_SOCKET_NAMESPACE}: received unrecoverable response from ${MOBIUS_SOCKET_NAMESPACE} for ${sessionId}`
          );
          backoffCallNormal?.abort();

          return callback(reason);
        }

        return callback(reason);
      })
      .catch((reason) => {
        this.logger.error(
          `${MOBIUS_SOCKET_NAMESPACE}: failed to handle connection failure for ${sessionId}`,
          reason
        );
        callback(reason);
      });
  }

  private prepareAndOpenSocket(socket, socketUrl, sessionId, isShutdownSwitchover = false) {
    const logPrefix = isShutdownSwitchover ? '[shutdown] switchover' : 'connection';

    return Promise.all([this.prepareUrl(socketUrl), this.webex.credentials.getUserToken()]).then(
      ([webSocketUrl, token]) => {
        let options = {
          forceCloseDelay: this.config.forceCloseDelay,
          wssResponseTimeout: this.config.wssResponseTimeout,
          skipAckEventId: this.config.skipAckEventId,
          skipAckEventType: this.config.skipAckEventType,
          token: normalizeMobiusAuthToken(token.toString()),
          refreshToken: () => this.refreshToken(),
          trackingId: `${this.webex.sessionId}_${Date.now()}`,
          logger: this.logger,
        };

        if (this.webex.config.defaultMobiusSocketOptions) {
          const customOptionsMsg = isShutdownSwitchover
            ? 'setting custom options for switchover'
            : 'setting custom options';

          this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: ${customOptionsMsg}`);
          options = {...options, ...this.webex.config.defaultMobiusSocketOptions};
        }

        // Set the socket before opening it. This allows a disconnect() to close
        // the socket if it is in the process of being opened.
        this.sockets.set(sessionId, socket);
        this.socket = this.sockets.get(this.defaultSessionId);

        this.logger.info(
          `${MOBIUS_SOCKET_NAMESPACE} ${logPrefix} url for ${sessionId}: ${webSocketUrl}`
        );

        return socket.open(webSocketUrl, options).then(() => webSocketUrl);
      }
    );
  }

  private connectWithBackoff(webSocketUrl, sessionId, context = {}): Promise<void> {
    const {isShutdownSwitchover = false, attemptOptions = {}} = context;

    return new Promise((resolve, reject) => {
      // eslint gets confused about whether call is actually used
      // eslint-disable-next-line prefer-const
      let call;
      const isInitialConnect = !isShutdownSwitchover && !this.hasEverConnected;
      const initialRetryLimit =
        this.config.initialConnectionMaxRetries == null
          ? null
          : Number(this.config.initialConnectionMaxRetries);
      const isInitialConnectWithoutRetries = isInitialConnect && initialRetryLimit === 0;

      const onComplete = (err, sid = sessionId) => {
        if (isShutdownSwitchover) {
          this.shutdownSwitchoverBackoffCalls.delete(sid);
        } else {
          this.backoffCalls.delete(sid);
        }
        const sessionSocket = this.sockets.get(sid);
        if (err) {
          const msg = isShutdownSwitchover
            ? `[shutdown] switchover failed after ${call.getNumRetries()} retries`
            : `failed to connect after ${call.getNumRetries()} retries`;

          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: ${msg}; log statement about next retry was inaccurate; ${err}`
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
          this.startTokenRefreshTimer();
          this.emitEvent(sid, 'online');
        }

        return resolve();
      };
      // eslint-disable-next-line prefer-reflect
      call = backoff.call(
        (callback) => {
          const attemptNum = call.getNumRetries();
          const attemptLogPrefix = isShutdownSwitchover ? '[shutdown] switchover' : 'connection';

          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: executing ${attemptLogPrefix} attempt ${attemptNum} for ${sessionId}`
          );
          this.attemptConnection(webSocketUrl, sessionId, callback, attemptOptions);
        },
        (err) => onComplete(err, sessionId)
      );

      call.setStrategy(
        new backoff.ExponentialStrategy({
          initialDelay: this.config.backoffTimeReset,
          maxDelay: this.config.backoffTimeMax,
        })
      );

      if (isInitialConnectWithoutRetries) {
        call.retryIf(() => false);
      } else if (isInitialConnect && initialRetryLimit > 0) {
        call.failAfter(initialRetryLimit);
      } else if (this.config.maxRetries) {
        call.failAfter(this.config.maxRetries);
      }

      // Store the call BEFORE setting up event handlers to prevent race conditions
      // Store backoff call reference BEFORE starting (so it's available in _attemptConnection)
      if (isShutdownSwitchover) {
        this.shutdownSwitchoverBackoffCalls.set(sessionId, call);
      } else {
        this.backoffCalls.set(sessionId, call);
      }

      call.on('abort', () => {
        const msg = isShutdownSwitchover ? 'Shutdown Switchover' : 'Connection';

        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: ${msg} aborted for ${sessionId}`);
        reject(new Error(`MobiusSocket ${msg} Aborted for ${sessionId}`));
      });

      call.on('callback', (err) => {
        if (err) {
          if (isInitialConnectWithoutRetries) {
            // retryIf(() => false) already disabled retries for this initial connect;
            // this branch only avoids logging the generic "attempting retry" message.
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: initial connect failed for ${sessionId}; retries already disabled`
            );

            return;
          }

          const number = call.getNumRetries();
          const delay = Math.min(call.strategy_.nextBackoffDelay_, this.config.backoffTimeMax);

          const callbackLogPrefix = isShutdownSwitchover ? '[shutdown] switchover' : '';

          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: ${callbackLogPrefix} failed to connect; attempting retry ${
              number + 1
            } in ${delay} ms for ${sessionId}`
          );
          /* istanbul ignore if */
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`${MOBIUS_SOCKET_NAMESPACE}: `, err, err.stack);
          }

          return;
        }
        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: connected ${sessionId}`);
      });

      call.start();
    });
  }

  private emitEvent(sessionId, eventName, ...args) {
    try {
      if (!sessionId || !eventName) {
        return;
      }

      const suffix = sessionId === this.defaultSessionId ? '' : `:${sessionId}`;

      this.emit(`${eventName}${suffix}`, ...args);
    } catch (error) {
      // Safely handle errors without causing additional issues during cleanup
      try {
        this.logger.error(
          `${MOBIUS_SOCKET_NAMESPACE}: error occurred in event handler:`,
          error,
          ' with args: ',
          [sessionId, eventName, ...args]
        );
      } catch (logError) {
        // If even logging fails, just ignore to prevent cascading errors during cleanup
        // eslint-disable-next-line no-console
        console.error('MobiusSocket _emit error handling failed:', logError);
      }
    }
  }

  private getEventHandlers(eventType) {
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
  }

  private startTokenRefreshTimer() {
    if (this.tokenRefreshTimer || !this.hasConnectedSockets()) {
      return;
    }

    this.tokenRefreshTimer = setInterval(() => {
      this.refreshToken().catch((error) => {
        this.logger.error(`${MOBIUS_SOCKET_NAMESPACE}: periodic token refresh failed`, error);
      });
    }, TOKEN_REFRESH_INTERVAL_MS);
  }

  private stopTokenRefreshTimer() {
    if (!this.tokenRefreshTimer) {
      return;
    }

    clearInterval(this.tokenRefreshTimer);
    this.tokenRefreshTimer = undefined;
  }

  private refreshToken() {
    if (this.tokenRefreshInFlight) {
      return this.tokenRefreshInFlight;
    }

    if (!this.hasConnectedSockets()) {
      this.stopTokenRefreshTimer();

      return Promise.resolve();
    }

    const tokenPromise = this.webex.credentials.canRefresh
      ? this.webex.credentials
          .refresh({force: true})
          .then(() => this.webex.credentials.getUserToken())
      : this.webex.credentials.getUserToken();

    this.tokenRefreshInFlight = tokenPromise
      .then((token) => {
        if (!token) {
          throw new Error('Mobius token refresh did not return a token');
        }
        const refreshedToken = normalizeMobiusAuthToken(token.toString());
        const authPayloadPromises = [];

        for (const socket of this.sockets.values()) {
          if (socket?.connected) {
            authPayloadPromises.push(socket.refresh(refreshedToken));
          }
        }

        return Promise.all(authPayloadPromises);
      })
      .catch((error) => {
        this.logger.error(
          `${MOBIUS_SOCKET_NAMESPACE}: failed to refresh/re-auth Mobius sockets`,
          error
        );
        throw error;
      })
      .finally(() => {
        this.tokenRefreshInFlight = undefined;
      });

    return this.tokenRefreshInFlight;
  }

  private onclose(sessionId, event, sourceSocket) {
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
          if (sessionId === this.defaultSessionId) {
            this.socket = undefined;
          }
          this.emitEvent(sessionId, 'offline', event);
        }
        // Update overall connected status
        this.connecting = this.hasConnectingSockets();
        this.connected = this.hasConnectedSockets();
        if (!this.hasConnectedSockets()) {
          this.stopTokenRefreshTimer();
        }
      } else {
        // Old socket closed; do not flip connection state
        this.logger.info(
          `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] non-active socket closed, code=${event.code} for ${sessionId}`
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
            `${MOBIUS_SOCKET_NAMESPACE}: service rejected last message for ${sessionId}; will not reconnect: ${event.reason}`
          );
          if (isActiveSocket) this.emitEvent(sessionId, 'offline.permanent', event);
          break;
        case 4000:
          // metric: disconnect
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: socket ${sessionId} replaced; will not reconnect`
          );
          if (isActiveSocket) this.emitEvent(sessionId, 'offline.replaced', event);
          // If not active, nothing to do
          break;
        case 4001:
          // replaced during shutdown
          if (isActiveSocket) {
            // Server closed active socket with 4001, meaning it expected this connection
            // to be replaced, but the switchover in _handleImminentShutdown failed.
            // This is a permanent failure - do not reconnect.
            this.logger.warn(
              `${MOBIUS_SOCKET_NAMESPACE}: active socket closed with 4001; shutdown switchover failed for ${sessionId}`
            );
            this.emitEvent(sessionId, 'offline.permanent', event);
          } else {
            // Expected: old socket closed after successful switchover
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: old socket closed with 4001 (replaced during shutdown); no reconnect needed for ${sessionId}`
            );
            this.emitEvent(sessionId, 'offline.replaced', event);
          }
          break;
        case 1001:
        case 1005:
        case 1006:
        case 1011:
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: socket ${sessionId} disconnected; reconnecting`
          );
          if (isActiveSocket) {
            this.emitEvent(sessionId, 'offline.transient', event);
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] reconnecting active socket to recover for ${sessionId}`
            );
            this.reconnect(socketUrl, sessionId);
          }
          // metric: disconnect
          // if (code == 1011 && reason !== ping error) metric: unexpected disconnect
          break;
        case 1000:
        case 3050: // 3050 indicates logout form of closure, default to old behavior, use config reason defined by consumer to proceed with the permanent block
          if (normalReconnectReasons.includes(reason)) {
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: socket ${sessionId} disconnected; reconnecting`
            );
            if (isActiveSocket) {
              this.emitEvent(sessionId, 'offline.transient', event);
              this.logger.info(
                `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] reconnecting due to normal close for ${sessionId}`
              );
              this.reconnect(socketUrl, sessionId);
            }
            // metric: disconnect
            // if (reason === done forced) metric: force closure
          } else {
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: socket ${sessionId} disconnected; will not reconnect: ${event.reason}`
            );
            if (isActiveSocket) this.emitEvent(sessionId, 'offline.permanent', event);
          }
          break;
        default:
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: socket ${sessionId} disconnected unexpectedly; will not reconnect`
          );
          // unexpected disconnect
          if (isActiveSocket) this.emitEvent(sessionId, 'offline.permanent', event);
      }
    } catch (error) {
      this.logger.error(
        `${MOBIUS_SOCKET_NAMESPACE}: error occurred in close handler for ${sessionId}`,
        error
      );
    }
  }

  private onmessage(sessionId, event) {
    this.setTimeOffset(sessionId, event);
    const envelope = event.data;

    if (process.env.ENABLE_MERCURY_LOGGING) {
      this.logger.debug(
        `${MOBIUS_SOCKET_NAMESPACE}: message envelope from ${sessionId}: `,
        envelope
      );
    }

    envelope.sessionId = sessionId;

    // Handle shutdown message shape: { type: 'shutdown' }
    if (envelope && envelope.type === 'shutdown') {
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] imminent shutdown message received for ${sessionId}`
      );
      this.emitEvent(sessionId, 'event:mercury_shutdown_imminent', envelope);

      this.handleImminentShutdown(sessionId);

      return Promise.resolve();
    }

    if (this.trackAsyncEventAndShouldSuppressDuplicate(sessionId, envelope)) {
      return Promise.resolve();
    }

    // Mobius: emit event:<type> for typed messages (e.g., register.response)
    if (envelope.type) {
      this.emitEvent(sessionId, `event:${envelope.type}`, envelope);
    }

    envelope.sessionId = sessionId;
    // Use data/payload if present, otherwise treat the envelope itself as the data (flat format)
    const data = envelope.data || envelope;

    this.applyOverrides(data);

    // Support both Mercury-enveloped (data.eventType) and flat (eventType) formats
    const eventType = data?.eventType || envelope.eventType;

    if (!eventType) {
      this.emitEvent(sessionId, 'event', envelope);

      return Promise.resolve();
    }

    return this.getEventHandlers(eventType)
      .reduce(
        (promise, handler) =>
          promise.then(() => {
            const {namespace, name} = handler;

            return new Promise((resolve) => {
              resolve((this.webex[namespace] || this.webex.internal[namespace])[name](data));
            }).catch((reason) =>
              this.logger.error(
                `${MOBIUS_SOCKET_NAMESPACE}: error occurred in autowired event handler for ${eventType} from ${sessionId}`,
                reason
              )
            );
          }),
        Promise.resolve()
      )
      .then(() => {
        this.emitEvent(sessionId, 'event', envelope);
        const [namespace] = eventType.split('.');

        if (namespace === eventType) {
          this.emitEvent(sessionId, `event:${namespace}`, envelope);
        } else {
          this.emitEvent(sessionId, `event:${namespace}`, envelope);
          this.emitEvent(sessionId, `event:${eventType}`, envelope);
        }
      })
      .catch((reason) => {
        this.logger.error(
          `${MOBIUS_SOCKET_NAMESPACE}: error occurred processing socket message from ${sessionId}`,
          reason
        );
      });
  }

  private setTimeOffset(sessionId, event) {
    const {wsWriteTimestamp} = event.data;
    if (typeof wsWriteTimestamp === 'number' && wsWriteTimestamp > 0) {
      this.mercuryTimeOffset = Date.now() - wsWriteTimestamp;
    }
  }

  private reconnect(webSocketUrl, sessionId = this.defaultSessionId) {
    this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: reconnecting ${sessionId}`);

    return this.connect(webSocketUrl || this.socketUrl, sessionId);
  }
}

export default MobiusSocket;
