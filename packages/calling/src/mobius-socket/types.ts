import type {SocketCloseEvent, SocketResponse} from './socket/types';

/**
 * Options for closing a Mobius socket connection.
 */
export type MobiusSocketCloseOptions = {
  /** WebSocket close code */
  code?: number;
  /** Human-readable close reason */
  reason?: string;
};

/**
 * Payload for a Mobius websocket request.
 */
export type MobiusSocketRequestPayload = SocketResponse & {
  /** Unique tracking ID for correlating request/response */
  trackingId: string;
  /** Request type identifier */
  type: string;
};

/**
 * Options for configuring a Mobius websocket request.
 */
export type MobiusSocketRequestOptions = {
  /** Request timeout in milliseconds */
  timeout?: number;
};

/**
 * Error type for Mobius websocket response failures.
 */
export type MobiusSocketResponseError = Error & {
  /** Error name identifier */
  name: 'MobiusSocketResponseError';
  /** Original socket response that triggered the error */
  response?: SocketResponse;
  /** HTTP-style status code */
  statusCode?: number;
  /** Human-readable status message */
  statusMessage?: string;
  /** Tracking ID of the failed request */
  trackingId?: string;
};

/**
 * Result type for Mobius socket disconnect operations.
 */
export type MobiusSocketDisconnectResult = Promise<void | SocketCloseEvent>;
