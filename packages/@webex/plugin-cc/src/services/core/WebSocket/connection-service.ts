/* eslint-disable */
import { Signal } from '../Signal';
import { WebSocketManager } from './WebSocketManager';

type ConnectionLostDetails = {
  isConnectionLost: boolean;
  isRestoreFailed: boolean;
  isSocketReconnected: boolean;
  isKeepAlive: boolean;
};

type ConnectionProp = {
  lostConnectionRecoveryTimeout: number;
};

const LOST_CONNECTION_RECOVERY_TIMEOUT = 20000; // 20 seconds
const WS_DISCONNECT_ALLOWED = 8000; // 8 seconds
const CONNECTIVITY_CHECK_INTERVAL = 5000; // 5 seconds

export class ConnectionService {
  private connectionProp: ConnectionProp = { lostConnectionRecoveryTimeout: LOST_CONNECTION_RECOVERY_TIMEOUT };
  private wsDisconnectAllowed = WS_DISCONNECT_ALLOWED;
  private reconnectingTimer: ReturnType<typeof setTimeout>;
  private restoreTimer: ReturnType<typeof setTimeout>;
  private isConnectionLost: boolean;
  private isRestoreFailed: boolean;
  private isSocketReconnected: boolean;
  private isKeepAlive: boolean;
  private reconnectInterval: ReturnType<typeof setInterval>;
  private readonly onConnectionLostSend: Signal.Send<ConnectionLostDetails>;
  public readonly onConnectionLost: Signal.WithData<ConnectionLostDetails>;

  constructor(private webSocketManager: WebSocketManager) {
    const { send, signal } = Signal.create.withData<ConnectionLostDetails>();
    this.onConnectionLost = signal;
    this.onConnectionLostSend = send;

    this.isConnectionLost = false;
    this.isRestoreFailed = false;
    this.isSocketReconnected = false;
    this.isKeepAlive = false;

    this.webSocketManager.onMessage.listen(this.onPing);
    this.webSocketManager.onSocketClose.listen(this.onSocketClose);
  }

  private dispatchEvent(socketReconnected = false): void {
    this.onConnectionLostSend({
      isConnectionLost: this.isConnectionLost,
      isRestoreFailed: this.isRestoreFailed,
      isSocketReconnected: !this.webSocketManager.isSocketClosed && (socketReconnected || this.isSocketReconnected),
      isKeepAlive: this.isKeepAlive,
    });
  }

  private handleConnectionLost = (): void => {
    this.isConnectionLost = true;
    this.dispatchEvent();
  };

  private clearTimerOnRestoreFailed = async () => {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
  };

  private handleRestoreFailed = async () => {
    this.isRestoreFailed = true;
    this.webSocketManager.shouldReconnect = false;
    this.dispatchEvent();
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

  private onPing = (msg: string): void => {
    const event = JSON.parse(msg);
    if (this.reconnectingTimer) {
      clearTimeout(this.reconnectingTimer);
    }
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
    }
    this.isKeepAlive = event["keepalive"] === "true";
    if ((this.isConnectionLost && !this.isRestoreFailed) || this.isKeepAlive) {
      this.updateConnectionData();
      this.dispatchEvent();
    } else if (this.isSocketReconnected && this.isKeepAlive) {
      this.updateConnectionData();
      this.dispatchEvent(true);
    }
  };

  private handleSocketClose = async (): Promise<void> => {
    console.info("event=socketConnectionRetry | Trying to reconnect to notifs socket");
    const onlineStatus = navigator.onLine;
    if (onlineStatus) {
      await this.webSocketManager.reconnect();
      // eslint-disable-next-line no-console
      await this.clearTimerOnRestoreFailed();
      this.isSocketReconnected = true;
    } else {
      throw new Error("event=socketConnectionRetry | browser network not available");
    }
  };

  private onSocketClose = (): void => {
    this.clearTimerOnRestoreFailed();

    this.reconnectInterval = setInterval(async () => {
      await this.handleSocketClose();
    }, CONNECTIVITY_CHECK_INTERVAL);
  };
}