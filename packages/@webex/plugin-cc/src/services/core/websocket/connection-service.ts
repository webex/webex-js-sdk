import {EventEmitter} from 'events';
import {WebSocketManager} from './WebSocketManager';
import LoggerProxy from '../../../logger-proxy';
import {ConnectionServiceOptions, ConnectionLostDetails, ConnectionProp} from './types';
import {
  LOST_CONNECTION_RECOVERY_TIMEOUT,
  WS_DISCONNECT_ALLOWED,
  CONNECTIVITY_CHECK_INTERVAL,
} from '../constants';
import {CONNECTION_SERVICE_FILE} from '../../../constants';
import {SubscribeRequest} from '../../../types';

export class ConnectionService extends EventEmitter {
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

  constructor(options: ConnectionServiceOptions) {
    super();
    this.webSocketManager = options.webSocketManager;
    this.subscribeRequest = options.subscribeRequest;

    this.isConnectionLost = false;
    this.isRestoreFailed = false;
    this.isSocketReconnected = false;
    this.isKeepAlive = false;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.webSocketManager.on('message', this.onPing.bind(this));
    this.webSocketManager.on('socketClose', this.onSocketClose.bind(this));
  }

  private dispatchConnectionEvent(socketReconnected = false): void {
    const event: ConnectionLostDetails = {
      isConnectionLost: this.isConnectionLost,
      isRestoreFailed: this.isRestoreFailed,
      isSocketReconnected:
        !this.webSocketManager.isSocketClosed && (socketReconnected || this.isSocketReconnected),
      isKeepAlive: this.isKeepAlive,
    };
    this.webSocketManager.handleConnectionLost(event);
    LoggerProxy.log(`Dispatching connection lost event`, {
      module: CONNECTION_SERVICE_FILE,
      method: this.dispatchConnectionEvent.name,
    });
    this.emit('connectionLost', event);
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

  private onPing = (event: any): void => {
    const parsedEvent = JSON.parse(event);
    if (this.reconnectingTimer) {
      clearTimeout(this.reconnectingTimer);
    }
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
    }
    this.isKeepAlive = parsedEvent.keepalive === 'true';

    if (
      ((this.isConnectionLost && !this.isRestoreFailed) || this.isKeepAlive) &&
      !this.isSocketReconnected
    ) {
      this.updateConnectionData();
      this.dispatchConnectionEvent();
    } else if (this.isSocketReconnected && this.isKeepAlive) {
      this.updateConnectionData();
      this.dispatchConnectionEvent(true);
    }

    this.reconnectingTimer = setTimeout(this.handleConnectionLost, this.wsDisconnectAllowed);
    this.restoreTimer = setTimeout(
      this.handleRestoreFailed,
      this.connectionProp && this.connectionProp.lostConnectionRecoveryTimeout
    );
  };

  private handleSocketClose = async (): Promise<void> => {
    LoggerProxy.info(`event=socketConnectionRetry | Trying to reconnect to websocket`, {
      module: CONNECTION_SERVICE_FILE,
      method: this.handleSocketClose.name,
    });
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
