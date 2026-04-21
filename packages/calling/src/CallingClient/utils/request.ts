import {v4 as uuid} from 'uuid';
// @ts-ignore - JS module without type declarations
import {getMobiusSocketInstance} from '@webex/internal-plugin-mobius-socket';
import {WebexRequestPayload} from '../../common/types';
import {WebexSDK} from '../../SDKConnector/types';
import log from '../../Logger';
import {APIRequestConfig, APIRequestOptions, MobiusSocketResponse} from './types';
import {deriveMobiusSocketMessageType} from './mobiusSocketMapper';
import {MOBIUS_SOCKET_MESSAGE_TYPE} from './constants';
import {isWsFeatureEnabled} from './wsFeatureFlag';
import {METHODS, REQUEST_FILE} from '../constants';

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
    if (!config.webex) {
      throw new Error('WebexSDK instance is required');
    }

    this.webex = config.webex;
    this.isMobiusSocketEnabled =
      isWsFeatureEnabled(config.webex) || (config.isMobiusSocketEnabled ?? false);
    this.mobiusSocket = getMobiusSocketInstance(this.webex);
  }

  /**
   * Whether the Mobius WebSocket transport is active for this instance.
   */
  public isSocketEnabled(): boolean {
    return this.isMobiusSocketEnabled;
  }

  /**
   * Ensures the Mobius WebSocket is connected before sending API requests.
   * If the socket is already connected, resolves immediately. Otherwise,
   * initiates a new connection to the provided WebSocket URL.
   * On failure, throws a normalized WebexRequestPayload-shaped error.
   *
   * @param wssUrl - The Mobius WebSocket URL to connect to.
   */
  public async connectToMobiusSocket(wssUrl: string): Promise<void> {
    const logContext = {
      file: REQUEST_FILE,
      method: METHODS.CONNECT_TO_MOBIUS_SOCKET,
    };

    if (this.mobiusSocket.isConnected()) {
      log.info('Mobius WebSocket already connected', logContext);

      return;
    }

    log.info('Mobius WebSocket not connected, initiating connection', logContext);

    try {
      await this.mobiusSocket.connect(wssUrl);
      log.log('Mobius WebSocket connected successfully', logContext);
    } catch (err) {
      log.warn(`Mobius WebSocket connection failed: ${String(err)}`, logContext);
      throw normalizeWsError(err);
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
    if (this.isMobiusSocketEnabled) {
      const trackingId = `webex-js-sdk_${uuid()}`;
      const socketType = deriveMobiusSocketMessageType(request.uri, request.method);

      if (socketType === MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN) {
        throw new Error(`Unknown Mobius Socket message type: ${socketType}`);
      }

      try {
        const wsResponse: MobiusSocketResponse = await this.mobiusSocket.sendWssRequest({
          type: socketType,
          trackingId,
          metadata: {
            // userAgent: CALLING_USER_AGENT,
            userAgent: 'mobius-ws-test-ui', // TODO: Confirm if this needs to be hardcoded
          }, // TODO: Add auth token to metadata for call transfer etc
          data: request.body,
        });

        return normalizeWsResponse(wsResponse);
      } catch (err) {
        throw normalizeWsError(err);
      }
    }

    return this.webex.request(request) as Promise<WebexRequestPayload>;
  }
}

/**
 * Factory function to create a singleton APIRequest instance
 * @param config - Configuration object for APIRequest
 * @returns APIRequest instance
 */
export const createAPIRequest = (config: APIRequestConfig): APIRequest =>
  APIRequest.getInstance(config);
