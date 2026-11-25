import {EventEmitter} from 'events';
import type {WebSocketManager} from './WebSocketManager';
import type {
  ConnectionServiceOptions,
  ConnectionLostDetails,
  ConnectionProp,
  ConnectionResetOptions,
  RegionRecoveryOptions,
  ConnectionRecoveryError,
  ConnectionRecoveryFailureKind,
} from './types';
import type {RecoveryFailure} from '../types';
import type {SubscribeRequest} from '../../../types';
import type {WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import {CONNECTION_SERVICE_FILE} from '../../../constants';
import {
  LOST_CONNECTION_RECOVERY_TIMEOUT,
  WS_DISCONNECT_ALLOWED,
  CONNECTIVITY_CHECK_INTERVAL,
  METHODS,
} from '../constants';
import {SUBSCRIBE_API} from '../../constants';
import {getSubscriptionMismatchReason, isRecord, normalizeRecoveryFailure} from '../Utils';

type Flight = {
  controller: AbortController;
  close?: 'retry' | 'stop';
};
type Invocation = RegionRecoveryOptions & {
  attempt: number;
  resolve: () => void;
  reject: (error: ConnectionRecoveryError) => void;
  onAbort: () => void;
};

const SAFE_REASONS = new Set([
  'RECOVERY_INTERRUPTED',
  'RECOVERY_IN_PROGRESS',
  'STALE_TASK',
  'REGION_RELOAD_REQUIRED',
  'REGION_MISMATCH_REGION_FAILOVER',
  'REGION_MISMATCH_ORG_OVERRIDE',
  'REGION_MISMATCH_ORG_OVERRIDE_SUPERSEDED',
  'REGION_MISMATCH_NO_OVERRIDE',
  'INTERNAL_ERROR',
  'AGENT_NOT_FOUND',
  'AGENT_DN_NOT_REGISTERED',
  'AGENT_SESSION_ALREADY_EXISTS',
]);
const safeFailure = (error: unknown, mismatch?: string): RecoveryFailure => {
  const {status, reasonCode, reason, id, trackingId} = normalizeRecoveryFailure(error);
  const safeReason = mismatch ?? (reason && SAFE_REASONS.has(reason) ? reason : undefined);

  return {
    ...(status !== undefined ? {status} : {}),
    ...(reasonCode !== undefined ? {reasonCode} : {}),
    ...(safeReason ? {reason: safeReason} : {}),
    ...(id ? {id} : {}),
    ...(trackingId ? {trackingId} : {}),
  };
};
const terminalError = (
  kind: ConnectionRecoveryFailureKind,
  failure?: RecoveryFailure
): ConnectionRecoveryError => Object.assign(new Error(kind), {data: {...failure, kind}});

/** Single-flight transport scheduler; station/session policy stays with ContactCenter. */
export class ConnectionService extends EventEmitter {
  private connectionProp: ConnectionProp = {
    lostConnectionRecoveryTimeout: LOST_CONNECTION_RECOVERY_TIMEOUT,
  };

  private mode: 'ordinary' | 'paused' | 'region' | 'stopped' = 'ordinary';
  private retryTimer?: ReturnType<typeof setTimeout>;
  private reconnectingTimer?: ReturnType<typeof setTimeout>;
  private restoreTimer?: ReturnType<typeof setTimeout>;
  private isConnectionLost = false;
  private isRestoreFailed = false;
  private isKeepAlive = false;
  private lossEpisode?: {startedAt: number; attempt: number};
  private flight?: Flight;
  private socketOwner?: Flight;
  private invocation?: Invocation;
  private registrationSignal?: AbortSignal;
  private onTerminalFailure?: ConnectionResetOptions['onTerminalFailure'];
  private webSocketManager: WebSocketManager;
  private subscribeRequest: SubscribeRequest;
  private readonly onRegistrationAbort = () => this.stop();

  constructor(options: ConnectionServiceOptions) {
    super();
    this.webSocketManager = options.webSocketManager;
    this.subscribeRequest = options.subscribeRequest;
    this.setupEventListeners();
  }

  public reset(options: ConnectionResetOptions): void {
    const retained =
      !this.flight && this.webSocketManager.hasUsableSocket() ? this.socketOwner : undefined;
    if (retained) this.socketOwner = undefined;
    this.stop();
    this.subscribeRequest = options.subscribeRequest;
    this.registrationSignal = options.signal;
    this.onTerminalFailure = options.onTerminalFailure;
    if (options.signal.aborted) {
      this.disposeFlight(retained);

      return;
    }
    this.socketOwner = retained;
    this.mode = 'ordinary';
    this.webSocketManager.shouldReconnect = true;
    this.updateConnectionData();
    options.signal.addEventListener('abort', this.onRegistrationAbort, {once: true});
    this.setupEventListeners();
    if (options.recoverIfDisconnected && !this.webSocketManager.hasUsableSocket())
      this.onSocketClose();
    else if (this.webSocketManager.hasUsableSocket()) this.monitorOrdinary();
  }

  public pause(): void {
    if (this.mode === 'stopped') return;
    this.mode = 'paused';
    this.cancelWork(true);
  }

  public stop(): void {
    this.mode = 'stopped';
    this.cancelWork();
    this.registrationSignal?.removeEventListener('abort', this.onRegistrationAbort);
    this.registrationSignal = undefined;
    this.onTerminalFailure = undefined;
    this.webSocketManager.off('message', this.onPing);
    this.webSocketManager.off('socketClose', this.onSocketClose);
  }

  public recoverRegion(options: RegionRecoveryOptions): Promise<void> {
    if (this.mode === 'stopped' || options.signal.aborted || this.registrationSignal?.aborted) {
      return Promise.reject(terminalError('cancelled'));
    }
    this.pause();
    this.mode = 'region';

    return new Promise((resolve, reject) => {
      const invocation: Invocation = {
        ...options,
        attempt: 0,
        resolve,
        reject,
        onAbort: () => this.pause(),
      };
      this.invocation = invocation;
      options.signal.addEventListener('abort', invocation.onAbort, {once: true});
      if (options.signal.aborted) invocation.onAbort();
      else this.scheduleRegion(invocation);
    });
  }

  public setConnectionProp(prop: ConnectionProp): void {
    this.connectionProp = prop;
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

  private disposeFlight(flight?: Flight): void {
    if (!flight) return;
    if (this.flight === flight) this.flight = undefined;
    if (this.socketOwner === flight) this.socketOwner = undefined;
    flight.controller.abort();
  }

  private cancelWork(preserveSocket = false): void {
    this.clearTimers();
    const invocation = this.invocation;
    this.invocation = undefined;
    this.disposeFlight(this.flight);
    if (!preserveSocket) this.disposeFlight(this.socketOwner);
    this.webSocketManager.cancelPending(terminalError('cancelled'));
    if (invocation) {
      invocation.signal.removeEventListener('abort', invocation.onAbort);
      invocation.reject(terminalError('cancelled'));
    }
  }

  private createFlight(): Flight {
    this.disposeFlight(this.socketOwner);
    const flight: Flight = {controller: new AbortController()};
    this.flight = flight;

    return flight;
  }

  private subscribePrimary(signal: AbortSignal): Promise<WelcomeResponse> {
    return this.webSocketManager
      .initWebSocket({body: this.subscribeRequest, resource: SUBSCRIBE_API, signal})
      .catch((error: unknown) => {
        // A forced close can reject admission and abort the flight in the same turn.
        throw signal.aborted ? terminalError('cancelled') : error;
      });
  }

  private ownsInvocation(invocation: Invocation): boolean {
    return (
      this.mode === 'region' &&
      this.invocation === invocation &&
      !invocation.signal.aborted &&
      !this.registrationSignal?.aborted
    );
  }

  private scheduleRegion(invocation: Invocation): void {
    if (!this.ownsInvocation(invocation)) return;
    invocation.attempt += 1;
    const attempt = invocation.attempt;
    const base = [100000, 60000, 30000, 15000][Math.min(attempt - 1, 3)];
    const wait = base * (1 + 0.5 * Math.random());
    try {
      invocation.onScheduled(attempt, wait);
    } catch {
      /* The scheduler owns pacing independently of observers. */
    }
    if (!this.ownsInvocation(invocation)) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.runRegionAttempt(invocation).catch(() => {
        if (this.ownsInvocation(invocation))
          this.failRegion(invocation, terminalError('after-welcome-failed'));
      });
    }, wait);
  }

  /** Observes abandoned callbacks while aborting the logical attempt promptly. */
  private static observe<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener('abort', onAbort);
        reject(terminalError('cancelled'));
      };
      signal.addEventListener('abort', onAbort, {once: true});
      work.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        }
      );
      if (signal.aborted) onAbort();
    });
  }

  private async runRegionAttempt(invocation: Invocation): Promise<void> {
    if (!this.ownsInvocation(invocation)) return;
    let canAttempt: boolean;
    try {
      canAttempt = invocation.canAttempt?.() ?? true;
    } catch {
      canAttempt = false;
    }
    // Identity detection may synchronously stop or replace the scheduler's owner.
    if (!this.ownsInvocation(invocation)) return;
    if (!canAttempt) {
      this.failRegion(invocation, terminalError('cancelled'));

      return;
    }
    const flight = this.createFlight();
    const {signal} = flight.controller;
    let welcomed = false;
    try {
      const welcome = await this.subscribePrimary(signal);
      if (!this.ownsInvocation(invocation) || this.flight !== flight) return;
      if (signal.aborted) throw terminalError('cancelled');
      welcomed = true;
      const publishOutcome = await ConnectionService.observe(
        Promise.resolve().then(() => invocation.afterWelcome(welcome, signal)),
        signal
      );
      if (!this.ownsInvocation(invocation) || this.flight !== flight) return;
      if (signal.aborted) throw terminalError('cancelled');
      this.flight = undefined;
      this.socketOwner = flight;
      this.invocation = undefined;
      invocation.signal.removeEventListener('abort', invocation.onAbort);
      this.mode = 'ordinary';
      this.updateConnectionData();
      this.monitorOrdinary();
      invocation.resolve();
      if (publishOutcome) publishOutcome();
    } catch (error) {
      if (!this.ownsInvocation(invocation) || this.flight !== flight) return;
      const mismatch = welcomed ? undefined : getSubscriptionMismatchReason(error);
      const failure = safeFailure(error, mismatch);
      const auth = failure.status === 401 || failure.status === 403;
      const cancelled = flight.close === 'stop' || (signal.aborted && !flight.close);
      let kind: ConnectionRecoveryFailureKind | undefined;
      if (cancelled) kind = 'cancelled';
      else if (auth) kind = 'authentication-failed';
      else if (mismatch) kind = 'region-mismatch';
      else if (welcomed && !flight.close) kind = 'after-welcome-failed';
      if (kind) {
        this.failRegion(
          invocation,
          terminalError(kind, kind === 'cancelled' ? undefined : failure)
        );

        return;
      }
      this.disposeFlight(flight);
      try {
        invocation.onAttemptSettled?.(invocation.attempt, 'retrying', failure);
      } catch {
        /* Best-effort diagnostic seam. */
      }
      if (this.ownsInvocation(invocation)) this.scheduleRegion(invocation);
    }
  }

  private failRegion(invocation: Invocation, error: ConnectionRecoveryError): void {
    if (this.invocation !== invocation) return;
    const {kind, ...failure} = error.data;
    // Commit old-owner cleanup before observers can cancel or replace the registration.
    this.invocation = undefined;
    invocation.signal.removeEventListener('abort', invocation.onAbort);
    this.stop();
    this.webSocketManager.close(false, 'Terminal recovery');
    if (kind !== 'cancelled') {
      try {
        invocation.onAttemptSettled?.(invocation.attempt, 'terminal', failure);
      } catch {
        /* The captured terminal error settles independently of observers. */
      }
    }
    invocation.reject(error);
  }

  private dispatchConnectionEvent(socketReconnected = false): void {
    const details: ConnectionLostDetails = {
      isConnectionLost: this.isConnectionLost,
      isRestoreFailed: this.isRestoreFailed,
      isSocketReconnected: socketReconnected,
      isKeepAlive: this.isKeepAlive,
    };
    try {
      this.webSocketManager.handleConnectionLost(details);
    } catch {
      /* Owner state is already settled. */
    }
    try {
      this.emit('connectionLost', details);
    } catch {
      /* Host observers cannot restart scheduling. */
    }
  }

  private updateConnectionData(): void {
    this.isConnectionLost = false;
    this.isRestoreFailed = false;
  }

  private monitorOrdinary(): void {
    if (this.mode !== 'ordinary') return;
    clearTimeout(this.reconnectingTimer);
    clearTimeout(this.restoreTimer);
    this.reconnectingTimer = setTimeout(this.handleConnectionLost, WS_DISCONNECT_ALLOWED);
    this.restoreTimer = setTimeout(
      this.handleRestoreFailed,
      this.connectionProp.lostConnectionRecoveryTimeout
    );
  }

  private handleConnectionLost = (): void => {
    if (this.mode !== 'ordinary') return;
    this.isConnectionLost = true;
    this.dispatchConnectionEvent();
  };

  private handleRestoreFailed = (): void => {
    if (this.mode !== 'ordinary') return;
    if (this.lossEpisode || !this.webSocketManager.hasUsableSocket()) {
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
    if (this.mode !== 'ordinary' || this.flight) return;
    let data: unknown;
    try {
      data = JSON.parse(event as string);
    } catch {
      ConnectionService.diagnose('error', 'onPing failed to parse payload', METHODS.ON_PING);

      return;
    }
    if (!isRecord(data) || Array.isArray(data)) {
      ConnectionService.diagnose(
        'error',
        'onPing received non-object payload, ignoring',
        METHODS.ON_PING
      );

      return;
    }
    this.isKeepAlive = data.keepalive === 'true';
    this.monitorOrdinary();
    if (this.isConnectionLost || this.isKeepAlive) {
      this.updateConnectionData();
      this.dispatchConnectionEvent();
    }
  };

  private scheduleOrdinary(): void {
    if (this.mode !== 'ordinary' || this.retryTimer || this.flight || !this.lossEpisode) return;
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
    if (this.mode !== 'ordinary' || this.flight || !episode) return;
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
    const flight = this.createFlight();
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false)
        throw new Error('Browser offline');
      await this.subscribePrimary(flight.controller.signal);
      if (this.mode !== 'ordinary' || this.flight !== flight) return;
      if (flight.controller.signal.aborted) throw terminalError('cancelled');
      diagnose('succeeded');
      if (this.mode !== 'ordinary' || this.flight !== flight || this.lossEpisode !== episode)
        return;
      this.flight = undefined;
      this.socketOwner = flight;
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      this.lossEpisode = undefined;
      this.updateConnectionData();
      this.monitorOrdinary();
      this.dispatchConnectionEvent(true);
    } catch (error) {
      if (this.mode !== 'ordinary' || this.flight !== flight) return;
      this.disposeFlight(flight);
      if (flight.close === 'stop' || !this.webSocketManager.shouldReconnect) {
        this.stop();

        return;
      }
      const mismatch = getSubscriptionMismatchReason(error);
      const failure = safeFailure(error, mismatch);
      const {status} = failure;
      const isTerminal = status === 401 || status === 403 || !!mismatch;
      diagnose(isTerminal ? 'terminal' : 'retrying', failure);
      if (this.mode !== 'ordinary' || this.lossEpisode !== episode) return;
      if (isTerminal) {
        const callback = this.onTerminalFailure;
        const terminal = terminalError(
          mismatch ? 'region-mismatch' : 'authentication-failed',
          failure
        );
        this.stop();
        this.webSocketManager.close(false, 'Terminal admission');
        try {
          callback?.(terminal);
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
    if (this.mode !== 'ordinary' && this.mode !== 'region') return;
    const shouldReconnect =
      event?.shouldReconnect !== false && this.webSocketManager.shouldReconnect;
    const flight = this.flight;
    if (flight) {
      flight.close = shouldReconnect ? 'retry' : 'stop';
      flight.controller.abort();

      return;
    }
    if (!shouldReconnect) {
      this.stop();

      return;
    }
    if (this.mode !== 'ordinary') return;
    // Aborting the adopted socket and emitting loss can synchronously reset the scheduler.
    const episode = this.lossEpisode ?? {startedAt: Date.now(), attempt: 0};
    this.lossEpisode = episode;
    clearTimeout(this.reconnectingTimer);
    this.isConnectionLost = true;
    if (!this.restoreTimer)
      this.restoreTimer = setTimeout(this.handleRestoreFailed, LOST_CONNECTION_RECOVERY_TIMEOUT);
    this.scheduleOrdinary();
    this.disposeFlight(this.socketOwner);
    if (this.lossEpisode === episode) this.dispatchConnectionEvent();
  };
}

export default ConnectionService;
