import {WebSocketManager} from './WebSocketManager';
import {SubscribeRequest} from '../../../types';
import LoggerProxy from '../../../logger-proxy';
import {
  LOST_CONNECTION_RECOVERY_TIMEOUT,
  WS_DISCONNECT_ALLOWED,
  CONNECTIVITY_CHECK_INTERVAL,
} from '../constants';

type ConnectionLostDetails = {
  isConnectionLost: boolean;
  isRestoreFailed: boolean;
  isSocketReconnected: boolean;
  isKeepAlive: boolean;
};

type ConnectionProp = {
  lostConnectionRecoveryTimeout: number;
};

export class ConnectionService extends EventTarget {
  private connectionProp: ConnectionProp = {
    lostConnectionRecoveryTimeout: LOST_CONNECTION_RECOVERY_TIMEOUT,
  };

  private wsDisconnectAllowed = WS_DISCONNECT_ALLOWED;
  private reconnectingTimer: ReturnType<typeof setTimeout>;
  private restoreTimer: ReturnType<typeof setTimeout>;
  private isConnectionLost: boolean;
  private isRestoreFailed: boolean;
  private isSocketReconnected: boolean;
  private isKeepAlive: boolean;
  private reconnectInterval: ReturnType<typeof setInterval>;
  private webSocketManager: WebSocketManager;
  private subscribeRequest: SubscribeRequest;

  constructor(webSocketManager: WebSocketManager, subscribeRequest: SubscribeRequest) {
    super();
    this.webSocketManager = webSocketManager;
    this.subscribeRequest = subscribeRequest;

    this.isConnectionLost = false;
    this.isRestoreFailed = false;
    this.isSocketReconnected = false;
    this.isKeepAlive = false;

    this.webSocketManager.addEventListener('message', this.onPing);
    this.webSocketManager.addEventListener('socketClose', this.onSocketClose);
  }

  private dispatchConnectionEvent(socketReconnected = false): void {
    const event = new CustomEvent<ConnectionLostDetails>('connectionLost', {
      detail: {
        isConnectionLost: this.isConnectionLost,
        isRestoreFailed: this.isRestoreFailed,
        isSocketReconnected:
          !this.webSocketManager.isSocketClosed && (socketReconnected || this.isSocketReconnected),
        isKeepAlive: this.isKeepAlive,
      },
    });
    this.dispatchEvent(event);
  }

  private handleConnectionLost = (): void => {
    this.isConnectionLost = true;
    this.dispatchConnectionEvent();
  };

  private clearTimerOnRestoreFailed = async () => {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
  };

  private handleRestoreFailed = async () => {
    this.isRestoreFailed = true;
    this.webSocketManager.shouldReconnect = false;
    this.dispatchConnectionEvent();
    await this.clearTimerOnRestoreFailed();
  };

  private updateConnectionData = (): void => {
    this.isRestoreFailed = false;
    this.isConnectionLost = false;
    this.isSocketReconnected = false;
  };

  public setConnectionProp(prop: ConnectionProp): void {
    this.connectionProp = prop;
  }

  private onPing = (event: Event): void => {
    const msg = (event as CustomEvent<string>).detail;
    const parsedEvent = JSON.parse(msg);
    if (this.reconnectingTimer) {
      clearTimeout(this.reconnectingTimer);
    }
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
    }
    this.isKeepAlive = parsedEvent.keepalive === 'true';
    const shouldUpdateConnectionData =
      this.isKeepAlive || (this.isConnectionLost && !this.isRestoreFailed);
    const shouldDispatchEvent =
      this.isKeepAlive || (this.isConnectionLost && !this.isRestoreFailed);
    const shouldDispatchEventWithReconnect = this.isSocketReconnected && this.isKeepAlive;

    if (shouldUpdateConnectionData) {
      this.updateConnectionData();
    }

    if (shouldDispatchEvent) {
      this.dispatchConnectionEvent();
    } else if (shouldDispatchEventWithReconnect) {
      this.dispatchConnectionEvent(true);
    }

    this.reconnectingTimer = setTimeout(this.handleConnectionLost, this.wsDisconnectAllowed);
    this.restoreTimer = setTimeout(
      this.handleRestoreFailed,
      this.connectionProp && this.connectionProp.lostConnectionRecoveryTimeout
    );
  };

  private handleSocketClose = async (): Promise<void> => {
    LoggerProxy.logger.info(`event=socketConnectionRetry | Trying to reconnect to notifs socket`);
    const onlineStatus = navigator.onLine;
    if (onlineStatus) {
      await this.webSocketManager.initWebSocket({body: this.subscribeRequest});
      await this.clearTimerOnRestoreFailed();
      this.isSocketReconnected = true;
    } else {
      throw new Error('event=socketConnectionRetry | browser network not available');
    }
  };

  private onSocketClose = (): void => {
    this.clearTimerOnRestoreFailed();

    this.reconnectInterval = setInterval(async () => {
      await this.handleSocketClose();
    }, CONNECTIVITY_CHECK_INTERVAL);
  };
}
