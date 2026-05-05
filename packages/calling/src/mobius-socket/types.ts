import type {SocketCloseEvent, SocketResponse} from './socket/types';

export type MobiusSocketCloseOptions = {
  code?: number;
  reason?: string;
};

export type MobiusSocketRequestPayload = SocketResponse & {
  trackingId: string;
  type: string;
};

export type MobiusSocketRequestOptions = {
  timeout?: number;
};

export type MobiusSocketResponseError = Error & {
  name: 'MobiusSocketResponseError';
  response?: SocketResponse;
  statusCode?: number;
  statusMessage?: string;
  trackingId?: string;
};

export type MobiusSocketDisconnectResult = Promise<void | SocketCloseEvent>;
