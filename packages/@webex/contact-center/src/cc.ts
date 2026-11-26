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
import {
  buildStationLoginPayload,
  compareAgentStateVersions,
  getStationRecoveryFailureCategory,
  hasAgentStateVersion,
} from './services/agent';
import type {AgentStateVersion} from './services/agent';
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
import type {AqmRequestContext, RecoveryFailure} from './services/core/types';
import type {TaskRecoveryGuard} from './services/task/types';
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
import {readSavedStationLogin, UserPreference} from './services/UserPreference';

/**
 * Typed allow-list of server-controlled websocket event names this SDK re-emits verbatim.
 * Guards against emitting an arbitrary/unknown `data.type` supplied by the websocket payload.
 * @ignore
 */
const CC_EVENT_ALLOW_LIST = new Set<string>(Object.values(CC_EVENTS));
const STATION_RELOAD_RETRY_DELAYS_MS = [2000, 4000, 8000];
const AGENT_STATE_FIELDS = ['status', 'subStatus', 'auxCodeId', 'lastStateChangeReason'] as const;

type RecoveryPhase =
  | 'idle'
  | 'waiting'
  | 'restoringSession'
  | 'ready'
  | 'manualLoginRequired'
  | 'unavailable'
  | 'reloadRequired'
  | 'cancelled';

type AcceptedStation = {
  orgId: string;
  agentId: string;
  sessionId?: string;
  revision: number;
  payload: Agent.UserStationLogin;
};

type InitialRegistration = {
  readonly registration: number;
  readonly orgId: string;
  readonly controller: AbortController;
  reloadRequired?: Error;
  rejectConnectionWait?: (error: Error) => void;
};

type RegionRecovery = {
  registration: number;
  station: number;
  orgId: string;
  agentId: string;
  controller: AbortController;
  detach: () => void;
  cleaned: boolean;
  stage: 'reload' | 'fallback' | 'post1035' | 'manual';
  reloads: number;
  retryNotBefore: number;
  intentRevision: number;
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

type RtdEpoch = {
  registration: number;
  station: number;
  orgId: string;
  agentId: string;
  sessionId?: string;
  parent: AbortSignal;
  controller: AbortController;
  detach: () => void;
  active: boolean;
  promise: Promise<void>;
};

type AgentStateChangeDispatchResult =
  | {kind: 'acknowledged'; response: Agent.StateChangeSuccess}
  | {kind: 'not-dispatched'; cause: 'browser-voice-not-ready'; error: Error};

type StateDispatchContext = {
  source: 'explicit' | 'dr-auto' | 'relogin-auto';
  intentRevision: number;
  stationRevision: number;
  generation: number;
  signal: AbortSignal;
};

type AutoAvailable = {
  registration: number;
  generation: number;
  stationRevision: number;
  sessionId: string;
  intentRevision: number;
  signal: AbortSignal;
  disconnect: Agent.ReloginSuccess['data'];
  published: boolean;
  dispatching: boolean;
  requestId?: string;
  startedAt: number;
};

type AutoAvailableDispatch = Pick<
  AutoAvailable,
  'generation' | 'stationRevision' | 'intentRevision'
>;

type ConfirmedAgentState = Pick<
  Agent.StateChangeSuccess['data'],
  'auxCodeId' | 'status' | 'subStatus'
> &
  AgentStateVersion & {lastStateChangeReason?: string};

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
  private terminatedRegistrationGeneration?: number;
  private registrationAbortController?: AbortController;
  private pendingRegistration?: InitialRegistration;
  private registrationOrgId?: string;
  private registrationAgentId?: string;
  private stationRevision = 0;
  private recoveryGeneration = 0;
  private recoveryPhase: RecoveryPhase = 'idle';
  private recovery?: RegionRecovery;

  private commandController?: AbortController;
  private taskLifetimeController?: AbortController;
  private interruptedTaskGeneration?: number;
  private sessionRequest?: {
    phase: 'restore' | 'manual';
    controller: AbortController;
    detach: () => void;
  };

  private readonly acceptedSwitchIds = new Set<string>();
  private acceptedStation?: AcceptedStation;
  private priorStationActive = false;
  private suppressAutomaticRelogin = false;
  private logoutAttempt?: {priorSuppression: boolean};
  private get logoutPending(): boolean {
    return Boolean(this.logoutAttempt);
  }

  private rtdEpoch?: RtdEpoch;
  private rtdTerminatedFor?: {registration: number; sessionId?: string};
  private stateIntentRevision = 0;
  private autoAvailable?: AutoAvailable;
  private readonly autoAvailableDispatches = new Map<string, AutoAvailableDispatch>();
  private confirmedState?: ConfirmedAgentState;

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
    if (!Number.isInteger(attempt) || attempt < 0 || !Number.isFinite(startedAt)) return;
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    if (!Number.isFinite(elapsedMs)) return;
    const registration = this.registrationGeneration;
    const generation = this.recoveryGeneration;
    const station = this.stationRevision;
    const recovery = this.recovery;
    const controller = this.registrationAbortController;
    let org: string;
    try {
      org = this.$webex.credentials.getOrgId();
    } catch {
      return;
    }
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
    const current = () => {
      try {
        return (
          registration === this.registrationGeneration &&
          generation === this.recoveryGeneration &&
          station === this.stationRevision &&
          recovery === this.recovery &&
          controller === this.registrationAbortController &&
          (!controller?.signal.aborted || outcome === 'cancelled') &&
          org === this.$webex.credentials.getOrgId()
        );
      } catch {
        return false;
      }
    };
    if (current()) {
      this.recordBestEffort(() =>
        LoggerProxy.info('Region recovery', {
          module: CC_FILE,
          method: METHODS.RECORD_RECOVERY_DIAGNOSTIC,
          data: {...payload},
        })
      );
    }
    if (!current()) return;
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

  /** Checks immutable registration ownership against the live authenticated organization. */
  private isCurrentRegistration(
    registration: number,
    orgId: string,
    signal: AbortSignal,
    agentId?: string
  ): boolean {
    if (
      !signal ||
      signal.aborted ||
      signal !== this.registrationAbortController?.signal ||
      registration !== this.registrationGeneration
    )
      return false;
    if (this.$webex.credentials.getOrgId() !== orgId) {
      this.terminateRegistration(true);

      return false;
    }

    return (
      this.registrationOrgId === orgId &&
      (agentId === undefined ||
        (this.registrationAgentId === agentId && this.agentConfig?.agentId === agentId))
    );
  }

  /** Preserves a pending registration's terminal outcome across aborts and replacement. */
  private assertInitialRegistration(attempt: InitialRegistration, agentId?: string): void {
    if (attempt.reloadRequired) throw attempt.reloadRequired;
    if (
      !this.isCurrentRegistration(
        attempt.registration,
        attempt.orgId,
        attempt.controller.signal,
        agentId
      )
    )
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
  }

  /** Fences station completion against registration and station changes. */
  private isCurrentStation(
    registration: number,
    station: number,
    orgId: string,
    profile: Profile
  ): boolean {
    if (registration !== this.registrationGeneration) return false;
    const sameOrg = this.$webex.credentials.getOrgId() === orgId;
    if (this.registrationOrgId && !sameOrg) {
      this.terminateRegistration(true);

      return false;
    }

    return (
      station === this.stationRevision &&
      profile === this.agentConfig &&
      sameOrg &&
      !this.registrationAbortController?.signal.aborted
    );
  }

  /** Admission is checked before preparation and again by the AQM owner at dispatch. */
  private assertRecoveryAdmission(kind: 'command' | 'session'): void {
    if (this.registrationOrgId && this.$webex.credentials.getOrgId() !== this.registrationOrgId)
      this.terminateRegistration(true);
    if (this.recoveryPhase === 'reloadRequired')
      throw createRegionRecoveryError('REGION_RELOAD_REQUIRED');
    if (this.recoveryPhase === 'unavailable' || this.recoveryPhase === 'cancelled')
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    if (
      !['idle', 'ready'].includes(this.recoveryPhase) &&
      !(kind === 'session' && this.recoveryPhase === 'manualLoginRequired')
    )
      throw createRegionRecoveryError('RECOVERY_IN_PROGRESS');
  }

  /** Rotate request ownership; only regional or terminal fences end the Task lifetime. */
  private fenceRecoveryWork(phase: RecoveryPhase): void {
    this.recoveryPhase = phase;
    this.recoveryGeneration += 1;
    this.abortSessionRequest();
    this.commandController?.abort();
    this.commandController = new AbortController();
    this.services.aqmReqs.beginGeneration(this.recoveryGeneration);
    this.setRecoveryPhase(phase);
    this.services.aqmReqs.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    if (['waiting', 'unavailable', 'reloadRequired'].includes(phase)) {
      this.interruptedTaskGeneration = this.recoveryGeneration;
      this.taskLifetimeController?.abort();
      this.taskManager.interruptTaskOperations(() =>
        createRegionRecoveryError('RECOVERY_INTERRUPTED')
      );
    }
  }

  private setRecoveryPhase(phase: RecoveryPhase): void {
    this.recoveryPhase = phase;
    if (phase === 'idle' || phase === 'ready') {
      this.services.aqmReqs.setRecoveryGate({state: 'open'});
    } else if (phase === 'unavailable' || phase === 'reloadRequired' || phase === 'cancelled') {
      this.services.aqmReqs.setRecoveryGate({
        state: 'unavailable',
        reason: phase === 'reloadRequired' ? 'REGION_RELOAD_REQUIRED' : 'RECOVERY_INTERRUPTED',
      });
    } else {
      const manual = phase === 'manualLoginRequired';
      const request = this.sessionRequest;
      const admitsSession = manual
        ? request?.phase === 'manual'
        : phase === 'restoringSession' && request?.phase === 'restore';
      this.services.aqmReqs.setRecoveryGate({
        state: manual ? 'manualLoginRequired' : 'recovering',
        ...(admitsSession ? {sessionSignal: request.controller.signal} : {}),
      });
    }
  }

  private getTaskRecoveryGuard(): TaskRecoveryGuard {
    if (!this.taskLifetimeController || this.taskLifetimeController.signal.aborted)
      this.taskLifetimeController = new AbortController();
    const controller = this.taskLifetimeController;
    const generation = this.recoveryGeneration;

    return {
      generation,
      signal: controller.signal,
      assertCommandAllowed: () => {
        this.assertRecoveryAdmission('command');
        if (controller.signal.aborted || controller !== this.taskLifetimeController)
          throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      },
    };
  }

  /** Retire interrupted objects before a replacement owner can admit Task deliveries. */
  private startTaskSession(isCurrent: () => boolean, invalidateTasks = false): boolean {
    const ownsSession = () =>
      isCurrent() &&
      !this.registrationAbortController?.signal.aborted &&
      !['unavailable', 'reloadRequired'].includes(this.recoveryPhase);
    if (!ownsSession()) return false;
    const interrupted = this.interruptedTaskGeneration;
    if (invalidateTasks || interrupted !== undefined) {
      this.taskManager.invalidateRegionalTasks();
      if (!ownsSession()) return false;
      this.taskManager.clearAISummaryState();
      if (!ownsSession()) return false;
      if (this.interruptedTaskGeneration === interrupted)
        this.interruptedTaskGeneration = undefined;
    }
    if (this.commandController) this.taskManager.startSession(this.getTaskRecoveryGuard());

    return ownsSession();
  }

  private beginSessionRequest(phase: 'restore' | 'manual', parent: AbortSignal): AqmRequestContext {
    this.abortSessionRequest();
    const controller = new AbortController();
    const abort = () => controller.abort();
    parent.addEventListener('abort', abort, {once: true});
    if (parent.aborted) abort();
    const context = {generation: this.recoveryGeneration, signal: controller.signal};
    this.sessionRequest = {
      phase,
      controller,
      detach: () => parent.removeEventListener('abort', abort),
    };
    this.setRecoveryPhase(phase === 'restore' ? 'restoringSession' : 'manualLoginRequired');

    return context;
  }

  private abortSessionRequest(): void {
    const request = this.sessionRequest;
    this.sessionRequest = undefined;
    request?.detach();
    request?.controller.abort();
  }

  private endSessionRequest(context: AqmRequestContext): void {
    const request = this.sessionRequest;
    if (!request || request.controller.signal !== context.signal) return;
    request.detach();
    this.sessionRequest = undefined;
  }

  private cancelRegionRecovery(): boolean {
    const recovery = this.recovery;
    const slot = recovery?.attempt;
    const registration = this.registrationGeneration;
    const generation = this.recoveryGeneration;
    const station = this.stationRevision;
    // Consume before aborting: obsolete continuations cannot consume a replacement's timing.
    if (recovery) recovery.attempt = undefined;
    this.recovery = undefined;
    recovery?.detach();
    recovery?.controller.abort();
    if (slot) this.recordRecoveryDiagnostic('admission', 'cancelled', slot.attempt, slot.startedAt);

    return (
      registration === this.registrationGeneration &&
      generation === this.recoveryGeneration &&
      station === this.stationRevision &&
      this.recovery === undefined
    );
  }

  private clearAcceptedStation(): void {
    this.autoAvailableDispatches.clear();
    this.confirmedState = undefined;
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
    this.terminatedRegistrationGeneration = this.registrationGeneration;
    this.stationRevision += 1;
    this.logoutAttempt = undefined;
    // Invalidate the ended owner before aborts, diagnostics or host publication can reenter.
    this.acceptedSwitchIds.clear();
    this.clearAcceptedStation();
    this.multiRegionSettings = null;
    this.registrationAgentId = undefined;
    this.wellbeingBreakIdleCode = undefined;
    this.registrationAbortController?.abort();
    if (!this.cancelRegionRecovery()) return undefined;
    this.fenceRecoveryWork('unavailable');
    const termination = this.registrationGeneration;
    const terminationStation = this.stationRevision;
    const terminationGeneration = this.recoveryGeneration;
    const ownsTermination = () =>
      termination === this.registrationGeneration &&
      terminationStation === this.stationRevision &&
      terminationGeneration === this.recoveryGeneration;
    this.services.connectionService.stop();
    const hadRtdEpoch = Boolean(this.rtdEpoch);
    this.pauseRtd();
    if (!hadRtdEpoch) this.services.rtdWebSocketManager.close(false, 'registrationEnded');
    this.services.webSocketManager.close(false, 'registrationEnded');
    this.interruptedTaskGeneration = undefined;
    this.taskManager.stopSession();
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
      recovery.station === this.stationRevision &&
      this.isCurrentRegistration(
        recovery.registration,
        recovery.orgId,
        this.registrationAbortController?.signal,
        recovery.agentId
      )
    );
  }

  private resetOrdinaryConnection(): void {
    const registration = this.registrationGeneration;
    const orgId = this.registrationOrgId;
    const agentId = this.registrationAgentId;
    const signal = this.registrationAbortController.signal;
    this.services.connectionService.reset({
      subscribeRequest: this.getConnectionConfig(),
      signal,
      onTerminalFailure: (error) => {
        if (!this.isCurrentRegistration(registration, orgId, signal, agentId)) return;
        const pending = this.pendingRegistration;
        if (pending?.registration === registration && pending.controller.signal === signal)
          pending.rejectConnectionWait?.(error);
        this.handleRecoveryTerminal(error);
      },
    });
  }

  /** Registration owns its relogin even when ordinary recovery supplies the primary. */
  private async awaitRegistrationConnection(attempt: InitialRegistration): Promise<void> {
    this.assertRecoveryAdmission('session');
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
    if (!this.cancelRegionRecovery()) return;
    this.fenceRecoveryWork(status);
    const closeReason = status === 'reloadRequired' ? 'regionMismatch' : 'recoveryFailed';
    this.services.connectionService.stop();
    this.services.webSocketManager.close(false, closeReason);
    this.pauseRtd(closeReason);
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
    const pending = this.pendingRegistration;
    if (
      !signal ||
      signal.aborted ||
      (!this.registrationAgentId &&
        (pending?.registration !== this.registrationGeneration ||
          pending.controller.signal !== signal))
    )
      return;
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
    if (
      !this.isCurrentRegistration(
        this.registrationGeneration,
        orgId,
        signal,
        this.registrationAgentId
      )
    )
      return;
    if (
      !this.registrationAgentId ||
      !this.multiRegionSettings ||
      this.acceptedSwitchIds.has(event.trackingId)
    ) {
      recordIgnoredSwitch();

      return;
    }
    this.acceptedSwitchIds.add(event.trackingId);
    if (this.acceptedSwitchIds.size > 128)
      this.acceptedSwitchIds.delete(this.acceptedSwitchIds.values().next().value);
    const cancelled = this.cancelAutoAvailable();
    this.services.webSocketManager.clearServingRegion();
    if (!this.cancelRegionRecovery()) return;
    this.fenceRecoveryWork('waiting');
    this.services.connectionService.pause();
    this.pauseRtd();
    const registration = this.registrationGeneration;
    const generation = this.recoveryGeneration;
    const station = this.stationRevision;
    if (cancelled) {
      this.publishRegionState(cancelled);
      if (
        registration !== this.registrationGeneration ||
        generation !== this.recoveryGeneration ||
        station !== this.stationRevision ||
        signal.aborted ||
        this.$webex.credentials.getOrgId() !== event.orgId
      )
        return;
    }
    this.resetRegionState();
    this.regionStateContext = {trackingId: event.trackingId, ...event.data};
    if (this.multiRegionSettings?.multiRegionEnabled === false) {
      this.setRecoveryPhase('unavailable');
      this.services.connectionService.stop();
      this.services.webSocketManager.close(false, 'notEligible');
      this.services.rtdWebSocketManager.close(false, 'notEligible');
      this.publishRegionState(this.buildRegionState('unavailable', 'not-eligible'));

      return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, {once: true});
    const recovery: RegionRecovery = {
      registration: this.registrationGeneration,
      station: this.stationRevision,
      orgId: event.orgId,
      agentId: this.registrationAgentId,
      controller,
      detach: () => signal.removeEventListener('abort', abort),
      cleaned: false,
      stage: 'reload',
      reloads: 0,
      retryNotBefore: 0,
      intentRevision: this.stateIntentRevision,
    };
    this.recovery = recovery;
    this.publishRegionState(this.buildRegionState('recovering', 'region-switch'));
    if (!this.isCurrentRecovery(recovery)) return;
    this.services.webSocketManager.close(false, 'regionRecovery');
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
          this.setRecoveryPhase('waiting');
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
      | {source: 'notification'; response: Agent.StationLoginSuccess | Agent.ReloginSuccess}
  ): void {
    const {response} = input;
    this.assertPrimaryIdentity(response.data.agentId);
    const data = response.data;
    const nonblank = (value: unknown): value is string =>
      typeof value === 'string' && Boolean(value.trim());
    const sessionId = nonblank(data.agentSessionId) ? data.agentSessionId : undefined;
    const epoch = this.rtdEpoch;
    if (epoch) {
      // A registration-only subscription can acquire its first accepted station. An
      // established subscription belongs to exactly one accepted session.
      if (
        this.isCurrentRtdEpoch(epoch) &&
        (epoch.sessionId === sessionId ||
          (!this.priorStationActive && epoch.sessionId === undefined))
      )
        epoch.sessionId = sessionId;
      else if (this.rtdEpoch === epoch) this.pauseRtd();
    }
    const old = this.acceptedStation;
    const compatible =
      old?.orgId === this.registrationOrgId &&
      old?.agentId === data.agentId &&
      (old?.sessionId === sessionId || old?.revision === this.stationRevision)
        ? old.payload
        : undefined;
    this.agentConfig.lastStateAuxCodeId = data.auxCodeId;
    this.agentConfig.lastStateChangeTimestamp = data.lastStateChangeTimestamp;
    this.agentConfig.lastIdleCodeChangeTimestamp = data.lastIdleCodeChangeTimestamp ?? undefined;
    this.priorStationActive = true;
    this.agentConfig.isAgentLoggedIn = true;
    this.updateWellnessSession(sessionId);
    if (hasAgentStateVersion(data)) this.confirmedState = {...data};
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
        else mode = compatible?.deviceType;
      }
      const dialNumber =
        number || (compatible?.deviceType === mode ? compatible?.dialNumber : undefined);
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
    this.acceptedStation = {
      orgId: this.registrationOrgId,
      agentId: data.agentId,
      sessionId,
      revision: this.stationRevision,
      payload,
    };
    this.agentConfig.deviceType = payload.deviceType as LoginOption;
    this.agentConfig.dn = payload.dialNumber;
    this.agentConfig.defaultDn = payload.dialNumber;
  }

  private reconcileStationSnapshot(): Agent.UserStationLogin | undefined {
    const accepted = this.acceptedStation;
    if (
      !accepted ||
      accepted.orgId !== this.registrationOrgId ||
      accepted.agentId !== this.registrationAgentId ||
      !accepted.payload.teamId?.trim() ||
      !Object.values(LoginOption).includes(accepted.payload.deviceType as LoginOption) ||
      (accepted.payload.deviceType !== LoginOption.BROWSER && !accepted.payload.dialNumber?.trim())
    )
      return undefined;

    return {...accepted.payload};
  }

  private async applyRestoredStationEffects(signal: AbortSignal): Promise<void> {
    const payload = this.acceptedStation?.payload;
    if (payload)
      await this.handleDeviceType(payload.deviceType as LoginOption, payload.dialNumber, signal);
    if (signal.aborted) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    await awaitRecoveryWork(this.ensureWxAppPostStationLogin(signal), signal);
  }

  private async restoreRegionSession(
    recovery: RegionRecovery,
    signal: AbortSignal
  ): Promise<void | (() => void)> {
    const manual =
      (reason: RegionRecoveryState['reason'], resumeRtd = false) =>
      () => {
        if (!this.isCurrentRecovery(recovery) || signal.aborted) return;
        this.setRecoveryPhase('manualLoginRequired');
        this.publishRegionState(this.buildRegionState('stationLoginRequired', reason));
        if (resumeRtd && this.isCurrentRecovery(recovery) && !signal.aborted)
          this.resumeRtd(this.registrationAbortController.signal);
      };
    const hadStation = this.priorStationActive;
    const allowSavedStation = this.$config.allowSavedStationLoginOnRecovery === true;
    const canRelogin = this.$config.allowAutomatedRelogin && !this.suppressAutomaticRelogin;
    if (!hadStation && (!canRelogin || !allowSavedStation)) return manual('region-switch', true);
    if (!canRelogin) return manual('automatic-relogin-disabled');

    let payload = this.reconcileStationSnapshot();
    if (!hadStation && recovery.stage === 'reload') recovery.stage = 'fallback';
    if (!recovery.cleaned || this.taskLifetimeController?.signal.aborted) {
      recovery.cleaned = true;
      if (!this.startTaskSession(() => this.isCurrentRecovery(recovery) && !signal.aborted))
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    }
    const taskLifetime = this.taskLifetimeController;
    const discardProvisionalTasks = () => {
      if (
        !taskLifetime ||
        taskLifetime !== this.taskLifetimeController ||
        taskLifetime.signal.aborted
      )
        return;
      taskLifetime.abort();
      if (
        taskLifetime === this.taskLifetimeController &&
        Object.keys(this.taskManager.getAllTasks() ?? {}).length > 0
      )
        this.taskManager.invalidateRegionalTasks();
    };
    signal.addEventListener('abort', discardProvisionalTasks, {once: true});
    const publishForAdoptedSocket = (publish: () => void) => () => {
      signal.removeEventListener('abort', discardProvisionalTasks);
      publish();
    };
    const context = this.beginSessionRequest('restore', signal);
    try {
      while (this.isCurrentRecovery(recovery) && !context.signal.aborted) {
        // eslint-disable-next-line no-await-in-loop -- Generation-owned retries are serial.
        await waitForRecoveryDelay(recovery.retryNotBefore - Date.now(), context.signal);
        if (context.signal.aborted || !this.isCurrentRecovery(recovery))
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
            if (!payload && allowSavedStation) {
              // eslint-disable-next-line no-await-in-loop -- The fallback owns one bounded read.
              const saved = await readSavedStationLogin(
                this.webexRequest,
                recovery.orgId,
                this.agentConfig,
                context.signal
              );
              if (!this.isCurrentRecovery(recovery) || context.signal.aborted)
                throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
              if (saved) payload = buildStationLoginPayload(saved, this.agentConfig.agentId);
            }
            if (!payload) break;
            // eslint-disable-next-line no-await-in-loop -- At most one fallback dispatch.
            response = await this.services.agent.stationLogin({data: payload}, undefined, context);
          } else {
            // eslint-disable-next-line no-await-in-loop -- Bounded reload budget survives sockets.
            response = await this.services.agent.reload(undefined, context);
          }
          if (!this.isCurrentRecovery(recovery) || context.signal.aborted)
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
          if (!this.isCurrentRecovery(recovery) || context.signal.aborted)
            throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
          // eslint-disable-next-line no-await-in-loop -- Apply only this accepted session.
          await this.applyRestoredStationEffects(context.signal);
          if (!this.isCurrentRecovery(recovery) || context.signal.aborted)
            throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

          return publishForAdoptedSocket(() => {
            if (!this.isCurrentRecovery(recovery) || context.signal.aborted) return;
            this.setRecoveryPhase('ready');
            if (stage !== 'fallback')
              this.armAutoAvailable(response as Agent.ReloginSuccess, signal);
            this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
            if (this.isCurrentRecovery(recovery) && !signal.aborted)
              this.resumeRtd(this.registrationAbortController.signal);
            if (this.isCurrentRecovery(recovery) && this.autoAvailable) {
              this.autoAvailable.published = true;
              this.dispatchAutoAvailable(this.autoAvailable).catch(() => undefined);
            }
          });
        } catch (error) {
          const retryDelay = STATION_RELOAD_RETRY_DELAYS_MS[recovery.reloads - 1];
          const current = this.isCurrentRecovery(recovery);
          if (!current || context.signal.aborted) {
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

      return publishForAdoptedSocket(
        manual(hadStation ? 'session-restore-failed' : 'region-switch', !hadStation)
      );
    } finally {
      this.endSessionRequest(context);
    }
  }

  /** Foreign accepted station notifications are separate from locally correlated completions. */
  private reconcileStationNotification(event: Record<string, any>): void {
    const data = event.data;
    const signal = this.registrationAbortController?.signal;
    if (
      !signal ||
      !this.registrationAgentId ||
      !isRecord(data) ||
      !this.isCurrentRegistration(
        this.registrationGeneration,
        this.registrationOrgId,
        signal,
        this.registrationAgentId
      ) ||
      data.orgId !== this.registrationOrgId ||
      data.agentId !== this.registrationAgentId ||
      typeof data.agentSessionId !== 'string' ||
      !data.agentSessionId.trim() ||
      !this.currentAgentSessionId
    )
      return;
    const isLogout = data.type === CC_EVENTS.AGENT_LOGOUT_SUCCESS;
    if (isLogout) {
      if (data.agentSessionId !== this.currentAgentSessionId || this.logoutPending) return;
    } else if (
      ![CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, CC_EVENTS.AGENT_RELOGIN_SUCCESS].includes(
        data.type as any
      ) ||
      !['idle', 'ready'].includes(this.recoveryPhase) ||
      this.sessionRequest ||
      this.suppressAutomaticRelogin ||
      typeof data.trackingId !== 'string' ||
      !data.trackingId.trim() ||
      this.services.aqmReqs.isLocalSessionTrackingId(data.trackingId)
    ) {
      return;
    }
    if (isLogout || data.agentSessionId !== this.currentAgentSessionId) {
      const terminal = ['unavailable', 'reloadRequired'].includes(this.recoveryPhase);
      const wasRegional = this.hasRegionalConnectionOwner();
      const cancelled = this.cancelAutoAvailable();
      this.stationRevision += 1;
      const station = this.stationRevision;
      const registration = this.registrationGeneration;
      if (!this.cancelRegionRecovery()) return;
      this.fenceRecoveryWork(terminal ? this.recoveryPhase : 'cancelled');
      this.pauseRtd();
      this.clearAcceptedStation();
      this.updateWellnessSession();
      this.suppressAutomaticRelogin = true;
      if (wasRegional) this.resetOrdinaryConnection();
      const generation = this.recoveryGeneration;
      const ownsStation = () =>
        station === this.stationRevision &&
        generation === this.recoveryGeneration &&
        this.isCurrentRegistration(
          registration,
          this.registrationOrgId,
          signal,
          this.registrationAgentId
        );
      if (cancelled) this.publishRegionState(cancelled);
      if (!ownsStation()) return;
      this.resetRegionState();
      if (!terminal) {
        this.setRecoveryPhase('idle');
        if (this.interruptedTaskGeneration !== undefined) this.startTaskSession(ownsStation);
      }

      return;
    }
    const previous = {...this.acceptedStation?.payload};
    this.rememberAcceptedStation({
      source: 'notification',
      response: event as Agent.StationLoginSuccess | Agent.ReloginSuccess,
    });
    const payloadChanged = !isEqual(previous, {...this.acceptedStation?.payload});
    const cancelled =
      payloadChanged || this.invalidatesAutoAvailableDisconnect(data, this.autoAvailable)
        ? this.cancelAutoAvailable()
        : undefined;
    if (payloadChanged) {
      this.stationRevision += 1;
      if (this.acceptedStation) this.acceptedStation.revision = this.stationRevision;
      if (this.rtdEpoch?.sessionId === this.currentAgentSessionId)
        this.rtdEpoch.station = this.stationRevision;
    }
    const generation = this.recoveryGeneration;
    if (cancelled) this.publishRegionState(cancelled);
    if (generation !== this.recoveryGeneration) return;
    if (this.acceptedStation) {
      const mode = this.acceptedStation.payload.deviceType as LoginOption;
      this.webCallingService.setLoginOption(mode);
      this.webCallingService.setBrowserVoiceRequired(this.isBrowserVoiceRequired(mode));
    }
  }

  private updateWellnessSession(agentSessionId?: string): void {
    // RTD ownership loss survives transient station revisions and unknown identities.
    if (
      agentSessionId &&
      this.rtdTerminatedFor?.registration === this.registrationGeneration &&
      agentSessionId !== this.rtdTerminatedFor.sessionId
    )
      this.rtdTerminatedFor = undefined;
    if (agentSessionId !== this.currentAgentSessionId) {
      this.autoAvailableDispatches.clear();
      this.confirmedState = undefined;
    }
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
      this.apiAIAssistant = new ApiAIAssistant(
        this.$webex,
        () => ({
          isWellnessBreakEnabled: this.agentConfig?.isWellnessBreakEnabled === true,
          agentId: this.agentConfig?.agentId,
          agentSessionId: this.currentAgentSessionId,
        }),
        () => this.getHttpRecoveryGuard()
      );
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

  /** Borrow shared lifecycle ownership independently of the optional RTD connection. */
  private getHttpRecoveryGuard(): Pick<TaskRecoveryGuard, 'generation' | 'signal'> | undefined {
    const signal = this.registrationAbortController?.signal;
    if (
      !signal ||
      signal.aborted ||
      !this.commandController ||
      this.commandController.signal.aborted ||
      this.suppressAutomaticRelogin ||
      !this.registrationAgentId ||
      this.registrationOrgId !== this.$webex.credentials.getOrgId() ||
      !(
        ['idle', 'ready'].includes(this.recoveryPhase) ||
        (this.recoveryPhase === 'manualLoginRequired' && !this.priorStationActive)
      )
    )
      return undefined;

    return {generation: this.recoveryGeneration, signal: this.commandController.signal};
  }

  private isCurrentRtdEpoch(epoch: RtdEpoch): boolean {
    return (
      this.rtdEpoch === epoch &&
      !epoch.controller.signal.aborted &&
      epoch.station === this.stationRevision &&
      epoch.sessionId === this.currentAgentSessionId &&
      this.isCurrentRegistration(epoch.registration, epoch.orgId, epoch.parent, epoch.agentId)
    );
  }

  /** An explicit terminal reason also closes the manager after an epoch was already released. */
  private pauseRtd(terminalReason?: 'recoveryFailed' | 'regionMismatch'): void {
    const epoch = this.rtdEpoch;
    this.rtdEpoch = undefined;
    epoch?.detach();
    epoch?.controller.abort();
    const release = [
      () => this.services.rtdWebSocketManager.off('message', this.handleRTDWebsocketMessage),
      () =>
        this.apiAIAssistant.clearAllRtdRequests(() =>
          createRegionRecoveryError('RECOVERY_INTERRUPTED')
        ),
      () => {
        if (epoch || this.registrationAbortController) this.taskManager.clearAISummaryState();
      },
      () => {
        if (epoch || terminalReason)
          this.services.rtdWebSocketManager.close(false, terminalReason ?? 'regionRecovery');
      },
    ];
    release.forEach((dispose) => this.recordBestEffort(dispose));
  }

  private resumeRtd(signal: AbortSignal): Promise<void> {
    if (
      signal !== this.registrationAbortController?.signal ||
      !this.shouldSubscribeRtd() ||
      !this.getHttpRecoveryGuard() ||
      (this.rtdTerminatedFor?.registration === this.registrationGeneration &&
        (!this.currentAgentSessionId ||
          this.rtdTerminatedFor.sessionId === this.currentAgentSessionId))
    )
      return Promise.resolve();
    const current = this.rtdEpoch;
    if (current && this.isCurrentRtdEpoch(current)) return current.promise;
    if (current) this.pauseRtd();
    const startedAt = Date.now();
    const controller = new AbortController();
    const abort = () => {
      if (this.rtdEpoch === epoch) this.pauseRtd();
      else controller.abort();
    };
    const epoch: RtdEpoch = {
      registration: this.registrationGeneration,
      station: this.stationRevision,
      orgId: this.registrationOrgId,
      agentId: this.registrationAgentId,
      sessionId: this.currentAgentSessionId,
      parent: signal,
      controller,
      detach: () => signal.removeEventListener('abort', abort),
      active: false,
      promise: Promise.resolve(),
    };
    this.rtdEpoch = epoch;
    signal.addEventListener('abort', abort, {once: true});
    this.services.rtdWebSocketManager.on('message', this.handleRTDWebsocketMessage);
    epoch.promise = Promise.resolve()
      .then(() => {
        if (!this.isCurrentRtdEpoch(epoch)) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

        return this.services.rtdWebSocketManager.initWebSocket({
          body: this.getConnectionConfig(),
          resource: RTD_SUBSCRIBE_API,
          signal: controller.signal,
        });
      })
      .then(() => {
        if (!this.isCurrentRtdEpoch(epoch)) {
          if (this.rtdEpoch === epoch) this.pauseRtd();

          return;
        }
        epoch.active = true;
        this.recordRecoveryDiagnostic('rtd', 'succeeded', 1, startedAt);
      })
      .catch((error) => {
        if (!this.isCurrentRtdEpoch(epoch)) {
          if (this.rtdEpoch === epoch) this.pauseRtd();

          return;
        }
        const failure = normalizeRecoveryFailure(error);
        // WebSocketManager owns these exact deadline errors; never forward error text.
        const deadline =
          error instanceof Error &&
          ['Subscribe deadline exceeded', 'Welcome deadline exceeded'].includes(error.message);
        this.recordRecoveryDiagnostic('rtd', 'failed', 1, startedAt, {
          ...failure,
          ...(failure.status === 401 || failure.status === 403
            ? {reason: 'authentication-failed'}
            : {}),
          ...(deadline ? {id: 'RTD_DEADLINE'} : {}),
          ...(!deadline && failure.status === undefined && !failure.id ? {id: 'RTD_NETWORK'} : {}),
        });
        if (this.isCurrentRtdEpoch(epoch)) this.pauseRtd();
      });

    return epoch.promise;
  }

  private handleRTDWebsocketMessage = (event: string) => {
    const epoch = this.rtdEpoch;
    if (!epoch?.active || !this.isCurrentRtdEpoch(epoch)) return;
    let payload: unknown;
    try {
      payload = JSON.parse(event);
    } catch {
      // TaskManager retains its existing malformed RTD message handling.
    }

    if (isRecord(payload) && payload.type === CC_EVENTS.AGENT_MULTI_LOGIN) {
      this.rtdTerminatedFor = {
        registration: this.registrationGeneration,
        sessionId: this.currentAgentSessionId,
      };
      this.pauseRtd();

      return;
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
    if (!this.cancelRegionRecovery()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    this.fenceRecoveryWork('cancelled');
    this.pauseRtd();
    this.services.connectionService.stop();
    if (this.registrationAbortController) {
      this.services.webSocketManager.close(false, 'register');
      this.services.rtdWebSocketManager.close(false, 'register');
      this.taskLifetimeController?.abort();
      this.interruptedTaskGeneration = undefined;
      this.taskManager.stopSession();
    }
    this.acceptedSwitchIds.clear();
    this.clearAcceptedStation();
    this.registrationAbortController?.abort();
    this.registrationGeneration += 1;
    this.registrationAgentId = undefined;
    this.multiRegionSettings = null;
    this.wellbeingBreakIdleCode = undefined;
    const entry = this.registrationGeneration;
    const entryRecovery = this.recoveryGeneration;
    const entryStation = this.stationRevision;
    if (cancelled) {
      this.publishRegionState(cancelled, publicationSettings);
      if (
        entry !== this.registrationGeneration ||
        entryRecovery !== this.recoveryGeneration ||
        entryStation !== this.stationRevision
      )
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    }
    this.stationRevision += 1;
    const registration = this.registrationGeneration;
    const controller = new AbortController();
    this.registrationAbortController = controller;
    const orgId = this.$webex.credentials.getOrgId();
    const attempt: InitialRegistration = {registration, orgId, controller};
    this.pendingRegistration = attempt;
    this.registrationOrgId = orgId;
    this.suppressAutomaticRelogin = false;
    this.logoutAttempt = undefined;
    this.setRecoveryPhase('idle');
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
      this.assertInitialRegistration(attempt, resp.agentId);
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
      this.assertInitialRegistration(attempt, resp.agentId);

      return resp.isAgentLoggedIn && this.currentAgentSessionId
        ? {...resp, agentSessionId: this.currentAgentSessionId}
        : resp;
    } catch (error) {
      const ownsRegistration = () =>
        registration === this.registrationGeneration &&
        this.registrationAbortController === controller;
      if (ownsRegistration()) {
        const recovery = this.recovery;
        const ownsRecovery = recovery?.registration === registration;
        const recoveryCancelled = ownsRecovery ? this.cancelAutoAvailable() : undefined;
        controller.abort();
        // Registration failure owns termination even when the restore was interrupted by DR.
        if (
          ownsRegistration() &&
          ownsRecovery &&
          this.recovery === recovery &&
          this.cancelRegionRecovery() &&
          ownsRegistration()
        ) {
          this.fenceRecoveryWork('unavailable');
          const generation = this.recoveryGeneration;
          this.services.connectionService.stop();
          this.services.webSocketManager.close(false, 'recoveryFailed');
          this.pauseRtd('recoveryFailed');
          if (recoveryCancelled) this.publishRegionState(recoveryCancelled);
          if (ownsRegistration() && generation === this.recoveryGeneration) {
            delete this.regionStateContext.autoAvailable;
            this.publishRegionState(this.buildRegionState('unavailable', 'recovery-failed'));
          }
        }
        if (ownsRegistration()) this.multiRegionSettings = null;
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
    const orgAtEntry = this.$webex.credentials.getOrgId();
    const termination = this.terminateRegistration();
    const assertOwned = () => {
      if (
        termination === undefined ||
        termination !== this.registrationGeneration ||
        this.$webex.credentials.getOrgId() !== orgAtEntry
      )
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    };
    assertOwned();
    this.registrationAgentId = undefined;
    this.registrationOrgId = undefined;
    this.multiRegionSettings = null;
    this.resetRegionState();
    this.wellbeingBreakIdleCode = undefined;
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
      assertOwned();

      if (
        this.agentConfig.webRtcEnabled &&
        this.agentConfig.loginVoiceOptions.includes(LoginOption.BROWSER)
      ) {
        if (this.$webex.internal.mercury.connected) {
          this.$webex.internal.mercury.off('online');
          this.$webex.internal.mercury.off('offline');
          await this.$webex.internal.mercury.disconnect();
          assertOwned();
          // @ts-ignore
          await this.$webex.internal.device.unregister();
          assertOwned();
          this.recordBestEffort(() =>
            LoggerProxy.log(MERCURY_DISCONNECTED_SUCCESS, {
              module: CC_FILE,
              method: METHODS.DEREGISTER,
            })
          );
        }
      }

      // Clear any cached agent configuration
      this.wellbeingBreakIdleCode = undefined;
      this.agentConfig = null;
      this.updateWellnessSession();

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
    const {registration, orgId, controller} = attempt;
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
        if (
          getSubscriptionMismatchReason(error) &&
          this.isCurrentRegistration(registration, orgId, signal)
        ) {
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
      this.assertInitialRegistration(attempt, agentId);
      this.multiRegionSettings = multiRegionSettings ?? null;
      this.taskManager.startSession(this.getTaskRecoveryGuard());

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

      this.assertInitialRegistration(attempt, agentId);
      if (this.$config && this.$config.allowAutomatedRelogin) {
        await this.awaitRegistrationConnection(attempt);
        this.assertInitialRegistration(attempt, agentId);
        await this.silentRelogin(true);
      } else {
        this.recordBestEffort(() =>
          LoggerProxy.log('Skipping silent relogin: allowAutomatedRelogin is disabled', {
            module: CC_FILE,
            method: METHODS.CONNECT_WEBSOCKET,
          })
        );
      }

      this.assertInitialRegistration(attempt, agentId);
      this.resumeRtd(signal);

      return this.agentConfig;
    } catch (error) {
      if (attempt.reloadRequired) throw attempt.reloadRequired;
      if (this.isCurrentRegistration(registration, orgId, signal)) this.updateWellnessSession();
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
    this.assertRecoveryAdmission('session');
    const manual = this.recoveryPhase === 'manualLoginRequired';
    if (!manual && this.regionStateContext.trackingId) {
      const cancelled = this.cancelAutoAvailable();
      if (!this.cancelRegionRecovery()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.fenceRecoveryWork('cancelled');
      const generation = this.recoveryGeneration;
      if (cancelled) this.publishRegionState(cancelled);
      if (generation !== this.recoveryGeneration)
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.resetRegionState();
      this.setRecoveryPhase('idle');
    }
    const loggerContext = {module: CC_FILE, method: METHODS.STATION_LOGIN};
    const registration = this.registrationGeneration;
    const epoch = this.rtdEpoch;
    const retainRtd = epoch && this.isCurrentRtdEpoch(epoch);
    this.stationRevision += 1;
    const station = this.stationRevision;
    // The revision fences competing station requests; it does not accept a new session.
    if (retainRtd) epoch.station = station;
    else if (epoch && this.rtdEpoch === epoch) this.pauseRtd();
    if (this.logoutAttempt) {
      this.suppressAutomaticRelogin = this.logoutAttempt.priorSuppression;
      this.logoutAttempt = undefined;
    }
    const orgId = this.$webex.credentials.getOrgId();
    const profile = this.agentConfig;
    const context: AqmRequestContext = manual
      ? this.beginSessionRequest('manual', this.registrationAbortController.signal)
      : {generation: this.recoveryGeneration, signal: this.registrationAbortController?.signal};
    const manualSignal = manual ? this.commandController?.signal : undefined;
    if (
      !this.startTaskSession(
        () =>
          this.isCurrentStation(registration, station, orgId, profile) &&
          context.generation === this.recoveryGeneration &&
          !context.signal?.aborted,
        manual
      )
    )
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    // Only a first station may prepare calling before backend acceptance. Replacing an
    // accepted station's line or mode must wait for its owned backend result.
    const prepareCalling = !this.priorStationActive;
    const reconcileCallingState = () => {
      if (!this.isCurrentStation(registration, station, orgId, profile)) return;
      const mode = this.priorStationActive ? this.agentConfig.deviceType : undefined;

      this.webCallingService.setLoginOption(mode);
      this.webCallingService.setBrowserVoiceRequired(!!mode && this.isBrowserVoiceRequired(mode));
    };

    try {
      this.recordBestEffort(() =>
        LoggerProxy.log(
          `Starting agent station login | loginOption: ${data?.loginOption} teamId: ${data?.teamId}`,
          loggerContext
        )
      );
      this.recordBestEffort(() =>
        this.metricsManager.timeEvent([
          METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
          METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
        ])
      );

      const dialPlanEntries = this.agentConfig?.dialPlan?.dialPlanEntity ?? [];
      if (data.loginOption === LoginOption.AGENT_DN) {
        this.recordBestEffort(() =>
          LoggerProxy.log(
            `Validating dial number | dialPlanEnabled: ${!!this.agentConfig
              ?.dialPlan} | dialPlanEntryCount: ${dialPlanEntries.length}`,
            loggerContext
          )
        );

        if (!isValidDialNumber(data.dialNumber, dialPlanEntries)) {
          this.recordBestEffort(() =>
            LoggerProxy.log(
              `Dial number validation failed | dialNumber: ${data.dialNumber} | dialPlanEntryCount: ${dialPlanEntries.length}`,
              loggerContext
            )
          );
          const error = new Error('INVALID_DIAL_NUMBER');
          // @ts-ignore - adding custom key to the error object
          error.details = {data: {reason: 'INVALID_DIAL_NUMBER'}} as Failure;

          throw error;
        }
      }

      this.assertRecoveryAdmission('session');
      const payload = buildStationLoginPayload(data, this.agentConfig.agentId);
      const loginResponse = this.services.agent
        .stationLogin({data: payload}, undefined, context)
        .then(
          (resp) => {
            if (
              !this.isCurrentStation(registration, station, orgId, profile) ||
              context.signal?.aborted
            )
              throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
            this.rememberAcceptedStation({source: 'login', payload, response: resp});
            reconcileCallingState();
            if (!this.isCurrentStation(registration, station, orgId, profile))
              throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
            this.suppressAutomaticRelogin = false;
            this.endSessionRequest(context);
            this.setRecoveryPhase('ready');
            this.publishRegionState(
              this.buildRegionState('ready', manual ? 'region-switch' : 'initial-login')
            );
            if (
              this.isCurrentStation(registration, station, orgId, profile) &&
              this.registrationAbortController
            )
              this.resumeRtd(this.registrationAbortController.signal);

            return resp;
          },
          (error) => {
            if (prepareCalling) reconcileCallingState();
            this.endSessionRequest(context);
            throw error;
          }
        );
      // Keep backend rejection observed even when an ancillary line await rejects first.
      loginResponse.catch(() => undefined);

      if (prepareCalling) {
        this.webCallingService.setLoginOption(data.loginOption);
        this.webCallingService.setBrowserVoiceRequired(
          this.isBrowserVoiceRequired(data.loginOption)
        );
      } else await loginResponse;

      if (!this.isCurrentStation(registration, station, orgId, profile) || context.signal?.aborted)
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

      if (this.isBrowserVoiceRequired(data.loginOption)) {
        if (manual) {
          try {
            await this.webCallingService.ensureWebCallingLine(context.signal);
          } catch {
            /* Voice ownership cannot fail an accepted DR station. */
            this.recordBestEffort(() =>
              LoggerProxy.error('Unexpected web calling ensure failure', {
                module: CC_FILE,
                method: METHODS.STATION_LOGIN,
              })
            );
          }
        } else await this.webCallingService.registerWebCallingLine();
      } else if (
        this.agentConfig.webRtcEnabled &&
        data.loginOption === LoginOption.BROWSER &&
        this.isWebRTCRegistrationDisabled()
      ) {
        this.recordBestEffort(() =>
          LoggerProxy.info(
            'Skipping web calling line registration because disableWebRTCRegistration is enabled',
            {
              module: CC_FILE,
              method: METHODS.STATION_LOGIN,
            }
          )
        );
      }

      if (!this.isCurrentStation(registration, station, orgId, profile) || context.signal?.aborted)
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      const resp = await loginResponse;
      if (!this.isCurrentStation(registration, station, orgId, profile)) {
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      }
      const {channelsMap, ...loginData} = resp.data;
      const response = {
        ...loginData,
        mmProfile: {
          chat: channelsMap?.chat?.length,
          email: channelsMap?.email?.length,
          social: channelsMap?.social?.length,
          telephony: channelsMap?.telephony?.length,
        },
        notifsTrackingId: resp.trackingId,
      };

      this.recordBestEffort(() =>
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
        )
      );

      this.recordBestEffort(() =>
        LoggerProxy.log(
          `Agent station login completed successfully agentId: ${resp.data.agentId} loginOption: ${data.loginOption} teamId: ${data.teamId}`,
          {
            module: CC_FILE,
            method: METHODS.STATION_LOGIN,
            trackingId: resp.trackingId,
          }
        )
      );

      if (manualSignal) {
        await awaitRecoveryWork(this.ensureWxAppPostStationLogin(manualSignal), manualSignal);
      } else await this.ensureWxAppPostStationLogin();
      if (!this.isCurrentStation(registration, station, orgId, profile))
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

      return response;
    } catch (error) {
      // Ancillary failure does not retire the backend observer. Reconcile from current
      // acceptance so a later owned success can still commit and newer stations win.
      if (prepareCalling) reconcileCallingState();
      const failure = error.details as Failure;
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
          {
            ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
            loginType: data.loginOption,
          },
          ['behavioral', 'business', 'operational']
        )
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
    if (
      this.terminatedRegistrationGeneration === this.registrationGeneration &&
      this.registrationAbortController?.signal.aborted
    )
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    const cancelled = this.cancelAutoAvailable();
    const wasRegional = this.hasRegionalConnectionOwner();
    const priorSuppression = this.logoutAttempt?.priorSuppression ?? this.suppressAutomaticRelogin;
    const logoutAttempt = {priorSuppression};
    const acceptedStation = this.acceptedStation;
    const registrationSignal = this.registrationAbortController?.signal;
    this.stationRevision += 1;
    const station = this.stationRevision;
    const registration = this.registrationGeneration;
    const orgId = this.registrationOrgId;
    const sessionId = this.currentAgentSessionId;
    const logoutGeneration = this.recoveryGeneration + 1;
    const ownsStation = () =>
      station === this.stationRevision &&
      registration === this.registrationGeneration &&
      sessionId === this.currentAgentSessionId &&
      (!orgId || this.$webex.credentials.getOrgId() === orgId);
    const ownsLogout = () => ownsStation() && logoutGeneration === this.recoveryGeneration;
    let logoutConfirmed = false;
    this.logoutAttempt = logoutAttempt;
    this.suppressAutomaticRelogin = true;
    try {
      if (!this.cancelRegionRecovery()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      const terminal = ['unavailable', 'reloadRequired'].includes(this.recoveryPhase);
      this.fenceRecoveryWork(terminal ? this.recoveryPhase : 'cancelled');
      this.pauseRtd();
      if (
        wasRegional &&
        this.registrationAbortController &&
        !this.registrationAbortController.signal.aborted
      )
        this.resetOrdinaryConnection();
      if (cancelled) this.publishRegionState(cancelled);
      if (!ownsLogout()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.resetRegionState();
      if (!terminal) this.setRecoveryPhase('idle');
      if (
        !terminal &&
        this.interruptedTaskGeneration !== undefined &&
        !this.startTaskSession(ownsLogout)
      )
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.recordBestEffort(() =>
        LoggerProxy.info('Starting agent station logout', {
          module: CC_FILE,
          method: METHODS.STATION_LOGOUT,
        })
      );
      this.recordBestEffort(() =>
        this.metricsManager.timeEvent([
          METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS,
          METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED,
        ])
      );
      if (!ownsLogout() || !this.services.webSocketManager.hasUsableSocket())
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      const resp = await this.services.agent.logout({data}, undefined, {
        generation: this.recoveryGeneration,
      });
      logoutConfirmed = true;
      if (!ownsLogout()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.clearAcceptedStation();
      this.logoutAttempt = undefined;

      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS,
          {
            ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
            logoutReason: sanitizeForObservability(data.logoutReason),
          },
          ['behavioral', 'business', 'operational']
        )
      );

      if (this.webCallingService) {
        await this.webCallingService.deregisterWebCallingLine();
        if (!ownsLogout()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      }

      await this.teardownWxAppLocalState();
      if (!ownsLogout()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.updateWellnessSession();

      this.recordBestEffort(() =>
        LoggerProxy.log(`Agent station logout completed successfully`, {
          module: CC_FILE,
          method: METHODS.STATION_LOGOUT,
          trackingId: resp.trackingId,
        })
      );

      return resp;
    } catch (error) {
      if (this.logoutAttempt === logoutAttempt) this.logoutAttempt = undefined;
      if (ownsStation() && !logoutConfirmed) {
        this.suppressAutomaticRelogin = priorSuppression;
        if (
          ownsLogout() &&
          acceptedStation &&
          this.acceptedStation === acceptedStation &&
          registrationSignal
        )
          // Caught admission creates a fresh epoch without reviving cancelled work.
          this.resumeRtd(registrationSignal);
      }
      const failure = error.details as Failure;
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED,
          {
            ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
            logoutReason: sanitizeForObservability(data.logoutReason),
          },
          ['behavioral', 'business', 'operational']
        )
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
    this.assertRecoveryAdmission('command');
    let cancelled: RegionRecoveryState | undefined;
    if (!this.autoAvailable?.requestId) {
      this.stateIntentRevision += 1;
      cancelled = this.cancelAutoAvailable();
    }
    const context: StateDispatchContext = {
      source: 'explicit',
      intentRevision: this.stateIntentRevision,
      stationRevision: this.stationRevision,
      generation: this.recoveryGeneration,
      signal: this.commandController?.signal,
    };
    if (cancelled) this.publishRegionState(cancelled);
    const dispatched = await this.performAgentStateChange(data, context);
    if (dispatched.kind === 'not-dispatched') throw dispatched.error;

    return dispatched.response;
  }

  private assertStateDispatchCurrent(context: StateDispatchContext): void {
    if (
      context.generation !== this.recoveryGeneration ||
      context.stationRevision !== this.stationRevision ||
      context.signal?.aborted
    )
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    this.assertRecoveryAdmission('command');
    if (context.source === 'dr-auto' && context.intentRevision !== this.stateIntentRevision)
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
  }

  private isCurrentAutoAvailable(auto: AutoAvailable): boolean {
    // Ownership survives transport abort long enough to consume and report the action.
    return (
      this.autoAvailable === auto &&
      auto.registration === this.registrationGeneration &&
      auto.generation === this.recoveryGeneration &&
      auto.stationRevision === this.stationRevision &&
      auto.sessionId === this.currentAgentSessionId &&
      auto.intentRevision === this.stateIntentRevision &&
      this.recoveryPhase === 'ready' &&
      this.registrationOrgId === this.$webex.credentials.getOrgId()
    );
  }

  private invalidatesAutoAvailableDisconnect(data: unknown, auto?: AutoAvailable): boolean {
    if (!auto || !isRecord(data)) return false;
    if (
      data.orgId !== this.registrationOrgId ||
      data.agentId !== this.registrationAgentId ||
      !this.currentAgentSessionId ||
      data.agentSessionId !== this.currentAgentSessionId ||
      !AGENT_STATE_FIELDS.every((key) => typeof data[key] === 'string') ||
      !hasAgentStateVersion(data)
    )
      return false;
    const restored = auto.disconnect;
    const version = compareAgentStateVersions(data, restored);

    return version >= 0 && AGENT_STATE_FIELDS.some((key) => data[key] !== restored[key]);
  }

  private armAutoAvailable(result: Agent.ReloginSuccess, signal: AbortSignal): void {
    if (
      result.data.lastStateChangeReason !== 'agent-wss-disconnect' ||
      this.recovery?.intentRevision !== this.stateIntentRevision ||
      signal.aborted
    )
      return;
    const data = result.data;
    if (
      !this.currentAgentSessionId ||
      data.agentSessionId !== this.currentAgentSessionId ||
      data.agentId !== this.registrationAgentId ||
      data.orgId !== this.registrationOrgId
    )
      return;
    const auto: AutoAvailable = {
      registration: this.registrationGeneration,
      generation: this.recoveryGeneration,
      stationRevision: this.stationRevision,
      sessionId: data.agentSessionId,
      intentRevision: this.stateIntentRevision,
      signal,
      disconnect: {...data},
      published: false,
      dispatching: false,
      startedAt: Date.now(),
    };
    this.autoAvailable = auto;
    this.regionStateContext.autoAvailable =
      this.webCallingService.isBrowserVoiceRequired() && !this.webCallingService.isVoiceReady()
        ? 'waitingForVoice'
        : 'requesting';
    this.webCallingService.off(
      VOICE_CONNECTION_EVENTS.STATE_CHANGE,
      this.handleAutoAvailableVoiceChange
    );
    this.webCallingService.on(
      VOICE_CONNECTION_EVENTS.STATE_CHANGE,
      this.handleAutoAvailableVoiceChange
    );
    signal.addEventListener('abort', this.handleAutoAvailableAbort, {once: true});
  }

  private handleAutoAvailableVoiceChange = (): void => {
    const auto = this.autoAvailable;
    if (auto) this.dispatchAutoAvailable(auto).catch(() => undefined);
  };

  private handleAutoAvailableAbort = (): void => {
    const auto = this.autoAvailable;
    if (!auto?.signal.aborted || !this.isCurrentAutoAvailable(auto)) return;
    const outcome = auto.requestId ? 'failed' : 'cancelled';
    if (!this.consumeAutoAvailable(auto, outcome)) return;
    this.regionStateContext.autoAvailable = outcome;
    this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
  };

  /** Release active work once. Its sent request still owns its correlation and settlement. */
  private consumeAutoAvailable(
    auto: AutoAvailable,
    outcome: 'succeeded' | 'failed' | 'cancelled',
    failure?: RecoveryFailure
  ): boolean {
    if (this.autoAvailable !== auto) return false;
    const current = outcome !== 'cancelled' && this.isCurrentAutoAvailable(auto);
    this.autoAvailable = undefined;
    auto.signal.removeEventListener('abort', this.handleAutoAvailableAbort);
    this.webCallingService.off(
      VOICE_CONNECTION_EVENTS.STATE_CHANGE,
      this.handleAutoAvailableVoiceChange
    );
    // Commit settlement before the sink: a reentrant notification cannot settle twice.
    if (current)
      this.recordRecoveryDiagnostic('auto-available', outcome, 1, auto.startedAt, failure);

    return (
      this.autoAvailable === undefined &&
      auto.registration === this.registrationGeneration &&
      auto.generation === this.recoveryGeneration &&
      auto.stationRevision === this.stationRevision &&
      auto.intentRevision === this.stateIntentRevision &&
      auto.sessionId === this.currentAgentSessionId
    );
  }

  /** Consume first; lifecycle owners publish the captured snapshot after their own fences. */
  private cancelAutoAvailable(): RegionRecoveryState | undefined {
    const auto = this.autoAvailable;
    if (!auto) return undefined;
    this.consumeAutoAvailable(auto, 'cancelled');
    const previous = this.lastPublishedRegionState;
    if (!previous || previous.status !== 'ready') return undefined;

    this.regionStateContext.autoAvailable = 'cancelled';

    return {...previous, autoAvailable: 'cancelled'};
  }

  private async dispatchAutoAvailable(auto: AutoAvailable): Promise<void> {
    if (
      auto.requestId ||
      auto.dispatching ||
      !auto.published ||
      auto.signal.aborted ||
      !this.isCurrentAutoAvailable(auto)
    )
      return;
    if (this.invalidatesAutoAvailableDisconnect(this.confirmedState, auto)) {
      const cancelled = this.cancelAutoAvailable();
      if (cancelled) this.publishRegionState(cancelled);

      return;
    }
    if (this.webCallingService.isBrowserVoiceRequired() && !this.webCallingService.isVoiceReady()) {
      auto.dispatching = true;
      this.recordRecoveryDiagnostic('auto-available', 'waiting', 1, auto.startedAt);
      if (!this.isCurrentAutoAvailable(auto) || auto.signal.aborted) return;
      auto.dispatching = false;
      this.regionStateContext.autoAvailable = 'waitingForVoice';
      this.publishRegionState(this.buildRegionState('ready', 'region-switch'));

      return;
    }
    auto.dispatching = true;
    auto.startedAt = Date.now();
    this.webCallingService.off(
      VOICE_CONNECTION_EVENTS.STATE_CHANGE,
      this.handleAutoAvailableVoiceChange
    );
    this.regionStateContext.autoAvailable = 'requesting';
    this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
    if (!this.isCurrentAutoAvailable(auto) || auto.signal.aborted) return;
    try {
      const result = await this.performAgentStateChange(
        {
          state: AGENT_STATE_AVAILABLE,
          auxCodeId: AGENT_STATE_AVAILABLE_ID,
          lastStateChangeReason: 'agent-wss-disconnect',
          agentId: this.registrationAgentId,
        },
        {
          source: 'dr-auto',
          intentRevision: auto.intentRevision,
          stationRevision: auto.stationRevision,
          generation: auto.generation,
          signal: auto.signal,
        }
      );
      if (!this.isCurrentAutoAvailable(auto)) return;
      if (result.kind === 'not-dispatched') {
        auto.dispatching = false;
        this.webCallingService.on(
          VOICE_CONNECTION_EVENTS.STATE_CHANGE,
          this.handleAutoAvailableVoiceChange
        );
        // A ready event may have occurred while the listener was detached.
        if (
          !this.webCallingService.isBrowserVoiceRequired() ||
          this.webCallingService.isVoiceReady()
        )
          await this.dispatchAutoAvailable(auto);
        else {
          this.regionStateContext.autoAvailable = 'waitingForVoice';
          this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
        }
      } else {
        // AQM settled, but the synchronous notification applier did not accept this result.
        if (!this.consumeAutoAvailable(auto, 'failed')) return;
        this.regionStateContext.autoAvailable = 'failed';
        this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
      }
    } catch (error) {
      if (!this.isCurrentAutoAvailable(auto)) return;
      if (!this.consumeAutoAvailable(auto, 'failed', normalizeRecoveryFailure(error))) return;
      this.regionStateContext.autoAvailable = 'failed';
      this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
    }
  }

  private reconcileAgentStateNotification(payload: unknown): void {
    if (!isRecord(payload) || !isRecord(payload.data)) return;
    const data = payload.data;
    if (
      data.type !== CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS ||
      !this.registrationAbortController ||
      this.registrationAbortController.signal.aborted ||
      this.registrationOrgId !== this.$webex.credentials.getOrgId() ||
      !this.registrationAgentId ||
      data.agentId !== this.registrationAgentId ||
      data.orgId !== this.registrationOrgId ||
      !this.currentAgentSessionId ||
      data.agentSessionId !== this.currentAgentSessionId ||
      !AGENT_STATE_FIELDS.every((key) => typeof data[key] === 'string') ||
      !hasAgentStateVersion(data)
    )
      return;
    const request =
      typeof data.trackingId === 'string'
        ? this.autoAvailableDispatches.get(data.trackingId)
        : undefined;
    if (
      request &&
      (request.stationRevision !== this.stationRevision ||
        request.generation !== this.recoveryGeneration ||
        request.intentRevision !== this.stateIntentRevision)
    )
      return;
    const previous = this.confirmedState;
    const version = previous ? compareAgentStateVersions(data, previous) : 1;
    if (version < 0) return;
    const identical = previous && AGENT_STATE_FIELDS.every((key) => data[key] === previous[key]);
    if (version || !identical) {
      this.agentConfig.lastStateAuxCodeId = data.auxCodeId as string;
      this.agentConfig.lastStateChangeTimestamp = data.lastStateChangeTimestamp;
      this.agentConfig.lastIdleCodeChangeTimestamp = data.lastIdleCodeChangeTimestamp ?? undefined;
      this.confirmedState = {...data} as Agent.StateChangeSuccess['data'];
    }
    const auto = this.autoAvailable;
    if (
      request &&
      auto?.requestId === data.trackingId &&
      !auto.signal.aborted &&
      this.isCurrentAutoAvailable(auto)
    ) {
      if (!this.consumeAutoAvailable(auto, 'succeeded')) return;
      this.regionStateContext.autoAvailable = 'succeeded';
      this.publishRegionState(this.buildRegionState('ready', 'region-switch'));
    } else if (!request && this.invalidatesAutoAvailableDisconnect(data, auto)) {
      const cancelled = this.cancelAutoAvailable();
      if (cancelled) this.publishRegionState(cancelled);
    }
  }

  private async performAgentStateChange(
    data: StateChange,
    context: StateDispatchContext
  ): Promise<AgentStateChangeDispatchResult> {
    let localVoiceFailure = false;
    const timeDispatch = () =>
      this.recordBestEffort(() =>
        this.metricsManager.timeEvent([
          METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
          METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
        ])
      );
    this.assertStateDispatchCurrent(context);
    this.recordBestEffort(() =>
      LoggerProxy.info('Setting agent state', {
        module: CC_FILE,
        method: METHODS.SET_AGENT_STATE,
      })
    );
    try {
      if (context.source !== 'dr-auto') timeDispatch();
      if (
        data.state === AGENT_STATE_AVAILABLE &&
        this.webCallingService?.isBrowserVoiceRequired() &&
        !this.webCallingService.isVoiceReady()
      ) {
        localVoiceFailure = true;
        const error = new Error(VOICE_CONNECTION_ERROR.NOT_READY) as GenericError;
        error.details = {
          type: 'SDK_VALIDATION_ERROR',
          orgId: this.$webex.credentials.getOrgId(),
          trackingId: EMPTY_STRING,
          data: {reason: VOICE_CONNECTION_ERROR.NOT_READY},
        };
        throw error;
      }
      if (context.source === 'dr-auto') timeDispatch();
      this.assertStateDispatchCurrent(context);
      if (context.source === 'dr-auto') {
        if (this.invalidatesAutoAvailableDisconnect(this.confirmedState, this.autoAvailable)) {
          const cancelled = this.cancelAutoAvailable();
          if (cancelled) this.publishRegionState(cancelled);
        }
        if (!this.autoAvailable) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      }
      const requestId = uuidv4();
      if (context.source === 'dr-auto') {
        this.autoAvailable.requestId = requestId;
        this.autoAvailableDispatches.set(requestId, {
          generation: context.generation,
          stationRevision: context.stationRevision,
          intentRevision: context.intentRevision,
        });
      }
      const agentStatusResponse = await this.services.agent.stateChange(
        {data: {...data, agentId: data.agentId || this.agentConfig.agentId}},
        undefined,
        {
          generation: context.generation,
          correlationId: requestId,
          ...(context.source === 'dr-auto'
            ? {signal: context.signal, requireCorrelation: true}
            : {}),
        }
      );
      if (context.source === 'dr-auto') this.assertStateDispatchCurrent(context);

      this.recordBestEffort(() =>
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
        )
      );

      this.recordBestEffort(() =>
        LoggerProxy.log(
          `Agent state changed successfully to auxCodeId: ${agentStatusResponse.data.auxCodeId}`,
          {
            module: CC_FILE,
            method: METHODS.SET_AGENT_STATE,
            trackingId: agentStatusResponse.trackingId,
          }
        )
      );

      return {kind: 'acknowledged', response: agentStatusResponse};
    } catch (error) {
      if (context.source === 'dr-auto') {
        if (localVoiceFailure)
          return {kind: 'not-dispatched', cause: 'browser-voice-not-ready', error};
        const auto = this.autoAvailable;
        if (auto && this.isCurrentAutoAvailable(auto))
          this.recordBestEffort(() =>
            this.metricsManager.trackEvent(
              METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
              {
                state: AGENT_STATE_AVAILABLE,
                auxCodeId: AGENT_STATE_AVAILABLE_ID,
                lastStateChangeReason: 'agent-wss-disconnect',
              },
              ['behavioral', 'business', 'operational']
            )
          );
        // The private recovery caller owns safe failure diagnostics. The public error
        // adapter logs arbitrary backend reasons and discards their structured fields.
        throw error;
      }
      const failure = error.details as Failure;
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
          {
            ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
            state: data.state,
            auxCodeId: data.auxCodeId,
            lastStateChangeReason: sanitizeForObservability(data.lastStateChangeReason),
          },
          ['behavioral', 'business', 'operational']
        )
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.SET_AGENT_STATE, CC_FILE);
      if (localVoiceFailure)
        return {kind: 'not-dispatched', cause: 'browser-voice-not-ready', error: detailedError};
      throw detailedError;
    }
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(event);
    } catch {
      return;
    }
    if (!isRecord(parsed)) return;
    const eventData = parsed as Record<string, any>;
    if (eventData.type === SYSTEM_EVENTS.SYSTEM_REGION_SWITCH) {
      const regionSwitch = normalizeRegionSwitch(parsed);
      if (regionSwitch) this.handleRegionSwitch(regionSwitch);

      return;
    }
    if (
      eventData.type === CC_EVENTS.WELCOME &&
      this.registrationAgentId &&
      this.registrationAbortController &&
      !this.registrationAbortController.signal.aborted
    ) {
      try {
        const recovery = this.recovery;
        const slot = recovery?.attempt;
        if (slot && eventData.data?.agentId !== recovery.agentId) {
          this.recordRecoveryDiagnostic(
            'welcome',
            'failed',
            slot.attempt,
            slot.welcomeStartedAt ?? slot.startedAt
          );
          if (!this.isCurrentRecovery(recovery)) return;
        }
        this.assertPrimaryIdentity(eventData.data?.agentId);
      } catch {
        return;
      }
    }
    if (eventData.type === CC_EVENTS.AGENT_MULTI_LOGIN) {
      const resetWellness =
        eventData.data?.type === 'AgentMultiLoginCloseSession' &&
        (!eventData.data.agentSessionId ||
          eventData.data.agentSessionId === this.currentAgentSessionId);
      const termination = this.terminateRegistration();
      if (termination !== undefined && resetWellness) this.updateWellnessSession();
    }
    this.reconcileStationNotification(eventData);
    const registration = this.registrationGeneration;
    const generation = this.recoveryGeneration;
    const station = this.stationRevision;
    const ownsMessage = () =>
      registration === this.registrationGeneration &&
      generation === this.recoveryGeneration &&
      station === this.stationRevision;
    this.reconcileAgentStateNotification(eventData);
    if (!ownsMessage()) return;
    // Re-emit all the events related to agent except keep-alives. Only event names present in
    // the typed CC_EVENTS allow-list are emitted; unknown/server-injected types are ignored.
    if (
      !eventData.keepalive &&
      eventData.data &&
      eventData.data.type &&
      CC_EVENT_ALLOW_LIST.has(eventData.data.type)
    ) {
      // @ts-ignore
      this.publishHostEvent(eventData.data.type, eventData.data);
      if (!ownsMessage()) return;
    }

    if (!eventData.type) {
      return;
    }

    this.recordBestEffort(() =>
      LoggerProxy.log(
        `Received event: ${sanitizeForObservability(eventData?.data?.type ?? eventData.type)}`,
        {
          module: CC_FILE,
          method: METHODS.HANDLE_WEBSOCKET_MESSAGE,
        }
      )
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
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WEBSOCKET_EVENT_RECEIVED,
          metricsPayload,
          ['operational']
        )
      );
    }

    if (this.handleWellnessBreakWebsocketPayload(eventData)) {
      return;
    }

    switch (eventData.type) {
      case CC_EVENTS.AGENT_MULTI_LOGIN:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_MULTI_LOGIN, eventData.data);

        return;
      case CC_EVENTS.AGENT_STATE_CHANGE:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData.data);
        if (!ownsMessage()) return;
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
        this.publishHostEvent(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, stationLoginData);
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
        this.publishHostEvent(AGENT_EVENTS.AGENT_RELOGIN_SUCCESS, stationReLoginData);
        break;
      }
      case CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, eventData.data);
        break;
      case CC_EVENTS.AGENT_STATE_CHANGE_FAILED:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_STATE_CHANGE_FAILED, eventData.data);
        break;
      case CC_EVENTS.AGENT_STATION_LOGIN_FAILED:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_STATION_LOGIN_FAILED, eventData.data);
        break;
      case CC_EVENTS.AGENT_LOGOUT_SUCCESS:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_LOGOUT_SUCCESS, eventData.data);
        break;
      case CC_EVENTS.AGENT_LOGOUT_FAILED:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_LOGOUT_FAILED, eventData.data);
        break;
      case CC_EVENTS.AGENT_DN_REGISTERED:
        // @ts-ignore
        this.publishHostEvent(AGENT_EVENTS.AGENT_DN_REGISTERED, eventData.data);
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

  private static assertWxAppSessionActive(signal?: AbortSignal): void {
    if (signal?.aborted) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
  }

  private async ensureWxAppPostStationLogin(signal?: AbortSignal): Promise<void> {
    ContactCenter.assertWxAppSessionActive(signal);
    const loginOption = this.getCurrentStationLoginOption();
    const flagEnabled = this.isWxBetterTogetherEnabled();
    const telephonyTaskType = this.getWxAppTelephonyTaskType();

    if (loginOption === LoginOption.BROWSER) {
      if (flagEnabled) {
        this.recordBestEffort(() =>
          logWxAppSessionReadiness({
            enableWxBetterTogether: true,
            loginOption,
            wxAppHooksApplied: false,
            usersubPublished: false,
            mercurySubscribed: false,
            telephonyTaskType,
            skipReason: 'unsupported_browser_login',
          })
        );

        this.recordBestEffort(() =>
          this.metricsManager.trackEvent(
            METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED,
            {
              loginOption,
              enableWxBetterTogether: true,
              skipReason: 'unsupported_browser_login',
            },
            ['operational', 'behavioral']
          )
        );
      }

      return;
    }

    let publishedEnable = false;
    let wxAppInitStage: 'mercury' | 'publish' = 'mercury';

    try {
      if (flagEnabled) {
        this.recordBestEffort(() =>
          this.metricsManager.timeEvent([
            METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_SUCCESS,
            METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
          ])
        );

        await this.ensureWxAppMercuryAndSubscribe(signal);
        ContactCenter.assertWxAppSessionActive(signal);
        wxAppInitStage = 'publish';
        await this.publishAnswerOnWebexCrossClientState(true, signal ? {signal} : undefined);
        ContactCenter.assertWxAppSessionActive(signal);
        publishedEnable = true;
        this.taskManager.syncWxAppMuteFromCallDetailsForAllTasks();
        this.taskManager.refreshWxAppOfferObservabilityForAllTasks();

        const mercurySubscribed = this.wxAppTelephonyMercurySync.isSubscribed();
        const usersubPublished = this.webexCrossClientService.isAnswerCallsStateActive();

        this.recordBestEffort(() =>
          logWxAppSessionReadiness({
            enableWxBetterTogether: true,
            loginOption,
            wxAppHooksApplied: true,
            usersubPublished,
            mercurySubscribed,
            telephonyTaskType,
          })
        );

        const sessionInitReady = mercurySubscribed && usersubPublished;

        if (sessionInitReady) {
          this.recordBestEffort(() =>
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
            )
          );
        } else {
          this.recordBestEffort(() =>
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
            )
          );
        }
      } else {
        await this.ensureWxAppDeviceRegistered(signal);
        await this.publishAnswerOnWebexCrossClientState(false, {
          force: true,
          ...(signal && {signal}),
        });
        ContactCenter.assertWxAppSessionActive(signal);
        this.webexCrossClientService.teardown();
        this.wxAppTelephonyMercurySync.unsubscribe();
        await this.releaseWxAppMercuryResources(signal);
        ContactCenter.assertWxAppSessionActive(signal);

        this.recordBestEffort(() =>
          logWxAppSessionReadiness({
            enableWxBetterTogether: false,
            loginOption,
            wxAppHooksApplied: true,
            usersubPublished: false,
            mercurySubscribed: false,
            telephonyTaskType,
            skipReason: 'flag_disabled',
          })
        );

        this.recordBestEffort(() =>
          this.metricsManager.trackEvent(
            METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED,
            {loginOption, enableWxBetterTogether: false, skipReason: 'flag_disabled'},
            ['operational', 'behavioral']
          )
        );
      }
    } catch (error) {
      ContactCenter.assertWxAppSessionActive(signal);
      this.recordBestEffort(() =>
        LoggerProxy.error(`Failed to initialize wxApp post-station-login: ${error}`, {
          module: CC_FILE,
          method: METHODS.STATION_LOGIN,
        })
      );

      if (flagEnabled) {
        const sessionInitFailureReason =
          wxAppInitStage === 'mercury' ? 'mercury_subscribe_failed' : 'publish_failed';

        this.recordBestEffort(() =>
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
          )
        );

        this.recordBestEffort(() =>
          logWxAppSessionReadiness({
            enableWxBetterTogether: true,
            loginOption,
            wxAppHooksApplied: false,
            usersubPublished: this.webexCrossClientService.isAnswerCallsStateActive(),
            mercurySubscribed: this.wxAppTelephonyMercurySync.isSubscribed(),
            telephonyTaskType,
            skipReason: sessionInitFailureReason,
          })
        );

        ContactCenter.assertWxAppSessionActive(signal);
        if (publishedEnable) {
          await this.revertWxAppCrossClientPublish(signal);
        } else {
          this.wxAppTelephonyMercurySync.unsubscribe();
          await this.releaseWxAppMercuryResources(signal);
        }
        ContactCenter.assertWxAppSessionActive(signal);
        this.resetEnableWxBetterTogetherConfig();
      } else {
        ContactCenter.assertWxAppSessionActive(signal);
        this.scheduleForcedFalsePublishRetry(signal);
      }
    }
  }

  private clearWxAppFalsePublishRetryTimer(): void {
    if (this.wxAppFalsePublishRetryTimer) {
      clearTimeout(this.wxAppFalsePublishRetryTimer);
      this.wxAppFalsePublishRetryTimer = undefined;
    }
  }

  private scheduleForcedFalsePublishRetry(signal?: AbortSignal): void {
    this.scheduleFalsePublishRetry(0, {requireDisabled: true, signal});
  }

  /**
   * Retries compensating false publish after rollback failure, regardless of enabled flag.
   * @private
   */
  private scheduleCompensatingFalsePublishRetry(signal?: AbortSignal): void {
    this.scheduleFalsePublishRetry(0, {signal});
  }

  private scheduleFalsePublishRetry(
    retryAttempt = 0,
    options: {requireDisabled?: boolean; signal?: AbortSignal} = {}
  ): void {
    if (options.signal?.aborted || retryAttempt >= ContactCenter.WXAPP_FALSE_PUBLISH_MAX_RETRIES) {
      return;
    }

    if (options?.requireDisabled && this.isWxBetterTogetherEnabled()) {
      return;
    }

    this.clearWxAppFalsePublishRetryTimer();
    const {signal} = options;
    // A completed restore detaches its attempt signal. The command signal still ends on a region fence.
    const owner = signal ? this.commandController?.signal ?? signal : undefined;

    this.wxAppFalsePublishRetryTimer = setTimeout(async () => {
      this.wxAppFalsePublishRetryTimer = undefined;

      if (signal?.aborted || owner?.aborted) return;

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

      const retryController = signal ? new AbortController() : undefined;
      const abortRetry = () => retryController?.abort();
      signal?.addEventListener('abort', abortRetry, {once: true});
      if (owner !== signal) owner?.addEventListener('abort', abortRetry, {once: true});
      const retrySignal = retryController?.signal;
      try {
        await this.ensureWxAppDeviceRegistered(retrySignal);
        await this.publishAnswerOnWebexCrossClientState(false, {
          force: true,
          ...(retrySignal && {signal: retrySignal}),
        });
        ContactCenter.assertWxAppSessionActive(retrySignal);
        this.webexCrossClientService.teardown();
        this.wxAppTelephonyMercurySync.unsubscribe();
        await this.releaseWxAppMercuryResources(retrySignal);
      } catch (retryError) {
        if (retrySignal?.aborted) return;
        LoggerProxy.error(
          `Failed to retry forced answer-calls-on-wxcc false publish: ${retryError}`,
          {
            module: CC_FILE,
            method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
          }
        );
        if (!retrySignal?.aborted) this.scheduleFalsePublishRetry(retryAttempt + 1, options);
      } finally {
        signal?.removeEventListener('abort', abortRetry);
        if (owner !== signal) owner?.removeEventListener('abort', abortRetry);
      }
    }, ContactCenter.WXAPP_FALSE_PUBLISH_RETRY_DELAY_MS);
  }

  /**
   * Best-effort rollback when usersub true was published but wxApp setup did not complete.
   * @private
   */
  private async revertWxAppCrossClientPublish(signal?: AbortSignal): Promise<void> {
    try {
      await this.publishAnswerOnWebexCrossClientState(false, {
        force: true,
        ...(signal && {signal}),
      });
    } catch (error) {
      ContactCenter.assertWxAppSessionActive(signal);
      this.recordBestEffort(() =>
        LoggerProxy.error(
          `Failed to publish compensating answer-calls-on-wxcc false during wxApp rollback: ${error}`,
          {
            module: CC_FILE,
            method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
          }
        )
      );
      ContactCenter.assertWxAppSessionActive(signal);
      this.scheduleCompensatingFalsePublishRetry(signal);
    }

    ContactCenter.assertWxAppSessionActive(signal);
    this.webexCrossClientService.teardown();
    this.wxAppTelephonyMercurySync.unsubscribe();
    await this.releaseWxAppMercuryResources(signal);
  }

  private async ensureWxAppDeviceRegistered(signal?: AbortSignal): Promise<void> {
    ContactCenter.assertWxAppSessionActive(signal);
    const device = this.$webex.internal.device;

    if (device && !device.registered && device.register) {
      await device.register();
      ContactCenter.assertWxAppSessionActive(signal);
      this.wxAppDeviceRegisteredByCc = true;
      this.recordBestEffort(() =>
        LoggerProxy.log('WxApp: device registered for cross-client publish', {
          module: CC_FILE,
          method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
        })
      );
    }
  }

  private async ensureWxAppMercuryConnected(signal?: AbortSignal): Promise<void> {
    const mercury = this.$webex.internal.mercury;

    await this.ensureWxAppDeviceRegistered(signal);
    ContactCenter.assertWxAppSessionActive(signal);

    if (mercury && !mercury.connected) {
      await mercury.connect();
      ContactCenter.assertWxAppSessionActive(signal);
      this.wxAppMercuryConnectedByCc = true;
      this.recordBestEffort(() =>
        LoggerProxy.log('WxApp mute sync: mercury connected', {
          module: CC_FILE,
          method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
        })
      );
    }
  }

  /**
   * Disconnects Mercury and unregisters the device when wxApp mute sync opened them.
   * @private
   */
  private async releaseWxAppMercuryResources(signal?: AbortSignal): Promise<void> {
    ContactCenter.assertWxAppSessionActive(signal);
    const mercury = this.$webex.internal.mercury;
    const device = this.$webex.internal.device;

    if (this.wxAppMercuryConnectedByCc && mercury?.connected) {
      try {
        await mercury.disconnect();
        ContactCenter.assertWxAppSessionActive(signal);
        this.wxAppMercuryConnectedByCc = false;
        this.recordBestEffort(() =>
          LoggerProxy.log('WxApp mute sync: mercury disconnected', {
            module: CC_FILE,
            method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
          })
        );
      } catch (error) {
        ContactCenter.assertWxAppSessionActive(signal);
        this.recordBestEffort(() =>
          LoggerProxy.error(`Failed to disconnect wxApp Mercury: ${error}`, {
            module: CC_FILE,
            method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
          })
        );
      }
    }

    ContactCenter.assertWxAppSessionActive(signal);
    if (this.wxAppDeviceRegisteredByCc && device?.registered && device.unregister) {
      try {
        // @ts-ignore
        await device.unregister();
        ContactCenter.assertWxAppSessionActive(signal);
        this.wxAppDeviceRegisteredByCc = false;
        this.recordBestEffort(() =>
          LoggerProxy.log('WxApp mute sync: device unregistered', {
            module: CC_FILE,
            method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
          })
        );
      } catch (error) {
        ContactCenter.assertWxAppSessionActive(signal);
        this.recordBestEffort(() =>
          LoggerProxy.error(`Failed to unregister wxApp device: ${error}`, {
            module: CC_FILE,
            method: METHODS.ENSURE_WXAPP_MERCURY_CONNECTED,
          })
        );
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
      this.recordBestEffort(() =>
        LoggerProxy.error(
          `Failed to publish answer-calls-on-wxcc false during wxApp teardown: ${error}`,
          {
            module: CC_FILE,
            method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
          }
        )
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

  private async ensureWxAppMercuryAndSubscribe(signal?: AbortSignal): Promise<void> {
    ContactCenter.assertWxAppSessionActive(signal);
    if (!this.isWxBetterTogetherEnabled()) {
      return;
    }

    if (this.getCurrentStationLoginOption() === LoginOption.BROWSER) {
      return;
    }

    const agentId = this.agentConfig?.agentId;
    if (!agentId) {
      this.recordBestEffort(() =>
        LoggerProxy.error('Cannot subscribe wxApp mute sync: agentId unavailable', {
          module: CC_FILE,
          method: METHODS.SYNC_WXAPP_MUTE_FROM_MERCURY,
        })
      );

      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_FAILED,
          {error: 'agentId unavailable', mercurySubscribed: false},
          ['operational', 'behavioral']
        )
      );

      return;
    }

    try {
      await this.ensureWxAppMercuryConnected(signal);
      ContactCenter.assertWxAppSessionActive(signal);
      this.wxAppTelephonyMercurySync.subscribe(agentId, (callId, muted) => {
        if (!signal?.aborted) this.taskManager.applyWxAppMuteStateFromSync(callId, muted);
      });
    } catch (error) {
      ContactCenter.assertWxAppSessionActive(signal);
      this.recordBestEffort(() =>
        LoggerProxy.error(`Failed to ensure wxApp Mercury mute sync: ${error}`, {
          module: CC_FILE,
          method: METHODS.SYNC_WXAPP_MUTE_FROM_MERCURY,
        })
      );
      this.recordBestEffort(() =>
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_FAILED,
          {
            error: error instanceof Error ? error.toString() : String(error),
            mercurySubscribed: false,
          },
          ['operational', 'behavioral']
        )
      );
      ContactCenter.assertWxAppSessionActive(signal);
      this.wxAppTelephonyMercurySync.unsubscribe();
      await this.releaseWxAppMercuryResources(signal);
      throw error;
    }
  }

  private async publishAnswerOnWebexCrossClientState(
    enable: boolean,
    options?: {force?: boolean; signal?: AbortSignal}
  ): Promise<void> {
    const signal = options?.signal;
    ContactCenter.assertWxAppSessionActive(signal);
    if (enable && !this.isWxBetterTogetherEnabled()) {
      return;
    }

    if (!enable && !options?.force && !this.webexCrossClientService.isAnswerCallsStateActive()) {
      return;
    }

    const userId = this.$webex.internal.device?.userId;
    if (!userId) {
      if (enable && this.isWxBetterTogetherEnabled()) {
        this.recordBestEffort(() =>
          this.metricsManager.trackEvent(
            METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
            {
              enableWxBetterTogether: true,
              usersubPublished: this.webexCrossClientService.isAnswerCallsStateActive(),
              skipReason: 'user_id_unavailable',
              error: 'User ID is unavailable for cross-client publish',
            },
            ['operational', 'behavioral']
          )
        );
      }

      return;
    }

    await this.webexCrossClientService.setManageWebexCallingInWxcc(enable, {
      userId,
      trackPublishMetrics: true,
      ...(signal && {signal}),
    });

    ContactCenter.assertWxAppSessionActive(signal);
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
    const registration = this.registrationGeneration;
    const generation = this.recoveryGeneration;
    const station = this.stationRevision;
    const orgId = this.$webex.credentials.getOrgId();
    const profile = this.agentConfig;
    const registrationSignal = this.registrationAbortController?.signal;
    const commandSignal = this.commandController?.signal;
    const ownsStation = () => this.isCurrentStation(registration, station, orgId, profile);
    const ownsRelogin = () => generation === this.recoveryGeneration && ownsStation();
    const assertReloginAdmission = () => {
      if (!ownsStation()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.assertRecoveryAdmission('session');
      if (generation !== this.recoveryGeneration)
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    };
    if (!initialRegistration) {
      const cancelled = this.cancelAutoAvailable();
      if (cancelled) {
        const phase = this.recoveryPhase;
        this.setRecoveryPhase('cancelled');
        this.publishRegionState(cancelled);
        if (!ownsRelogin()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
        this.setRecoveryPhase(phase);
      }
    }
    this.recordBestEffort(() =>
      LoggerProxy.log('Starting silent relogin process', {
        module: CC_FILE,
        method: METHODS.SILENT_RELOGIN,
      })
    );

    try {
      assertReloginAdmission();
      if (this.interruptedTaskGeneration !== undefined && !this.startTaskSession(ownsRelogin))
        throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      const reLoginResponse = await this.services.agent.reload(undefined, {
        generation,
        signal: registrationSignal,
      });
      assertReloginAdmission();
      this.rememberAcceptedStation({source: 'reload', response: reLoginResponse});
      assertReloginAdmission();
      if (!initialRegistration && registrationSignal) {
        this.resumeRtd(registrationSignal);
        assertReloginAdmission();
      }

      const {agentId, lastStateChangeReason, deviceType, dn} = reLoginResponse.data;
      const acceptedPayload = this.acceptedStation?.payload;
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
          assertReloginAdmission();
          const dispatched = await this.performAgentStateChange(stateChangeData, {
            source: 'relogin-auto',
            intentRevision: this.stateIntentRevision,
            stationRevision: station,
            generation,
            signal: commandSignal,
          });
          if (dispatched.kind === 'not-dispatched') throw dispatched.error;
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
      const wxApp = this.ensureWxAppPostStationLogin(commandSignal);
      await awaitRecoveryWork(wxApp, commandSignal);
      assertReloginAdmission();
      if (initialRegistration) {
        this.setRecoveryPhase('ready');
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
   * @param {AbortSignal} [restoreSignal] Identifies a regional restore that preserves Calling's line
   * @returns {Promise<void>}
   * @private
   */
  private async handleDeviceType(
    deviceType: LoginOption,
    dn: string,
    restoreSignal?: AbortSignal
  ): Promise<void> {
    this.webCallingService.setLoginOption(deviceType);
    this.webCallingService.setBrowserVoiceRequired(this.isBrowserVoiceRequired(deviceType));
    this.agentConfig.deviceType = deviceType;
    switch (deviceType) {
      case LoginOption.BROWSER:
        // Ordinary relogin replaces the line even when the profile does not require browser voice.
        if (
          this.isWebRTCRegistrationDisabled() ||
          (restoreSignal && !this.isBrowserVoiceRequired(deviceType))
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
        try {
          if (restoreSignal) {
            await this.webCallingService.ensureWebCallingLine(restoreSignal);
          } else await this.webCallingService.registerWebCallingLine();
        } catch (error) {
          this.recordBestEffort(() =>
            LoggerProxy.error(
              restoreSignal
                ? 'Unexpected web calling ensure failure'
                : `Error registering web calling line: ${error}`,
              {module: CC_FILE, method: METHODS.HANDLE_DEVICE_TYPE}
            )
          );
          // During a regional restore, voice can recover independently of station acceptance.
          if (!restoreSignal) throw error;
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
    this.assertRecoveryAdmission('command');
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
    this.assertRecoveryAdmission('command');
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
    this.assertRecoveryAdmission('command');
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
    this.assertRecoveryAdmission('command');
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
    this.assertRecoveryAdmission('command');
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
