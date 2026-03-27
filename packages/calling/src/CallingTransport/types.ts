import {WebexRequestPayload} from '../common/types';
import {WebexSDK} from '../SDKConnector/types';

export type CallingTransportEventHandler<T = unknown> = (data: T) => void;

export enum CallingTransportConnectionSource {
  MERCURY = 'mercury',
  MOBIUS = 'mobius',
}

export enum CallingTransportConnectionState {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

export type CallingTransportConnectionStateChangeEvent = {
  source: CallingTransportConnectionSource;
  state: CallingTransportConnectionState;
};
export type CallingTransportConnectionStateChangeHandler = (
  event: CallingTransportConnectionStateChangeEvent
) => void;

export interface ICallingTransportAdapter {
  request<T>(webex: WebexSDK, request: WebexRequestPayload): Promise<T>;
  on<T>(webex: WebexSDK, event: string, handler: CallingTransportEventHandler<T>): void;
  off<T>(webex: WebexSDK, event: string, handler?: CallingTransportEventHandler<T>): void;
  dispose?(webex: WebexSDK): Promise<void> | void;
  onConnectionStateChange(
    webex: WebexSDK,
    handler: CallingTransportConnectionStateChangeHandler
  ): void;
  offConnectionStateChange(webex: WebexSDK): void;
}

export interface ICallingTransport {
  setAdapter(adapter: ICallingTransportAdapter): void;
  request<T>(request: WebexRequestPayload): Promise<T>;
  on<T>(event: string, handler: CallingTransportEventHandler<T>): void;
  off<T>(event: string, handler?: CallingTransportEventHandler<T>): void;
  onConnectionStateChange(handler: CallingTransportConnectionStateChangeHandler): void;
  offConnectionStateChange(): void;
}
