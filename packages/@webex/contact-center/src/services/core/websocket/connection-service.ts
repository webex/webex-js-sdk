import {EventEmitter} from 'events';
import isEqual from 'lodash/isEqual';
import type {RegionRecoveryState} from '../../../types';
import type {MultiRegionSettings, SystemRegionSwitch, WelcomeResponse} from '../../config/types';
import {CC_EVENTS} from '../../config/types';
import type * as Agent from '../../agent/types';
import type {RecoveryFailure} from '../types';
import {
  createRegionRecoveryError,
  getStationRecoveryFailureCategory,
  getSubscriptionMismatchReason,
  normalizeRecoveryDiagnosticId,
  normalizeRecoveryFailure,
  isRecord,
} from '../Utils';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import {WebSocketManager} from './WebSocketManager';
import LoggerProxy from '../../../logger-proxy';
import {ConnectionServiceOptions, ConnectionLostDetails, ConnectionProp} from './types';
import type {RecoveryOptions} from './types';
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

const STATION_RELOAD_RETRY_DELAYS_MS = [2000, 4000, 8000];
const REGION_RETRY_DELAYS_MS = [100000, 60000, 30000, 15000];

type RegionRecovery = {
  stage: 'reload' | 'fallback' | 'post1035' | 'manual';
  reloads: number;
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
  private webSocketManager: WebSocketManager;
  private subscribeRequest: SubscribeRequest;

  private recoveryOptions?: RecoveryOptions;
  private recovery?: RegionRecovery;
  private lastSwitchTrackingId?: string;
  private multiRegionSettings: MultiRegionSettings | null = null;
  private servingRegion?: string;
  private autoAvailable?: {requesting: boolean};
  public regionState?: RegionRecoveryState;
  private regionStateContext: Pick<
    RegionRecoveryState,
    'trackingId' | 'operation' | 'scope' | 'autoAvailable'
  > = {};

  constructor(options: ConnectionServiceOptions) {
    super();
    this.webSocketManager = options.webSocketManager;
    this.subscribeRequest = options.subscribeRequest;

    this.isConnectionLost = false;
    this.isRestoreFailed = false;
    this.isKeepAlive = false;

    this.setupEventListeners();
  }

  public configureRecovery(options: RecoveryOptions): void {
    this.recoveryOptions = options;
  }

  public get isRecovering(): boolean {
    return Boolean(this.recovery);
  }

  public setMultiRegionSettings(settings?: MultiRegionSettings): void {
    this.multiRegionSettings = settings ?? null;
  }

  public resetRecovery(identityFailure = false): void {
    const cancelled = this.cancelAutoAvailable();
    this.cancelRegionRecovery();
    this.lastSwitchTrackingId = undefined;
    if (cancelled) this.publishRegionState(cancelled);
    if (identityFailure) {
      delete this.regionStateContext.autoAvailable;
      this.publishRegionState({status: 'unavailable', reason: 'recovery-failed'});
    }
    this.multiRegionSettings = null;
    this.resetRegionState();
  }

  public clearStationRecovery(): void {
    const wasRegional = Boolean(this.recovery);
    const cancelled = this.cancelAutoAvailable();
    this.cancelRegionRecovery();
    if (wasRegional) this.reset();
    if (this.regionState?.status !== 'unavailable') this.resetRegionState();
    if (cancelled) this.publishRegionState(cancelled);
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
    if (metric) this.recoveryOptions.metricsManager.trackEvent(metric, payload, ['operational']);
  }

  /** Publishes recovery state with current placement details. */
  public publishRegionState(state: RegionRecoveryState): void {
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
        await this.recoveryOptions.webex.internal.services.updateServices({forceRefresh: true});
        // The ordinary restore timeout may have stopped retries while discovery was pending.
        if (ordinaryReconnect && !this.pending)
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      }
      const manager = this.webSocketManager;
      const welcome = await manager.initWebSocket({
        body: this.recoveryOptions?.getSession().connectionConfig ?? this.subscribeRequest,
        resource: SUBSCRIBE_API,
      });
      if (this.recoveryOptions) this.rememberServingRegion(manager.getUrl());

      return welcome;
    } catch (error) {
      if (this.recoveryOptions && !refreshServices && getSubscriptionMismatchReason(error))
        return this.connect(true);
      if (
        this.recoveryOptions &&
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
    const cancelled = this.cancelAutoAvailable();
    this.servingRegion = undefined;
    this.recoveryOptions.onConnectionChange(false);
    if (cancelled) this.publishRegionState(cancelled);
    this.publishRegionState({status: 'recovering', reason: 'region-mismatch'});
  };

  public finishRegionRecovery(reason: RegionRecoveryState['reason']): void {
    const cancelled = this.cancelAutoAvailable();
    this.cancelRegionRecovery();
    this.stop();
    this.webSocketManager.close(false, 'recoveryFailed');
    this.recoveryOptions.onConnectionChange(false);
    if (cancelled) this.publishRegionState(cancelled);
    delete this.regionStateContext.autoAvailable;
    this.publishRegionState({status: 'unavailable', reason});
  }

  public handleRegionSwitch(event: SystemRegionSwitch): void {
    const startedAt = Date.now();
    const recordIgnoredSwitch = () =>
      this.recordRecoveryDiagnostic('ignored-event', 'dropped', 0, startedAt, {
        trackingId: event.trackingId,
      });
    const {orgId, agentId} = this.recoveryOptions.getSession();
    if (!agentId) return;
    if (this.regionState?.status === 'unavailable') {
      recordIgnoredSwitch();

      return;
    }
    if (this.recoveryOptions.webex.credentials.getOrgId() !== orgId) {
      this.emit('reconnectFailed', createRegionRecoveryError('RECOVERY_INTERRUPTED'));

      return;
    }
    if (event.orgId !== orgId) {
      recordIgnoredSwitch();

      return;
    }
    if (!this.multiRegionSettings || this.lastSwitchTrackingId === event.trackingId) {
      recordIgnoredSwitch();

      return;
    }
    this.lastSwitchTrackingId = event.trackingId;
    const cancelled = this.cancelAutoAvailable();
    this.servingRegion = undefined;
    this.cancelRegionRecovery();
    this.stop();
    this.recoveryOptions.onConnectionChange(false);
    if (cancelled) this.publishRegionState(cancelled);
    this.resetRegionState();
    this.regionStateContext = {trackingId: event.trackingId, ...event.data};
    if (this.multiRegionSettings?.multiRegionEnabled === false) {
      this.webSocketManager.close(false, 'notEligible');
      this.publishRegionState({status: 'unavailable', reason: 'not-eligible'});

      return;
    }
    const recovery: RegionRecovery = {
      stage: 'reload',
      reloads: 0,
    };
    this.recovery = recovery;
    this.publishRegionState({status: 'recovering', reason: 'region-switch'});
    this.webSocketManager.close(false, 'regionRecovery');
    this.scheduleRegionRecovery(recovery, 1);
  }

  private scheduleRegionRecovery(recovery: RegionRecovery, attempt: number): void {
    if (this.recovery !== recovery) return;
    const base = REGION_RETRY_DELAYS_MS[Math.min(attempt, REGION_RETRY_DELAYS_MS.length) - 1];
    const delay = base * (1 + 0.5 * Math.random());
    const startedAt = Date.now();
    recovery.timer = setTimeout(() => {
      recovery.timer = undefined;
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
    if (this.recovery !== recovery) return;
    const welcomeStartedAt = Date.now();
    const manager = this.webSocketManager;
    try {
      const welcome = await this.connect();
      if (this.recovery !== recovery) return;
      const agentId = isRecord(welcome) ? welcome.agentId : undefined;
      this.recordRecoveryDiagnostic(
        'welcome',
        agentId === this.recoveryOptions.getSession().agentId ? 'succeeded' : 'failed',
        attempt,
        welcomeStartedAt
      );
      const state = await this.restoreRegionSession(recovery);
      if (this.recovery !== recovery) return;
      if (!manager.hasUsableSocket()) throw new Error('WebSocket closed');
      this.recordRecoveryDiagnostic('admission', 'succeeded', attempt, startedAt);
      this.reset();
      this.recovery = undefined;
      if (state.autoAvailable) {
        this.autoAvailable = {requesting: false};
        this.regionStateContext.autoAvailable = state.autoAvailable;
      }
      this.publishRegionState(state);
      if (state.status === 'ready' || !this.recoveryOptions.getSession().isAgentLoggedIn)
        this.recoveryOptions.onConnectionChange(true);
      if (state.status === 'ready') this.requestAutoAvailable();
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

  private async restoreRegionSession(recovery: RegionRecovery): Promise<RegionRecoveryState> {
    if (!this.recoveryOptions.getSession().isAgentLoggedIn)
      return {status: 'stationLoginRequired', reason: 'region-switch'};
    if (!this.recoveryOptions.getSession().allowAutomatedRelogin)
      return {status: 'stationLoginRequired', reason: 'automatic-relogin-disabled'};

    const payload = this.recoveryOptions.getSession().station;
    while (this.recovery === recovery && this.webSocketManager.hasUsableSocket()) {
      if (recovery.stage === 'reload' && recovery.reloads > STATION_RELOAD_RETRY_DELAYS_MS.length)
        recovery.stage = 'fallback';
      const stage = recovery.stage;
      if (stage === 'manual') break;
      const diagnosticStage = stage === 'fallback' ? 'fallback-login' : 'reload';
      const attempt = stage === 'fallback' ? 1 : recovery.reloads + 1;
      const startedAt = Date.now();
      let response: Agent.ReloginSuccess | Agent.StationLoginSuccess;
      try {
        if (stage === 'reload') recovery.reloads += 1;
        // Consume each one-shot stage before dispatch so a lost socket cannot repeat it.
        else recovery.stage = 'manual';
        if (stage === 'fallback') {
          if (!payload) break;
          // eslint-disable-next-line no-await-in-loop -- At most one fallback dispatch.
          response = await this.recoveryOptions.agent.stationLogin({data: payload});
        } else {
          // eslint-disable-next-line no-await-in-loop -- Bounded reload budget survives sockets.
          response = await this.recoveryOptions.agent.reload();
        }
      } catch (error) {
        if (this.recovery !== recovery || !this.webSocketManager.hasUsableSocket())
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
        const failure = normalizeRecoveryFailure(error);
        const category = getStationRecoveryFailureCategory(failure);
        const retryDelay =
          stage === 'reload' && category === 'transient'
            ? STATION_RELOAD_RETRY_DELAYS_MS[recovery.reloads - 1]
            : undefined;
        if (category === 'cancelled' || category === 'auth') {
          this.recordRecoveryDiagnostic(
            diagnosticStage,
            category === 'auth' ? 'failed' : 'cancelled',
            attempt,
            startedAt,
            failure
          );
          throw error;
        }
        if (stage === 'fallback' && category === 'exists') recovery.stage = 'post1035';
        else if (stage === 'reload') {
          if (retryDelay === undefined) recovery.stage = 'fallback';
        } else {
          this.recordRecoveryDiagnostic(diagnosticStage, 'failed', attempt, startedAt, failure);
          break;
        }
        this.recordRecoveryDiagnostic(diagnosticStage, 'retrying', attempt, startedAt, failure);
        if (retryDelay !== undefined) {
          // eslint-disable-next-line no-await-in-loop -- Station reload retries are serial.
          await new Promise<void>((resolve) => {
            setTimeout(resolve, retryDelay);
          });
        }
      }
      if (response) {
        if (this.recovery !== recovery || !this.webSocketManager.hasUsableSocket())
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
        this.recordRecoveryDiagnostic(diagnosticStage, 'succeeded', attempt, startedAt);
        // eslint-disable-next-line no-await-in-loop -- Apply the accepted session before proceeding.
        await this.recoveryOptions.applySession(
          response,
          stage === 'fallback' ? payload : undefined
        );
        if (this.recovery !== recovery || !this.webSocketManager.hasUsableSocket())
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

        const state: RegionRecoveryState = {status: 'ready', reason: 'region-switch'};
        if (
          response.data.type === CC_EVENTS.AGENT_RELOGIN_SUCCESS &&
          response.data.lastStateChangeReason === 'agent-wss-disconnect'
        ) {
          state.autoAvailable = this.recoveryOptions.getSession().waitingForVoice
            ? 'waitingForVoice'
            : 'requesting';
        }

        return state;
      }
    }

    return {status: 'stationLoginRequired', reason: 'session-restore-failed'};
  }

  public cancelWaitingAutoAvailable(): void {
    if (this.autoAvailable?.requesting) return;
    const cancelled = this.cancelAutoAvailable();
    if (cancelled) this.publishRegionState(cancelled);
  }

  private cancelAutoAvailable(): RegionRecoveryState | undefined {
    if (!this.autoAvailable) return undefined;
    this.autoAvailable = undefined;
    const previous = this.regionState;
    if (previous?.status !== 'ready') return undefined;
    this.regionStateContext.autoAvailable = 'cancelled';

    return {...previous, autoAvailable: 'cancelled'};
  }

  public async requestAutoAvailable(): Promise<void> {
    const pending = this.autoAvailable;
    if (!pending || pending.requesting || this.recoveryOptions.getSession().waitingForVoice) return;

    pending.requesting = true;
    this.regionStateContext.autoAvailable = 'requesting';
    this.publishRegionState({status: 'ready', reason: 'region-switch'});

    const startedAt = Date.now();
    let outcome: 'succeeded' | 'failed' = 'succeeded';
    try {
      const result = await this.recoveryOptions.makeAvailable();
      if (this.autoAvailable === pending) await this.recoveryOptions.applySession(result);
    } catch {
      outcome = 'failed';
    }
    if (this.autoAvailable !== pending) return;
    this.autoAvailable = undefined;
    this.regionStateContext.autoAvailable = outcome;
    this.recordRecoveryDiagnostic('auto-available', outcome, 1, startedAt);
    this.publishRegionState({status: 'ready', reason: 'region-switch'});
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
    if (this.recoveryOptions) {
      if (event.isConnectionLost) this.servingRegion = undefined;
      else if (socketReconnected) this.rememberServingRegion(this.webSocketManager.getUrl());
      if (event.isConnectionLost || socketReconnected) {
        const cancelled = this.cancelAutoAvailable();
        if (cancelled) this.publishRegionState(cancelled);
      }
    }
    this.emit('connectionLost', event);
  }

  private handleConnectionLost = (): void => {
    if (this.isStopped) return;
    this.isConnectionLost = true;
    this.dispatchConnectionEvent();
  };

  private handleRestoreFailed = (): void => {
    if (this.isStopped) return;
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
    if (this.isStopped || this.pending) return;
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
      if (this.recoveryOptions && this.isTerminalConnectionFailure(error))
        this.handleRecoveryTerminal(error);
      else if (!this.recoveryOptions) this.emit('reconnectFailed', error);
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
