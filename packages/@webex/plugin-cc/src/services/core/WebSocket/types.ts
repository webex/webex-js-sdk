import {WebSocketManager} from './WebSocketManager';

export type ConnectionServiceOptions = {
  webSocketManager: WebSocketManager;
  onReRegister: () => Promise<void>;
};

export type ConnectionLostDetails = {
  isConnectionLost: boolean;
  isRestoreFailed: boolean;
  isSocketReconnected: boolean;
  isKeepAlive: boolean;
};

export type ConnectionProp = {
  lostConnectionRecoveryTimeout: number;
};
