import {MobiusCallData, MobiusRegistrationDownData} from '../calling/types';
import {WebexRequestPayload} from '../../common/types';
import {WebexSDK} from '../../SDKConnector/types';
import {MOBIUS_SOCKET_DISCONNECT_REASON} from './constants';

/**
 * Configuration for APIRequest class
 */
export interface APIRequestConfig {
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
  /** Optional request data/body */
  data?: unknown;
}

/**
 * Response structure for Mobius WebSocket requests
 */
export type MobiusSocketResponse = {
  type: string;
  trackingId: string;
  statusCode: number;
  statusMessage: string;
  metadata?: Record<string, unknown>;
  data?: unknown;
};

/**
 * Function signature for MobiusSocket.sendWssRequest.
 * Sends a websocket request data and resolves when the matching response arrives.
 */
export type SendWssRequestFn = (
  data: MobiusSocketRequestOptions,
  options?: Record<string, unknown>
) => Promise<MobiusSocketResponse>;

export type MobiusAsyncEvent = {
  type: string;
  eventId: string;
  trackingId: string;
  data: MobiusCallData | MobiusRegistrationDownData;
};

/**
 * Callbacks invoked when the Mobius WebSocket connects or disconnects.
 */
export type MobiusSocketConnectionListener = {
  onConnected: () => void;
  onDisconnected: (reason: MOBIUS_SOCKET_DISCONNECT_REASON) => void;
};
