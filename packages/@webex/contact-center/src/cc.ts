/**
 * @module CCPlugin
 * @packageDocumentation
 * Contact Center Plugin module that provides functionality for managing contact center agents,
 * handling tasks, and interacting with contact center services. This module enables integration
 * with Webex Contact Center features through the WebexSDK.
 */

import {WebexPlugin} from '@webex/webex-core';
import EventEmitter from 'events';
import isEqual from 'lodash/isEqual';
import {v4 as uuidv4} from 'uuid';
import {
  SetStateResponse,
  CCPluginConfig,
  IContactCenter,
  WebexSDK,
  LoginOption,
  AgentLogin,
  AgentProfileUpdate,
  StationLoginResponse,
  StationLogoutResponse,
  BuddyAgentsResponse,
  BuddyAgents,
  SubscribeRequest,
  UploadLogsResponse,
  UpdateDeviceTypeResponse,
  GenericError,
  ConfigFlags,
  WellnessBreakEvent,
  WellnessBreakNotificationAction,
  WELLNESS_BREAK_NOTIFICATION_ACTIONS,
  VoiceConnectionState,
  VOICE_CONNECTION_ERROR,
} from './types';
import {
  READY,
  CC_FILE,
  EMPTY_STRING,
  OUTDIAL_DIRECTION,
  ATTRIBUTES,
  OUTDIAL_MEDIA_TYPE,
  OUTBOUND_TYPE,
  UNKNOWN_ERROR,
  MERCURY_DISCONNECTED_SUCCESS,
  METHODS,
  WELLNESS_BREAK_HANDLER,
  DEFAULT_VOICE_CONNECTION_STATE,
  REGION_RECOVERY_EVENTS,
  REGION_RECOVERY_ERROR_CODES,
} from './constants';
import {AGENT_STATE_AVAILABLE, AGENT_STATE_AVAILABLE_ID} from './services/config/constants';
import {RTD_SUBSCRIBE_API, SUBSCRIBE_API, WEB_RTC_PREFIX} from './services/constants';
import Services from './services';
import WebexRequest from './services/core/WebexRequest';
import LoggerProxy from './logger-proxy';
import {StateChange, Logout, AGENT_EVENTS} from './services/agent/types';
import {buildStationLoginPayload, getStationRecoveryFailureCategory} from './services/agent';
import {
  getErrorDetails,
  isRecord,
  isValidDialNumber,
  sanitizeForObservability,
  awaitRecoveryWork,
  createRegionRecoveryError,
  normalizeRecoveryFailure,
  normalizeRecoveryDiagnosticId,
  normalizeRegionSwitch,
  waitForRecoveryDelay,
  getSubscriptionMismatchReason,
  isRegionRecoveryError,
} from './services/core/Utils';
import type {MultiRegionSettings, SystemRegionSwitch} from './services/config/types';
import type * as Agent from './services/agent/types';
import type {RecoveryFailure} from './services/core/types';
import type {
  RegionRecoveryErrorCode,
  RegionRecoveryState,
  EntryPointListResponse,
  EntryPointSearchParams,
  ContactServiceQueuesResponse,
  ContactServiceQueueSearchParams,
} from './types';
import {
  Profile,
  CC_EVENTS,
  VOICE_CONNECTION_EVENTS,
  OutdialAniEntriesResponse,
  OutdialAniParams,
  Entity,
  SYSTEM_EVENTS,
} from './services/config/types';
import {ConnectionLostDetails} from './services/core/websocket/types';
import TaskManager from './services/task/TaskManager';
import WebCallingService from './services/WebCallingService';
import AnswerCallOnWebexService from './services/AnswerCallOnWebexService';
import WebexCrossClientService from './services/WebexCrossClientService';
import WxAppTelephonyMercurySync from './services/WxAppTelephonyMercurySync';
import {logWxAppSessionReadiness} from './services/wxAppDiagnosticLogging';
import {
  ITask,
  TASK_EVENTS,
  TaskResponse,
  DialerPayload,
  PreviewContactPayload,
} from './services/task/types';
import MetricsManager from './metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from './metrics/constants';
import {Failure} from './services/core/GlobalTypes';
import {EntryPoint} from './services/EntryPoint';
import {AddressBook} from './services/AddressBook';
import {Queue} from './services/Queue';
import {ApiAIAssistant} from './services/ApiAiAssistant';
import {UserPreference} from './services/UserPreference';

/**
 * Typed allow-list of server-controlled websocket event names this SDK re-emits verbatim.
 * Guards against emitting an arbitrary/unknown `data.type` supplied by the websocket payload.
 * @ignore
 */
const CC_EVENT_ALLOW_LIST = new Set<string>(Object.values(CC_EVENTS));
const STATION_RELOAD_RETRY_DELAYS_MS = [2000, 4000, 8000];

type RecoveryPhase =
  | 'idle'
  | 'waiting'
  | 'restoringSession'
  | 'ready'
  | 'manualLoginRequired'
  | 'unavailable'
  | 'reloadRequired'
  | 'cancelled';

type InitialRegistration = {
  readonly registration: number;
  readonly orgId: string;
  readonly controller: AbortController;
  reloadRequired?: Error;
  rejectConnectionWait?: (error: Error) => void;
};

type RegionRecovery = {
  registration: number;
  orgId: string;
  agentId: string;
  controller: AbortController;
  detach: () => void;
  stage: 'reload' | 'fallback' | 'post1035' | 'manual';
  reloads: number;
  retryNotBefore: number;
  attempt?: {attempt: number; startedAt: number; welcomeStartedAt?: number};
};

type RecoveryDiagnosticStage =
  | 'ignored-event'
  | 'scheduled-wait'
  | 'admission'
  | 'welcome'
  | 'reload'
  | 'fallback-login'
  | 'rtd'
  | 'auto-available';
type RecoveryDiagnosticOutcome =
  | 'succeeded'
  | 'retrying'
  | 'terminal'
  | 'failed'
  | 'cancelled'
  | 'dropped'
  | 'waiting';
type RecoveryDiagnosticPayload = Readonly<{
  stage: RecoveryDiagnosticStage;
  outcome: RecoveryDiagnosticOutcome;
  attempt: number;
  elapsedMs: number;
  reason?: RegionRecoveryState['reason'] | RegionRecoveryErrorCode;
  status?: number;
  reasonCode?: number;
  id?: string;
  trackingId?: string;
}>;

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

type AutoAvailable = {
  agentId: string;
  signal: AbortSignal;
  requesting: boolean;
};

/**
 * The main Contact Center plugin class that enables integration with Webex Contact Center.
 *
 * @class ContactCenter
 * @extends WebexPlugin
 * @implements IContactCenter
 * @description
 * Features:
 *
 * 1. Session Management:
 *   - {@link register} - Initialize and register SDK with contact center
 *   - {@link deregister} - Cleanup and disconnect SDK resources
 *
 * 2. Agent Login/Logout:
 *   - {@link stationLogin} - Login with browser or desk phone
 *   - {@link stationLogout} - Logout from current station
 *   - {@link updateAgentProfile} - Update device type and settings
 *
 * 3. Agent State Control:
 *   - {@link setAgentState} - Change agent state (Available/Idle)
 *
 * 4. Task Management:
 *   - Inbound task handling via events
 *   - {@link startOutdial} - Make outbound calls
 *
 * 5. Routing & Distribution:
 *   - {@link getQueues} - Get available queues for routing
 *   - {@link getBuddyAgents} - Get available buddy agents
 *
 * 6. Diagnostics:
 *   - {@link uploadLogs} - Upload logs for troubleshooting
 *
 *  * Key Events:
 * - Agent State Events:
 *   - `agent:stateChange` - Agent's state has changed (Available, Idle, etc.)
 *   - `agent:stateChangeSuccess` - Agent state change was successful
 *   - `agent:stateChangeFailed` - Agent state change failed
 *
 * - Session Events:
 *   - `agent:stationLoginSuccess` - Agent login was successful
 *   - `agent:stationLoginFailed` - Agent login failed
 *   - `agent:logoutSuccess` - Agent logout was successful
 *   - `agent:logoutFailed` - Agent logout failed
 *
 * - Task Events:
 *   - `task:incoming` - New task is being offered
 *   - `task:hydrate` - Task data has been updated
 *   - `task:established` - Task/call has been connected
 *   - `task:ended` - Task/call has ended
 *   - `task:error` - An error occurred during task handling
 *   - `task:campaignPreviewReservation` - Campaign preview contact offered to agent
 *
 * @public
 *
 * @example
 * ```typescript
 * import Webex from 'webex';
 *
 * // Initialize SDK with access token
 * const webex = new Webex({
 *   credentials: 'YOUR_ACCESS_TOKEN'
 * });
 *
 * // Get Contact Center plugin instance
 * const cc = webex.cc;
 *
 * // Setup event handlers
 * cc.on('agent:stateChange', (event) => {
 *   console.log('Agent state changed:', event.state);
 * });
 *
 * cc.on('task:incoming', (task) => {
 *   console.log('New task received:', task.interactionId);
 * });
 *
 * // Initialize agent session
 * async function initializeAgent() {
 *   try {
 *     // Register with contact center
 *     const profile = await cc.register();
 *
 *     // Login with browser-based calling
 *     await cc.stationLogin({
 *       teamId: profile.teams[0].id,
 *       loginOption: 'BROWSER'
 *     });
 *
 *     // Set agent to Available state
 *     await cc.setAgentState({
 *       state: 'Available',
 *       auxCodeId: '0'
 *     });
 *
 *     console.log('Agent initialized and ready');
 *   } catch (error) {
 *     console.error('Initialization failed:', error);
 *     await cc.uploadLogs();  // Upload logs for troubleshooting
 *   }
 * }
 *
 * initializeAgent();
 * ```
 *
 * @public
 */

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  /**
   * The plugin's unique namespace identifier in the Webex SDK.
   * Used to access the plugin via webex.cc
   * @type {string}
   * @public
   */
  namespace = 'cc';

  /**
   * Plugin configuration settings including connection and authentication options
   * @type {CCPluginConfig}
   * @private
   */
  private $config: CCPluginConfig;

  /**
   * Reference to the parent Webex SDK instance
   * Used to access core Webex functionality and credentials
   * @type {WebexSDK}
   * @private
   */
  private $webex: WebexSDK;

  /**
   * Event emitter for handling internal plugin events
   * Manages event subscriptions and notifications
   * @type {EventEmitter}
   * @private
   */
  private eventEmitter: EventEmitter;

  /**
   * Agent's profile and configuration data
   * Includes capabilities, teams, settings, and current state
   * @type {Profile}
   * @private
   */
  private agentConfig: Profile;

  /**
   * Service for managing browser-based calling (WebRTC)
   * Handles audio/video streaming and device management
   * @type {WebCallingService}
   * @private
   */
  private webCallingService: WebCallingService;

  /**
   * REST telephony for wxApp thick-client answer (WXCC-6026)
   * @private
   */
  private answerCallOnWebexService: AnswerCallOnWebexService;

  /**
   * usersub cross-client state for Webex App toast suppression
   * @private
   */
  private webexCrossClientService: WebexCrossClientService;

  /**
   * Mercury telephony mute sync for wxApp thick-client answer
   * @private
   */
  private wxAppTelephonyMercurySync: WxAppTelephonyMercurySync;

  /** True when wxApp mute sync opened Mercury (Extension/DN-only profiles). */
  private wxAppMercuryConnectedByCc = false;

  /** True when wxApp mute sync registered the Webex device. */
  private wxAppDeviceRegisteredByCc = false;

  private static readonly WXAPP_FALSE_PUBLISH_RETRY_DELAY_MS = 30_000;
  private static readonly WXAPP_FALSE_PUBLISH_MAX_RETRIES = 3;
  private wxAppFalsePublishRetryTimer?: ReturnType<typeof setTimeout>;

  /**
   * Core service managers for Contact Center operations
   * Includes agent, connection, and configuration services
   * @type {Services}
   * @private
   */
  private services: Services;

  /**
   * Service for making authenticated HTTP requests to Webex APIs
   * Handles request/response lifecycle and error handling
   * @type {WebexRequest}
   * @private
   */
  private webexRequest: WebexRequest;

  /**
   * Manager for handling contact center tasks (calls, chats, etc.)
   * Coordinates task lifecycle events and state
   * @type {TaskManager}
   * @private
   */
  private taskManager: TaskManager;

  /**
   * Manager for tracking and reporting SDK metrics and analytics
   * Monitors performance, errors, and usage patterns
   * @type {MetricsManager}
   * @private
   */
  private metricsManager: MetricsManager;

  /** Current login/relogin session used for agent-scoped wellness validation. */
  private currentAgentSessionId?: string;

  /** Registered-session cache for the system WellbeingBreak idle code. */
  private wellbeingBreakIdleCode?: Entity;

  /** Registration generation that owns the wellness idle-code cache and in-flight lookups. */
  private registrationGeneration = 0;
  /** Reject station mutations for an ended owner, independently of replacement-register entry. */
  private registrationAbortController?: AbortController;
  private pendingRegistration?: InitialRegistration;
  private registrationOrgId?: string;
  private registrationAgentId?: string;
  private recoveryGeneration = 0;
  private recoveryPhase: RecoveryPhase = 'idle';
  private recovery?: RegionRecovery;

  private readonly acceptedSwitchIds = new Set<string>();
  private acceptedStation?: Agent.UserStationLogin;
  private priorStationActive = false;
  private suppressAutomaticRelogin = false;
  private rtdConnection?: Promise<unknown>;
  private autoAvailable?: AutoAvailable;

  private multiRegionSettings: MultiRegionSettings | null = null;

  private lastPublishedRegionState?: RegionRecoveryState;
  private regionStateContext: Pick<
    RegionRecoveryState,
    'trackingId' | 'operation' | 'scope' | 'autoAvailable'
  > = {};

  private recordBestEffort(effect: () => void): void {
    try {
      effect();
    } catch {
      /* Diagnostics and host observers do not own SDK progress. */
    }
  }

  private publishHostEvent(event: string, payload: unknown, trigger = false): void {
    this.recordBestEffort(() => {
      // @ts-ignore - ampersand-events methods are provided by WebexPlugin at runtime.
      if (trigger) this.trigger(event, payload);
      // @ts-ignore - ampersand-events methods are provided by WebexPlugin at runtime.
      else this.emit(event, payload);
    });
  }

  private static isRecoveryDiagnosticReason(
    value: unknown
  ): value is RegionRecoveryState['reason'] | RegionRecoveryErrorCode {
    return typeof value === 'string' && RECOVERY_DIAGNOSTIC_REASONS.has(value);
  }

  private recordRecoveryDiagnostic(
    stage: RecoveryDiagnosticStage,
    outcome: RecoveryDiagnosticOutcome,
    attempt: number,
    startedAt: number,
    failure?: RecoveryFailure
  ): void {
    if (startedAt === undefined) return;
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const id = normalizeRecoveryDiagnosticId(failure?.id);
    const trackingId = normalizeRecoveryDiagnosticId(failure?.trackingId);
    const payload: RecoveryDiagnosticPayload = {
      stage,
      outcome,
      attempt,
      elapsedMs,
      ...(Number.isFinite(failure?.status) ? {status: failure.status} : {}),
      ...(Number.isFinite(failure?.reasonCode) ? {reasonCode: failure.reasonCode} : {}),
      ...(id ? {id} : {}),
      ...(trackingId ? {trackingId} : {}),
      ...(ContactCenter.isRecoveryDiagnosticReason(failure?.reason)
        ? {reason: failure.reason}
        : {}),
    };
    this.recordBestEffort(() =>
      LoggerProxy.info('Region recovery', {
        module: CC_FILE,
        method: METHODS.RECORD_RECOVERY_DIAGNOSTIC,
        data: {...payload},
      })
    );
    let metric:
      | typeof METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS
      | typeof METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED
      | typeof METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS
      | typeof METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED
      | undefined;
    if (stage === 'admission') {
      if (outcome === 'succeeded') metric = METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS;
      else if (outcome === 'retrying' || outcome === 'terminal')
        metric = METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED;
    } else if (stage === 'reload') {
      if (outcome === 'succeeded') metric = METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS;
      else if (['retrying', 'terminal', 'failed'].includes(outcome))
        metric = METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED;
    }
    if (metric)
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(metric, {...payload}, ['operational'])
      );
  }

  private static getRegistrationErrorDetails(error: unknown) {
    const failure = normalizeRecoveryFailure(error);
    const id = normalizeRecoveryDiagnosticId(failure.id);
    const trackingId =
      normalizeRecoveryDiagnosticId(failure.trackingId) ??
      normalizeRecoveryDiagnosticId(isRecord(error) ? error.trackingId : undefined);

    return {
      ...(Number.isFinite(failure.status) ? {status: failure.status} : {}),
      ...(Number.isFinite(failure.reasonCode) ? {reasonCode: failure.reasonCode} : {}),
      ...(id ? {id} : {}),
      ...(trackingId ? {trackingId} : {}),
    };
  }

  /** Refresh placement; ended owners can publish detached settings after live invalidation. */
  private publishRegionState(
    state: RegionRecoveryState,
    settings = this.multiRegionSettings
  ): void {
    const retained = {...state};
    delete retained.homeRegion;
    delete retained.servingRegion;
    delete retained.limitedService;
    const homeRegion = settings?.homeRegion;
    const servingRegion = this.services.webSocketManager.getServingRegion();
    const snapshot = Object.freeze({
      ...retained,
      ...(homeRegion ? {homeRegion} : {}),
      ...(servingRegion ? {servingRegion} : {}),
      ...(settings?.multiRegionEnabled && homeRegion && servingRegion
        ? {limitedService: homeRegion !== servingRegion}
        : {}),
    });
    if (isEqual(snapshot, this.lastPublishedRegionState)) return;
    this.lastPublishedRegionState = snapshot;
    this.publishHostEvent(REGION_RECOVERY_EVENTS.STATE_CHANGE, snapshot, true);
  }

  /** Builds initiating recovery context; publication adds the current placement metadata. */
  private buildRegionState(
    status: RegionRecoveryState['status'],
    reason: RegionRecoveryState['reason'],
    retryAfterMs?: number
  ): RegionRecoveryState {
    return {
      status,
      reason,
      ...this.regionStateContext,
      ...(Number.isFinite(retryAfterMs) ? {retryAfterMs: Math.max(0, retryAfterMs)} : {}),
    };
  }

  /** Ends publication context independently from the registration entitlement lifetime. */
  private resetRegionState(): void {
    this.lastPublishedRegionState = undefined;
    this.regionStateContext = {};
  }

  private isCurrentRegistration(orgId: string, signal: AbortSignal): boolean {
    if (signal !== this.registrationAbortController?.signal || signal?.aborted) return false;
    if (this.$webex.credentials.getOrgId() === orgId) return true;
    this.terminateRegistration(true);

    return false;
  }

  private assertInitialRegistration(attempt: InitialRegistration): void {
    if (attempt.reloadRequired) throw attempt.reloadRequired;
    if (!this.isCurrentRegistration(attempt.orgId, attempt.controller.signal))
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
  }

  private fenceRecoveryWork(phase: RecoveryPhase): void {
    this.recoveryPhase = phase;
    this.recoveryGeneration += 1;
  }

  private cancelRegionRecovery(): void {
    const recovery = this.recovery;
    this.recovery = undefined;
    if (!recovery) return;
    recovery.detach();
    recovery.controller.abort();
    const {attempt} = recovery;
    if (attempt)
      this.recordRecoveryDiagnostic('admission', 'cancelled', attempt.attempt, attempt.startedAt);
  }

  private clearAcceptedStation(): void {
    this.acceptedStation = undefined;
    this.priorStationActive = false;
    if (this.agentConfig) {
      this.agentConfig.isAgentLoggedIn = false;
      this.agentConfig.currentTeamId = undefined;
      this.agentConfig.deviceType = undefined;
      this.agentConfig.dn = undefined;
      this.agentConfig.defaultDn = undefined;
    }
  }

  /** Full registration boundaries are distinct from station logout and optional RTD loss. */
  private terminateRegistration(identityFailure = false): number | undefined {
    const cancelled = this.cancelAutoAvailable();
    const publicationSettings = this.multiRegionSettings;
    this.registrationGeneration += 1;
    // Invalidate the ended owner before aborts, diagnostics or host publication can reenter.
    this.acceptedSwitchIds.clear();
    this.clearAcceptedStation();
    this.multiRegionSettings = null;
    this.registrationAgentId = undefined;
    this.wellbeingBreakIdleCode = undefined;
    this.registrationAbortController?.abort();
    this.cancelRegionRecovery();
    this.fenceRecoveryWork('unavailable');
    const termination = this.registrationGeneration;
    const ownsTermination = () => termination === this.registrationGeneration;
    this.services.connectionService.stop();
    this.pauseRtd('registrationEnded');
    this.services.webSocketManager.close(false, 'registrationEnded');
    this.taskManager.unregisterIncomingCallEvent();
    this.taskManager.invalidateRegionalTasks();
    if (cancelled) this.publishRegionState(cancelled, publicationSettings);
    if (!ownsTermination()) return undefined;
    if (identityFailure) {
      delete this.regionStateContext.autoAvailable;
      this.publishRegionState(
        this.buildRegionState('unavailable', 'recovery-failed'),
        publicationSettings
      );
      if (!ownsTermination()) return undefined;
    }
    this.resetRegionState();

    return termination;
  }

  private isCurrentRecovery(recovery: RegionRecovery): boolean {
    return (
      this.recovery === recovery &&
      !recovery.controller.signal.aborted &&
      this.isCurrentRegistration(recovery.orgId, this.registrationAbortController.signal)
    );
  }

  private resetOrdinaryConnection(): void {
    const orgId = this.registrationOrgId;
    const signal = this.registrationAbortController.signal;
    this.services.connectionService.reset({
      subscribeRequest: this.getConnectionConfig(),
      signal,
      onTerminalFailure: (error) => {
        if (!this.isCurrentRegistration(orgId, signal)) return;
        const pending = this.pendingRegistration;
        if (pending?.controller.signal === signal) pending.rejectConnectionWait?.(error);
        this.handleRecoveryTerminal(error);
      },
    });
  }

  /** Registration owns its relogin even when ordinary recovery supplies the primary. */
  private async awaitRegistrationConnection(attempt: InitialRegistration): Promise<void> {
    if (this.hasRegionalConnectionOwner()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    const manager = this.services.webSocketManager;
    if (manager.hasUsableSocket()) return;
    if (manager.shouldReconnect === false) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

    let onConnection: (details: ConnectionLostDetails) => void;
    let onClose: (event: {shouldReconnect: boolean}) => void;
    const connected = new Promise<void>((resolve, reject) => {
      attempt.rejectConnectionWait = reject;
      onConnection = (details) => {
        if (details.isRestoreFailed) reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        else if (details.isSocketReconnected && manager.hasUsableSocket()) resolve();
      };
      onClose = ({shouldReconnect}) => {
        if (!shouldReconnect) reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));
      };
      this.services.connectionService.on('connectionLost', onConnection);
      manager.on('socketClose', onClose);
    });
    try {
      await awaitRecoveryWork(connected, attempt.controller.signal);
    } finally {
      attempt.rejectConnectionWait = undefined;
      this.services.connectionService.off('connectionLost', onConnection);
      manager.off('socketClose', onClose);
    }
  }

  private hasRegionalConnectionOwner(): boolean {
    return (
      !['unavailable', 'reloadRequired'].includes(this.recoveryPhase) &&
      (Boolean(this.recovery) || !['idle', 'ready', 'cancelled'].includes(this.recoveryPhase))
    );
  }

  private handleRecoveryTerminal(error: unknown): void {
    const failure = normalizeRecoveryFailure(error);
    const kind = isRecord(error) && isRecord(error.data) ? error.data.kind : undefined;
    if (kind === 'cancelled' || failure.reason === 'RECOVERY_INTERRUPTED') {
      this.cancelRegionRecovery();

      return;
    }
    if (kind === 'region-mismatch' || getSubscriptionMismatchReason(error)) {
      this.requireRegionReload();

      return;
    }
    this.finishRegionRecovery(
      'unavailable',
      kind === 'authentication-failed' || failure.status === 401 || failure.status === 403
        ? 'authentication-failed'
        : 'recovery-failed'
    );
  }

  private requireRegionReload(): void {
    const pending = this.pendingRegistration;
    if (
      pending?.registration === this.registrationGeneration &&
      pending.controller === this.registrationAbortController
    ) {
      pending.reloadRequired ??= createRegionRecoveryError('REGION_RELOAD_REQUIRED');
    }
    if (this.recoveryPhase === 'reloadRequired') return;
    this.finishRegionRecovery('reloadRequired', 'region-mismatch');
  }

  private finishRegionRecovery(
    status: 'unavailable' | 'reloadRequired',
    reason: RegionRecoveryState['reason']
  ): void {
    const cancelled = this.cancelAutoAvailable();
    this.cancelRegionRecovery();
    this.fenceRecoveryWork(status);
    const closeReason = status === 'reloadRequired' ? 'regionMismatch' : 'recoveryFailed';
    this.services.connectionService.stop();
    this.services.webSocketManager.close(false, closeReason);
    this.pauseRtd(closeReason);
    this.taskManager.invalidateRegionalTasks();
    const generation = this.recoveryGeneration;
    if (cancelled) this.publishRegionState(cancelled);
    if (generation !== this.recoveryGeneration) return;
    delete this.regionStateContext.autoAvailable;
    this.publishRegionState(this.buildRegionState(status, reason));
  }

  private handleRegionSwitch(event: SystemRegionSwitch): void {
    const startedAt = Date.now();
    const recordIgnoredSwitch = () =>
      this.recordRecoveryDiagnostic('ignored-event', 'dropped', 0, startedAt, {
        trackingId: event.trackingId,
      });
    const signal = this.registrationAbortController?.signal;
    const orgId = this.registrationOrgId;
    if (!signal || signal.aborted || !this.registrationAgentId) return;
    if (['unavailable', 'reloadRequired'].includes(this.recoveryPhase)) {
      recordIgnoredSwitch();

      return;
    }
    if (this.$webex.credentials.getOrgId() !== orgId) {
      this.terminateRegistration(true);

      return;
    }
    if (event.orgId !== orgId) {
      recordIgnoredSwitch();

      return;
    }
    if (!this.multiRegionSettings || this.acceptedSwitchIds.has(event.trackingId)) {
      recordIgnoredSwitch();

      return;
    }
    this.acceptedSwitchIds.add(event.trackingId);
    if (this.acceptedSwitchIds.size > 128)
      this.acceptedSwitchIds.delete(this.acceptedSwitchIds.values().next().value);
    const cancelled = this.cancelAutoAvailable();
    this.services.webSocketManager.clearServingRegion();
    this.cancelRegionRecovery();
    this.fenceRecoveryWork('waiting');
    this.services.connectionService.pause();
    this.pauseRtd();
    if (cancelled) this.publishRegionState(cancelled);
    if (signal.aborted) return;
    this.resetRegionState();
    this.regionStateContext = {trackingId: event.trackingId, ...event.data};
    if (this.multiRegionSettings?.multiRegionEnabled === false) {
      this.recoveryPhase = 'unavailable';
      this.services.connectionService.stop();
      this.services.webSocketManager.close(false, 'notEligible');
      this.taskManager.invalidateRegionalTasks();
      this.services.rtdWebSocketManager.close(false, 'notEligible');
      this.publishRegionState(this.buildRegionState('unavailable', 'not-eligible'));

      return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, {once: true});
    const recovery: RegionRecovery = {
      registration: this.registrationGeneration,
      orgId: event.orgId,
      agentId: this.registrationAgentId,
      controller,
      detach: () => signal.removeEventListener('abort', abort),
      stage: 'reload',
      reloads: 0,
      retryNotBefore: 0,
    };
    this.recovery = recovery;
    this.publishRegionState(this.buildRegionState('recovering', 'region-switch'));
    if (!this.isCurrentRecovery(recovery)) return;
    this.services.webSocketManager.close(false, 'regionRecovery');
    this.taskManager.invalidateRegionalTasks();
    if (!this.isCurrentRecovery(recovery)) return;
    this.services.connectionService
      .recoverRegion({
        signal: controller.signal,
        canAttempt: () => {
          if (!this.isCurrentRecovery(recovery)) return false;
          if (recovery.attempt) recovery.attempt.welcomeStartedAt = Date.now();

          return true;
        },
        onScheduled: (attempt, retryAfterMs) => {
          if (!this.isCurrentRecovery(recovery)) return;
          const attemptStartedAt = Date.now();
          recovery.attempt = {attempt, startedAt: attemptStartedAt};
          this.recordRecoveryDiagnostic('scheduled-wait', 'waiting', attempt, attemptStartedAt);
          if (!this.isCurrentRecovery(recovery)) return;
          this.recoveryPhase = 'waiting';
          this.publishRegionState(
            this.buildRegionState('recovering', 'region-switch', retryAfterMs)
          );
        },
        onAttemptSettled: (attempt, outcome, failure) => {
          const slot = recovery.attempt;
          if (!this.isCurrentRecovery(recovery) || slot?.attempt !== attempt) return;
          recovery.attempt = undefined;
          this.recordRecoveryDiagnostic('admission', outcome, attempt, slot.startedAt, failure);
        },
        afterWelcome: async (welcome, attemptSignal) => {
          if (!this.isCurrentRecovery(recovery))
            throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
          const slot = recovery.attempt;
          const attempt = slot?.attempt;
          const agentId = isRecord(welcome) ? welcome.agentId : undefined;
          const valid = agentId === recovery.agentId;
          this.recordRecoveryDiagnostic(
            'welcome',
            valid ? 'succeeded' : 'failed',
            attempt,
            slot?.welcomeStartedAt ?? slot?.startedAt
          );
          if (!this.isCurrentRecovery(recovery) || attemptSignal.aborted)
            throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
          this.assertPrimaryIdentity(agentId);

          return this.restoreRegionSession(recovery, attemptSignal);
        },
      })
      .then(
        () => {
          const slot = recovery.attempt;
          if (!this.isCurrentRecovery(recovery) || !slot) return;
          recovery.attempt = undefined;
          this.recordRecoveryDiagnostic('admission', 'succeeded', slot.attempt, slot.startedAt);
        },
        (error) => {
          if (this.isCurrentRecovery(recovery)) this.handleRecoveryTerminal(error);
        }
      );
  }

  private assertPrimaryIdentity(agentId: unknown): void {
    if (
      typeof agentId !== 'string' ||
      !agentId.trim() ||
      (this.registrationAgentId && agentId !== this.registrationAgentId)
    ) {
      this.terminateRegistration(true);
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    }
  }

  private rememberAcceptedStation(
    input:
      | {source: 'login'; payload: Agent.UserStationLogin; response: Agent.StationLoginSuccess}
      | {source: 'reload'; response: Agent.ReloginSuccess}
  ): void {
    const {response} = input;
    this.assertPrimaryIdentity(response.data.agentId);
    const data = response.data;
    const nonblank = (value: unknown): value is string =>
      typeof value === 'string' && Boolean(value.trim());
    const sessionId = nonblank(data.agentSessionId) ? data.agentSessionId : undefined;
    if (this.currentAgentSessionId && this.currentAgentSessionId !== sessionId) this.pauseRtd();
    const old = this.acceptedStation;
    this.agentConfig.lastStateAuxCodeId = data.auxCodeId;
    this.agentConfig.lastStateChangeTimestamp = data.lastStateChangeTimestamp;
    this.agentConfig.lastIdleCodeChangeTimestamp = data.lastIdleCodeChangeTimestamp ?? undefined;
    this.priorStationActive = true;
    this.agentConfig.isAgentLoggedIn = true;
    this.updateWellnessSession(sessionId);
    this.agentConfig.currentTeamId = data.teamId;
    let payload: Agent.UserStationLogin;
    if (input.source === 'login') {
      payload = {
        ...input.payload,
        teamId: nonblank(data.teamId) ? data.teamId : input.payload.teamId,
      };
    } else {
      const fields = data as typeof data & {
        isExtension?: boolean;
        dn?: string;
        deviceType?: string;
      };
      let number: string | undefined;
      if (nonblank(fields.dn)) number = fields.dn;
      else if (nonblank(fields.dialNumber)) number = fields.dialNumber;
      let mode = nonblank(fields.deviceType) ? fields.deviceType : undefined;
      if (!mode) {
        if (fields.isExtension === true) mode = LoginOption.EXTENSION;
        else if (number === `${WEB_RTC_PREFIX}${data.agentId}`) mode = LoginOption.BROWSER;
        else if (number && fields.isExtension === false) mode = LoginOption.AGENT_DN;
        else mode = old?.deviceType;
      }
      const dialNumber = number || (old?.deviceType === mode ? old?.dialNumber : undefined);
      if (
        !Object.values(LoginOption).includes(mode as LoginOption) ||
        !nonblank(data.teamId) ||
        (mode !== LoginOption.BROWSER && !nonblank(dialNumber))
      ) {
        this.acceptedStation = undefined;
        this.agentConfig.deviceType = mode as LoginOption;
        this.agentConfig.dn = number;
        this.agentConfig.defaultDn = number;

        return;
      }
      payload = buildStationLoginPayload(
        {teamId: data.teamId, loginOption: mode as LoginOption, dialNumber},
        this.agentConfig.agentId
      );
    }
    this.agentConfig.currentTeamId = payload.teamId;
    this.acceptedStation = payload;
    this.agentConfig.deviceType = payload.deviceType as LoginOption;
    this.agentConfig.dn = payload.dialNumber;
    this.agentConfig.defaultDn = payload.dialNumber;
  }

  private async applyRestoredStationEffects(): Promise<void> {
    const payload = this.acceptedStation;
    if (payload)
      await this.handleDeviceType(payload.deviceType as LoginOption, payload.dialNumber, true);
    await this.ensureWxAppPostStationLogin();
  }

  private async restoreRegionSession(
    recovery: RegionRecovery,
    signal: AbortSignal
  ): Promise<void | (() => void)> {
    const manual =
      (reason: RegionRecoveryState['reason'], resumeRtd = false) =>
      () => {
        if (!this.isCurrentRecovery(recovery) || signal.aborted) return;
        this.recoveryPhase = 'manualLoginRequired';
        this.publishRegionState(this.buildRegionState('stationLoginRequired', reason));
        if (resumeRtd && this.isCurrentRecovery(recovery) && !signal.aborted)
          this.resumeRtd(this.registrationAbortController.signal);
      };
    if (!this.priorStationActive) return manual('region-switch', true);
    if (!this.$config.allowAutomatedRelogin || this.suppressAutomaticRelogin)
      return manual('automatic-relogin-disabled');

    const payload = this.acceptedStation;
    this.recoveryPhase = 'restoringSession';
    while (this.isCurrentRecovery(recovery) && !signal.aborted) {
      // eslint-disable-next-line no-await-in-loop -- Generation-owned retries are serial.
      await waitForRecoveryDelay(recovery.retryNotBefore - Date.now(), signal);
      if (signal.aborted || !this.isCurrentRecovery(recovery))
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      if (recovery.stage === 'reload' && recovery.reloads > STATION_RELOAD_RETRY_DELAYS_MS.length)
        recovery.stage = 'fallback';
      const stage = recovery.stage;
      if (stage === 'manual') break;
      const diagnosticStage = stage === 'fallback' ? 'fallback-login' : 'reload';
      const attempt = stage === 'fallback' ? 1 : recovery.reloads + 1;
      const startedAt = Date.now();
      let applying = false;
      try {
        let response: Agent.ReloginSuccess | Agent.StationLoginSuccess;
        if (stage === 'reload') recovery.reloads += 1;
        // Consume each one-shot stage before dispatch so a lost socket cannot repeat it.
        else recovery.stage = 'manual';
        if (stage === 'fallback') {
          if (!payload) break;
          // eslint-disable-next-line no-await-in-loop -- At most one fallback dispatch.
          response = await this.services.agent.stationLogin({data: payload});
        } else {
          // eslint-disable-next-line no-await-in-loop -- Bounded reload budget survives sockets.
          response = await this.services.agent.reload();
        }
        if (!this.isCurrentRecovery(recovery) || signal.aborted)
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
        if (stage === 'fallback')
          this.rememberAcceptedStation({
            source: 'login',
            payload,
            response: response as Agent.StationLoginSuccess,
          });
        else
          this.rememberAcceptedStation({
            source: 'reload',
            response: response as Agent.ReloginSuccess,
          });
        applying = true;
        this.recordRecoveryDiagnostic(diagnosticStage, 'succeeded', attempt, startedAt);
        if (!this.isCurrentRecovery(recovery) || signal.aborted)
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
        // eslint-disable-next-line no-await-in-loop -- Apply only this accepted session.
        await this.applyRestoredStationEffects();
        if (!this.isCurrentRecovery(recovery) || signal.aborted)
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

        return () => {
          if (!this.isCurrentRecovery(recovery) || signal.aborted) return;
          this.recoveryPhase = 'ready';
          if (
            response.data.type === CC_EVENTS.AGENT_RELOGIN_SUCCESS &&
            response.data.lastStateChangeReason === 'agent-wss-disconnect'
          ) {
            this.autoAvailable = {agentId: recovery.agentId, signal, requesting: false};
            this.regionStateContext.autoAvailable = this.isWaitingForBrowserVoice()
              ? 'waitingForVoice'
              : 'requesting';
          }
          this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
          if (this.isCurrentRecovery(recovery) && !signal.aborted) {
            this.resumeRtd(this.registrationAbortController.signal);
            this.requestAutoAvailable();
          }
        };
      } catch (error) {
        const retryDelay = STATION_RELOAD_RETRY_DELAYS_MS[recovery.reloads - 1];
        const current = this.isCurrentRecovery(recovery);
        if (!current || signal.aborted) {
          if (current && stage === 'reload' && retryDelay !== undefined)
            recovery.retryNotBefore = Math.max(recovery.retryNotBefore, Date.now() + retryDelay);
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
        }
        if (applying) throw error;
        const failure = normalizeRecoveryFailure(error);
        const category = getStationRecoveryFailureCategory(failure);
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
        else if (stage === 'reload' && category === 'transient' && retryDelay !== undefined) {
          recovery.retryNotBefore = Date.now() + retryDelay;
        } else if (stage === 'reload') {
          recovery.stage = 'fallback';
          recovery.retryNotBefore = 0;
        } else {
          this.recordRecoveryDiagnostic(diagnosticStage, 'failed', attempt, startedAt, failure);
          break;
        }
        this.recordRecoveryDiagnostic(diagnosticStage, 'retrying', attempt, startedAt, failure);
      }
    }

    return manual('session-restore-failed');
  }

  private handleRemoteStationLogout(event: Record<string, any>): void {
    const {data} = event;
    if (
      data?.type === CC_EVENTS.AGENT_LOGOUT_SUCCESS &&
      this.currentAgentSessionId &&
      data.agentSessionId === this.currentAgentSessionId &&
      data.orgId === this.registrationOrgId &&
      data.agentId === this.registrationAgentId
    )
      this.clearStationSession();
  }

  private clearStationSession(): void {
    const wasRegional = this.hasRegionalConnectionOwner();
    const cancelled = this.cancelAutoAvailable();
    this.cancelRegionRecovery();
    this.recoveryGeneration += 1;
    this.clearAcceptedStation();
    this.updateWellnessSession();
    this.suppressAutomaticRelogin = true;
    this.pauseRtd();
    if (wasRegional) this.resetOrdinaryConnection();
    this.resetRegionState();
    if (!['unavailable', 'reloadRequired'].includes(this.recoveryPhase))
      this.recoveryPhase = 'idle';
    if (cancelled) this.publishRegionState(cancelled);
  }

  private updateWellnessSession(agentSessionId?: string): void {
    this.currentAgentSessionId = agentSessionId;
  }

  /**
   * API instance for managing Webex Contact Center entry points
   * Provides functionality to fetch entry points with caching support
   * @type {EntryPoint}
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   *
   * // Access EntryPointRecord
   * const response = await cc.entryPoint.getEntryPoints({
   *   page: 0,
   *   pageSize: 50
   * });
   * ```
   */
  private entryPoint: EntryPoint;

  /**
   * API instance for managing Webex Contact Center address book contacts
   * Provides functionality to fetch address book entries with caching support
   * @type {AddressBook}
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   *
   * // Access AddressBook API
   * const response = await cc.addressBook.getEntries({
   *   page: 0,
   *   pageSize: 25
   * });
   * ```
   */
  public addressBook: AddressBook;

  /**
   * API instance for managing Webex Contact Center queues
   * Provides functionality to fetch queues with caching support
   * @type {Queue}
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   *
   * // Access Queue API
   * const response = await cc.queue.getQueues({
   *   page: 0,
   *   pageSize: 50
   * });
   *
   * // Filter queues by specific criteria
   * const filteredQueues = await cc.queue.getQueues({
   *   filter: 'id=="queue-id-123"'
   * });
   * ```
   */
  public queue: Queue;

  /**
   * API instance for managing Webex Contact Center user preferences
   * Provides functionality to get, create, update, and delete user preferences
   * @type {UserPreference}
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   *
   * // Get user preferences for current user
   * const preferences = await cc.userPreference.getUserPreference();
   *
   * // Create new user preferences
   * const newPrefs = await cc.userPreference.createUserPreference({
   *   userId: 'user123',
   *   preferences: { e911Reminder: true }
   * });
   *
   * // Update user preferences
   * const updatedPrefs = await cc.userPreference.updateUserPreference('user123', {
   *   preferences: { e911Reminder: false }
   * });
   *
   * // Delete user preferences
   * await cc.userPreference.deleteUserPreference('user123');
   * ```
   */
  public userPreference: UserPreference;

  /**
   * API instance for AI Assistant operations such as transcript controls.
   * @type {ApiAIAssistant}
   * @public
   */
  public apiAIAssistant: ApiAIAssistant;

  /**
   * Logger utility for Contact Center plugin
   * Provides consistent logging across the plugin
   * @type {LoggerProxy}
   * @public
   */
  public LoggerProxy = LoggerProxy;

  /**
   * @ignore
   * Creates an instance of ContactCenter plugin
   * @param {any[]} args Arguments passed to plugin constructor
   */
  constructor(...args) {
    super(...args);

    this.eventEmitter = new EventEmitter();
    // @ts-ignore
    this.$webex = this.webex;

    this.$webex.once(READY, () => {
      // @ts-ignore
      this.$config = this.config;
      this.validatePluginConfig();

      /**
       * This is used for handling the async requests by sending webex.request and wait for corresponding websocket event.
       */
      this.webexRequest = WebexRequest.getInstance({
        webex: this.$webex,
      });

      this.services = Services.getInstance({
        webex: this.$webex,
      });

      this.webCallingService = new WebCallingService(this.$webex);
      this.webCallingService.on(
        VOICE_CONNECTION_EVENTS.STATE_CHANGE,
        this.handleVoiceConnectionStateChange
      );
      this.answerCallOnWebexService = new AnswerCallOnWebexService(this.$webex);
      this.webexCrossClientService = new WebexCrossClientService(this.$webex);
      this.wxAppTelephonyMercurySync = new WxAppTelephonyMercurySync(this.$webex);
      this.apiAIAssistant = new ApiAIAssistant(this.$webex, () => ({
        isWellnessBreakEnabled: this.agentConfig?.isWellnessBreakEnabled === true,
        agentId: this.agentConfig?.agentId,
        agentSessionId: this.currentAgentSessionId,
      }));
      this.metricsManager = MetricsManager.getInstance({webex: this.$webex});
      this.taskManager = TaskManager.getTaskManager(
        this.apiAIAssistant,
        this.services.contact,
        this.webCallingService,
        this.services.webSocketManager,
        this.services.rtdWebSocketManager
      );
      this.taskManager.setAnswerCallOnWebexService(this.answerCallOnWebexService);
      this.incomingTaskListener();

      // Initialize API instances
      // will have future function for indivdual fetch etc so better be in an object
      this.entryPoint = new EntryPoint(this.$webex);
      this.addressBook = new AddressBook(this.$webex, () => this.agentConfig?.addressBookId);
      this.queue = new Queue(this.$webex);
      this.userPreference = new UserPreference(this.$webex, () => this.agentConfig?.agentId);
      LoggerProxy.initialize(this.$webex.logger);
    });
  }

  /**
   * Handles incoming task events and triggers appropriate notifications
   * @private
   * @param {ITask} task The incoming task object containing task details
   */
  private handleIncomingTask = (task: ITask) => {
    // @ts-ignore
    this.trigger(TASK_EVENTS.TASK_INCOMING, task);
  };

  private handleVoiceConnectionStateChange = (state: VoiceConnectionState): void => {
    this.publishHostEvent(VOICE_CONNECTION_EVENTS.STATE_CHANGE, state, true);
    this.requestAutoAvailable();
  };

  /**
   * Handles task hydration events for updating task data
   * @private
   * @param {ITask} task The task object to be hydrated with additional data
   */
  private handleTaskHydrate = (task: ITask) => {
    // @ts-ignore
    this.trigger(TASK_EVENTS.TASK_HYDRATE, task);
  };

  /**
   * Handles multi-login hydrate events for SDK instances without Mobius registration
   * @private
   * @param {ITask} task The task object associated with the multi-login hydrate
   */
  private handleTaskMultiLoginHydrate = (task: ITask) => {
    // @ts-ignore
    this.trigger(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, task);
  };

  /**
   * Handles task merged events when tasks are combined eg: EPDN merge/transfer
   * @private
   * @param {ITask} task The task object that has been merged
   */
  private handleTaskMerged = (task: ITask) => {
    // @ts-ignore
    this.trigger(TASK_EVENTS.TASK_MERGED, task);
  };

  /**
   * Handles campaign preview reservation events when a contact is offered to the agent
   * @private
   * @param {ITask} task The campaign reservation task
   */
  private handleCampaignPreviewReservation = (task: ITask) => {
    // @ts-ignore
    this.trigger(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION, task);
  };

  private trackInvalidWellnessEvent(reason: string): void {
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_EVENT_INVALID,
      {reason},
      ['operational']
    );
  }

  private normalizeWellnessBreakEvent(payload: Record<string, unknown>): WellnessBreakEvent | null {
    if (this.agentConfig?.isWellnessBreakEnabled !== true) {
      this.trackInvalidWellnessEvent('wellness_disabled');

      return null;
    }

    const notificationData = isRecord(payload.data) ? payload.data : null;
    const notificationDetails =
      notificationData && isRecord(notificationData.notifDetails)
        ? notificationData.notifDetails
        : null;
    const sessionData =
      notificationData && isRecord(notificationData.data) ? notificationData.data : null;
    const actionEvent = notificationDetails?.actionEvent;

    if (
      payload.type !== WELLNESS_BREAK_HANDLER ||
      notificationData?.notifType !== WELLNESS_BREAK_HANDLER ||
      typeof actionEvent !== 'string'
    ) {
      this.trackInvalidWellnessEvent('malformed_wellness_event');

      return null;
    }

    if (
      !Object.values(WELLNESS_BREAK_NOTIFICATION_ACTIONS).includes(
        actionEvent as WellnessBreakNotificationAction
      )
    ) {
      this.trackInvalidWellnessEvent('unknown_wellness_action');

      return null;
    }

    const agentId = notificationData.agentId;
    const eventOrgId = notificationData.orgId;
    const sessionOrgId = sessionData?.orgId;
    const envelopeOrgId = payload.orgId;
    const agentSessionId = sessionData?.agentSessionId;
    const currentOrgId = this.$webex.credentials.getOrgId();

    if (
      typeof agentId !== 'string' ||
      typeof eventOrgId !== 'string' ||
      typeof sessionOrgId !== 'string' ||
      typeof envelopeOrgId !== 'string' ||
      typeof agentSessionId !== 'string' ||
      !agentId ||
      !eventOrgId ||
      !sessionOrgId ||
      !envelopeOrgId ||
      !agentSessionId
    ) {
      this.trackInvalidWellnessEvent('missing_wellness_identity');

      return null;
    }

    if (
      agentId !== this.agentConfig?.agentId ||
      eventOrgId !== currentOrgId ||
      sessionOrgId !== currentOrgId ||
      envelopeOrgId !== currentOrgId
    ) {
      this.trackInvalidWellnessEvent('mismatched_wellness_identity');

      return null;
    }

    const interactionValue = sessionData.interactionId ?? sessionData.InteractionId;
    const actionText = notificationDetails.actionText;
    const trackingId = payload.trackingId;

    return {
      agentId,
      orgId: currentOrgId,
      agentSessionId,
      actionEvent: actionEvent as WellnessBreakNotificationAction,
      ...(typeof actionText === 'string' ? {actionText} : {}),
      ...(typeof interactionValue === 'string' ? {interactionId: interactionValue} : {}),
      ...(typeof trackingId === 'string' ? {trackingId} : {}),
    };
  }

  private handleWellnessBreakWebsocketPayload(payload: Record<string, unknown>): boolean {
    if (payload.type !== WELLNESS_BREAK_HANDLER) {
      return false;
    }

    const wellnessEvent = this.normalizeWellnessBreakEvent(payload);
    if (wellnessEvent) {
      this.publishHostEvent(CC_EVENTS.WELLNESS_BREAK, wellnessEvent);
    }

    return true;
  }

  private shouldSubscribeRtd(): boolean {
    return Boolean(
      this.agentConfig?.aiFeature?.realtimeTranscripts?.enable ||
        this.agentConfig?.aiFeature?.suggestedResponses?.enable ||
        this.agentConfig?.aiFeature?.generatedSummaries?.wrapUpSummariesEnabled === true ||
        this.agentConfig?.aiFeature?.generatedSummaries?.consultTransferSummariesEnabled === true ||
        this.agentConfig?.isWellnessBreakEnabled
    );
  }

  private pauseRtd(reason?: string): void {
    const wasSubscribed = Boolean(this.rtdConnection);
    this.rtdConnection = undefined;
    const manager = this.services.rtdWebSocketManager;
    manager.off('message', this.handleRTDWebsocketMessage);
    if (wasSubscribed || reason) manager.close(false, reason ?? 'regionRecovery');
    if (wasSubscribed) this.taskManager.clearAISummaryState();
  }

  private resumeRtd(signal: AbortSignal): void {
    if (signal.aborted || this.rtdConnection || !this.shouldSubscribeRtd()) return;
    const manager = this.services.rtdWebSocketManager;
    const startedAt = Date.now();
    manager.on('message', this.handleRTDWebsocketMessage);
    const connection = manager.initWebSocket({
      body: this.getConnectionConfig(),
      resource: RTD_SUBSCRIBE_API,
      signal,
    });
    this.rtdConnection = connection;
    connection.then(
      () => {
        if (this.rtdConnection === connection)
          this.recordRecoveryDiagnostic('rtd', 'succeeded', 1, startedAt);
      },
      (error) => {
        if (this.rtdConnection !== connection) return;
        this.pauseRtd();
        this.recordRecoveryDiagnostic(
          'rtd',
          'failed',
          1,
          startedAt,
          normalizeRecoveryFailure(error)
        );
      }
    );
  }

  private handleRTDWebsocketMessage = (event: string) => {
    let payload: unknown;
    try {
      payload = JSON.parse(event);
    } catch {
      // TaskManager retains its existing malformed RTD message handling.
    }

    if (isRecord(payload) && this.handleWellnessBreakWebsocketPayload(payload)) {
      return;
    }

    this.taskManager.handleRealtimeWebsocketEvent(event);
  };

  /**
   * Sets up event listeners for incoming tasks and task hydration
   * Subscribes to task events from the task manager
   * @private
   */
  private incomingTaskListener() {
    this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
    this.taskManager.off(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
    this.taskManager.off(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, this.handleTaskMultiLoginHydrate);
    this.taskManager.off(TASK_EVENTS.TASK_MERGED, this.handleTaskMerged);
    this.taskManager.off(
      TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
      this.handleCampaignPreviewReservation
    );
    this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
    this.taskManager.on(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
    this.taskManager.on(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, this.handleTaskMultiLoginHydrate);
    this.taskManager.on(TASK_EVENTS.TASK_MERGED, this.handleTaskMerged);
    this.taskManager.on(
      TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
      this.handleCampaignPreviewReservation
    );
  }

  /**
   * Initializes the Contact Center SDK by setting up the web socket connections.
   * This method must be called before performing any agent operations such as login, state change, or handling tasks.
   *
   * @returns {Promise<Profile>} Agent profile information after successful registration.
   * The returned `Profile` object contains details such as:
   * - `agentId`: The unique identifier for the agent.
   * - `defaultDn`: The default dial number associated with the agent.
   * - `teams`: Array of teams the agent belongs to.
   * - `webRtcEnabled`: Indicates if WebRTC (browser calling) is enabled.
   * - `loginVoiceOptions`: Supported login options for the agent (e.g., BROWSER, EXTENSION).
   * - ...and other agent configuration details.
   *
   * @throws {Error} If registration fails.
   *
   * @public
   * @example
   * ```typescript
   * import Webex from 'webex';
   *
   * const webex = Webex.init({ credentials: 'YOUR_ACCESS_TOKEN' });
   * const cc = webex.cc;
   *
   * // Register the SDK and fetch agent profile
   * const profile = await cc.register();
   *
   * console.log('Agent ID:', profile.agentId);
   * console.log('Default DN:', profile.defaultDn);
   * console.log('Teams:', profile.teams.map(t => t.id));
   * console.log('WebRTC Enabled:', profile.webRtcEnabled);
   * console.log('Supported Login Options:', profile.loginVoiceOptions);
   *
   * // Now you can proceed with station login, state changes, etc.
   * await cc.stationLogin({ teamId: profile.teams[0].id, loginOption: 'BROWSER' });
   * ```
   */
  public async register(): Promise<Profile> {
    const cancelled = this.cancelAutoAvailable();
    const publicationSettings = this.multiRegionSettings;
    this.cancelRegionRecovery();
    this.fenceRecoveryWork('cancelled');
    this.pauseRtd();
    this.services.connectionService.stop();
    if (this.registrationAbortController) {
      this.services.webSocketManager.close(false, 'register');
      this.taskManager.unregisterIncomingCallEvent();
      this.taskManager.invalidateRegionalTasks();
    }
    this.acceptedSwitchIds.clear();
    this.clearAcceptedStation();
    this.registrationAbortController?.abort();
    this.registrationGeneration += 1;
    this.registrationAgentId = undefined;
    this.multiRegionSettings = null;
    this.wellbeingBreakIdleCode = undefined;
    const registration = this.registrationGeneration;
    if (cancelled) this.publishRegionState(cancelled, publicationSettings);
    if (registration !== this.registrationGeneration)
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    const controller = new AbortController();
    this.registrationAbortController = controller;
    const orgId = this.$webex.credentials.getOrgId();
    const attempt: InitialRegistration = {registration, orgId, controller};
    this.pendingRegistration = attempt;
    this.registrationOrgId = orgId;
    this.suppressAutomaticRelogin = false;
    this.recoveryPhase = 'idle';
    this.resetRegionState();
    this.recordBestEffort(() =>
      LoggerProxy.log('Starting CC SDK registration', {
        module: CC_FILE,
        method: METHODS.REGISTER,
      })
    );
    try {
      this.recordBestEffort(() =>
        this.metricsManager.timeEvent([
          METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
          METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
        ])
      );
      this.assertInitialRegistration(attempt);
      this.setupEventListeners();
      this.incomingTaskListener();
      this.services.webSocketManager.off('message', this.handleWebsocketMessage);
      this.services.webSocketManager.on('message', this.handleWebsocketMessage);

      const resp = await this.connectWebsocket(attempt);
      this.assertInitialRegistration(attempt);
      // Ensure 'dn' is always populated from 'defaultDn'
      resp.dn = resp.defaultDn;
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
          {
            ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
            deviceType: resp.deviceType || EMPTY_STRING,
          },
          ['operational']
        )
      );

      this.recordBestEffort(() =>
        LoggerProxy.log(
          `CC SDK registration completed successfully with agentId: ${resp.agentId}`,
          {
            module: CC_FILE,
            method: METHODS.REGISTER,
          }
        )
      );

      // Registration can silently restore a station session without emitting a
      // relogin event. Project the active session for consumers that must
      // recover session-scoped state after a page refresh.
      this.assertInitialRegistration(attempt);

      return resp.isAgentLoggedIn && this.currentAgentSessionId
        ? {...resp, agentSessionId: this.currentAgentSessionId}
        : resp;
    } catch (error) {
      if (this.registrationAbortController === controller) {
        controller.abort();
        if (this.recovery?.registration === registration)
          this.finishRegionRecovery('unavailable', 'recovery-failed');
        if (this.registrationAbortController === controller) this.multiRegionSettings = null;
      }
      if (attempt.reloadRequired) throw attempt.reloadRequired;
      if (isRegionRecoveryError(error)) throw error;
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
          {
            orgId: normalizeRecoveryDiagnosticId(isRecord(error) ? error.orgId : undefined),
          },
          ['operational']
        )
      );
      let correlationId: string | undefined;
      this.recordBestEffort(() => {
        const data = ContactCenter.getRegistrationErrorDetails(error);
        correlationId = data.trackingId;
        LoggerProxy.error('Error during register', {
          module: CC_FILE,
          method: METHODS.REGISTER,
          data,
        });
      });
      this.recordBestEffort(() => {
        Promise.resolve(this.webexRequest.uploadLogs({correlationId})).catch(() => {
          /* Log upload failure must not replace the registration error. */
        });
      });

      throw error;
    } finally {
      if (this.pendingRegistration === attempt) this.pendingRegistration = undefined;
    }
  }

  /**
   * Unregisters the Contact Center SDK by closing all web socket connections, removing event listeners,
   * and cleaning up internal state.
   *
   * @remarks
   * This method only disconnects the SDK from the backend and cleans up resources. It does NOT perform a station logout
   * (i.e., the agent remains logged in to the contact center unless you explicitly call {@link stationLogout}).
   * Use this when you want to fully tear down the SDK instance, such as during application shutdown or user sign-out.
   *
   * @returns {Promise<void>} Resolves when deregistration and cleanup are complete.
   * @throws {Error} If deregistration fails.
   *
   * @public
   * @example
   * // Typical usage: clean up SDK before application exit or user logout
   * import Webex from 'webex';
   *
   * const webex = Webex.init({ credentials: 'YOUR_ACCESS_TOKEN' });
   * const cc = webex.cc;
   *
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   * // ... perform agent operations ...
   *
   * // If you want to log out the agent as well, call:
   * // await cc.stationLogout({ logoutReason: 'User signed out' });
   * // On application shutdown or user sign-out:
   * await cc.deregister();
   *

   */
  public async deregister(): Promise<void> {
    const termination = this.terminateRegistration();
    if (termination !== this.registrationGeneration) return;
    this.registrationOrgId = undefined;
    this.updateWellnessSession();
    try {
      this.recordBestEffort(() =>
        this.metricsManager.timeEvent([
          METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
          METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
        ])
      );

      this.taskManager.clearAISummaryState();
      this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
      this.taskManager.off(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
      this.taskManager.off(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, this.handleTaskMultiLoginHydrate);
      this.taskManager.off(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
        this.handleCampaignPreviewReservation
      );
      this.taskManager.unregisterIncomingCallEvent();

      this.services.webSocketManager.off('message', this.handleWebsocketMessage);
      this.services.rtdWebSocketManager.off('message', this.handleRTDWebsocketMessage);
      this.services.connectionService.off('connectionLost', this.handleConnectionLost);

      const {publishError: wxAppPublishError} = await this.teardownWxAppLocalState({
        clearInitFlag: true,
      });
      if (termination !== this.registrationGeneration) return;

      if (
        this.agentConfig?.webRtcEnabled &&
        this.agentConfig.loginVoiceOptions.includes(LoginOption.BROWSER) &&
        this.$webex.internal.mercury.connected
      ) {
        this.$webex.internal.mercury.off('online');
        this.$webex.internal.mercury.off('offline');
        await this.$webex.internal.mercury.disconnect();
        // @ts-ignore
        await this.$webex.internal.device.unregister();
        this.recordBestEffort(() =>
          LoggerProxy.log(MERCURY_DISCONNECTED_SUCCESS, {
            module: CC_FILE,
            method: METHODS.DEREGISTER,
          })
        );
      }

      if (termination !== this.registrationGeneration) return;
      this.agentConfig = null;

      if (wxAppPublishError) {
        throw wxAppPublishError;
      }

      this.recordBestEffort(() =>
        LoggerProxy.log('Deregistered successfully', {
          module: CC_FILE,
          method: METHODS.DEREGISTER,
        })
      );

      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS, {}, [
          'operational',
        ])
      );
    } catch (error) {
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
          {
            error: error.message || UNKNOWN_ERROR,
          },
          ['operational']
        )
      );

      this.recordBestEffort(() =>
        LoggerProxy.error(`Error during deregister: ${error}`, {
          module: CC_FILE,
          method: METHODS.DEREGISTER,
        })
      );

      throw error;
    }
  }

  /**
   * Returns the list of buddy agents who are in the given user state and media type based on their agent profile settings
   * @param {BuddyAgents} data The data required to fetch buddy agents
   * @returns {Promise<BuddyAgentsResponse>} A promise resolving to the buddy agents information
   * @throws {Error} If fetching buddy agents fails
   * @example
   * ```typescript
   * // Get list of available agents for consultation or transfer
   * const cc = webex.cc;
   *
   * // First ensure you're registered and logged in
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   *
   * // Get buddy agents filtered by state and media type
   * const response = await cc.getBuddyAgents({
   *   state: 'Available',     // Filter by agent state ('Available', 'Idle', etc.)
   *   mediaType: 'telephony'  // Filter by media type ('telephony', 'chat', 'email', 'social')
   * });
   *
   * // Process the buddy agents list
   * if (response.data.agentList.length > 0) {
   *   const buddyAgents = response.data.agentList;
   *   console.log(`Found ${buddyAgents.length} available agents`);
   *
   *   // Access agent details
   *   buddyAgents.forEach(agent => {
   *     console.log(`Agent ID: ${agent.agentId}`);
   *     console.log(`Name: ${agent.firstName} ${agent.lastName}`);
   *     console.log(`State: ${agent.state}`);
   *     console.log(`Team: ${agent.teamName}`);
   *   });
   * }
   * ```
   */
  public async getBuddyAgents(data: BuddyAgents): Promise<BuddyAgentsResponse> {
    const {action, state, mediaType = 'telephony'} = data;
    const buddyAgentState = state ?? (action === 'Transfer' ? AGENT_STATE_AVAILABLE : undefined);

    LoggerProxy.info('Fetching buddy agents', {
      module: CC_FILE,
      method: METHODS.GET_BUDDY_AGENTS,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS,
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED,
      ]);
      const resp = await this.services.agent.buddyAgents({
        data: {
          agentProfileId: this.agentConfig.agentProfileID,
          mediaType,
          ...(buddyAgentState ? {state: buddyAgentState} : {}),
        },
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          mediaType,
          buddyAgentState,
          buddyAgentCount: resp.data.agentList.length,
        },
        ['operational']
      );

      LoggerProxy.log(`Successfully retrieved ${resp.data.agentList.length} buddy agents`, {
        module: CC_FILE,
        method: METHODS.GET_BUDDY_AGENTS,
        trackingId: resp.trackingId,
      });

      return resp;
    } catch (error) {
      const failureResp = error.details as Failure;

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failureResp),
          mediaType,
          buddyAgentState,
        },
        ['operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.GET_BUDDY_AGENTS, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Connects to the websocket and fetches the agent profile
   * @returns {Promise<Profile>} Agent profile information
   * @throws {Error} If connection fails or profile cannot be fetched
   * @private
   */
  private async connectWebsocket(attempt: InitialRegistration) {
    const {orgId, controller} = attempt;
    const {signal} = controller;
    this.recordBestEffort(() =>
      LoggerProxy.log('Connecting to websocket', {
        module: CC_FILE,
        method: METHODS.CONNECT_WEBSOCKET,
      })
    );

    try {
      this.assertInitialRegistration(attempt);
      let data: unknown;
      try {
        data = await this.services.webSocketManager.initWebSocket({
          body: this.getConnectionConfig(),
          resource: SUBSCRIBE_API,
          signal,
        });
      } catch (error) {
        if (getSubscriptionMismatchReason(error) && this.isCurrentRegistration(orgId, signal)) {
          this.requireRegionReload();
        }
        throw error;
      }
      this.assertInitialRegistration(attempt);
      if (!isRecord(data) || typeof data.agentId !== 'string' || !data.agentId.trim()) {
        this.terminateRegistration(true);
        throw new Error('Primary Welcome agent identity is required');
      }
      const agentId = data.agentId;
      const profile = await awaitRecoveryWork(
        this.services.config.getAgentConfig(orgId, agentId),
        signal
      );
      this.assertInitialRegistration(attempt);
      if (profile.agentId !== agentId) {
        this.terminateRegistration(true);
        throw new Error('Primary Welcome and Profile agent identities differ');
      }
      const {multiRegionSettings} = profile;
      // Keep recovery settings private when register() returns this profile.
      delete profile.multiRegionSettings;
      this.agentConfig = profile;
      this.registrationAgentId = agentId;
      this.resetOrdinaryConnection();
      this.assertInitialRegistration(attempt);
      this.multiRegionSettings = multiRegionSettings ?? null;
      this.taskManager.registerIncomingCallEvent();

      this.recordBestEffort(() =>
        LoggerProxy.log(`Agent config is fetched successfully`, {
          module: CC_FILE,
          method: METHODS.CONNECT_WEBSOCKET,
        })
      );

      const configFlags: ConfigFlags = {
        isEndTaskEnabled: this.agentConfig.isEndTaskEnabled,
        isEndConsultEnabled: this.agentConfig.isEndConsultEnabled,
        webRtcEnabled: this.agentConfig.webRtcEnabled,
        autoWrapup: this.agentConfig.wrapUpData?.wrapUpProps?.autoWrapup ?? false,
        aiFeature: this.agentConfig.aiFeature,
        consultTransfer: {
          allowConsultToQueue: this.agentConfig.allowConsultToQueue,
          accessQueue: this.agentConfig.accessQueue,
          accessEntryPoint: this.agentConfig.accessEntryPoint,
          accessBuddyTeam: this.agentConfig.accessBuddyTeam,
        },
        enableWxBetterTogether: this.isWxBetterTogetherEnabled(),
        getWxAppUsersubPublished: () => this.webexCrossClientService.isAnswerCallsStateActive(),
      };
      this.taskManager.setConfigFlags(configFlags);
      // TODO: Make profile a singleton to make it available throughout app/sdk so we dont need to inject info everywhere
      this.taskManager.setWrapupData(this.agentConfig.wrapUpData);
      this.taskManager.setAgentId(this.agentConfig.agentId);
      this.taskManager.setAgentName(this.agentConfig.agentName);
      this.taskManager.setWebRtcEnabled(this.agentConfig.webRtcEnabled);
      this.apiAIAssistant.setAIFeatureFlags(this.agentConfig.aiFeature);
      this.wellbeingBreakIdleCode = undefined;
      this.updateWellnessSession();

      if (
        this.agentConfig.loginVoiceOptions.some((loginOption) =>
          this.isBrowserVoiceRequired(loginOption)
        )
      ) {
        try {
          await this.$webex.internal.mercury.connect();
          this.recordBestEffort(() =>
            LoggerProxy.log('Authentication: webex.internal.mercury.connect successful', {
              module: CC_FILE,
              method: METHODS.CONNECT_WEBSOCKET,
            })
          );
        } catch (error) {
          this.recordBestEffort(() =>
            LoggerProxy.error(`Error occurred during mercury.connect() ${error}`, {
              module: CC_FILE,
              method: METHODS.CONNECT_WEBSOCKET,
            })
          );
        }
      } else if (this.isWebRTCRegistrationDisabled()) {
        this.recordBestEffort(() =>
          LoggerProxy.info(
            'Skipping Mobius registration because disableWebRTCRegistration is enabled',
            {
              module: CC_FILE,
              method: METHODS.CONNECT_WEBSOCKET,
            }
          )
        );
      }

      this.assertInitialRegistration(attempt);
      if (this.$config && this.$config.allowAutomatedRelogin) {
        await this.awaitRegistrationConnection(attempt);
        this.assertInitialRegistration(attempt);
        await this.silentRelogin(true);
      } else {
        this.recordBestEffort(() =>
          LoggerProxy.log('Skipping silent relogin: allowAutomatedRelogin is disabled', {
            module: CC_FILE,
            method: METHODS.CONNECT_WEBSOCKET,
          })
        );
      }

      this.assertInitialRegistration(attempt);
      this.resumeRtd(signal);

      return this.agentConfig;
    } catch (error) {
      if (attempt.reloadRequired) throw attempt.reloadRequired;
      if (this.isCurrentRegistration(orgId, signal)) this.updateWellnessSession();
      if (isRegionRecoveryError(error)) throw error;
      this.recordBestEffort(() =>
        LoggerProxy.error('Error during register', {
          module: CC_FILE,
          method: METHODS.CONNECT_WEBSOCKET,
          data: ContactCenter.getRegistrationErrorDetails(error),
        })
      );

      throw error;
    }
  }

  /**
   * Performs agent login with specified credentials and device type
   * @param {AgentLogin} data Login parameters including teamId, loginOption and dialNumber
   * @returns {Promise<StationLoginResponse>} Response containing login status and profile
   * @throws {Error} If login fails
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   *
   * // Primary usage: using Promise response
   * try {
   *   const response = await cc.stationLogin({
   *     teamId: 'team123',
   *     loginOption: 'EXTENSION',
   *     dialNumber: '1002'
   *   });
   *   console.log('Login successful:', response);
   * } catch (error) {
   *   console.error('Login failed:', error);
   * }
   *
   * // Optional: Also listen for events elsewhere in your application
   * // cc.on('agent:stationLoginSuccess', (data) => { ... });
   * // cc.on('agent:stationLoginFailed', (error) => { ... });
   * ```
   */
  public async stationLogin(data: AgentLogin): Promise<StationLoginResponse> {
    const manual = this.recoveryPhase === 'manualLoginRequired';
    const generation = this.recoveryGeneration;
    const loggerContext = {module: CC_FILE, method: METHODS.STATION_LOGIN};

    try {
      LoggerProxy.log(
        `Starting agent station login | loginOption: ${data?.loginOption} teamId: ${data?.teamId}`,
        loggerContext
      );
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
        METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
      ]);

      const dialPlanEntries = this.agentConfig?.dialPlan?.dialPlanEntity ?? [];
      if (data.loginOption === LoginOption.AGENT_DN) {
        LoggerProxy.log(
          `Validating dial number | dialPlanEnabled: ${!!this.agentConfig
            ?.dialPlan} | dialPlanEntryCount: ${dialPlanEntries.length}`,
          loggerContext
        );

        if (!isValidDialNumber(data.dialNumber, dialPlanEntries)) {
          LoggerProxy.log(
            `Dial number validation failed | dialNumber: ${data.dialNumber} | dialPlanEntryCount: ${dialPlanEntries.length}`,
            loggerContext
          );
          const error = new Error('INVALID_DIAL_NUMBER');
          // @ts-ignore - adding custom key to the error object
          error.details = {data: {reason: 'INVALID_DIAL_NUMBER'}} as Failure;

          throw error;
        }
      }

      const payload = buildStationLoginPayload(data, this.agentConfig.agentId);
      const resp = await this.services.agent.stationLogin({data: payload});
      if (generation !== this.recoveryGeneration)
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.rememberAcceptedStation({source: 'login', payload, response: resp});
      this.suppressAutomaticRelogin = false;
      this.recoveryPhase = 'ready';

      this.webCallingService.setLoginOption(data.loginOption);
      this.webCallingService.setBrowserVoiceRequired(this.isBrowserVoiceRequired(data.loginOption));

      if (this.isBrowserVoiceRequired(data.loginOption)) {
        if (manual) this.webCallingService.ensureWebCallingLine();
        else await this.webCallingService.registerWebCallingLine();
      } else if (
        this.agentConfig.webRtcEnabled &&
        data.loginOption === LoginOption.BROWSER &&
        this.isWebRTCRegistrationDisabled()
      ) {
        LoggerProxy.info(
          'Skipping web calling line registration because disableWebRTCRegistration is enabled',
          {
            module: CC_FILE,
            method: METHODS.STATION_LOGIN,
          }
        );
      }

      const {channelsMap, ...loginData} = resp.data;
      const response = {
        ...loginData,
        mmProfile: {
          chat: channelsMap.chat?.length,
          email: channelsMap.email?.length,
          social: channelsMap.social?.length,
          telephony: channelsMap.telephony?.length,
        },
        notifsTrackingId: resp.trackingId,
      };

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          loginType: data.loginOption,
          status: resp.data.status,
          type: resp.data.type,
          roles: resp.data.roles?.join(',') || EMPTY_STRING,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log(
        `Agent station login completed successfully agentId: ${resp.data.agentId} loginOption: ${data.loginOption} teamId: ${data.teamId}`,
        {
          module: CC_FILE,
          method: METHODS.STATION_LOGIN,
          trackingId: resp.trackingId,
        }
      );

      await this.ensureWxAppPostStationLogin();
      if (generation === this.recoveryGeneration) {
        this.publishRegionState(
          this.buildRegionState('ready', manual ? 'region-switch' : 'initial-login')
        );
        if (this.registrationAbortController)
          this.resumeRtd(this.registrationAbortController.signal);
      }

      return response;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          loginType: data.loginOption,
        },
        ['behavioral', 'business', 'operational']
      );
      error.loginOption = data.loginOption;
      const {error: detailedError} = getErrorDetails(error, METHODS.STATION_LOGIN, CC_FILE);

      throw detailedError;
    }
  }

  /**
   * Performs a station logout operation for the agent
   * @remarks
   * A logout operation cannot happen if the agent is in an interaction or haven't logged in yet.
   * @param {Logout} data Logout parameters with logoutReason - a string explaining why the agent is logging out
   * @returns {Promise<StationLogoutResponse>} Response indicating logout status
   * @throws {Error} If logout fails
   * @public
   * @example
   * ```typescript
   * // Basic logout
   * try {
   *   await cc.stationLogout({
   *     logoutReason: 'End of shift'
   *   });
   *   console.log('Logged out successfully');
   * } catch (error) {
   *   console.error('Logout failed:', error);
   * }
   * ```
   */
  public async stationLogout(data: Logout): Promise<StationLogoutResponse> {
    LoggerProxy.info('Starting agent station logout', {
      module: CC_FILE,
      method: METHODS.STATION_LOGOUT,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS,
        METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED,
      ]);
      const resp = await this.services.agent.logout({data});
      if (this.priorStationActive) this.clearStationSession();

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          logoutReason: sanitizeForObservability(data.logoutReason),
        },
        ['behavioral', 'business', 'operational']
      );

      if (this.webCallingService) {
        await this.webCallingService.deregisterWebCallingLine();
      }

      await this.teardownWxAppLocalState();
      this.updateWellnessSession();

      LoggerProxy.log(`Agent station logout completed successfully`, {
        module: CC_FILE,
        method: METHODS.STATION_LOGOUT,
        trackingId: resp.trackingId,
      });

      return resp;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          logoutReason: sanitizeForObservability(data.logoutReason),
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.STATION_LOGOUT, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Sets the state of the agent to Available or any of the Idle states.
   * After a state change attempt, one of the following events will be emitted:
   * - agent:stateChange: Emitted when agent's state changes (triggered for both local and remote changes)
   * - agent:stateChangeSuccess: Emitted when agent state change is successful
   * - agent:stateChangeFailed: Emitted when agent state change attempt fails
   *
   * @param {StateChange} data State change parameters including the new state
   * @returns {Promise<SetStateResponse>} Response with updated state information
   * @throws {Error} If state change fails
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   *
   * // Using promise-based approach
   * try {
   *   await cc.setAgentState({
   *     state: 'Available',
   *     auxCodeId: '12345',
   *     lastStateChangeReason: 'Manual state change',
   *     agentId: 'agent123',
   *   });
   * } catch (error) {
   *   console.error('State change failed:', error);
   * }
   *
   * // Optionally, listen for events
   * cc.on('agent:stateChange', (eventData) => {
   *   // Triggered for both local and remote state changes
   *   console.log('State changed:', eventData);
   * });
   *
   * cc.on('agent:stateChangeSuccess', (eventData) => {
   *   console.log('State change succeeded:', eventData);
   * });
   *
   * cc.on('agent:stateChangeFailed', (error) => {
   *   console.error('State change failed:', error);
   * });
   * ```
   */
  public async setAgentState(data: StateChange): Promise<SetStateResponse> {
    if (!this.autoAvailable?.requesting) {
      const cancelled = this.cancelAutoAvailable();
      if (cancelled) this.publishRegionState(cancelled);
    }

    LoggerProxy.info('Setting agent state', {
      module: CC_FILE,
      method: METHODS.SET_AGENT_STATE,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
      ]);
      if (
        data.state === AGENT_STATE_AVAILABLE &&
        this.webCallingService?.isBrowserVoiceRequired() &&
        !this.webCallingService.isVoiceReady()
      ) {
        const error = new Error(VOICE_CONNECTION_ERROR.NOT_READY) as GenericError;
        error.details = {
          type: 'SDK_VALIDATION_ERROR',
          orgId: this.$webex.credentials.getOrgId(),
          trackingId: EMPTY_STRING,
          data: {reason: VOICE_CONNECTION_ERROR.NOT_READY},
        };
        throw error;
      }
      const agentStatusResponse = await this.services.agent.stateChange({
        data: {...data, agentId: data.agentId || this.agentConfig.agentId},
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(agentStatusResponse),
          requestedState: data.state,
          teamId: this.agentConfig?.teams[0]?.id ?? EMPTY_STRING,
          status: agentStatusResponse.data?.status,
          subStatus: agentStatusResponse.data?.subStatus,
          auxCodeId: data.auxCodeId,
          lastStateChangeReason: sanitizeForObservability(data.lastStateChangeReason),
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log(
        `Agent state changed successfully to auxCodeId: ${agentStatusResponse.data.auxCodeId}`,
        {
          module: CC_FILE,
          method: METHODS.SET_AGENT_STATE,
          trackingId: agentStatusResponse.trackingId,
        }
      );

      return agentStatusResponse;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          state: data.state,
          auxCodeId: data.auxCodeId,
          lastStateChangeReason: sanitizeForObservability(data.lastStateChangeReason),
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.SET_AGENT_STATE, CC_FILE);
      throw detailedError;
    }
  }

  private isWaitingForBrowserVoice(): boolean {
    return (
      this.webCallingService.isBrowserVoiceRequired() && !this.webCallingService.isVoiceReady()
    );
  }

  private cancelAutoAvailable(): RegionRecoveryState | undefined {
    if (!this.autoAvailable) return undefined;
    this.autoAvailable = undefined;
    const previous = this.lastPublishedRegionState;
    if (previous?.status !== 'ready') return undefined;
    this.regionStateContext.autoAvailable = 'cancelled';

    return {...previous, autoAvailable: 'cancelled'};
  }

  private applyAvailableState(response: Agent.StateChangeSuccess): void {
    this.agentConfig.lastStateAuxCodeId = AGENT_STATE_AVAILABLE_ID;
    this.agentConfig.lastStateChangeTimestamp = response.data.lastStateChangeTimestamp;
    this.agentConfig.lastIdleCodeChangeTimestamp =
      response.data.lastIdleCodeChangeTimestamp ?? undefined;
  }

  private async requestAutoAvailable(): Promise<void> {
    const pending = this.autoAvailable;
    if (!pending || pending.requesting || pending.signal.aborted || this.isWaitingForBrowserVoice())
      return;

    pending.requesting = true;
    this.regionStateContext.autoAvailable = 'requesting';
    this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
    if (this.autoAvailable !== pending || pending.signal.aborted) return;

    const startedAt = Date.now();
    let outcome: 'succeeded' | 'failed' = 'succeeded';
    try {
      const result = await this.setAgentState({
        state: AGENT_STATE_AVAILABLE,
        auxCodeId: AGENT_STATE_AVAILABLE_ID,
        lastStateChangeReason: 'agent-wss-disconnect',
        agentId: pending.agentId,
      });
      if (this.autoAvailable === pending)
        this.applyAvailableState(result as Agent.StateChangeSuccess);
    } catch {
      outcome = 'failed';
    }
    if (this.autoAvailable !== pending || pending.signal.aborted) return;
    this.autoAvailable = undefined;
    this.regionStateContext.autoAvailable = outcome;
    this.recordRecoveryDiagnostic('auto-available', outcome, 1, startedAt);
    this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
  }

  /**
   * Returns the system-managed `WellbeingBreak` idle code for the current registration.
   * The value is fetched outside Desktop Profile filtering and cached until deregistration.
   * @returns The normalized system idle-code entity
   * @throws Structured Contact Center error when wellness is disabled or the code is unavailable
   * @example
   * const idleCode = await webex.cc.getWellbeingBreakIdleCode();
   * @public
   */
  public async getWellbeingBreakIdleCode(): Promise<Entity> {
    const method = METHODS.GET_WELLBEING_BREAK_IDLE_CODE;
    try {
      if (!this.agentConfig?.isWellnessBreakEnabled) {
        const validationError = new Error('WELLNESS_BREAK_NOT_ENABLED') as GenericError;
        validationError.details = {
          type: 'SDK_VALIDATION_ERROR',
          orgId: this.$webex.credentials.getOrgId(),
          trackingId: EMPTY_STRING,
          data: {reason: 'WELLNESS_BREAK_NOT_ENABLED'},
        };
        throw validationError;
      }

      if (this.wellbeingBreakIdleCode) {
        return this.wellbeingBreakIdleCode;
      }

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.WELLBEING_BREAK_IDLE_CODE_FETCH_SUCCESS,
        METRIC_EVENT_NAMES.WELLBEING_BREAK_IDLE_CODE_FETCH_FAILED,
      ]);
      const registrationGeneration = this.registrationGeneration;
      const orgId = this.$webex.credentials.getOrgId();
      const idleCode = await this.services.config.getWellbeingBreakIdleCode(orgId);

      if (
        registrationGeneration !== this.registrationGeneration ||
        orgId !== this.$webex.credentials.getOrgId() ||
        !this.agentConfig?.isWellnessBreakEnabled
      ) {
        const staleRegistrationError = new Error(
          'WELLNESS_BREAK_REGISTRATION_CHANGED'
        ) as GenericError;
        staleRegistrationError.details = {
          type: 'SDK_VALIDATION_ERROR',
          orgId,
          trackingId: EMPTY_STRING,
          data: {reason: 'WELLNESS_BREAK_REGISTRATION_CHANGED'},
        };
        throw staleRegistrationError;
      }

      this.wellbeingBreakIdleCode = idleCode;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WELLBEING_BREAK_IDLE_CODE_FETCH_SUCCESS,
        {},
        ['operational']
      );

      return idleCode;
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WELLBEING_BREAK_IDLE_CODE_FETCH_FAILED,
        {reason: error instanceof Error ? error.message : UNKNOWN_ERROR},
        ['operational']
      );
      const {error: detailedError} = getErrorDetails(error, method, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Returns the current browser voice connection state.
   * Subscribe to `voice:connectionStateChange` to receive updates. The snapshot keeps line
   * registration separate from Mobius socket connectivity and does not represent the Contact
   * Center WebSocket connection.
   *
   * @returns {VoiceConnectionState} Current browser voice status and underlying connection states
   * @fires voice:connectionStateChange When browser voice availability changes
   * @public
   * @example
   * ```typescript
   * cc.on('voice:connectionStateChange', onVoiceStateChange);
   * const state = cc.getVoiceConnectionState();
   * ```
   */
  public getVoiceConnectionState(): VoiceConnectionState {
    const state = this.webCallingService?.getVoiceConnectionState();

    return state ?? {...DEFAULT_VOICE_CONNECTION_STATE};
  }

  /**
   * Processes incoming websocket messages and emits corresponding events
   * Handles various event types including agent state changes, login events,
   * and other agent-related notifications
   * @private
   * @param {string} event The raw websocket event message
   */
  private handleWebsocketMessage = (event: string) => {
    let eventData: Record<string, any>;
    try {
      eventData = JSON.parse(event);
    } catch {
      return;
    }
    if (!eventData || typeof eventData !== 'object') return;
    if (eventData.type === SYSTEM_EVENTS.SYSTEM_REGION_SWITCH) {
      const regionSwitch = normalizeRegionSwitch(eventData);
      if (regionSwitch) this.handleRegionSwitch(regionSwitch);

      return;
    }
    if (eventData.type === CC_EVENTS.WELCOME && this.registrationAgentId) {
      try {
        this.assertPrimaryIdentity(eventData.data?.agentId);
      } catch {
        return;
      }
    }
    if (eventData.type === CC_EVENTS.AGENT_MULTI_LOGIN) this.terminateRegistration();
    this.handleRemoteStationLogout(eventData);
    // Re-emit all the events related to agent except keep-alives. Only event names present in
    // the typed CC_EVENTS allow-list are emitted; unknown/server-injected types are ignored.
    if (
      !eventData.keepalive &&
      eventData.data &&
      eventData.data.type &&
      CC_EVENT_ALLOW_LIST.has(eventData.data.type)
    ) {
      // @ts-ignore
      this.emit(eventData.data.type, eventData.data);
    }

    if (!eventData.type) {
      return;
    }

    LoggerProxy.log(
      `Received event: ${sanitizeForObservability(eventData?.data?.type ?? eventData.type)}`,
      {
        module: CC_FILE,
        method: METHODS.HANDLE_WEBSOCKET_MESSAGE,
      }
    );

    // Emit metrics for all websocket events except keepalive and welcome
    const topLevelType = eventData.type;
    const nestedType = eventData?.data?.type;
    if (topLevelType !== CC_EVENTS.WELCOME && eventData.keepalive !== 'true') {
      const metricsPayload: Record<string, any> = {
        ws_event_type: sanitizeForObservability(nestedType || topLevelType),
        top_level_type: sanitizeForObservability(topLevelType),
        has_data: Boolean(eventData.data),
      };
      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.WEBSOCKET_EVENT_RECEIVED, metricsPayload, [
        'operational',
      ]);
    }

    if (this.handleWellnessBreakWebsocketPayload(eventData)) {
      return;
    }

    switch (eventData.type) {
      case CC_EVENTS.AGENT_MULTI_LOGIN:
        if (
          eventData.data?.type === 'AgentMultiLoginCloseSession' &&
          (!eventData.data.agentSessionId ||
            eventData.data.agentSessionId === this.currentAgentSessionId)
        ) {
          this.updateWellnessSession();
        }
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_MULTI_LOGIN, eventData.data);
        break;
      case CC_EVENTS.AGENT_STATE_CHANGE:
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData.data);
        break;
      default:
        break;
    }

    if (!(eventData.data && eventData.data.type)) {
      return;
    }

    switch (eventData.data.type) {
      case CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS: {
        const {channelsMap, ...loginData} = eventData.data;
        if (!this.recovery || this.recoveryPhase === 'ready') {
          this.webCallingService.setLoginOption(loginData.deviceType as LoginOption);
          if (
            loginData.deviceType === LoginOption.EXTENSION ||
            loginData.deviceType === LoginOption.AGENT_DN
          )
            this.webCallingService.setBrowserVoiceRequired(false);
        }
        const stationLoginData = {
          ...loginData,
          mmProfile: {
            chat: channelsMap?.chat?.length,
            email: channelsMap?.email?.length,
            social: channelsMap?.social?.length,
            telephony: channelsMap?.telephony?.length,
          },
          notifsTrackingId: eventData.trackingId,
        };
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, stationLoginData);
        break;
      }
      case CC_EVENTS.AGENT_RELOGIN_SUCCESS: {
        const {channelsMap, ...loginData} = eventData.data;
        const stationReLoginData = {
          ...loginData,
          mmProfile: {
            chat: channelsMap?.chat?.length,
            email: channelsMap?.email?.length,
            social: channelsMap?.social?.length,
            telephony: channelsMap?.telephony?.length,
          },
          notifsTrackingId: eventData.trackingId,
        };
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_RELOGIN_SUCCESS, stationReLoginData);
        break;
      }
      case CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS:
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, eventData.data);
        break;
      case CC_EVENTS.AGENT_STATE_CHANGE_FAILED:
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE_FAILED, eventData.data);
        break;
      case CC_EVENTS.AGENT_STATION_LOGIN_FAILED:
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_STATION_LOGIN_FAILED, eventData.data);
        break;
      case CC_EVENTS.AGENT_LOGOUT_SUCCESS:
        if (
          !eventData.data.agentSessionId ||
          eventData.data.agentSessionId === this.currentAgentSessionId
        ) {
          this.updateWellnessSession();
        }
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_LOGOUT_SUCCESS, eventData.data);
        break;
      case CC_EVENTS.AGENT_LOGOUT_FAILED:
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_LOGOUT_FAILED, eventData.data);
        break;
      case CC_EVENTS.AGENT_DN_REGISTERED:
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_DN_REGISTERED, eventData.data);
        break;
      default:
        break;
    }
  };

  /**
   * Checks whether Mobius/WebRTC registration should be skipped by config
   * @returns {boolean} True when browser WebRTC registration is disabled
   * @private
   */
  private isWebRTCRegistrationDisabled(): boolean {
    return this.$config?.disableWebRTCRegistration === true;
  }

  /**
   * Determines whether this local login should register a browser voice line.
   * @param {LoginOption} loginOption Login device selected for this station login
   * @returns {boolean} True when browser WebRTC registration is enabled
   * @private
   */
  private isBrowserVoiceRequired(loginOption: LoginOption): boolean {
    return (
      loginOption === LoginOption.BROWSER &&
      this.agentConfig?.webRtcEnabled === true &&
      !this.isWebRTCRegistrationDisabled()
    );
  }

  /**
   * Validates contact-center plugin configuration before service initialization
   * @private
   */
  private validatePluginConfig(): void {
    if (
      this.$config?.disableWebRTCRegistration === true &&
      this.$config?.allowMultiLogin === false
    ) {
      throw new Error(
        'Invalid Contact Center configuration: disableWebRTCRegistration cannot be true when allowMultiLogin is false. Enable allowMultiLogin or allow WebRTC registration so an SDK instance can receive Mobius/WebRTC task events.'
      );
    }
  }

  /**
   * Whether wxApp thick-client answer is enabled for this SDK instance.
   * @public
   */
  public isWxBetterTogetherEnabled(): boolean {
    return this.$config?.enableWxBetterTogether === true;
  }

  /**
   * Current station login option (Extension, Dial Number, or Browser/Desktop).
   * Prefer webCallingService — updated on every stationLogin before wxApp hooks run.
   * @private
   */
  private getCurrentStationLoginOption(): LoginOption | undefined {
    return this.webCallingService?.loginOption ?? this.agentConfig?.deviceType;
  }

  /**
   * wxApp thick-client answer is supported for Extension and Dial Number station login only —
   * not Browser/Desktop (WebRTC) login.
   * @private
   */
  private assertWxAppStationLoginSupportedForEnable(): void {
    const loginOption = this.getCurrentStationLoginOption();
    if (loginOption !== LoginOption.EXTENSION && loginOption !== LoginOption.AGENT_DN) {
      throw new Error(
        'setManageWebexCallingInWxcc requires EXTENSION or AGENT_DN station login. Complete station login before enabling.'
      );
    }
  }

  /**
   * Clears runtime wxApp config after logout/deregister so stale flags do not apply on relogin.
   * @private
   */
  private resetEnableWxBetterTogetherConfig(): void {
    if (this.$config) {
      this.$config.enableWxBetterTogether = false;
    }
    this.taskManager.applyEnableWxBetterTogether(false);
  }

  /**
   * Runtime enable/disable for wxApp Better Together (toast suppression + Mercury mute sync).
   *
   * **Phase 1 (WXCC-6026 / MMT): NOT part of the public host contract.**
   * Hosts must set `webexConfig.cc.enableWxBetterTogether` before `webex.init()` / `cc.register()`.
   * To change the flag after the SDK is initialized, re-init the SDK with the updated config.
   *
   * **Supported public read API:** {@link isWxBetterTogetherEnabled}.
   * **Supported telephony API:** unified `task.accept()`, `task.decline()`, `task.toggleMute()`,
   * `task.transmitDtmf()` — SDK routes wxApp calls internally when the init flag is active.
   *
   * **Production lifecycle does not call this method.** Station login, silent relogin, logout,
   * and deregister use {@link ensureWxAppPostStationLogin} and {@link teardownWxAppLocalState}
   * (usersub publish + Mercury subscribe/unsubscribe based on the init flag).
   *
   * This setter remains as a **private implementation** for Phase 2 runtime toggle and unit tests.
   * It updates `$config.enableWxBetterTogether`, TaskManager flags, cross-client usersub
   * (`answer-calls-on-wxcc`), and Mercury mute sync; rolls back config on publish/connect failure.
   *
   * @param enabled - `true` to enable wxApp answer + usersub suppression; `false` to disable and tear down.
   * @throws When enabling without login, on unsupported BROWSER station login, or when usersub/Mercury init fails.
   * @internal
   * @see enableWxBetterTogether (CCPluginConfig init flag)
   * @see ensureWxAppPostStationLogin
   * @see teardownWxAppLocalState
   */
  private async setManageWebexCallingInWxcc(enabled: boolean): Promise<void> {
    if (enabled && !this.$webex.internal.device?.userId) {
      throw new Error('Cannot publish answer-calls-on-wxcc: user is not logged in');
    }

    if (enabled) {
      this.assertWxAppStationLoginSupportedForEnable();
    }

    const previousEnabled = this.isWxBetterTogetherEnabled();

    if (this.$config) {
      this.$config.enableWxBetterTogether = enabled;
    }

    this.taskManager.applyEnableWxBetterTogether(enabled);

    let publishedEnable = false;

    try {
      if (enabled) {
        await this.ensureWxAppMercuryAndSubscribe();
        await this.publishAnswerOnWebexCrossClientState(true);
        publishedEnable = true;
        this.taskManager.syncWxAppMuteFromCallDetailsForAllTasks();
        this.taskManager.refreshWxAppOfferObservabilityForAllTasks();
      } else {
        await this.publishAnswerOnWebexCrossClientState(false);
        this.wxAppTelephonyMercurySync.unsubscribe();
        await this.releaseWxAppMercuryResources();
      }
    } catch (error) {
      if (publishedEnable) {
        await this.revertWxAppCrossClientPublish();
      } else if (enabled) {
        this.wxAppTelephonyMercurySync.unsubscribe();
        await this.releaseWxAppMercuryResources();
      }

      if (this.$config) {
        this.$config.enableWxBetterTogether = previousEnabled;
      }
      this.taskManager.applyEnableWxBetterTogether(previousEnabled);
      throw error;
    }
  }

  private getWxAppTelephonyTaskType(): 'Voice' | 'WebRTC' | 'unknown' {
    const loginOption = this.getCurrentStationLoginOption();

    if (loginOption === LoginOption.BROWSER) {
      return 'WebRTC';
    }

    if (loginOption === LoginOption.EXTENSION || loginOption === LoginOption.AGENT_DN) {
      return 'Voice';
    }

    return 'unknown';
  }

  private async ensureWxAppPostStationLogin(): Promise<void> {
    const loginOption = this.getCurrentStationLoginOption();
    const flagEnabled = this.isWxBetterTogetherEnabled();
    const telephonyTaskType = this.getWxAppTelephonyTaskType();

    if (loginOption === LoginOption.BROWSER) {
      if (flagEnabled) {
        logWxAppSessionReadiness({
          enableWxBetterTogether: true,
          loginOption,
          wxAppHooksApplied: false,
          usersubPublished: false,
          mercurySubscribed: false,
          telephonyTaskType,
          skipReason: 'unsupported_browser_login',
        });

        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED,
          {
            loginOption,
            enableWxBetterTogether: true,
            skipReason: 'unsupported_browser_login',
          },
          ['operational', 'behavioral']
        );
      }

      return;
    }

    let publishedEnable = false;
    let wxAppInitStage: 'mercury' | 'publish' = 'mercury';

    try {
      if (flagEnabled) {
        this.metricsManager.timeEvent([
          METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_SUCCESS,
          METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
        ]);

        await this.ensureWxAppMercuryAndSubscribe();
        wxAppInitStage = 'publish';
        await this.publishAnswerOnWebexCrossClientState(true);
        publishedEnable = true;
        this.taskManager.syncWxAppMuteFromCallDetailsForAllTasks();
        this.taskManager.refreshWxAppOfferObservabilityForAllTasks();

        const mercurySubscribed = this.wxAppTelephonyMercurySync.isSubscribed();
        const usersubPublished = this.webexCrossClientService.isAnswerCallsStateActive();

        logWxAppSessionReadiness({
          enableWxBetterTogether: true,
          loginOption,
          wxAppHooksApplied: true,
          usersubPublished,
          mercurySubscribed,
          telephonyTaskType,
        });

        const sessionInitReady = mercurySubscribed && usersubPublished;

        if (sessionInitReady) {
          this.metricsManager.trackEvent(
            METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_SUCCESS,
            {
              loginOption,
              enableWxBetterTogether: true,
              usersubPublished,
              mercurySubscribed,
              telephonyTaskType,
            },
            ['operational', 'behavioral']
          );
        } else {
          this.metricsManager.trackEvent(
            METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
            {
              loginOption,
              enableWxBetterTogether: true,
              usersubPublished,
              mercurySubscribed,
              telephonyTaskType,
              skipReason: !usersubPublished ? 'usersub_not_published' : 'mercury_not_subscribed',
            },
            ['operational', 'behavioral']
          );
        }
      } else {
        await this.ensureWxAppDeviceRegistered();
        await this.publishAnswerOnWebexCrossClientState(false, {force: true});
        this.webexCrossClientService.teardown();
        this.wxAppTelephonyMercurySync.unsubscribe();
        await this.releaseWxAppMercuryResources();

        logWxAppSessionReadiness({
          enableWxBetterTogether: false,
          loginOption,
          wxAppHooksApplied: true,
          usersubPublished: false,
          mercurySubscribed: false,
          telephonyTaskType,
          skipReason: 'flag_disabled',
        });

        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED,
          {loginOption, enableWxBetterTogether: false, skipReason: 'flag_disabled'},
          ['operational', 'behavioral']
        );
      }
    } catch (error) {
      LoggerProxy.error(`Failed to initialize wxApp post-station-login: ${error}`, {
        module: CC_FILE,
        method: METHODS.STATION_LOGIN,
      });

      if (flagEnabled) {
        const sessionInitFailureReason =
          wxAppInitStage === 'mercury' ? 'mercury_subscribe_failed' : 'publish_failed';

        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
          {
            loginOption,
            enableWxBetterTogether: true,
            usersubPublished: this.webexCrossClientService.isAnswerCallsStateActive(),
            mercurySubscribed: this.wxAppTelephonyMercurySync.isSubscribed(),
            telephonyTaskType,
            skipReason: sessionInitFailureReason,
            error: error instanceof Error ? error.toString() : String(error),
          },
          ['operational', 'behavioral']
        );

        logWxAppSessionReadiness({
          enableWxBetterTogether: true,
          loginOption,
          wxAppHooksApplied: false,
          usersubPublished: this.webexCrossClientService.isAnswerCallsStateActive(),
          mercurySubscribed: this.wxAppTelephonyMercurySync.isSubscribed(),
          telephonyTaskType,
          skipReason: sessionInitFailureReason,
        });

        if (publishedEnable) {
          await this.revertWxAppCrossClientPublish();
        } else {
          this.wxAppTelephonyMercurySync.unsubscribe();
          await this.releaseWxAppMercuryResources();
        }
        this.resetEnableWxBetterTogetherConfig();
      } else {
        this.scheduleForcedFalsePublishRetry();
      }
    }
  }

  private clearWxAppFalsePublishRetryTimer(): void {
    if (this.wxAppFalsePublishRetryTimer) {
      clearTimeout(this.wxAppFalsePublishRetryTimer);
      this.wxAppFalsePublishRetryTimer = undefined;
    }
  }

  private scheduleForcedFalsePublishRetry(retryAttempt = 0): void {
    this.scheduleFalsePublishRetry(retryAttempt, {requireDisabled: true});
  }

  /**
   * Retries compensating false publish after rollback failure, regardless of enabled flag.
   * @private
   */
  private scheduleCompensatingFalsePublishRetry(retryAttempt = 0): void {
    this.scheduleFalsePublishRetry(retryAttempt);
  }

  private scheduleFalsePublishRetry(
    retryAttempt = 0,
    options: {requireDisabled?: boolean} = {}
  ): void {
    if (retryAttempt >= ContactCenter.WXAPP_FALSE_PUBLISH_MAX_RETRIES) {
      return;
    }

    if (options?.requireDisabled && this.isWxBetterTogetherEnabled()) {
      return;
    }

    this.clearWxAppFalsePublishRetryTimer();

    this.wxAppFalsePublishRetryTimer = setTimeout(async () => {
      this.wxAppFalsePublishRetryTimer = undefined;

      if (options?.requireDisabled && this.isWxBetterTogetherEnabled()) {
        return;
      }

      if (
        !options?.requireDisabled &&
        this.isWxBetterTogetherEnabled() &&
        this.webexCrossClientService.isAnswerCallsStateActive()
      ) {
        return;
      }

      try {
        await this.ensureWxAppDeviceRegistered();
        await this.publishAnswerOnWebexCrossClientState(false, {force: true});
        this.webexCrossClientService.teardown();
        this.wxAppTelephonyMercurySync.unsubscribe();
        await this.releaseWxAppMercuryResources();
      } catch (retryError) {
        LoggerProxy.error(
          `Failed to retry forced answer-calls-on-wxcc false publish: ${retryError}`,
          {
            module: CC_FILE,
            method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
          }
        );
        this.scheduleFalsePublishRetry(retryAttempt + 1, options);
      }
    }, ContactCenter.WXAPP_FALSE_PUBLISH_RETRY_DELAY_MS);
  }

  /**
   * Best-effort rollback when usersub true was published but wxApp setup did not complete.
   * @private
   */
  private async revertWxAppCrossClientPublish(): Promise<void> {
    try {
      await this.publishAnswerOnWebexCrossClientState(false, {force: true});
    } catch (error) {
      LoggerProxy.error(
        `Failed to publish compensating answer-calls-on-wxcc false during wxApp rollback: ${error}`,
        {
          module: CC_FILE,
          method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
        }
      );
      this.scheduleCompensatingFalsePublishRetry();
    }

    this.webexCrossClientService.teardown();
    this.wxAppTelephonyMercurySync.unsubscribe();
    await this.releaseWxAppMercuryResources();
  }

  private async ensureWxAppDeviceRegistered(): Promise<void> {
    const device = this.$webex.internal.device;

    if (device && !device.registered && device.register) {
      await device.register();
      this.wxAppDeviceRegisteredByCc = true;
      LoggerProxy.log('WxApp: device registered for cross-client publish', {
        module: CC_FILE,
        method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
      });
    }
  }

  private async ensureWxAppMercuryConnected(): Promise<void> {
    const mercury = this.$webex.internal.mercury;

    await this.ensureWxAppDeviceRegistered();

    if (mercury && !mercury.connected) {
      await mercury.connect();
      this.wxAppMercuryConnectedByCc = true;
      LoggerProxy.log('WxApp mute sync: mercury connected', {
        module: CC_FILE,
        method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
      });
    }
  }

  /**
   * Disconnects Mercury and unregisters the device when wxApp mute sync opened them.
   * @private
   */
  private async releaseWxAppMercuryResources(): Promise<void> {
    const mercury = this.$webex.internal.mercury;
    const device = this.$webex.internal.device;

    if (this.wxAppMercuryConnectedByCc && mercury?.connected) {
      try {
        await mercury.disconnect();
        this.wxAppMercuryConnectedByCc = false;
        LoggerProxy.log('WxApp mute sync: mercury disconnected', {
          module: CC_FILE,
          method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
        });
      } catch (error) {
        LoggerProxy.error(`Failed to disconnect wxApp Mercury: ${error}`, {
          module: CC_FILE,
          method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
        });
      }
    }

    if (this.wxAppDeviceRegisteredByCc && device?.registered && device.unregister) {
      try {
        // @ts-ignore
        await device.unregister();
        this.wxAppDeviceRegisteredByCc = false;
        LoggerProxy.log('WxApp mute sync: device unregistered', {
          module: CC_FILE,
          method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
        });
      } catch (error) {
        LoggerProxy.error(`Failed to unregister wxApp device: ${error}`, {
          module: CC_FILE,
          method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
        });
      }
    } else if (this.wxAppDeviceRegisteredByCc) {
      this.wxAppDeviceRegisteredByCc = false;
    }
  }

  /**
   * Clears wxApp runtime state and feature-owned resources. Publish failures are logged;
   * optional rethrow for deregister when callers need to surface usersub errors.
   * @private
   */
  private async teardownWxAppLocalState(options?: {
    rethrowPublishError?: boolean;
    clearInitFlag?: boolean;
  }): Promise<{publishError?: unknown}> {
    this.clearWxAppFalsePublishRetryTimer();
    let publishError: unknown;

    try {
      const shouldForceFalsePublish =
        this.isWxBetterTogetherEnabled() || this.webexCrossClientService.isAnswerCallsStateActive();

      await this.publishAnswerOnWebexCrossClientState(false, {
        force: shouldForceFalsePublish,
      });
    } catch (error) {
      publishError = error;
      LoggerProxy.error(
        `Failed to publish answer-calls-on-wxcc false during wxApp teardown: ${error}`,
        {
          module: CC_FILE,
          method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
        }
      );
    }

    this.webexCrossClientService.teardown();
    this.wxAppTelephonyMercurySync.unsubscribe();
    await this.releaseWxAppMercuryResources();

    if (options?.clearInitFlag) {
      this.resetEnableWxBetterTogetherConfig();
    }

    if (publishError) {
      this.scheduleCompensatingFalsePublishRetry();
    }

    if (options?.rethrowPublishError && publishError) {
      throw publishError;
    }

    return {publishError: publishError ?? undefined};
  }

  private async ensureWxAppMercuryAndSubscribe(): Promise<void> {
    if (!this.isWxBetterTogetherEnabled()) {
      return;
    }

    if (this.getCurrentStationLoginOption() === LoginOption.BROWSER) {
      return;
    }

    const agentId = this.agentConfig?.agentId;
    if (!agentId) {
      LoggerProxy.error('Cannot subscribe wxApp mute sync: agentId unavailable', {
        module: CC_FILE,
        method: METHODS.SYNC_WXAPP_MUTE_FROM_MERCURY,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_FAILED,
        {error: 'agentId unavailable', mercurySubscribed: false},
        ['operational', 'behavioral']
      );

      return;
    }

    try {
      await this.ensureWxAppMercuryConnected();
      this.wxAppTelephonyMercurySync.subscribe(agentId, (callId, muted) => {
        this.taskManager.applyWxAppMuteStateFromSync(callId, muted);
      });
    } catch (error) {
      LoggerProxy.error(`Failed to ensure wxApp Mercury mute sync: ${error}`, {
        module: CC_FILE,
        method: METHODS.SYNC_WXAPP_MUTE_FROM_MERCURY,
      });
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_FAILED,
        {
          error: error instanceof Error ? error.toString() : String(error),
          mercurySubscribed: false,
        },
        ['operational', 'behavioral']
      );
      this.wxAppTelephonyMercurySync.unsubscribe();
      await this.releaseWxAppMercuryResources();
      throw error;
    }
  }

  private async publishAnswerOnWebexCrossClientState(
    enable: boolean,
    options?: {force?: boolean}
  ): Promise<void> {
    if (enable && !this.isWxBetterTogetherEnabled()) {
      return;
    }

    if (!enable && !options?.force && !this.webexCrossClientService.isAnswerCallsStateActive()) {
      return;
    }

    const userId = this.$webex.internal.device?.userId;
    if (!userId) {
      if (enable && this.isWxBetterTogetherEnabled()) {
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
          {
            enableWxBetterTogether: true,
            usersubPublished: this.webexCrossClientService.isAnswerCallsStateActive(),
            skipReason: 'user_id_unavailable',
            error: 'User ID is unavailable for cross-client publish',
          },
          ['operational', 'behavioral']
        );
      }

      return;
    }

    await this.webexCrossClientService.setManageWebexCallingInWxcc(enable, {
      userId,
      trackPublishMetrics: true,
    });

    if (enable) {
      this.clearWxAppFalsePublishRetryTimer();
    }
  }

  /**
   * Initializes event listeners for the Contact Center service
   * Sets up handlers for connection state changes and other core events
   * @private
   */
  private setupEventListeners() {
    this.services.connectionService.off('connectionLost', this.handleConnectionLost);
    this.services.connectionService.on('connectionLost', this.handleConnectionLost);
  }

  /**
   * Returns the connection configuration
   * @returns {SubscribeRequest} Connection configuration
   * @private
   */
  private getConnectionConfig(): SubscribeRequest {
    return {
      force: this.$config?.force ?? true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
      clientType: this.$config?.clientType ?? 'WebexCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin ?? true,
    };
  }

  /**
   * Handles connection lost events and reconnection attempts
   * @param {ConnectionLostDetails} msg Connection lost details
   * @private
   */
  private handleConnectionLost = async (msg: ConnectionLostDetails): Promise<void> => {
    if (msg.isConnectionLost) {
      // TODO: Emit an event saying connection is lost
      this.recordBestEffort(() =>
        LoggerProxy.log('event=handleConnectionLost | Connection lost', {
          module: CC_FILE,
          method: METHODS.HANDLE_CONNECTION_LOST,
        })
      );
    } else if (msg.isSocketReconnected) {
      // TODO: Emit an event saying connection is re-estabilished
      this.recordBestEffort(() =>
        LoggerProxy.log(
          'event=handleConnectionReconnect | Connection reconnected attempting to request silent relogin',
          {module: CC_FILE, method: METHODS.HANDLE_CONNECTION_LOST}
        )
      );
      if (
        this.$config?.allowAutomatedRelogin &&
        !this.pendingRegistration &&
        !this.suppressAutomaticRelogin &&
        ['idle', 'ready'].includes(this.recoveryPhase)
      ) {
        const registration = this.registrationGeneration;
        const generation = this.recoveryGeneration;
        const signal = this.registrationAbortController?.signal;
        try {
          await this.silentRelogin();
        } catch (error) {
          if (
            registration !== this.registrationGeneration ||
            generation !== this.recoveryGeneration ||
            signal?.aborted
          )
            return;
          const failure = normalizeRecoveryFailure(error);
          if (failure.status === 401 || failure.status === 403) this.handleRecoveryTerminal(error);
        }
      }
    }
  };

  /**
   * Handles silent relogin after registration completion
   * @private
   */
  private async silentRelogin(initialRegistration = false): Promise<void> {
    const generation = this.recoveryGeneration;
    const registrationSignal = this.registrationAbortController?.signal;
    const assertReloginAdmission = () => {
      if (generation !== this.recoveryGeneration || registrationSignal?.aborted)
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    };
    if (!initialRegistration) {
      const cancelled = this.cancelAutoAvailable();
      if (cancelled) {
        const phase = this.recoveryPhase;
        this.recoveryPhase = 'cancelled';
        this.publishRegionState(cancelled);
        assertReloginAdmission();
        this.recoveryPhase = phase;
      }
    }
    this.recordBestEffort(() =>
      LoggerProxy.log('Starting silent relogin process', {
        module: CC_FILE,
        method: METHODS.SILENT_RELOGIN,
      })
    );

    try {
      const reLoginResponse = await this.services.agent.reload();
      assertReloginAdmission();
      this.rememberAcceptedStation({source: 'reload', response: reLoginResponse});
      if (!initialRegistration && registrationSignal) this.resumeRtd(registrationSignal);

      const {agentId, lastStateChangeReason, deviceType, dn} = reLoginResponse.data;
      const acceptedPayload = this.acceptedStation;
      if (acceptedPayload)
        await this.handleDeviceType(
          acceptedPayload.deviceType as LoginOption,
          acceptedPayload.dialNumber
        );
      else if (Object.values(LoginOption).includes(deviceType as LoginOption))
        await this.handleDeviceType(deviceType as LoginOption, dn);

      assertReloginAdmission();

      if (lastStateChangeReason === 'agent-wss-disconnect') {
        this.recordBestEffort(() =>
          LoggerProxy.log(
            'event=requestAutoStateChange | Requesting state change to available on socket reconnect',
            {module: CC_FILE, method: METHODS.SILENT_RELOGIN}
          )
        );
        const stateChangeData: StateChange = {
          state: AGENT_STATE_AVAILABLE,
          auxCodeId: AGENT_STATE_AVAILABLE_ID,
          lastStateChangeReason,
          agentId,
        };
        try {
          const result = (await this.setAgentState(stateChangeData)) as Agent.StateChangeSuccess;
          assertReloginAdmission();
          this.applyAvailableState(result);
        } catch (error) {
          this.recordBestEffort(() =>
            LoggerProxy.error(
              `event=requestAutoStateChange | Error requesting state change to available on socket reconnect: ${error}`,
              {module: CC_FILE, method: METHODS.SILENT_RELOGIN}
            )
          );
        }
      }
      assertReloginAdmission();
      await this.ensureWxAppPostStationLogin();
      assertReloginAdmission();
      if (initialRegistration) {
        this.recoveryPhase = 'ready';
        this.publishRegionState(this.buildRegionState('ready', 'initial-login'));
      }

      this.recordBestEffort(() =>
        LoggerProxy.log(
          `Silent relogin process completed successfully with login Option: ${reLoginResponse.data.deviceType} teamId: ${reLoginResponse.data.teamId}`,
          {
            module: CC_FILE,
            method: METHODS.SILENT_RELOGIN,
            trackingId: reLoginResponse.trackingId,
          }
        )
      );
    } catch (error) {
      const {reason, error: detailedError} = getErrorDetails(
        error,
        METHODS.SILENT_RELOGIN,
        CC_FILE
      );
      if (reason === 'AGENT_NOT_FOUND') {
        this.recordBestEffort(() =>
          LoggerProxy.log('Agent not found during relogin, handling silently', {
            module: CC_FILE,
            method: METHODS.SILENT_RELOGIN,
          })
        );

        return;
      }
      // Keep the structured HTTP classification across the public Error translation.
      const {status} = normalizeRecoveryFailure(error);
      if (status !== undefined && !isRegionRecoveryError(error))
        Object.assign(detailedError, {statusCode: status});
      throw detailedError;
    }
  }

  /**
   * Handles device type specific configuration and setup
   * Configures services and settings based on the login device type
   * @param {LoginOption} deviceType The type of device being used for login
   * @param {string} dn The dial number associated with the device
   * @param {boolean} [restoringRegion] Preserve Calling's line on regional restore
   * @returns {Promise<void>}
   * @private
   */
  private async handleDeviceType(
    deviceType: LoginOption,
    dn: string,
    restoringRegion = false
  ): Promise<void> {
    this.webCallingService.setLoginOption(deviceType);
    this.webCallingService.setBrowserVoiceRequired(this.isBrowserVoiceRequired(deviceType));
    this.agentConfig.deviceType = deviceType;
    switch (deviceType) {
      case LoginOption.BROWSER:
        // Ordinary relogin replaces the line even when the profile does not require browser voice.
        if (
          this.isWebRTCRegistrationDisabled() ||
          (restoringRegion && !this.isBrowserVoiceRequired(deviceType))
        ) {
          this.recordBestEffort(() =>
            LoggerProxy.info(
              this.isWebRTCRegistrationDisabled()
                ? 'Skipping web calling line registration because disableWebRTCRegistration is enabled'
                : 'Skipping web calling line registration because browser voice is not required',
              {
                module: CC_FILE,
                method: METHODS.HANDLE_DEVICE_TYPE,
              }
            )
          );
          break;
        }
        if (restoringRegion) this.webCallingService.ensureWebCallingLine();
        else {
          try {
            await this.webCallingService.registerWebCallingLine();
          } catch (error) {
            LoggerProxy.error(`Error registering web calling line: ${error}`, {
              module: CC_FILE,
              method: METHODS.HANDLE_DEVICE_TYPE,
            });
            throw error;
          }
        }
        break;
      case LoginOption.AGENT_DN:
      case LoginOption.EXTENSION:
        this.agentConfig.defaultDn = dn;
        this.agentConfig.dn = dn;
        break;
      default:
        this.recordBestEffort(() =>
          LoggerProxy.error(`Unsupported device type: ${deviceType}`, {
            module: CC_FILE,
            method: METHODS.HANDLE_DEVICE_TYPE,
          })
        );
        throw new Error(`Unsupported device type: ${deviceType}`);
    }
  }

  /**
   * Makes an outbound call to a specified phone number.
   *
   * @param {string} destination - The phone number to dial (e.g., '+1234567890').
   * @param {string} origin - The contact center number that will be used while making a call to the customer.
   * Should include country code and be in E.164 format.
   * @returns {Promise<TaskResponse>} Resolves with the task response containing:
   *   - interactionId: Unique identifier for the outbound call
   *   - taskId: Identifier for the task instance
   *   - data: Task details including state, queue info, and media properties
   * @throws {Error} If the outdial operation fails:
   *   - "Agent not configured for outbound calls" if isOutboundEnabledForAgent is false
   *   - "Invalid phone number format" if destination is not in E.164 format
   *   - "Agent not in Available state" if agent's state is not Available
   * @public
   * @example
   * ```typescript
   * // Initialize and prepare agent
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({
   *   teamId: 'team123',
   *   loginOption: 'BROWSER'
   * });
   *
   * // Set Available state before outbound call
   * await cc.setAgentState({
   *   state: 'Available',
   *   auxCodeId: '0'
   * });
   *
   * // Make outbound call with full error handling
   * try {
   *   // Verify agent is properly configured for outdial
   *   if (!cc.agentConfig.isOutboundEnabledForAgent) {
   *     throw new Error('Agent not configured for outbound calls');
   *   }
   *
   *   // Start the outbound call
   *   const destination = '+1234567890';
   *   const task = await cc.startOutdial(destination, origin);
   *
   *   // Listen for all relevant task events
   *   task.on('task:ringing', () => {
   *     console.log('Call is ringing');
   *     updateCallStatus('Ringing...');
   *   });
   *
   *   task.on('task:established', () => {
   *     console.log('Call connected');
   *     updateCallStatus('Connected');
   *     enableCallControls(); // Show mute, hold, transfer buttons
   *   });
   *
   *   task.on('task:hold', () => {
   *     console.log('Call placed on hold');
   *     updateCallStatus('On Hold');
   *   });
   *
   *   task.on('task:error', (error) => {
   *     console.error('Call error:', error);
   *     updateCallStatus('Error');
   *     showErrorDialog(error.message);
   *   });
   *
   *   task.on('task:ended', () => {
   *     console.log('Call ended');
   *     updateCallStatus('Call Ended');
   *     resetCallControls();
   *
   *     // Handle wrap-up if required
   *     if (task.data.wrapUpRequired) {
   *       showWrapupForm();
   *     }
   *   });
   *
   *   // Example call control usage
   *   function handleMuteToggle() {
   *     await task.toggleMute();
   *   }
   *
   *   function handleHoldToggle() {
   *     if (task.data.isOnHold) {
   *       await task.resume();
   *     } else {
   *       await task.hold();
   *     }
   *   }
   *
   *   async function handleTransfer() {
   *     // Get available queues for transfer
   *     const queues = await cc.getQueues();
   *
   *     // Transfer to first available queue
   *     if (queues.length > 0) {
   *       await task.transfer({
   *         to: queues[0].queueId,
   *         destinationType: 'QUEUE'
   *       });
   *     }
   *   }
   *
   * } catch (error) {
   *   console.error('Outdial failed:', error);
   *   showErrorNotification('Failed to place call: ' + error.message);
   * }
   * ```
   */
  public async startOutdial(destination: string, origin: string): Promise<TaskResponse> {
    LoggerProxy.info('Starting outbound dial', {
      module: CC_FILE,
      method: METHODS.START_OUTDIAL,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_OUTDIAL_SUCCESS,
        METRIC_EVENT_NAMES.TASK_OUTDIAL_FAILED,
      ]);

      // Construct the outdial payload.
      const outDialPayload: DialerPayload = {
        destination,
        origin,
        entryPointId: this.agentConfig.outDialEp,
        direction: OUTDIAL_DIRECTION,
        attributes: ATTRIBUTES,
        mediaType: OUTDIAL_MEDIA_TYPE,
        outboundType: OUTBOUND_TYPE,
      };

      const result = await this.services.dialer.startOutdial({data: outDialPayload});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_OUTDIAL_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
          destination,
          origin,
          mediaType: OUTDIAL_MEDIA_TYPE,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log(`Outbound dial completed successfully`, {
        module: CC_FILE,
        method: METHODS.START_OUTDIAL,
        trackingId: result.trackingId,
        interactionId: result.data?.interactionId,
      });

      return result;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_OUTDIAL_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          destination,
          origin,
          mediaType: OUTDIAL_MEDIA_TYPE,
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.START_OUTDIAL, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Accepts a campaign preview contact, initiating the outbound call.
   *
   * When a campaign manager reserves a contact for an agent, the agent receives an
   * `AgentOfferCampaignReservation` event. The agent can then accept the preview contact
   * to initiate the outbound call.
   *
   * @param {PreviewContactPayload} payload - The preview contact payload containing interactionId and campaignId (campaign name, not UUID).
   * @returns {Promise<TaskResponse>} Promise resolving with agent contact on success.
   * @throws {Error} If the operation fails (network error, customer unavailable, etc.)
   *
   * @example
   * ```typescript
   * webex.cc.on('task:campaignPreviewReservation', async (task) => {
   *   const { interactionId } = task.data;
   *   // campaignId is the campaign name (e.g. "MyCampaign"), not a UUID
   *   const campaignId = task.data.interaction.callProcessingDetails.campaignId;
   *
   *   const result = await webex.cc.acceptPreviewContact({ interactionId, campaignId });
   * });
   * ```
   */
  public async acceptPreviewContact(payload: PreviewContactPayload): Promise<TaskResponse> {
    LoggerProxy.info('Accepting campaign preview contact', {
      module: CC_FILE,
      method: METHODS.ACCEPT_PREVIEW_CONTACT,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_ACCEPT_SUCCESS,
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_ACCEPT_FAILED,
      ]);

      const result = await this.services.dialer.acceptPreviewContact({data: payload});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_ACCEPT_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
          interactionId: payload.interactionId,
          campaignId: payload.campaignId,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log('Campaign preview contact accepted successfully', {
        module: CC_FILE,
        method: METHODS.ACCEPT_PREVIEW_CONTACT,
        trackingId: result.trackingId,
        interactionId: payload.interactionId,
      });

      return result;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_ACCEPT_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          interactionId: payload.interactionId,
          campaignId: payload.campaignId,
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.ACCEPT_PREVIEW_CONTACT,
        CC_FILE
      );
      throw detailedError;
    }
  }

  /**
   * Skips a campaign preview contact, requesting the next contact from the campaign.
   *
   * When a campaign manager reserves a contact for an agent, the agent receives an
   * `AgentOfferCampaignReservation` event. Instead of accepting, the agent can skip the
   * preview contact to move to the next contact in the campaign.
   *
   * @param {PreviewContactPayload} payload - The preview contact payload containing interactionId and campaignId (campaign name, not UUID).
   * @returns {Promise<TaskResponse>} Promise resolving with agent contact on success.
   * @throws {Error} If the operation fails (network error, etc.)
   *
   * @example
   * ```typescript
   * webex.cc.on('task:campaignPreviewReservation', async (task) => {
   *   const { interactionId } = task.data;
   *   const campaignId = task.data.interaction.callProcessingDetails.campaignId;
   *
   *   const result = await webex.cc.skipPreviewContact({ interactionId, campaignId });
   * });
   * ```
   */
  public async skipPreviewContact(payload: PreviewContactPayload): Promise<TaskResponse> {
    const task = this.taskManager.getTask(payload.interactionId);
    if (task?.data?.interaction?.callProcessingDetails?.campaignPreviewSkipDisabled === 'true') {
      LoggerProxy.warn('Skip action is disabled for this campaign preview contact', {
        module: CC_FILE,
        method: METHODS.SKIP_PREVIEW_CONTACT,
        interactionId: payload.interactionId,
      });
      throw new Error('Skip action is disabled for this campaign preview contact');
    }

    LoggerProxy.info('Skipping campaign preview contact', {
      module: CC_FILE,
      method: METHODS.SKIP_PREVIEW_CONTACT,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_SKIP_SUCCESS,
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_SKIP_FAILED,
      ]);

      const result = await this.services.dialer.skipPreviewContact({data: payload});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_SKIP_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
          interactionId: payload.interactionId,
          campaignId: payload.campaignId,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log('Campaign preview contact skipped successfully', {
        module: CC_FILE,
        method: METHODS.SKIP_PREVIEW_CONTACT,
        trackingId: result.trackingId,
        interactionId: payload.interactionId,
      });

      return result;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_SKIP_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          interactionId: payload.interactionId,
          campaignId: payload.campaignId,
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.SKIP_PREVIEW_CONTACT, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Removes a campaign preview contact from the campaign list entirely.
   *
   * When a campaign manager reserves a contact for an agent, the agent receives an
   * `AgentOfferCampaignReservation` event. Instead of accepting or skipping, the agent can
   * remove the preview contact to permanently take it out of the campaign contact list.
   *
   * @param {PreviewContactPayload} payload - The preview contact payload containing interactionId and campaignId (campaign name, not UUID).
   * @returns {Promise<TaskResponse>} Promise resolving with agent contact on success.
   * @throws {Error} If the operation fails (network error, etc.)
   *
   * @example
   * ```typescript
   * webex.cc.on('task:campaignPreviewReservation', async (task) => {
   *   const { interactionId } = task.data;
   *   const campaignId = task.data.interaction.callProcessingDetails.campaignId;
   *
   *   const result = await webex.cc.removePreviewContact({ interactionId, campaignId });
   * });
   * ```
   */
  public async removePreviewContact(payload: PreviewContactPayload): Promise<TaskResponse> {
    const task = this.taskManager.getTask(payload.interactionId);
    if (task?.data?.interaction?.callProcessingDetails?.campaignPreviewRemoveDisabled === 'true') {
      LoggerProxy.warn('Remove action is disabled for this campaign preview contact', {
        module: CC_FILE,
        method: METHODS.REMOVE_PREVIEW_CONTACT,
        interactionId: payload.interactionId,
      });
      throw new Error('Remove action is disabled for this campaign preview contact');
    }

    LoggerProxy.info('Removing campaign preview contact', {
      module: CC_FILE,
      method: METHODS.REMOVE_PREVIEW_CONTACT,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_REMOVE_SUCCESS,
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_REMOVE_FAILED,
      ]);

      const result = await this.services.dialer.removePreviewContact({data: payload});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_REMOVE_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
          interactionId: payload.interactionId,
          campaignId: payload.campaignId,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log('Campaign preview contact removed successfully', {
        module: CC_FILE,
        method: METHODS.REMOVE_PREVIEW_CONTACT,
        trackingId: result.trackingId,
        interactionId: payload.interactionId,
      });

      return result;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.CAMPAIGN_PREVIEW_REMOVE_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          interactionId: payload.interactionId,
          campaignId: payload.campaignId,
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.REMOVE_PREVIEW_CONTACT,
        CC_FILE
      );
      throw detailedError;
    }
  }

  /**
   * Fetches outdial ANI (Automatic Number Identification) entries for an outdial ANI ID.
   *
   * This method retrieves the list of phone numbers that can be used as caller ID when making
   * outbound calls. The ANI data is associated with an outdial ANI ID and can be filtered
   * and paginated as needed.
   *
   * @param {string} outdialANI - The outdial ANI ID to fetch ANI data for
   * @param {number} [page] - Optional page number for pagination (0-based)
   * @param {number} [pageSize] - Optional number of items per page
   * @param {string} [search] - Optional search term to filter results by name or number
   * @param {string} [filter] - Optional filter string
   * @param {string} [attributes] - Optional attributes to include in response
   * @returns {Promise<OutdialAniEntriesResponse>} Promise resolving to outdial ANI response containing:
   *   - data: Array of ANI entries with number and name
   *   - meta: Pagination metadata
   * @throws {Error} If the operation fails or agent is not registered
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   *
   * // Get agent profile to obtain outdial ANI ID
   * const agentProfile = cc.agentConfig;
   * const outdialANI = agentProfile.outdialANIId;
   *
   * // Basic usage - get all ANI data for an outdial ANI ID
   * const aniData = await cc.getOutdialAniEntries({ outdialANI });
   *
   * // With pagination and search
   * const paginatedAni = await cc.getOutdialAniEntries({
   *   outdialANI,
   *   page: 0,
   *   pageSize: 50,
   *   search: '555' // search for numbers containing '555'
   * });
   *
   * // Process the results
   * paginatedAni.forEach(ani => {
   *   console.log(`ANI: ${ani.number} - ${ani.name}`);
   * });
   * ```
   */
  public async getOutdialAniEntries(params: OutdialAniParams): Promise<OutdialAniEntriesResponse> {
    const {outdialANI, page, pageSize, search, filter, attributes} = params;

    LoggerProxy.info('Fetching outdial ANI entries', {
      module: CC_FILE,
      method: METHODS.GET_OUTDIAL_ANI_ENTRIES,
    });

    const orgId = this.$webex.credentials.getOrgId();

    if (!orgId) {
      LoggerProxy.error('Org ID not found.', {
        module: CC_FILE,
        method: METHODS.GET_OUTDIAL_ANI_ENTRIES,
      });

      throw new Error('Org ID not found.');
    }

    try {
      const result = await this.services.config.getOutdialAniEntries(orgId, {
        outdialANI,
        page,
        pageSize,
        search,
        filter,
        attributes,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.OUTDIAL_ANI_EP_FETCH_SUCCESS,
        {
          outdialANI,
          resultCount: result?.length || 0,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log(`Successfully retrieved outdial ANI entries for ANI ID ${outdialANI}`, {
        module: CC_FILE,
        method: METHODS.GET_OUTDIAL_ANI_ENTRIES,
      });

      return result;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.OUTDIAL_ANI_EP_FETCH_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          outdialANI,
          error,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.error(
        `Failed to fetch outdial ANI entries for ANI ID ${outdialANI} due to: ${error}`,
        {
          module: CC_FILE,
          method: METHODS.GET_OUTDIAL_ANI_ENTRIES,
          trackingId: failure.trackingId,
        }
      );

      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.GET_OUTDIAL_ANI_ENTRIES,
        CC_FILE
      );
      throw detailedError;
    }
  }

  /**
   * Uploads logs to help troubleshoot SDK issues.
   *
   * This method collects the current SDK logs including network requests, WebSocket
   * messages, and client-side events, then securely submits them to Webex's diagnostics
   * service. The returned tracking ID, feedbackID can be provided to Webex support for faster
   * issue resolution.
   * @returns Promise<UploadLogsResponse> Resolves with the upload logs response
   * @throws Error If the upload fails
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * try {
   *   await cc.register();
   * } catch (error) {
   *   console.error('Error:', error);
   *   const result = await cc.uploadLogs();
   *   console.log('Logs uploaded. Tracking ID:', result.trackingId);
   * }
   * ```
   */
  public async uploadLogs(): Promise<UploadLogsResponse> {
    return this.webexRequest.uploadLogs();
  }

  /**
   * Updates the agent device type and login configuration.
   * Use this method to change how an agent connects to the contact center system (e.g., switching from browser-based calling to a desk phone extension).
   * Change to any field of the profile is allowed;
   *
   * @param {AgentDeviceUpdate} data Configuration containing:
   *   - loginOption: New device type ('BROWSER', 'EXTENSION', 'AGENT_DN')
   *   - dialNumber: Required phone number when using EXTENSION or AGENT_DN
   *   - teamId: Optional team ID (defaults to current team if not specified)
   * @returns Promise<UpdateDeviceTypeResponse> Resolves with the device type update response
   * @throws Error If the update fails
   * @example
   * ```typescript
   * const cc = webex.cc;
   *
   * // Switch from browser to extension
   * try {
   *   await cc.updateAgentProfile({
   *     loginOption: 'EXTENSION',
   *     dialNumber: '1234',      // Required for EXTENSION
   *     teamId: 'currentTeam'    // Optional: uses current team if not specified
   *   });
   * } catch (error) {
   *   console.error('Failed to update device:', error.message);
   * }
   * ```
   * @public
   */
  public async updateAgentProfile(data: AgentProfileUpdate): Promise<UpdateDeviceTypeResponse> {
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AGENT_DEVICE_TYPE_UPDATE_SUCCESS,
      METRIC_EVENT_NAMES.AGENT_DEVICE_TYPE_UPDATE_FAILED,
    ]);

    const trackingId = `WX_CC_SDK_${uuidv4()}`;

    LoggerProxy.info(`starting profile update`, {
      module: CC_FILE,
      method: METHODS.UPDATE_AGENT_PROFILE,
      trackingId,
    });

    try {
      await this.stationLogout({
        logoutReason: 'User requested agent profile update',
      });

      const loginPayload: AgentLogin = {
        teamId: data.teamId,
        loginOption: data.loginOption,
        dialNumber: data.dialNumber,
      };

      const resp = await this.stationLogin(loginPayload);

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AGENT_DEVICE_TYPE_UPDATE_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          loginType: data.loginOption,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log(
        `profile updated successfully with ${loginPayload.loginOption} teamId: ${loginPayload.teamId}`,
        {
          module: CC_FILE,
          method: METHODS.UPDATE_AGENT_PROFILE,
          trackingId,
        }
      );

      const deviceTypeUpdateResponse: UpdateDeviceTypeResponse = {
        ...resp,
        type: 'AgentDeviceTypeUpdateSuccess',
      };

      return deviceTypeUpdateResponse;
    } catch (error) {
      const failure = (error as GenericError).details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AGENT_DEVICE_TYPE_UPDATE_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
          loginType: data.loginOption,
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.error(`error updating profile: ${error}`, {
        module: CC_FILE,
        method: METHODS.UPDATE_AGENT_PROFILE,
        trackingId,
      });
      throw error;
    }
  }

  /**
   * Returns paginated entry points using the EntryPoint service defaults.
   * Existing request parameters can override those defaults.
   * @public
   */
  public async getEntryPoints(
    params: EntryPointSearchParams = {}
  ): Promise<EntryPointListResponse> {
    return this.entryPoint.getEntryPoints(params);
  }

  /**
   * Returns paginated contact service queues using the Queue service defaults.
   * Existing request parameters can override those defaults.
   * @public
   */
  public async getQueues(
    params: ContactServiceQueueSearchParams = {}
  ): Promise<ContactServiceQueuesResponse> {
    return this.queue.getQueues(params);
  }
}
