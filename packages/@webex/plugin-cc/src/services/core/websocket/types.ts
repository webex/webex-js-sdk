import {SubscribeRequest} from '../../../types';
import {WebSocketManager} from './WebSocketManager';

export type ConnectionServiceOptions = {
  webSocketManager: WebSocketManager;
  subscribeRequest: SubscribeRequest;
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
