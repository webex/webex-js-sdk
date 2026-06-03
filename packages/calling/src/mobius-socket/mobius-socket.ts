/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file
 */

import {EventEmitter} from 'events';
// @ts-ignore - backoff library does not have type definitions
import backoff from 'backoff';

import type {WebexSDK} from '../SDKConnector/types';
import Socket from './socket';
import {BadRequest, Forbidden, NotAuthorized, UnknownResponse} from './errors';
import type {MobiusSocketConfig} from './config';
import type {SocketCloseEvent, SocketMessageEvent, SocketResponse} from './socket/types';
import type {
  MobiusSocketCloseOptions,
  MobiusSocketDisconnectResult,
  MobiusSocketRequestOptions,
  MobiusSocketRequestPayload,
} from './types';
import {MOBIUS_SOCKET_4001_EVENT} from './socket/constants';

const normalReconnectReasons = ['idle', 'done (forced)'];
const MOBIUS_SOCKET_NAMESPACE = 'MobiusSocket';
const TOKEN_REFRESH_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour

type MobiusSocketLogger = Pick<Console, 'debug' | 'error' | 'info' | 'log' | 'warn'>;

// Extended Socket type with dynamic properties
type ExtendedSocket = Socket & {
  connecting?: boolean;
  connected?: boolean;
};

function normalizeMobiusAuthToken(token: string) {
  return token.replace(/^Bearer\s+/i, '');
}

class MobiusSocket extends EventEmitter {
  private webex: WebexSDK;
  private config: Partial<MobiusSocketConfig>;
  private logger: MobiusSocketLogger;
  private connected: boolean;
  private connecting: boolean;
  private hasEverConnected: boolean;
  private socket: ExtendedSocket | undefined;
  private backoffCall: any; // backoff library has no types
  private shutdownSwitchoverBackoffCall: any; // backoff library has no types
  private seenAsyncEventIds: Map<string, boolean>;
  private connectPromise: Promise<void> | undefined;
  private socketUrl: string | undefined;
  private tokenRefreshTimer: NodeJS.Timeout | undefined;
  private tokenRefreshInFlight: Promise<unknown> | undefined;

  constructor(webex: WebexSDK, config: Partial<MobiusSocketConfig> = {}) {
    super();

    if (!webex) {
      throw new Error('A Webex instance is required when initializing MobiusSocket');
    }

    this.webex = webex;
    this.config = config;
    this.logger = (webex.logger as unknown as MobiusSocketLogger) || console;
    this.connected = false;
    this.connecting = false;
    this.hasEverConnected = false;
    this.socket = undefined;
    this.backoffCall = undefined;
    this.shutdownSwitchoverBackoffCall = undefined;
    this.seenAsyncEventIds = new Map();
    this.connectPromise = undefined;
    this.tokenRefreshTimer = undefined;
    this.tokenRefreshInFlight = undefined;
  }

  public off(eventName: string, listener?: (...args: unknown[]) => void) {
    if (listener) {
      return super.off(eventName, listener);
    }

    this.removeAllListeners(eventName);

    return this;
  }

  /**
   * Attach event listeners to a socket.
   * @param socket - The socket to attach listeners to
   */
  private attachSocketEventListeners(socket: ExtendedSocket): void {
    socket.on('close', (event: SocketCloseEvent) => this.onclose(event, socket));
    socket.on('message', (event: SocketMessageEvent<SocketResponse>) => this.onmessage(event));
  }

  /**
   * Tracks a newly seen async_event ID and reports whether a duplicate should be suppressed.
   * @param envelope - Parsed websocket message envelope
   * @returns True when the event has already been seen
   */
  private trackAsyncEventAndShouldSuppressDuplicate(envelope: SocketResponse): boolean {
    if (envelope?.type !== 'async_event' || !envelope.eventId) {
      return false;
    }

    if (this.seenAsyncEventIds.has(envelope.eventId)) {
      // Refresh recency so frequently retransmitted eventIds stay protected longer.
      // This deletion and setting again makes the data recent since javascript map maintains order as well
      const previousValue = this.seenAsyncEventIds.get(envelope.eventId) || true;
      this.seenAsyncEventIds.delete(envelope.eventId);
      this.seenAsyncEventIds.set(envelope.eventId, previousValue);
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: duplicate async_event suppressed, eventId=${envelope.eventId}`
      );

      return true;
    }

    this.logger.log(
      `${MOBIUS_SOCKET_NAMESPACE}: tracking async_event, eventId=${envelope.eventId}`
    );
    this.seenAsyncEventIds.set(envelope.eventId, true);

    if (
      this.config.dedupCacheMaxSize &&
      this.seenAsyncEventIds.size > this.config.dedupCacheMaxSize
    ) {
      const oldestEventId = this.seenAsyncEventIds.keys().next().value || '';

      this.seenAsyncEventIds.delete(oldestEventId);
      this.logger.log(
        `${MOBIUS_SOCKET_NAMESPACE}: evicted oldest async_event from dedup cache, eventId=${oldestEventId}`
      );
    }

    return false;
  }

  /**
   * Handle imminent shutdown by establishing a new connection while keeping
   * the current one alive (make-before-break).
   * Idempotent: will no-op if already in progress.
   */
  private handleImminentShutdown() {
    const oldSocket = this.socket;

    try {
      if (this.shutdownSwitchoverBackoffCall) {
        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover already in progress`);

        return;
      }

      this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover start`);

      this.connectWithBackoff(undefined, {
        isShutdownSwitchover: true,
        attemptOptions: {
          isShutdownSwitchover: true,
          onSuccess: (newSocket, webSocketUrl) => {
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover connected, url: ${webSocketUrl}`
            );

            // Promote the new socket now that the switchover succeeded
            newSocket.connecting = false;
            newSocket.connected = true;
            this.socket = newSocket;
            this.connected = true;

            this.emitEvent('event:mobius_shutdown_switchover_complete', {
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
            `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover completed successfully`
          );
        })
        .catch((err) => {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover exhausted retries; will fall back to normal reconnection: `,
            err
          );
          this.emitEvent('event:mobius_shutdown_switchover_failed', {reason: err});
        });
    } catch (e) {
      this.logger.error(`${MOBIUS_SOCKET_NAMESPACE}: [shutdown] error during switchover`, e);
      this.shutdownSwitchoverBackoffCall = undefined;
      this.emitEvent('event:mobius_shutdown_switchover_failed', {reason: e});
    }
  }

  /**
   * Get the websocket URL for the currently connected socket.
   * @returns The connected websocket URL, or undefined when not connected
   */
  public getConnectedWebSocketUrl(): string | undefined {
    if (!this.socket?.connected) {
      return undefined;
    }

    return this.socket.url;
  }

  /**
   * Sends a websocket request and resolves when the matching response arrives.
   * @param payload - The websocket request payload
   * @param options - Additional request options
   * @returns Promise that resolves with the socket response
   */
  public sendWssRequest(
    payload: MobiusSocketRequestPayload,
    options: MobiusSocketRequestOptions = {}
  ): Promise<SocketResponse> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return Promise.reject(new Error('`payload` is required'));
    }

    if (!this.socket || !this.socket.connected) {
      return Promise.reject(new Error('Mobius socket is not connected'));
    }

    return this.socket.sendRequest(payload, {timeout: options.timeout});
  }

  /**
   * Check if the socket is connected.
   * @returns True if connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Connect to Mobius.
   * @param webSocketUrl - Optional websocket URL override. Falls back to the device websocket URL
   * @returns Promise that resolves when connection flow completes
   */
  public connect(webSocketUrl?: string): Promise<void> {
    if (this.connectPromise) {
      this.logger.info(
        `${MOBIUS_SOCKET_NAMESPACE}: connection already in progress, returning existing promise`
      );

      return this.connectPromise;
    }

    if (this.socket?.connected || this.socket?.connecting) {
      this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: already connected, will not connect again`);

      return Promise.resolve();
    }

    // Treat a connect() call that targets a different Mobius websocket URL
    // as a fresh initial connection for retry purposes.
    if (webSocketUrl && this.socketUrl && webSocketUrl !== this.socketUrl) {
      this.hasEverConnected = false;
    }

    // Cache the caller-provided URL for reconnect
    if (webSocketUrl) {
      this.socketUrl = webSocketUrl;
    }

    this.connecting = true;

    this.logger.info(
      `${MOBIUS_SOCKET_NAMESPACE}: starting connection attempt${
        Number(this.config.initialConnectionMaxRetries) === 0 && !this.hasEverConnected
          ? ' (initial retries disabled)'
          : ''
      }`
    );

    const connectPromise = Promise.resolve(
      this.webex.internal.device.registered || this.webex.internal.device.register?.()
    )
      .then(() => {
        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: connecting`);

        return this.connectWithBackoff(this.socketUrl);
      })
      .finally(() => {
        this.connectPromise = undefined;
      });

    this.connectPromise = connectPromise;

    return connectPromise;
  }

  /**
   * Disconnect the Mobius socket.
   * @param options - Optional websocket close options (code, reason)
   * @returns Promise that resolves after disconnect cleanup and close handling complete
   */
  public disconnect(options?: MobiusSocketCloseOptions): MobiusSocketDisconnectResult {
    this.logger.info(
      `${MOBIUS_SOCKET_NAMESPACE}#disconnect: connecting state: ${this.connecting},
       connected state: ${this.connected}, socket exists: ${!!this.socket},
       options: ${JSON.stringify(options)}`
    );

    if (this.backoffCall) {
      this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: aborting connection`);
      this.backoffCall.abort();
      this.backoffCall = undefined;
    }

    if (this.shutdownSwitchoverBackoffCall) {
      this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: aborting shutdown switchover connection`);
      this.shutdownSwitchoverBackoffCall.abort();
      this.shutdownSwitchoverBackoffCall = undefined;
    }

    this.connectPromise = undefined;
    this.seenAsyncEventIds.clear();

    if (!this.socket) {
      this.connected = false;
      this.stopTokenRefreshTimer();

      return Promise.resolve();
    }

    this.socket.removeAllListeners('message');
    this.socket.connecting = false;
    this.socket.connected = false;

    return Promise.resolve(this.socket.close(options || undefined)).finally(() => {
      this.connected = false;
      this.stopTokenRefreshTimer();
    });
  }

  private prepareUrl(webSocketUrl: string | undefined): Promise<string> {
    if (!webSocketUrl) {
      // TODO: Circle back to this logic when mobius implements the shutdown switchover
      webSocketUrl = this.webex.internal.device.webSocketUrl || '';
    }

    return Promise.resolve(webSocketUrl);
  }

  private attemptConnection(
    socketUrl: string | undefined,
    callback: (err?: Error) => void,
    options: {
      isShutdownSwitchover?: boolean;
      attemptOptions?: {
        isShutdownSwitchover?: boolean;
        onSuccess?: ((socket: ExtendedSocket, url: string) => void) | null;
      };
    } = {}
  ): Promise<void | Error> {
    const {isShutdownSwitchover = false, attemptOptions = {}} = options;
    const {onSuccess = null} = attemptOptions;

    const socket = new Socket() as ExtendedSocket;
    socket.connecting = true;
    let newWSUrl: string | undefined;

    this.attachSocketEventListeners(socket);

    const backoffCall = isShutdownSwitchover
      ? this.shutdownSwitchoverBackoffCall
      : this.backoffCall;

    // Check appropriate backoff call based on connection type
    if (!backoffCall) {
      const mode = isShutdownSwitchover ? 'switchover backoff call' : 'backoffCall';
      const msg = `${MOBIUS_SOCKET_NAMESPACE}: prevent socket open when ${mode} no longer defined`;
      const err = new Error(msg);

      this.logger.info(msg);
      // Call the callback with the error before rejecting
      callback(err);

      return Promise.reject(err);
    }

    // For shutdown switchover, don't set socket yet (make-before-break)
    // For normal connection, set socket before opening to allow disconnect() to close it
    if (!isShutdownSwitchover) {
      this.socket = socket;
    }

    return this.prepareAndOpenSocket(socket, socketUrl, isShutdownSwitchover)
      .then((webSocketUrl) => {
        newWSUrl = webSocketUrl;

        this.logger.info(
          `${MOBIUS_SOCKET_NAMESPACE}: ${
            isShutdownSwitchover ? '[shutdown] switchover' : ''
          } connected to mobius socket, success, url: ${newWSUrl}`
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
            `${MOBIUS_SOCKET_NAMESPACE}: [shutdown] switchover attempt failed`,
            reason
          );

          return callback(reason as Error);
        }

        // Normal connection error handling
        const backoffCallNormal = this.backoffCall;
        // Suppress connection errors that appear to be network related (code 1006).
        if (reason.code !== 1006 && backoffCallNormal && backoffCallNormal?.getNumRetries() > 0) {
          this.emitEvent('connection_failed', reason, {
            retries: backoffCallNormal?.getNumRetries(),
          });
        }
        this.logger.info(
          `${MOBIUS_SOCKET_NAMESPACE}: connection attempt failed`,
          reason,
          backoffCallNormal?.getNumRetries() === 0 ? reason.stack : ''
        );

        // UnknownResponse is produced by IE for any 4XXX; treat it like a bad
        // web socket url and let WDM handle the token checking
        if (reason instanceof UnknownResponse) {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: received unknown response code, refreshing device registration`
          );

          return this.webex.internal.device
            .refresh?.()
            .then(() => callback(reason as unknown as Error));
        }
        // NotAuthorized implies expired token
        if (reason instanceof NotAuthorized) {
          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: received authorization error, reauthorizing`
          );

          return this.webex.credentials
            .refresh?.({force: true})
            .then(() => callback(reason as unknown as Error));
        }
        if (reason instanceof BadRequest || reason instanceof Forbidden) {
          this.logger.warn(
            `${MOBIUS_SOCKET_NAMESPACE}: received unrecoverable response from ${MOBIUS_SOCKET_NAMESPACE}`
          );
          backoffCallNormal?.abort();

          return callback(reason as unknown as Error);
        }

        return callback(reason as unknown as Error);
      })
      .catch((reason) => {
        this.logger.error(
          `${MOBIUS_SOCKET_NAMESPACE}: failed to handle connection failure`,
          reason
        );
        callback(reason);
      });
  }

  private prepareAndOpenSocket(
    socket: ExtendedSocket,
    socketUrl: string | undefined,
    isShutdownSwitchover = false
  ): Promise<string> {
    const logPrefix = isShutdownSwitchover ? '[shutdown] switchover' : 'connection';

    return Promise.all([this.prepareUrl(socketUrl), this.webex.credentials.getUserToken()]).then(
      ([webSocketUrl, token]) => {
        let options: any = {
          forceCloseDelay: this.config.forceCloseDelay,
          wssResponseTimeout: this.config.wssResponseTimeout,
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

        // Only promote the socket reference for normal connections.
        // Shutdown switchover keeps the old socket active until the new one succeeds.
        if (!isShutdownSwitchover) {
          this.socket = socket;
        }

        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE} ${logPrefix} url: ${webSocketUrl}`);

        return socket.open(webSocketUrl, options).then(() => webSocketUrl);
      }
    );
  }

  private connectWithBackoff(
    webSocketUrl: string | undefined,
    // TODO: type for context can be moved out, it's repeated
    context: {
      isShutdownSwitchover?: boolean;
      attemptOptions?: {
        isShutdownSwitchover?: boolean;
        onSuccess?: ((socket: ExtendedSocket, url: string) => void) | null;
      };
    } = {}
  ): Promise<void> {
    const {isShutdownSwitchover = false, attemptOptions = {}} = context;

    return new Promise((resolve, reject) => {
      let call: any;
      const isInitialConnect = !isShutdownSwitchover && !this.hasEverConnected;
      const initialRetryLimit =
        this.config.initialConnectionMaxRetries == null
          ? null
          : Number(this.config.initialConnectionMaxRetries);
      const isInitialConnectWithoutRetries = isInitialConnect && initialRetryLimit === 0;

      const onComplete = (err?: Error) => {
        if (isShutdownSwitchover) {
          this.shutdownSwitchoverBackoffCall = undefined;
        } else {
          this.backoffCall = undefined;
        }

        if (err) {
          const msg = isShutdownSwitchover
            ? `[shutdown] switchover failed after ${call.getNumRetries()} retries`
            : `failed to connect after ${call.getNumRetries()} retries`;

          this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: ${msg}; ${err}`);
          // Only mutate socket flags for normal connections.
          // During shutdown switchover, this.socket is the old live socket — don't touch it.
          if (!isShutdownSwitchover && this.socket) {
            this.socket.connecting = false;
            this.socket.connected = false;
          }

          return reject(err);
        }

        // For normal connections, mark the socket as connected.
        // Shutdown switchover promotion is handled by the onSuccess callback.
        if (!isShutdownSwitchover && this.socket) {
          this.socket.connecting = false;
          this.socket.connected = true;
        }

        if (!isShutdownSwitchover) {
          this.connecting = false;
          this.connected = true;
          this.hasEverConnected = true;
          this.startTokenRefreshTimer();
          this.emitEvent('online');
        }

        return resolve();
      };
      // eslint-disable-next-line prefer-reflect
      call = backoff.call(
        (callback: (err?: Error) => void) => {
          const attemptNum = call.getNumRetries();
          const attemptLogPrefix = isShutdownSwitchover ? '[shutdown] switchover' : 'connection';

          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: executing ${attemptLogPrefix} attempt ${attemptNum}`
          );
          this.attemptConnection(webSocketUrl, callback, attemptOptions);
        },
        (err?: Error) => onComplete(err)
      );

      call.setStrategy(
        new backoff.ExponentialStrategy({
          initialDelay: this.config.backoffTimeReset,
          maxDelay: this.config.backoffTimeMax,
        })
      );

      if (isInitialConnectWithoutRetries) {
        call.retryIf(() => false);
      } else if (isInitialConnect && initialRetryLimit !== null && initialRetryLimit > 0) {
        call.failAfter(initialRetryLimit);
      } else if (this.config.maxRetries) {
        call.failAfter(this.config.maxRetries);
      }

      // Store backoff call reference BEFORE starting (so it's available in attemptConnection)
      if (isShutdownSwitchover) {
        this.shutdownSwitchoverBackoffCall = call;
      } else {
        this.backoffCall = call;
      }

      call.on('abort', () => {
        const msg = isShutdownSwitchover ? 'Shutdown Switchover' : 'Connection';

        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: ${msg} aborted`);
        reject(new Error(`MobiusSocket ${msg} Aborted`));
      });

      call.on('callback', (err?: Error) => {
        if (err) {
          if (isInitialConnectWithoutRetries) {
            this.logger.info(
              `${MOBIUS_SOCKET_NAMESPACE}: initial connect failed; retries already disabled`
            );

            return;
          }

          const number = call.getNumRetries();
          const delay = Math.min(
            call.strategy_.nextBackoffDelay_,
            this.config.backoffTimeMax || Infinity
          );

          const callbackLogPrefix = isShutdownSwitchover ? '[shutdown] switchover' : '';

          this.logger.info(
            `${MOBIUS_SOCKET_NAMESPACE}: ${callbackLogPrefix} failed to connect; attempting retry ${
              number + 1
            } in ${delay} ms`
          );
          /* istanbul ignore if */
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`${MOBIUS_SOCKET_NAMESPACE}: `, err, err.stack);
          }

          return;
        }
        this.logger.info(`${MOBIUS_SOCKET_NAMESPACE}: connected`);
      });

      call.start();
    });
  }

  /**
   * Safely emits an event, catching and logging any errors from event handlers.
   * @param eventName - The name of the event to emit
   * @param args - Arguments to pass to event handlers
   */
  private emitEvent(eventName: string, ...args: unknown[]): void {
    try {
      if (!eventName) {
        return;
      }

      this.emit(eventName, ...args);
    } catch (error) {
      // Safely handle errors without causing additional issues during cleanup
      this.logger.error(
        `${MOBIUS_SOCKET_NAMESPACE}: error occurred in event handler:`,
        error,
        ' with args: ',
        [eventName, ...args]
      );
    }
  }

  /**
   * Starts a periodic timer to refresh the authentication token.
   * Token refresh occurs every hour while connected.
   */
  private startTokenRefreshTimer() {
    if (this.tokenRefreshTimer || !this.connected) {
      return;
    }

    this.tokenRefreshTimer = setInterval(() => {
      this.refreshToken().catch((error) => {
        this.logger.error(`${MOBIUS_SOCKET_NAMESPACE}: periodic token refresh failed`, error);
      });
    }, TOKEN_REFRESH_INTERVAL_MS);
  }

  /**
   * Stops the periodic token refresh timer.
   */
  private stopTokenRefreshTimer() {
    if (!this.tokenRefreshTimer) {
      return;
    }

    clearInterval(this.tokenRefreshTimer);
    this.tokenRefreshTimer = undefined;
  }

  /**
   * Refreshes the authentication token and re-authenticates the socket connection.
   * @returns Promise that resolves when token refresh and re-authentication complete
   */
  private refreshToken(): Promise<unknown> {
    if (this.tokenRefreshInFlight) {
      return this.tokenRefreshInFlight;
    }

    if (!this.connected) {
      this.stopTokenRefreshTimer();

      return Promise.resolve();
    }

    const tokenPromise = this.webex.credentials.canRefresh
      ? this.webex.credentials
          .refresh?.({force: true})
          ?.then(() => this.webex.credentials.getUserToken())
      : this.webex.credentials.getUserToken();

    this.tokenRefreshInFlight = tokenPromise!
      .then((token) => {
        if (!token) {
          throw new Error('Mobius token refresh did not return a token');
        }
        const refreshedToken = normalizeMobiusAuthToken(token.toString());

        if (!this.socket?.connected) {
          this.logger.warn(
            `${MOBIUS_SOCKET_NAMESPACE}: socket is not connected, skipping token refresh`
          );

          return undefined;
        }

        return this.socket!.refresh(refreshedToken);
      })
      .catch((error) => {
        this.logger.error(
          `${MOBIUS_SOCKET_NAMESPACE}: failed to refresh/re-auth Mobius socket`,
          error
        );

        throw error;
      })
      .finally(() => {
        this.tokenRefreshInFlight = undefined;
      });

    return this.tokenRefreshInFlight;
  }

  private async onclose(event: SocketCloseEvent, sourceSocket: ExtendedSocket): Promise<void> {
    const loggerContext = {
      file: 'mobius-socket.ts',
      method: 'onclose',
    };

    try {
      const reason = event.reason && event.reason.toLowerCase();
      let socketUrl: string | undefined;

      const isActiveSocket = sourceSocket === this.socket;
      if (sourceSocket) {
        socketUrl = sourceSocket.url;
      }

      // Only tear down state if the currently active socket closed
      if (isActiveSocket) {
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket = undefined;
          this.emitEvent('offline', event);
        }
        this.connecting = false;
        this.connected = false;
        this.stopTokenRefreshTimer();
      } else {
        // Old socket closed; do not flip connection state
        this.logger.info(`[shutdown] non-active socket closed, code=${event.code}`, loggerContext);
        // Clean up listeners from old socket now that it's closed
        if (sourceSocket) {
          sourceSocket.removeAllListeners();
        }
      }

      switch (event.code) {
        case 1003:
          this.logger.info(
            `service rejected last message; will not reconnect: ${event.reason}`,
            loggerContext
          );
          if (isActiveSocket) this.emitEvent('offline.permanent', event);
          break;
        case 4000:
          this.logger.info(`socket replaced; will not reconnect`, loggerContext);
          if (isActiveSocket) this.emitEvent('offline.replaced', event);
          break;
        case 4001:
          // Handle the same way we do for registration.down event from Mobius.
          this.logger.info(`socket closed with 4001; will not reconnect`, loggerContext);
          this.emitEvent('event:async_event', MOBIUS_SOCKET_4001_EVENT);
          // 4001 means the socket is offline and will not reconnect, so surface a
          // permanent disconnect to connection-lifecycle listeners (which only observe
          // the suffixed offline.* events) in addition to the registration.down signal.
          if (isActiveSocket) this.emitEvent('offline.permanent', event);
          break;
        case 1000:
        case 1001:
          this.logger.info(`socket disconnected; ${event.reason}`, loggerContext);
          if (isActiveSocket) this.emitEvent('offline.permanent', event);
          break;
        case 1005:
        case 1006:
        case 1011:
        case 1012:
          this.logger.info(`socket disconnected; reconnecting`, loggerContext);
          if (isActiveSocket) {
            this.emitEvent('offline.transient', event);
            this.reconnect(socketUrl);
          }
          break;
        case 3050:
          if (reason && normalReconnectReasons.includes(reason)) {
            this.logger.info(`socket disconnected; reconnecting`, loggerContext);
            if (isActiveSocket) {
              this.emitEvent('offline.transient', event);
              this.reconnect(socketUrl);
            }
          } else {
            this.logger.info(
              `socket disconnected; will not reconnect: ${event.reason}`,
              loggerContext
            );
            if (isActiveSocket) this.emitEvent('offline.permanent', event);
          }
          break;
        case 4401:
        case 4403:
        case 4404:
          this.logger.error(`onclose, statusCode=${event.code}`, loggerContext);
          await this.refreshToken().catch((error) => {
            this.logger.error(`${MOBIUS_SOCKET_NAMESPACE}: periodic token refresh failed`, error);
          });
          await this.reconnect(this.socket?.url);
          break;
        case 4429:
          // Too many requests: the socket is torn down and not auto-reconnected, so surface
          // a permanent disconnect to connection-lifecycle listeners (which only observe the
          // suffixed offline.* events) instead of leaving them unaware of the close.
          // Silently ignore (do not attempt reconnect)
          this.logger.error(`too many requests, statusCode=${event.code}`, loggerContext);
          if (isActiveSocket) this.emitEvent('offline.permanent', event);
          break;
        default:
          this.logger.info(`socket disconnected unexpectedly; will not reconnect`, loggerContext);
          if (isActiveSocket) this.emitEvent('offline.permanent', event);
      }
    } catch (error) {
      this.logger.error(`error occurred in close handler`, error, loggerContext);
    }
  }

  private onmessage(event: SocketMessageEvent<SocketResponse>): Promise<void> {
    const loggerContext = {
      file: 'mobius-socket.ts',
      method: 'onmessage',
    };

    const envelope = event.data;

    this.logger.debug(`message envelope: `, envelope, loggerContext);

    // Handle shutdown message shape: { type: 'shutdown' }
    if (envelope && envelope.type === 'shutdown') {
      this.logger.info(`[shutdown] imminent shutdown message received`, loggerContext);
      this.emitEvent('event:mobius_shutdown_imminent', envelope); // This is not yet not implemented, keeping for future support

      this.handleImminentShutdown();

      return Promise.resolve();
    }

    if (this.trackAsyncEventAndShouldSuppressDuplicate(envelope)) {
      return Promise.resolve();
    }

    // Emit event:<type> for typed messages (e.g., register.response)
    if (envelope.type) {
      this.emitEvent(`event:${envelope.type}`, envelope);
    }

    // Use data/payload if present, otherwise treat the envelope itself as the data (flat format)
    const data: SocketResponse = (envelope.data as SocketResponse) || envelope;

    // Support both Mobius-enveloped (data.eventType) and flat (eventType) formats
    const eventType: string | undefined =
      (data?.eventType as string) || (envelope.eventType as string);

    if (!eventType) {
      this.emitEvent('event', envelope);

      return Promise.resolve();
    }

    try {
      // TODO: Remove if event:namespace is not required
      this.emitEvent('event', envelope);
      const [namespace] = eventType.split('.');
      this.emitEvent(`event:${namespace}`, envelope);

      if (namespace !== eventType) {
        this.emitEvent(`event:${eventType}`, envelope);
      }
    } catch (reason) {
      this.logger.error(`error occurred processing socket message`, reason, loggerContext);
    }

    return Promise.resolve();
  }

  private reconnect(webSocketUrl: string | undefined): Promise<void> {
    this.logger.info(`reconnecting`, {file: 'mobius-socket.ts', method: 'reconnect'});

    return this.connect(webSocketUrl || this.socketUrl);
  }
}

export default MobiusSocket;
