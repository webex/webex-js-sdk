import {EventEmitter} from 'events';
import type {WebexSDK} from '../../../types';
import type {WelcomeResponse} from '../../config/types';
import {WebSocketManager} from './WebSocketManager';
import LoggerProxy from '../../../logger-proxy';
import {ConnectionServiceOptions, ConnectionLostDetails, ConnectionProp} from './types';
import {
  LOST_CONNECTION_RECOVERY_TIMEOUT,
  WS_DISCONNECT_ALLOWED,
  CONNECTIVITY_CHECK_INTERVAL,
  METHODS,
} from '../constants';
import {CONNECTION_SERVICE_FILE} from '../../../constants';
import {SubscribeRequest} from '../../../types';
import {SUBSCRIBE_API} from '../../constants';
import {
  isRecord,
  createRegionRecoveryError,
  getSubscriptionMismatchReason,
  normalizeRecoveryFailure,
} from '../Utils';

export class ConnectionService extends EventEmitter {
  private connectionProp: ConnectionProp = {
    lostConnectionRecoveryTimeout: LOST_CONNECTION_RECOVERY_TIMEOUT,
  };

  private wsDisconnectAllowed = WS_DISCONNECT_ALLOWED;
  private reconnectingTimer: ReturnType<typeof setTimeout>;
  private restoreTimer: ReturnType<typeof setTimeout>;
  private isConnectionLost: boolean;
  private isRestoreFailed: boolean;
  private isKeepAlive: boolean;
  private reconnectInterval: ReturnType<typeof setInterval>;
  private pending = false;
  private isStopped = false;
  private webex: WebexSDK;
  private webSocketManager: WebSocketManager;
  private subscribeRequest: SubscribeRequest;

  constructor(options: ConnectionServiceOptions) {
    super();
    this.webex = options.webex;
    this.webSocketManager = options.webSocketManager;
    this.subscribeRequest = options.subscribeRequest;

    this.isConnectionLost = false;
    this.isRestoreFailed = false;
    this.isKeepAlive = false;

    this.setupEventListeners();
  }

  public async connect(refreshServices = false): Promise<WelcomeResponse> {
    try {
      if (refreshServices) {
        const ordinaryReconnect = this.pending;
        this.emit('subscriptionMismatch');
        await this.webex.internal.services.updateServices({forceRefresh: true});
        // The ordinary restore timeout may have stopped retries while discovery was pending.
        if (ordinaryReconnect && !this.pending)
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      }

      return await this.webSocketManager.initWebSocket({
        body: this.subscribeRequest,
        resource: SUBSCRIBE_API,
      });
    } catch (error) {
      if (!refreshServices && getSubscriptionMismatchReason(error)) return this.connect(true);
      throw error;
    }
  }

  private setupEventListeners() {
    this.webSocketManager.on('message', this.onPing);
    this.webSocketManager.on('socketClose', this.onSocketClose);
  }

  private dispatchConnectionEvent(socketReconnected = false): void {
    const event: ConnectionLostDetails = {
      isConnectionLost: this.isConnectionLost,
      isRestoreFailed: this.isRestoreFailed,
      isSocketReconnected: socketReconnected,
      isKeepAlive: this.isKeepAlive,
    };
    this.webSocketManager.handleConnectionLost(event);
    LoggerProxy.info(`Dispatching connection event`, {
      module: CONNECTION_SERVICE_FILE,
      method: METHODS.DISPATCH_CONNECTION_EVENT,
    });
    this.emit('connectionLost', event);
  }

  private handleConnectionLost = (): void => {
    this.isConnectionLost = true;
    this.dispatchConnectionEvent();
  };

  private handleRestoreFailed = (): void => {
    if (this.reconnectInterval || !this.webSocketManager.hasUsableSocket()) {
      this.pending = false;
      this.stop();
      this.webSocketManager.close(false, 'Restore watchdog expired');
    } else {
      // An admitted socket can still deliver a late keepalive without a reconnect.
      this.restoreTimer = undefined;
      this.webSocketManager.shouldReconnect = false;
    }
    this.isRestoreFailed = true;
    this.isConnectionLost = true;
    this.dispatchConnectionEvent();
  };

  private updateConnectionData = (): void => {
    this.isRestoreFailed = false;
    this.isConnectionLost = false;
  };

  public setConnectionProp(prop: ConnectionProp): void {
    this.connectionProp = prop;
  }

  public reset(socketReconnected = false): void {
    this.stop();
    this.isStopped = false;
    this.webSocketManager.shouldReconnect = true;
    this.updateConnectionData();
    this.setupEventListeners();
    if (this.webSocketManager.hasUsableSocket()) {
      this.reconnectingTimer = setTimeout(this.handleConnectionLost, this.wsDisconnectAllowed);
      this.restoreTimer = setTimeout(
        this.handleRestoreFailed,
        this.connectionProp && this.connectionProp.lostConnectionRecoveryTimeout
      );
      if (socketReconnected) this.dispatchConnectionEvent(true);
    } else this.onSocketClose();
  }

  public stop(): void {
    this.isStopped = true;
    clearInterval(this.reconnectInterval);
    clearTimeout(this.reconnectingTimer);
    clearTimeout(this.restoreTimer);
    this.reconnectInterval = undefined;
    this.reconnectingTimer = undefined;
    this.restoreTimer = undefined;
    const pending = this.pending;
    this.pending = false;
    this.webSocketManager.off('message', this.onPing);
    this.webSocketManager.off('socketClose', this.onSocketClose);
    if (pending) this.webSocketManager.close(false, 'Recovery cancelled');
  }

  private onPing = (event: unknown): void => {
    if (this.isStopped || this.pending) return;
    let parsedEvent: unknown;
    try {
      parsedEvent = JSON.parse(event as string);
    } catch (error) {
      LoggerProxy.error(`onPing failed to parse payload: ${(error as Error)?.message}`, {
        module: CONNECTION_SERVICE_FILE,
        method: METHODS.ON_PING,
      });

      return;
    }
    if (!isRecord(parsedEvent)) {
      LoggerProxy.error(`onPing received non-object payload, ignoring`, {
        module: CONNECTION_SERVICE_FILE,
        method: METHODS.ON_PING,
      });

      return;
    }
    if (this.reconnectingTimer) {
      clearTimeout(this.reconnectingTimer);
    }
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
    }
    this.isKeepAlive = parsedEvent.keepalive === 'true';

    if ((this.isConnectionLost && !this.isRestoreFailed) || this.isKeepAlive) {
      this.updateConnectionData();
      this.dispatchConnectionEvent();
    }

    this.reconnectingTimer = setTimeout(this.handleConnectionLost, this.wsDisconnectAllowed);
    this.restoreTimer = setTimeout(
      this.handleRestoreFailed,
      this.connectionProp && this.connectionProp.lostConnectionRecoveryTimeout
    );
  };

  private handleSocketClose = async (): Promise<void> => {
    if (this.pending) return;
    LoggerProxy.info(`event=socketConnectionRetry | Trying to reconnect to websocket`, {
      module: CONNECTION_SERVICE_FILE,
      method: METHODS.HANDLE_SOCKET_CLOSE,
    });
    this.pending = true;
    try {
      const onlineStatus = navigator.onLine;
      if (onlineStatus) {
        await this.connect();
        if (!this.pending) return;
        if (!this.webSocketManager.hasUsableSocket()) throw new Error('WebSocket closed');
        this.pending = false;
        this.reset(true);
      } else {
        throw new Error('event=socketConnectionRetry | browser network not available');
      }
    } catch (error) {
      if (!this.pending) return;
      this.pending = false;
      if (!this.webSocketManager.shouldReconnect) {
        this.stop();

        return;
      }
      const {status} = normalizeRecoveryFailure(error);
      if (status === 401 || status === 403 || getSubscriptionMismatchReason(error)) this.stop();
      this.emit('reconnectFailed', error);
    }
  };

  private onSocketClose = (): void => {
    if (this.isStopped) return;
    if (!this.webSocketManager.shouldReconnect) {
      this.stop();

      return;
    }
    if (this.pending) return;
    clearTimeout(this.reconnectingTimer);
    this.isConnectionLost = true;
    if (!this.restoreTimer)
      this.restoreTimer = setTimeout(
        this.handleRestoreFailed,
        this.connectionProp && this.connectionProp.lostConnectionRecoveryTimeout
      );
    if (!this.reconnectInterval)
      this.reconnectInterval = setInterval(this.handleSocketClose, CONNECTIVITY_CHECK_INTERVAL);
    this.dispatchConnectionEvent();
  };
}
