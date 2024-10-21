import {WebSocketEvent} from '../types';

interface IWebSocket {
  on(event: string, callback: (event: WebSocketEvent) => void): void;
  off(event: string, callback: (event: WebSocketEvent) => void): void;
  subscribeAndConnect(params: {datachannelUrl: string; body: object}): Promise<void>;
  isConnected(): boolean;
  disconnectWebSocket(): Promise<void>;
  getSubscriptionId(): string | undefined;
  getDatachannelUrl(): string | undefined;
}

export default IWebSocket;
