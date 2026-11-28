import {EventEmitter} from 'events';
import isEqual from 'lodash/isEqual';
import type {RegionRecoveryState, WebexSDK} from '../../../types';
import type {MultiRegionSettings, SystemRegionSwitch, WelcomeResponse} from '../../config/types';
import type {RecoveryFailure} from '../types';
import {
  createRegionRecoveryError,
  getSubscriptionMismatchReason,
  normalizeRecoveryDiagnosticId,
  normalizeRecoveryFailure,
  isRecord,
} from '../Utils';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import {WebSocketManager} from './WebSocketManager';
import LoggerProxy from '../../../logger-proxy';
import {ConnectionServiceOptions, ConnectionLostDetails, ConnectionProp} from './types';
import {
  LOST_CONNECTION_RECOVERY_TIMEOUT,
  WS_DISCONNECT_ALLOWED,
  CONNECTIVITY_CHECK_INTERVAL,
  METHODS,
  REFERENCE_SERVING_REGIONS,
  REGION_RECOVERY_ERROR_CODES,
} from '../constants';
import {CONNECTION_SERVICE_FILE, METHODS as CC_METHODS} from '../../../constants';
import {SubscribeRequest} from '../../../types';
import {SUBSCRIBE_API} from '../../constants';

const REGION_RETRY_DELAYS_MS = [100000, 60000, 30000, 15000];

type RegionRecovery = {
  timer?: ReturnType<typeof setTimeout>;
};

const RECOVERY_DIAGNOSTIC_REASONS = new Set<string>([
  ...Object.values(REGION_RECOVERY_ERROR_CODES),
  'initial-login',
  'region-switch',
  'region-mismatch',
  'not-eligible',
  'session-restore-failed',
  'automatic-relogin-disabled',
  'authentication-failed',
  'recovery-failed',
]);

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

  private recoverSession?: () => Promise<RegionRecoveryState>;
  private recovery?: RegionRecovery;
  private lastSwitchTrackingId?: string;
  private multiRegionSettings: MultiRegionSettings | null = null;
  private servingRegion?: string;
  public regionState?: RegionRecoveryState;
  private regionStateContext: Pick<
    RegionRecoveryState,
    'trackingId' | 'operation' | 'scope' | 'autoAvailable'
  > = {};

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

  public setSessionRecoveryHandler(recoverSession: () => Promise<RegionRecoveryState>): void {
    this.recoverSession = recoverSession;
  }

  public get isRecovering(): boolean {
    return Boolean(this.recovery);
  }

  public setMultiRegionSettings(settings?: MultiRegionSettings): void {
    this.multiRegionSettings = settings ?? null;
  }

  public resetRecovery(): void {
    this.cancelRegionRecovery();
    this.lastSwitchTrackingId = undefined;
    this.multiRegionSettings = null;
    this.resetRegionState();
  }

  public clearStationRecovery(): void {
    const wasRegional = Boolean(this.recovery);
    this.cancelRegionRecovery();
    if (wasRegional) this.reset();
    if (this.regionState?.status !== 'unavailable') this.resetRegionState();
  }

  public recordRecoveryDiagnostic(
    stage: string,
    outcome: string,
    attempt: number,
    startedAt: number,
    failure?: RecoveryFailure
  ): void {
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const id = normalizeRecoveryDiagnosticId(failure?.id);
    const trackingId = normalizeRecoveryDiagnosticId(failure?.trackingId);
    const payload = {
      stage,
      outcome,
      attempt,
      elapsedMs,
      ...(Number.isFinite(failure?.status) ? {status: failure.status} : {}),
      ...(Number.isFinite(failure?.reasonCode) ? {reasonCode: failure.reasonCode} : {}),
      ...(id ? {id} : {}),
      ...(trackingId ? {trackingId} : {}),
      ...(RECOVERY_DIAGNOSTIC_REASONS.has(failure?.reason) ? {reason: failure.reason} : {}),
    };
    LoggerProxy.info('Region recovery', {
      module: CONNECTION_SERVICE_FILE,
      method: CC_METHODS.RECORD_RECOVERY_DIAGNOSTIC,
      data: payload,
    });
    let metric: METRIC_EVENT_NAMES | undefined;
    if (stage === 'admission') {
      if (outcome === 'succeeded') metric = METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS;
      else if (outcome === 'retrying' || outcome === 'terminal')
        metric = METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED;
    } else if (stage === 'reload') {
      if (outcome === 'succeeded') metric = METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS;
      else if (['retrying', 'terminal', 'failed'].includes(outcome))
        metric = METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED;
    }
    if (metric) this.emit('recoveryDiagnostic', metric, payload);
  }

  /** Publishes recovery state with current placement details. */
  public publishRegionState(state: RegionRecoveryState): void {
    if (state.autoAvailable !== undefined)
      this.regionStateContext.autoAvailable = state.autoAvailable;
    const retained = {...this.regionStateContext, ...state};
    delete retained.homeRegion;
    delete retained.servingRegion;
    delete retained.limitedService;
    const homeRegion = this.multiRegionSettings?.homeRegion;
    const servingRegion = this.webSocketManager.hasUsableSocket() ? this.servingRegion : undefined;
    const snapshot = Object.freeze({
      ...retained,
      ...(homeRegion ? {homeRegion} : {}),
      ...(servingRegion ? {servingRegion} : {}),
      ...(this.multiRegionSettings?.multiRegionEnabled && homeRegion && servingRegion
        ? {limitedService: homeRegion !== servingRegion}
        : {}),
    });
    if (isEqual(snapshot, this.regionState)) return;
    this.regionState = snapshot;
    this.emit('regionStateChange', snapshot);
  }

  /** Clears the last recovery event and switch details. */
  private resetRegionState(): void {
    this.regionState = undefined;
    this.regionStateContext = {};
  }

  private cancelRegionRecovery(): void {
    const recovery = this.recovery;
    this.recovery = undefined;
    if (!recovery) return;
    clearTimeout(recovery.timer);
    this.webSocketManager.close(false, 'regionRecoveryEnded');
  }

  private isTerminalConnectionFailure(error: unknown): boolean {
    const {status} = normalizeRecoveryFailure(error);

    return status === 401 || status === 403 || Boolean(getSubscriptionMismatchReason(error));
  }

  private rememberServingRegion(url: string): void {
    const labels = new URL(url).hostname.toLowerCase().split('.');
    this.servingRegion = REFERENCE_SERVING_REGIONS.find((region) => labels.includes(region));
  }

  public async connect(refreshServices = false): Promise<WelcomeResponse> {
    try {
      if (refreshServices) {
        const ordinaryReconnect = this.pending;
        this.handleSubscriptionMismatch();
        await this.webex.internal.services.updateServices({forceRefresh: true});
        // The ordinary restore timeout may have stopped retries while discovery was pending.
        if (ordinaryReconnect && !this.pending)
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      }
      const manager = this.webSocketManager;
      const welcome = await manager.initWebSocket({
        body: this.subscribeRequest,
        resource: SUBSCRIBE_API,
      });
      if (this.recoverSession) this.rememberServingRegion(manager.getUrl());

      return welcome;
    } catch (error) {
      if (this.recoverSession && !refreshServices && getSubscriptionMismatchReason(error))
        return this.connect(true);
      if (
        this.recoverSession &&
        !this.recovery &&
        (getSubscriptionMismatchReason(error) || this.regionState?.status === 'recovering')
      )
        this.handleRecoveryTerminal(error);

      throw error;
    }
  }

  public handleRecoveryTerminal(error: unknown): void {
    const failure = normalizeRecoveryFailure(error);
    if (failure.reason === 'RECOVERY_INTERRUPTED') {
      this.cancelRegionRecovery();

      return;
    }
    let reason: RegionRecoveryState['reason'] = 'recovery-failed';
    if (getSubscriptionMismatchReason(error)) reason = 'region-mismatch';
    else if (failure.status === 401 || failure.status === 403) reason = 'authentication-failed';
    this.emit('reconnectFailed', error);
    this.finishRegionRecovery(reason);
  }

  private handleSubscriptionMismatch = (): void => {
    this.servingRegion = undefined;
    this.emit('recoveryConnectionChange', false);
    this.publishRegionState({status: 'recovering', reason: 'region-mismatch'});
  };

  public finishRegionRecovery(reason: RegionRecoveryState['reason']): void {
    this.cancelRegionRecovery();
    this.stop();
    this.webSocketManager.close(false, 'recoveryFailed');
    this.emit('recoveryConnectionChange', false);
    delete this.regionStateContext.autoAvailable;
    this.publishRegionState({status: 'unavailable', reason});
  }

  public handleRegionSwitch(event: SystemRegionSwitch): void {
    const startedAt = Date.now();
    const orgId = this.webex.credentials.getOrgId();
    if (
      event.orgId !== orgId ||
      !this.multiRegionSettings ||
      this.lastSwitchTrackingId === event.trackingId
    ) {
      this.recordRecoveryDiagnostic('ignored-event', 'dropped', 0, startedAt, {
        trackingId: event.trackingId,
      });

      return;
    }
    this.lastSwitchTrackingId = event.trackingId;
    this.servingRegion = undefined;
    this.cancelRegionRecovery();
    this.stop();
    this.emit('recoveryConnectionChange', false);
    this.resetRegionState();
    this.regionStateContext = {trackingId: event.trackingId, ...event.data};
    if (this.multiRegionSettings?.multiRegionEnabled === false) {
      this.webSocketManager.close(false, 'notEligible');
      this.publishRegionState({status: 'unavailable', reason: 'not-eligible'});

      return;
    }
    const recovery: RegionRecovery = {};
    this.recovery = recovery;
    this.publishRegionState({status: 'recovering', reason: 'region-switch'});
    this.webSocketManager.close(false, 'regionRecovery');
    this.scheduleRegionRecovery(recovery, 1);
  }

  private scheduleRegionRecovery(recovery: RegionRecovery, attempt: number): void {
    const base = REGION_RETRY_DELAYS_MS[Math.min(attempt, REGION_RETRY_DELAYS_MS.length) - 1];
    const delay = base * (1 + 0.5 * Math.random());
    const startedAt = Date.now();
    recovery.timer = setTimeout(() => {
      this.reconnectRegion(recovery, attempt, startedAt);
    }, delay);
    this.recordRecoveryDiagnostic('scheduled-wait', 'waiting', attempt, startedAt);
    this.publishRegionState({status: 'recovering', reason: 'region-switch', retryAfterMs: delay});
  }

  private async reconnectRegion(
    recovery: RegionRecovery,
    attempt: number,
    startedAt: number
  ): Promise<void> {
    const welcomeStartedAt = Date.now();
    const manager = this.webSocketManager;
    try {
      await this.connect();
      if (this.recovery !== recovery) return;
      this.recordRecoveryDiagnostic('welcome', 'succeeded', attempt, welcomeStartedAt);
      const state = await this.recoverSession();
      if (this.recovery !== recovery) return;
      if (!manager.hasUsableSocket()) throw new Error('WebSocket closed');
      this.recordRecoveryDiagnostic('admission', 'succeeded', attempt, startedAt);
      this.reset();
      this.recovery = undefined;
      this.publishRegionState(state);
      this.emit('recoveryConnectionChange', true);
    } catch (error) {
      if (this.recovery !== recovery) return;
      const terminal = this.isTerminalConnectionFailure(error) || manager.hasUsableSocket();
      this.recordRecoveryDiagnostic(
        'admission',
        terminal ? 'terminal' : 'retrying',
        attempt,
        startedAt,
        normalizeRecoveryFailure(error)
      );
      if (terminal) this.handleRecoveryTerminal(error);
      else this.scheduleRegionRecovery(recovery, attempt + 1);
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
    if (event.isConnectionLost) this.servingRegion = undefined;
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
    } catch {
      LoggerProxy.error('onPing failed to parse payload', {
        module: CONNECTION_SERVICE_FILE,
        method: METHODS.ON_PING,
      });

      return;
    }
    if (!isRecord(parsedEvent) || Array.isArray(parsedEvent)) {
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
    this.reconnectingTimer = setTimeout(this.handleConnectionLost, this.wsDisconnectAllowed);
    this.restoreTimer = setTimeout(
      this.handleRestoreFailed,
      this.connectionProp && this.connectionProp.lostConnectionRecoveryTimeout
    );
    if (this.isConnectionLost || this.isKeepAlive) {
      this.updateConnectionData();
      this.dispatchConnectionEvent();
    }
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
      if (!onlineStatus)
        throw new Error('event=socketConnectionRetry | browser network not available');
      await this.connect();
      if (!this.pending) return;
      if (!this.webSocketManager.hasUsableSocket()) throw new Error('WebSocket closed');
      this.pending = false;
      this.reset(true);
    } catch (error) {
      if (!this.pending) return;
      this.pending = false;
      if (!this.webSocketManager.shouldReconnect) {
        this.stop();

        return;
      }
      if (this.recoverSession && this.isTerminalConnectionFailure(error))
        this.handleRecoveryTerminal(error);
      else if (!this.recoverSession) this.emit('reconnectFailed', error);
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
