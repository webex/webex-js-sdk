import {EventEmitter} from 'events';
import type {WebSocketManager} from './WebSocketManager';
import LoggerProxy from '../../../logger-proxy';
import type {ConnectionLostDetails, ConnectionResetOptions} from './types';
import {
  LOST_CONNECTION_RECOVERY_TIMEOUT,
  WS_DISCONNECT_ALLOWED,
  CONNECTIVITY_CHECK_INTERVAL,
  METHODS,
} from '../constants';
import {CONNECTION_SERVICE_FILE} from '../../../constants';
import type {RecoveryFailure} from '../types';
import {isRecord, normalizeRecoveryFailure} from '../Utils';

/** Schedules ordinary socket reconnection and monitors connection liveness. */
export class ConnectionService extends EventEmitter {
  private mode: 'ordinary' | 'paused' | 'stopped' = 'stopped';
  private retryTimer?: ReturnType<typeof setTimeout>;
  private reconnectingTimer?: ReturnType<typeof setTimeout>;
  private restoreTimer?: ReturnType<typeof setTimeout>;
  private isConnectionLost = false;
  private isRestoreFailed = false;
  private isKeepAlive = false;
  private lossEpisode?: {startedAt: number; attempt: number};
  private pending?: {reconnectOnClose: boolean};
  private onTerminalFailure?: ConnectionResetOptions['onTerminalFailure'];
  private readonly webSocketManager: WebSocketManager;
  private getWebSocketUrl?: ConnectionResetOptions['getWebSocketUrl'];
  private isTerminalFailure?: ConnectionResetOptions['isTerminalFailure'];

  constructor(webSocketManager: WebSocketManager) {
    super();
    this.webSocketManager = webSocketManager;
  }

  public reset(options: ConnectionResetOptions): void {
    this.stop();
    this.getWebSocketUrl = options.getWebSocketUrl;
    this.isTerminalFailure = options.isTerminalFailure;
    this.onTerminalFailure = options.onTerminalFailure;
    this.mode = 'ordinary';
    this.webSocketManager.shouldReconnect = true;
    this.updateConnectionData();
    this.setupEventListeners();
    if (this.webSocketManager.hasUsableSocket()) this.monitorOrdinary();
    else this.onSocketClose();
  }

  public pause(): void {
    if (this.mode === 'stopped') return;
    this.mode = 'paused';
    this.cancelWork();
  }

  public stop(): void {
    this.mode = 'stopped';
    this.cancelWork();
    this.getWebSocketUrl = undefined;
    this.isTerminalFailure = undefined;
    this.onTerminalFailure = undefined;
    this.webSocketManager.off('message', this.onPing);
    this.webSocketManager.off('socketClose', this.onSocketClose);
  }

  private setupEventListeners(): void {
    this.webSocketManager.on('message', this.onPing);
    this.webSocketManager.on('socketClose', this.onSocketClose);
  }

  private clearTimers(): void {
    clearTimeout(this.retryTimer);
    clearTimeout(this.reconnectingTimer);
    clearTimeout(this.restoreTimer);
    this.retryTimer = undefined;
    this.reconnectingTimer = undefined;
    this.restoreTimer = undefined;
    this.lossEpisode = undefined;
  }

  private cancelWork(): void {
    this.clearTimers();
    const pending = this.pending;
    this.pending = undefined;
    if (pending) this.webSocketManager.close(false, 'Recovery cancelled');
  }

  private dispatchConnectionEvent(socketReconnected = false): void {
    const event: ConnectionLostDetails = {
      isConnectionLost: this.isConnectionLost,
      isRestoreFailed: this.isRestoreFailed,
      isSocketReconnected: socketReconnected,
      isKeepAlive: this.isKeepAlive,
    };
    try {
      this.webSocketManager.handleConnectionLost(event);
    } catch {
      /* Owner state is already settled. */
    }
    try {
      this.emit('connectionLost', event);
    } catch {
      /* Host observers cannot restart scheduling. */
    }
  }

  private updateConnectionData(): void {
    this.isConnectionLost = false;
    this.isRestoreFailed = false;
  }

  private monitorOrdinary(): void {
    clearTimeout(this.reconnectingTimer);
    clearTimeout(this.restoreTimer);
    this.reconnectingTimer = setTimeout(this.handleConnectionLost, WS_DISCONNECT_ALLOWED);
    this.restoreTimer = setTimeout(this.handleRestoreFailed, LOST_CONNECTION_RECOVERY_TIMEOUT);
  }

  private handleConnectionLost = (): void => {
    if (this.mode !== 'ordinary') return;
    this.isConnectionLost = true;
    this.dispatchConnectionEvent();
  };

  private handleRestoreFailed = (): void => {
    if (this.mode !== 'ordinary') return;
    if (this.lossEpisode || !this.webSocketManager.hasUsableSocket()) {
      this.pending = undefined;
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

  private onPing = (event: unknown): void => {
    if (this.mode !== 'ordinary' || this.pending) return;
    let parsedEvent: unknown;
    try {
      parsedEvent = JSON.parse(event as string);
    } catch {
      ConnectionService.diagnose('error', 'onPing failed to parse payload', METHODS.ON_PING);

      return;
    }
    if (!isRecord(parsedEvent) || Array.isArray(parsedEvent)) {
      ConnectionService.diagnose(
        'error',
        'onPing received non-object payload, ignoring',
        METHODS.ON_PING
      );

      return;
    }
    this.isKeepAlive = parsedEvent.keepalive === 'true';
    this.monitorOrdinary();
    if (this.isConnectionLost || this.isKeepAlive) {
      this.updateConnectionData();
      this.dispatchConnectionEvent();
    }
  };

  private scheduleOrdinary(): void {
    if (this.mode !== 'ordinary' || this.retryTimer || this.pending || !this.lossEpisode) return;
    const next =
      this.lossEpisode.startedAt +
      (Math.floor((Date.now() - this.lossEpisode.startedAt) / CONNECTIVITY_CHECK_INTERVAL) + 1) *
        CONNECTIVITY_CHECK_INTERVAL;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.handleSocketClose().catch(() => this.scheduleOrdinary());
    }, Math.max(0, next - Date.now()));
  }

  private async handleSocketClose(): Promise<void> {
    const episode = this.lossEpisode;
    if (this.mode !== 'ordinary' || this.pending || !episode) return;
    episode.attempt += 1;
    const attempt = episode.attempt;
    const diagnose = (
      outcome: 'retrying' | 'terminal' | 'succeeded',
      failure: RecoveryFailure = {}
    ) => {
      ConnectionService.diagnose(
        'info',
        'Ordinary reconnect attempt settled',
        METHODS.HANDLE_SOCKET_CLOSE,
        {
          attempt,
          elapsedMs: Math.max(0, Date.now() - episode.startedAt),
          outcome,
          ...failure,
        }
      );
    };
    const pending = {reconnectOnClose: false};
    this.pending = pending;
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false)
        throw new Error('Browser offline');
      const url = await this.getWebSocketUrl();
      if (this.pending !== pending) return;
      await this.webSocketManager.initWebSocket({url});
      if (this.mode !== 'ordinary' || this.pending !== pending) return;
      if (pending.reconnectOnClose) throw new Error('WebSocket closed');
      diagnose('succeeded');
      if (this.mode !== 'ordinary' || this.pending !== pending || this.lossEpisode !== episode)
        return;
      this.lossEpisode = undefined;
      this.pending = undefined;
      this.updateConnectionData();
      this.monitorOrdinary();
      this.dispatchConnectionEvent(true);
    } catch (error) {
      if (this.mode !== 'ordinary' || this.pending !== pending) return;
      this.pending = undefined;
      if (!this.webSocketManager.shouldReconnect) {
        this.stop();

        return;
      }
      const failure = normalizeRecoveryFailure(error);
      delete failure.reason;
      const isTerminal = this.isTerminalFailure(error);
      diagnose(isTerminal ? 'terminal' : 'retrying', failure);
      if (this.mode !== 'ordinary' || this.lossEpisode !== episode) return;
      if (isTerminal) {
        const callback = this.onTerminalFailure;
        this.stop();
        this.webSocketManager.close(false, 'Terminal admission');
        try {
          callback?.(error);
        } catch {
          /* Terminal ownership is detached before callback delivery. */
        }
      } else this.scheduleOrdinary();
    }
  }

  /** Constant messages and selected scalars only; diagnostics never own scheduler progress. */
  private static diagnose(
    level: 'info' | 'error',
    message: string,
    method: string,
    data?: Record<string, unknown>
  ): void {
    try {
      LoggerProxy[level](message, {
        module: CONNECTION_SERVICE_FILE,
        method,
        ...(data ? {data} : {}),
      });
    } catch {
      /* Best-effort diagnostic sink. */
    }
  }

  private onSocketClose = (event?: {shouldReconnect?: boolean}): void => {
    if (this.mode !== 'ordinary') return;
    const shouldReconnect =
      event?.shouldReconnect !== false && this.webSocketManager.shouldReconnect;
    if (!shouldReconnect) {
      this.stop();

      return;
    }
    if (this.pending) {
      this.pending.reconnectOnClose = true;

      return;
    }
    const episode = this.lossEpisode ?? {startedAt: Date.now(), attempt: 0};
    this.lossEpisode = episode;
    clearTimeout(this.reconnectingTimer);
    this.isConnectionLost = true;
    if (!this.restoreTimer)
      this.restoreTimer = setTimeout(this.handleRestoreFailed, LOST_CONNECTION_RECOVERY_TIMEOUT);
    this.scheduleOrdinary();
    if (this.lossEpisode === episode) this.dispatchConnectionEvent();
  };
}
