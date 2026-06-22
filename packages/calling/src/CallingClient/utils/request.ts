import {v4 as uuid} from 'uuid';
import {getMobiusSocketInstance} from '../../mobius-socket';
import {WebexRequestPayload} from '../../common/types';
import {WebexSDK} from '../../SDKConnector/types';
import log from '../../Logger';
import {
  APIRequestConfig,
  APIRequestOptions,
  MobiusAsyncEvent,
  MobiusSocketConnectionListener,
  MobiusSocketResponse,
} from './types';
import {
  deriveMobiusSocketMessageType,
  isSupplementaryServiceMessageType,
} from './mobiusSocketMapper';
import {MOBIUS_SOCKET_DISCONNECT_REASON, MOBIUS_SOCKET_MESSAGE_TYPE} from './constants';
import {isMobiusWssEnabled} from './wsFeatureFlag';
import {CALLING_USER_AGENT, METHODS, REQUEST_FILE} from '../constants';
import {getMetricManager} from '../../Metrics';
import {IMetricManager, METRIC_EVENT, METRIC_TYPE, MOBIUS_SOCKET_ACTION} from '../../Metrics/types';

/**
 * Converts a MobiusSocketResponse into the WebexRequestPayload shape that
 * all callers (registration, call, keepalive error-handlers) expect.
 */
function normalizeWsResponse(wsResponse: MobiusSocketResponse): WebexRequestPayload {
  return {
    statusCode: wsResponse.statusCode,
    body: (wsResponse.data as object) ?? undefined,
    headers: {
      trackingid: wsResponse.trackingId,
      ...((wsResponse.metadata as Record<string, string>) ?? {}),
    },
  };
}

/**
 * Converts a MobiusSocketResponseError rejection into a WebexRequestPayload-shaped
 * error so handleRegistrationErrors / handleCallErrors can process it identically.
 */
function normalizeWsError(err: unknown): WebexRequestPayload {
  const wsErr = err as {
    statusCode?: number;
    statusMessage?: string;
    response?: MobiusSocketResponse;
    trackingId?: string;
  };

  return {
    statusCode: wsErr.statusCode,
    body: (wsErr.response?.data as object) ?? undefined,
    headers: {
      trackingid: wsErr.trackingId ?? wsErr.response?.trackingId ?? '',
      ...((wsErr.response?.metadata as Record<string, string>) ?? {}),
    },
  };
}

/**
 * APIRequest routes Mobius traffic over HTTP (`webex.request`) or the Mobius WebSocket path
 * (`mobiusSocketRequest`). `isMobiusSocketEnabled` is set in the constructor from WDM
 * `webrtc-calling-over-ws` and/or SDK config (interim until WDM is fully in prod).
 */
export class APIRequest {
  // eslint-disable-next-line no-use-before-define
  private static instance: APIRequest | undefined;
  private isMobiusSocketEnabled: boolean;
  private webex: WebexSDK;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mobiusSocket: any;
  private metricManager: IMetricManager;

  static getInstance(config: APIRequestConfig): APIRequest {
    if (!APIRequest.instance) {
      APIRequest.instance = new APIRequest(config);
    }

    return APIRequest.instance;
  }

  static resetInstance(): void {
    APIRequest.instance = undefined;
  }

  /**
   * @param config - Webex instance plus optional SDK Mobius-socket override
   */
  constructor(config: APIRequestConfig) {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.CONSTRUCTOR,
    };

    if (!config.webex) {
      log.error('APIRequest instantiation failed: WebexSDK instance is required', logContext);
      throw new Error('WebexSDK instance is required');
    }

    this.webex = config.webex;
    this.isMobiusSocketEnabled = isMobiusWssEnabled(config.webex) || false;
    this.mobiusSocket = getMobiusSocketInstance(this.webex);
    this.metricManager = getMetricManager(this.webex);

    log.info(
      `APIRequest initialized with transport: ${this.isMobiusSocketEnabled ? 'WSS' : 'HTTP'}`,
      logContext
    );
  }

  /**
   * Whether the Mobius WebSocket transport is active for this instance.
   */
  public isSocketEnabled(): boolean {
    return this.isMobiusSocketEnabled;
  }

  /**
   * Overrides the active Mobius transport for subsequent requests.
   *
   * The constructor seeds this from the `webrtc-calling-over-ws` feature flag, but
   * registration may need to fall back to HTTP for a Mobius server group that has no
   * WSS URL (even while the feature is enabled). Toggling this keeps all transport-gated
   * paths (connect, teardown, makeRequest) consistent for the group being registered.
   *
   * @param enabled - `true` to route over the Mobius WebSocket, `false` for HTTP.
   */
  public setSocketEnabled(enabled: boolean): void {
    this.isMobiusSocketEnabled = enabled;

    log.info(`APIRequest transport set to: ${enabled ? 'WSS' : 'HTTP'}`, {
      file: REQUEST_FILE,
      method: METHODS.SET_SOCKET_ENABLED,
    });
  }

  /**
   * Ensures the Mobius WebSocket is connected before sending API requests.
   * If the socket is already connected, resolves immediately. Otherwise,
   * initiates a new connection to the provided WebSocket URL.
   * On failure, throws a normalized WebexRequestPayload-shaped error.
   *
   * @param wssUrl - The Mobius WebSocket URL to connect to.
   */
  public async connectToMobiusSocket(wssUrl: string): Promise<string | undefined> {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.CONNECT_TO_MOBIUS_SOCKET,
    };

    if (this.mobiusSocket.isConnected()) {
      log.info('Mobius WebSocket already connected', logContext);

      return this.mobiusSocket.getConnectedWebSocketUrl();
    }

    log.info('Mobius WebSocket not connected, initiating connection', logContext);

    try {
      await this.mobiusSocket.connect(wssUrl);
      log.log('Mobius WebSocket connected successfully', logContext);

      this.metricManager?.submitMobiusSocketMetric(
        METRIC_EVENT.MOBIUS_SOCKET,
        MOBIUS_SOCKET_ACTION.CONNECT,
        METRIC_TYPE.BEHAVIORAL,
        wssUrl
      );

      return wssUrl;
    } catch (err) {
      log.warn(`Mobius WebSocket connection failed: ${String(err)}`, logContext);

      this.metricManager?.submitMobiusSocketMetric(
        METRIC_EVENT.MOBIUS_SOCKET_ERROR,
        MOBIUS_SOCKET_ACTION.CONNECT,
        METRIC_TYPE.BEHAVIORAL,
        wssUrl,
        undefined,
        String(err)
      );

      throw normalizeWsError(err);
    }
  }

  public getConnectedWebSocketUrl() {
    return this.mobiusSocket.getConnectedWebSocketUrl();
  }

  /**
   * Disconnects the default session from the Mobius WebSocket.
   */
  public async disconnectFromMobiusSocket(options?: {code: number; reason: string}): Promise<void> {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.DISCONNECT_FROM_MOBIUS_SOCKET,
    };

    log.info('Disconnecting from Mobius WebSocket', logContext);

    const wssUrl = this.mobiusSocket.getConnectedWebSocketUrl();

    try {
      await this.mobiusSocket.disconnect(options);
      log.log('Mobius WebSocket disconnected successfully', logContext);

      this.metricManager?.submitMobiusSocketMetric(
        METRIC_EVENT.MOBIUS_SOCKET,
        MOBIUS_SOCKET_ACTION.DISCONNECT,
        METRIC_TYPE.BEHAVIORAL,
        wssUrl
      );
    } catch (err) {
      // silent error - no need to throw an error
      log.warn(`Mobius WebSocket disconnection failed: ${String(err)}`, logContext);

      this.metricManager?.submitMobiusSocketMetric(
        METRIC_EVENT.MOBIUS_SOCKET_ERROR,
        MOBIUS_SOCKET_ACTION.DISCONNECT,
        METRIC_TYPE.BEHAVIORAL,
        wssUrl,
        undefined, // add trackingId
        String(err)
      );
    }
  }

  /**
   * Makes a request using HTTP or WebSocket transport per the flag set in the constructor.
   * When using WebSocket, the response is normalized to the WebexRequestPayload shape
   * so callers do not need to know which transport was used.
   * @param request - Request options (uri, method, body, headers, service)
   * @returns Promise resolving to WebexRequestPayload
   */
  public async makeRequest(request: APIRequestOptions): Promise<WebexRequestPayload> {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.MAKE_REQUEST,
    };
    log.info(`Dispatching request via ${this.isMobiusSocketEnabled ? 'WSS' : 'HTTP'} `, logContext);

    if (this.isMobiusSocketEnabled) {
      const trackingId = `webex-js-sdk_${uuid()}`;
      const socketType = deriveMobiusSocketMessageType(request.uri, request.method);

      if (socketType === MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN) {
        log.error(
          `Unknown Mobius Socket message type for uri: ${request.uri}, httpMethod: ${request.method}`,
          logContext
        );
        throw new Error(`Unknown Mobius Socket message type: ${socketType}`);
      }

      const isSupplementaryService = isSupplementaryServiceMessageType(socketType);

      try {
        const wsResponse: MobiusSocketResponse = await this.mobiusSocket.sendWssRequest({
          type: socketType,
          trackingId,
          metadata: {
            ...request.headers,
            userAgent: CALLING_USER_AGENT,
            authorization: `${
              (isSupplementaryService && (await this.webex.credentials.getUserToken())) || ''
            }`,
          },
          data: request.body,
        });

        log.log(
          `WSS request succeeded - socketType: ${socketType}, trackingId: ${trackingId}, statusCode: ${wsResponse.statusCode}`,
          logContext
        );

        return normalizeWsResponse(wsResponse);
      } catch (err) {
        log.error(
          `WSS request failed - socketType: ${socketType}, trackingId: ${trackingId}, error: ${String(
            err
          )}`,
          logContext
        );
        throw normalizeWsError(err);
      }
    }

    return this.webex.request(request) as Promise<WebexRequestPayload>;
  }

  public registerMobiusSocketListener(cb: (data?: MobiusAsyncEvent) => void): void {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.REGISTER_MOBIUS_SOCKET_LISTENER,
    };

    log.info('Attaching Mobius async event listener', logContext);

    this.mobiusSocket.on('event:async_event', (data: MobiusAsyncEvent) => {
      log.trace(
        `Mobius async event received - eventType: ${data?.data?.eventType ?? 'unknown'}`,
        logContext
      );
      cb(data);
    });

    log.log('Mobius async event listener attached', logContext);

    this.metricManager?.submitMobiusSocketMetric(
      METRIC_EVENT.MOBIUS_SOCKET,
      MOBIUS_SOCKET_ACTION.LISTENER_REGISTERED,
      METRIC_TYPE.BEHAVIORAL
    );
  }

  public unregisterMobiusSocketListener(): void {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.UNREGISTER_MOBIUS_SOCKET_LISTENER,
    };

    log.info('Detaching Mobius async event listener', logContext);
    this.mobiusSocket.off('event:async_event');
    log.log('Mobius async event listener detached', logContext);

    this.metricManager?.submitMobiusSocketMetric(
      METRIC_EVENT.MOBIUS_SOCKET,
      MOBIUS_SOCKET_ACTION.LISTENER_UNREGISTERED,
      METRIC_TYPE.BEHAVIORAL
    );
  }

  /**
   * Bridges the underlying Mobius socket connect/disconnect lifecycle to the caller.
   * The socket emits `online` on every successful (re)connect and `offline.*` on close,
   * where the suffix distinguishes the disconnect reason.
   *
   * @param listener - Callbacks invoked on connect and disconnect transitions.
   */
  public registerMobiusSocketConnectionListener(listener: MobiusSocketConnectionListener): void {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.REGISTER_MOBIUS_SOCKET_CONNECTION_LISTENER,
    };

    log.info('Attaching Mobius socket connection listener', logContext);

    this.mobiusSocket.on('online', () => {
      log.log('Mobius socket connected', logContext);
      listener.onConnected();
    });

    this.mobiusSocket.on('offline.permanent', () => {
      log.log('Mobius socket disconnected (permanent)', logContext);
      listener.onDisconnected(MOBIUS_SOCKET_DISCONNECT_REASON.PERMANENT);
    });

    this.mobiusSocket.on('offline.transient', () => {
      log.log('Mobius socket disconnected (transient)', logContext);
      listener.onDisconnected(MOBIUS_SOCKET_DISCONNECT_REASON.TRANSIENT);
    });

    this.mobiusSocket.on('offline.replaced', () => {
      log.log('Mobius socket disconnected (replaced)', logContext);
      listener.onDisconnected(MOBIUS_SOCKET_DISCONNECT_REASON.REPLACED);
    });

    log.log('Mobius socket connection listener attached', logContext);
  }

  /**
   * Whether the underlying Mobius WebSocket is currently connected.
   *
   * Useful for consumers that subscribe to connection events after the socket may
   * already be up (the socket only emits `online` on a fresh (re)connect), so they
   * can reconcile the initial connected state instead of waiting for the next event.
   */
  public isSocketConnected(): boolean {
    return this.mobiusSocket.isConnected();
  }

  public unregisterMobiusSocketConnectionListener(): void {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.UNREGISTER_MOBIUS_SOCKET_CONNECTION_LISTENER,
    };

    log.info('Detaching Mobius socket connection listener', logContext);
    this.mobiusSocket.off('online');
    this.mobiusSocket.off('offline.permanent');
    this.mobiusSocket.off('offline.transient');
    this.mobiusSocket.off('offline.replaced');
    log.log('Mobius socket connection listener detached', logContext);
  }
}

/**
 * Factory function to create a singleton APIRequest instance
 * @param config - Configuration object for APIRequest
 * @returns APIRequest instance
 */
export const createAPIRequest = (config: APIRequestConfig): APIRequest =>
  APIRequest.getInstance(config);
