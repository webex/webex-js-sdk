import {v4 as uuid} from 'uuid';
// @ts-ignore - JS module without type declarations
import {getMobiusSocketInstance} from '@webex/internal-plugin-mobius-socket';
import {WebexRequestPayload} from '../../common/types';
import {WebexSDK} from '../../SDKConnector/types';
import {APIRequestConfig, APIRequestOptions, MobiusSocketResponse} from './types';
import {deriveMobiusSocketMessageType} from './mobiusSocketMapper';
import {MOBIUS_SOCKET_MESSAGE_TYPE} from './constants';

/**
 * APIRequest class provides a unified interface for making requests
 * that can be routed through either HTTP (webex.request) or WebSocket
 * (mobiusSocketRequest) based on configuration.
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
   * Creates an instance of APIRequest
   * @param config - Configuration object containing webex instance and optional socket flag
   */
  constructor(config: APIRequestConfig) {
    if (!config.webex) {
      throw new Error('WebexSDK instance is required');
    }

    this.webex = config.webex;
    this.mobiusSocket = getMobiusSocketInstance(this.webex);

    // TODO: Update this once feature flag is implemented
    // this.isMobiusSocketEnabled = config.isMobiusSocketEnabled ?? false;
    this.isMobiusSocketEnabled = config.isMobiusSocketEnabled ?? true;
  }

  /**
   * Makes a request using either HTTP or WebSocket transport based on configuration
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
