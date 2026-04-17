import {WebexRequestPayload} from '../../common/types';
import {WebexSDK} from '../../SDKConnector/types';

/**
 * Configuration for APIRequest class
 */
export interface APIRequestConfig {
  /**
   * Interim SDK opt-in for Mobius WebSocket transport when WDM
   * `webrtc-calling-over-ws` is not yet true (until prod rollout).
   */
  isMobiusSocketEnabled?: boolean;
  /** Webex SDK instance for making requests */
  webex: WebexSDK;
}

/**
 * Request options for makeRequest method (alias for compatibility)
 */
export type APIRequestOptions = WebexRequestPayload;

/**
 * Request options for Mobius WebSocket requests
 */
export interface MobiusSocketRequestOptions {
  /** Request type (typically HTTP method like GET, POST, etc.) */
  type: string;
  /** Unique tracking ID for the request */
  trackingId: string;
  /** Optional metadata (uri, service, headers, etc.) */
  metadata?: Record<string, unknown>;
  /** Optional request payload/body */
  payload?: unknown;
}

/**
 * Response structure for Mobius WebSocket requests
 */
export type MobiusSocketResponse = {
  type: string;
  trackingId: string;
  status: {
    code: number;
    message: string;
  };
  metadata?: Record<string, unknown>;
  payload?: unknown;
};
