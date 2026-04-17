import {v4 as uuid} from 'uuid';
// @ts-ignore - JS module without type declarations
import {getMobiusSocketInstance} from '@webex/internal-plugin-mobius-socket';
import {WebexRequestPayload} from '../../common/types';
import {WebexSDK} from '../../SDKConnector/types';
import {APIRequestConfig, APIRequestOptions, MobiusSocketResponse} from './types';
import {deriveMobiusSocketMessageType} from './mobiusSocketMapper';
import {MOBIUS_SOCKET_MESSAGE_TYPE} from './constants';
import {isWsFeatureEnabled} from './wsFeatureFlag';

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
   * Makes a request using HTTP or WebSocket transport per the flag set in the constructor.
   * @param request - Request options (uri, method, body, headers, service)
   * @returns Promise resolving to WebexRequestPayload or MobiusSocketResponse
   */
  public async makeRequest(
    request: APIRequestOptions
  ): Promise<WebexRequestPayload | MobiusSocketResponse> {
    if (this.isMobiusSocketEnabled) {
      const trackingId = `webex-js-sdk_${uuid()}`;
      const socketType = deriveMobiusSocketMessageType(request.uri, request.method);

      if (socketType === MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN) {
        throw new Error(`Unknown Mobius Socket message type: ${socketType}`);
      }

      return this.mobiusSocket.sendWssRequest({
        type: socketType,
        trackingId,
        metadata: {
          // userAgent: CALLING_USER_AGENT,
          userAgent: 'mobius-ws-test-ui', // TODO: Confirm if this needs to be hardcoded
        }, // TODO: Add auth token to metadata for call transfer etc
        data: request.body,
      });
    }

    return this.webex.request(request);
  }
}

/**
 * Factory function to create a singleton APIRequest instance
 * @param config - Configuration object for APIRequest
 * @returns APIRequest instance
 */
export const createAPIRequest = (config: APIRequestConfig): APIRequest =>
  APIRequest.getInstance(config);
