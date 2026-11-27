/**
 * @module CCPlugin
 * @packageDocumentation
 * Contact Center Plugin module that provides functionality for managing contact center agents,
 * handling tasks, and interacting with contact center services. This module enables integration
 * with Webex Contact Center features through the WebexSDK.
 */

import {WebexPlugin} from '@webex/webex-core';
import EventEmitter from 'events';
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
} from './constants';
import {AGENT_STATE_AVAILABLE, AGENT_STATE_AVAILABLE_ID} from './services/config/constants';
import {AGENT, RTD_SUBSCRIBE_API, WEB_RTC_PREFIX} from './services/constants';
import Services from './services';
import WebexRequest from './services/core/WebexRequest';
import LoggerProxy from './logger-proxy';
import {StateChange, Logout, AGENT_EVENTS} from './services/agent/types';
import {
  getErrorDetails,
  getStationRecoveryFailureCategory,
  isRecord,
  isValidDialNumber,
  sanitizeForObservability,
  createRegionRecoveryError,
  normalizeRecoveryFailure,
  normalizeRecoveryDiagnosticId,
  normalizeRegionSwitch,
  isRegionRecoveryError,
} from './services/core/Utils';
import type * as Agent from './services/agent/types';
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
import type {
  RegionRecoveryState,
  EntryPointListResponse,
  EntryPointSearchParams,
  ContactServiceQueuesResponse,
  ContactServiceQueueSearchParams,
} from './types';

/**
 * Typed allow-list of server-controlled websocket event names this SDK re-emits verbatim.
 * Guards against emitting an arbitrary/unknown `data.type` supplied by the websocket payload.
 * @ignore
 */
const CC_EVENT_ALLOW_LIST = new Set<string>(Object.values(CC_EVENTS));
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
  private wellnessRegistrationGeneration = 0;
  private pendingRegistration?: {
    failure?: Error;
    rejectConnectionWait?: (error: Error) => void;
  };

  private registrationOrgId?: string;
  private registrationAgentId?: string;

  private acceptedStation?: Agent.UserStationLogin;
  private rtdConnection?: Promise<unknown>;

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

  private clearAcceptedStation(): void {
    this.acceptedStation = undefined;
    if (this.agentConfig) {
      this.agentConfig.isAgentLoggedIn = false;
      this.agentConfig.currentTeamId = undefined;
      this.agentConfig.deviceType = undefined;
      this.agentConfig.dn = undefined;
      this.agentConfig.defaultDn = undefined;
    }
  }

  /** Stops transports and clears registration state. */
  private terminateRegistration(identityFailure = false): void {
    if (this.pendingRegistration) {
      const error =
        this.pendingRegistration.failure ?? createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.pendingRegistration.failure = error;
      this.pendingRegistration.rejectConnectionWait?.(error);
    }
    this.services.connectionService.resetRecovery(identityFailure);
    this.wellnessRegistrationGeneration += 1;
    this.clearAcceptedStation();
    this.registrationAgentId = undefined;
    this.wellbeingBreakIdleCode = undefined;
    this.services.connectionService.stop();
    this.pauseRtd('registrationEnded');
    this.services.webSocketManager.close(false, 'registrationEnded');
    this.taskManager.unregisterIncomingCallEvent();
    this.taskManager.invalidateRegionalTasks();
  }

  /** Waits for an ordinary reconnect before registration attempts station reload. */
  private async awaitRegistrationConnection(): Promise<void> {
    if (this.services.connectionService.isRecovering)
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    const manager = this.services.webSocketManager;
    if (manager.hasUsableSocket()) return;
    if (manager.shouldReconnect === false) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

    let onConnection: (details: ConnectionLostDetails) => void;
    let onClose: (event: {shouldReconnect: boolean}) => void;
    const connected = new Promise<void>((resolve, reject) => {
      this.pendingRegistration.rejectConnectionWait = reject;
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
      await connected;
    } finally {
      this.pendingRegistration.rejectConnectionWait = undefined;
      this.services.connectionService.off('connectionLost', onConnection);
      manager.off('socketClose', onClose);
    }
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

  private applyRecoveredSession = async (
    response: Agent.ReloginSuccess | Agent.StationLoginSuccess | Agent.StateChangeSuccess,
    payload?: Agent.UserStationLogin
  ): Promise<void> => {
    if (response.data.type === CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS) {
      this.applyAvailableState(response as Agent.StateChangeSuccess);

      return;
    }
    if (payload)
      this.rememberAcceptedStation({
        source: 'login',
        payload,
        response: response as Agent.StationLoginSuccess,
      });
    else
      this.rememberAcceptedStation({source: 'reload', response: response as Agent.ReloginSuccess});
    if (this.acceptedStation)
      await this.handleDeviceType(
        this.acceptedStation.deviceType as LoginOption,
        this.acceptedStation.dialNumber,
        true
      );
    await this.ensureWxAppPostStationLogin();
  };

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
      const fields = input.response.data;
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
      payload = this.buildStationLoginPayload({
        teamId: data.teamId,
        loginOption: mode as LoginOption,
        dialNumber,
      });
    }
    this.agentConfig.currentTeamId = payload.teamId;
    this.acceptedStation = payload;
    this.agentConfig.deviceType = payload.deviceType as LoginOption;
    this.agentConfig.dn = payload.dialNumber;
    this.agentConfig.defaultDn = payload.dialNumber;
  }

  private buildStationLoginPayload(data: AgentLogin): Agent.UserStationLogin {
    const {loginOption, dialNumber, teamId} = data;
    const deviceId = this.getDeviceId(loginOption, dialNumber);

    return {
      dialNumber: loginOption === LoginOption.BROWSER ? deviceId : dialNumber,
      teamId,
      deviceType: loginOption,
      isExtension: loginOption === LoginOption.EXTENSION,
      deviceId,
      roles: [AGENT],
      teamName: EMPTY_STRING,
      siteId: EMPTY_STRING,
      usesOtherDN: false,
      auxCodeId: EMPTY_STRING,
    };
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
    this.clearAcceptedStation();
    this.updateWellnessSession();
    this.pauseRtd();
    this.services.connectionService.clearStationRecovery();
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
        connectionConfig: this.getConnectionConfig(),
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
      this.services.connectionService.configureRecovery({
        webex: this.$webex,
        agent: this.services.agent,
        metricsManager: this.metricsManager,
        getSession: () => ({
          orgId: this.registrationOrgId,
          agentId: this.registrationAgentId,
          connectionConfig: this.getConnectionConfig(),
          isAgentLoggedIn: this.agentConfig?.isAgentLoggedIn,
          station: this.acceptedStation,
          allowAutomatedRelogin: this.$config?.allowAutomatedRelogin ?? false,
          waitingForVoice: this.isWaitingForBrowserVoice(),
        }),
        onConnectionChange: (connected) => {
          if (connected) this.resumeRtd();
          else {
            this.pauseRtd();
            this.taskManager.invalidateRegionalTasks();
          }
        },
        applySession: this.applyRecoveredSession,
        makeAvailable: () =>
          this.setAgentState({
            state: AGENT_STATE_AVAILABLE,
            auxCodeId: AGENT_STATE_AVAILABLE_ID,
            lastStateChangeReason: 'agent-wss-disconnect',
          }) as Promise<Agent.StateChangeSuccess>,
      });
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
    // @ts-ignore
    this.trigger(VOICE_CONNECTION_EVENTS.STATE_CHANGE, state);
    this.services.connectionService.requestAutoAvailable();
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
      // @ts-ignore
      this.emit(CC_EVENTS.WELLNESS_BREAK, wellnessEvent);
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

  private resumeRtd(): void {
    if (this.rtdConnection || !this.shouldSubscribeRtd()) return;
    const manager = this.services.rtdWebSocketManager;
    const startedAt = Date.now();
    manager.on('message', this.handleRTDWebsocketMessage);
    const connection = manager.initWebSocket({
      body: this.getConnectionConfig(),
      resource: RTD_SUBSCRIBE_API,
    });
    this.rtdConnection = connection;
    connection.then(
      () => {
        if (this.rtdConnection === connection)
          this.services.connectionService.recordRecoveryDiagnostic(
            'rtd',
            'succeeded',
            1,
            startedAt
          );
      },
      (error) => {
        if (this.rtdConnection !== connection) return;
        this.pauseRtd();
        this.services.connectionService.recordRecoveryDiagnostic(
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
    this.services.connectionService.resetRecovery();
    this.pauseRtd();
    this.services.connectionService.stop();
    if (this.registrationAgentId) {
      this.services.webSocketManager.close(false, 'register');
      this.taskManager.unregisterIncomingCallEvent();
      this.taskManager.invalidateRegionalTasks();
    }
    this.clearAcceptedStation();
    this.wellnessRegistrationGeneration += 1;
    this.registrationAgentId = undefined;
    this.wellbeingBreakIdleCode = undefined;
    const orgId = this.$webex.credentials.getOrgId();
    this.pendingRegistration = {};
    this.registrationOrgId = orgId;
    LoggerProxy.log('Starting CC SDK registration', {
      module: CC_FILE,
      method: METHODS.REGISTER,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
      ]);
      this.setupEventListeners();
      this.incomingTaskListener();
      this.services.webSocketManager.off('message', this.handleWebsocketMessage);
      this.services.webSocketManager.on('message', this.handleWebsocketMessage);

      const resp = await this.connectWebsocket();
      if (this.pendingRegistration.failure) throw this.pendingRegistration.failure;
      // Ensure 'dn' is always populated from 'defaultDn'
      resp.dn = resp.defaultDn;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          deviceType: resp.deviceType || EMPTY_STRING,
        },
        ['operational']
      );

      LoggerProxy.log(`CC SDK registration completed successfully with agentId: ${resp.agentId}`, {
        module: CC_FILE,
        method: METHODS.REGISTER,
      });

      // Registration can silently restore a station session without emitting a
      // relogin event. Project the active session for consumers that must
      // recover session-scoped state after a page refresh.
      return resp.isAgentLoggedIn && this.currentAgentSessionId
        ? {...resp, agentSessionId: this.currentAgentSessionId}
        : resp;
    } catch (error) {
      const failure = this.pendingRegistration.failure ?? error;
      this.registrationAgentId = undefined;
      this.services.connectionService.stop();
      this.services.webSocketManager.close(false, 'registrationFailed');
      this.pauseRtd();
      if (this.services.connectionService.isRecovering)
        this.services.connectionService.finishRegionRecovery('recovery-failed');
      this.services.connectionService.setMultiRegionSettings();
      if (isRegionRecoveryError(failure)) throw failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
        {
          orgId: normalizeRecoveryDiagnosticId(isRecord(failure) ? failure.orgId : undefined),
        },
        ['operational']
      );
      const data = ContactCenter.getRegistrationErrorDetails(failure);
      LoggerProxy.error('Error during register', {
        module: CC_FILE,
        method: METHODS.REGISTER,
        data,
      });
      Promise.resolve(this.webexRequest.uploadLogs({correlationId: data.trackingId})).catch(() => {
        /* Log upload failure must not replace the registration error. */
      });

      throw failure;
    } finally {
      this.pendingRegistration = undefined;
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
    this.terminateRegistration();
    this.registrationOrgId = undefined;
    this.updateWellnessSession();
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
      ]);

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
      this.services.connectionService.off('reconnectFailed', this.handleReconnectFailure);
      this.services.connectionService.off('regionStateChange', this.handleRegionStateChange);

      const {publishError: wxAppPublishError} = await this.teardownWxAppLocalState({
        clearInitFlag: true,
      });

      if (
        this.agentConfig?.webRtcEnabled &&
        this.agentConfig.loginVoiceOptions.includes(LoginOption.BROWSER)
      ) {
        if (this.$webex.internal.mercury.connected) {
          this.$webex.internal.mercury.off('online');
          this.$webex.internal.mercury.off('offline');
          await this.$webex.internal.mercury.disconnect();
          // @ts-ignore
          await this.$webex.internal.device.unregister();
          LoggerProxy.log(MERCURY_DISCONNECTED_SUCCESS, {
            module: CC_FILE,
            method: METHODS.DEREGISTER,
          });
        }
      }

      this.agentConfig = null;

      if (wxAppPublishError) {
        throw wxAppPublishError;
      }

      LoggerProxy.log('Deregistered successfully', {
        module: CC_FILE,
        method: METHODS.DEREGISTER,
      });

      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS, {}, [
        'operational',
      ]);
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
        {
          error: error.message || UNKNOWN_ERROR,
        },
        ['operational']
      );

      LoggerProxy.error(`Error during deregister: ${error}`, {
        module: CC_FILE,
        method: METHODS.DEREGISTER,
      });

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
  private async connectWebsocket() {
    const orgId = this.registrationOrgId;
    LoggerProxy.log('Connecting to websocket', {
      module: CC_FILE,
      method: METHODS.CONNECT_WEBSOCKET,
    });

    try {
      const data = await this.services.connectionService.connect();
      if (!isRecord(data) || typeof data.agentId !== 'string' || !data.agentId.trim()) {
        this.terminateRegistration(true);
        throw new Error('Primary Welcome agent identity is required');
      }
      const agentId = data.agentId;
      const profile = await this.services.config.getAgentConfig(orgId, agentId);
      if (this.pendingRegistration.failure) throw this.pendingRegistration.failure;
      if (profile.agentId !== agentId) {
        this.terminateRegistration(true);
        throw new Error('Primary Welcome and Profile agent identities differ');
      }
      const {multiRegionSettings} = profile;
      // Keep recovery settings private when register() returns this profile.
      delete profile.multiRegionSettings;
      this.agentConfig = profile;
      this.registrationAgentId = agentId;
      this.services.connectionService.reset();
      this.services.connectionService.setMultiRegionSettings(multiRegionSettings);
      this.taskManager.registerIncomingCallEvent();

      LoggerProxy.log(`Agent config is fetched successfully`, {
        module: CC_FILE,
        method: METHODS.CONNECT_WEBSOCKET,
      });

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
          LoggerProxy.log('Authentication: webex.internal.mercury.connect successful', {
            module: CC_FILE,
            method: METHODS.CONNECT_WEBSOCKET,
          });
        } catch (error) {
          LoggerProxy.error(`Error occurred during mercury.connect() ${error}`, {
            module: CC_FILE,
            method: METHODS.CONNECT_WEBSOCKET,
          });
        }
      } else if (this.isWebRTCRegistrationDisabled()) {
        LoggerProxy.info(
          'Skipping Mobius registration because disableWebRTCRegistration is enabled',
          {
            module: CC_FILE,
            method: METHODS.CONNECT_WEBSOCKET,
          }
        );
      }

      if (this.pendingRegistration.failure) throw this.pendingRegistration.failure;
      if (this.$config && this.$config.allowAutomatedRelogin) {
        await this.awaitRegistrationConnection();
        await this.silentRelogin(true);
      } else {
        LoggerProxy.log('Skipping silent relogin: allowAutomatedRelogin is disabled', {
          module: CC_FILE,
          method: METHODS.CONNECT_WEBSOCKET,
        });
      }

      if (
        this.services.connectionService.regionState?.status === 'recovering' &&
        !this.agentConfig?.isAgentLoggedIn
      ) {
        this.services.connectionService.publishRegionState({
          status: 'stationLoginRequired',
          reason: 'region-mismatch',
        });
      }
      this.resumeRtd();

      return this.agentConfig;
    } catch (error) {
      if (error?.name === 'AbortError') throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
      this.updateWellnessSession();
      if (isRegionRecoveryError(error)) throw error;
      LoggerProxy.error('Error during register', {
        module: CC_FILE,
        method: METHODS.CONNECT_WEBSOCKET,
        data: ContactCenter.getRegistrationErrorDetails(error),
      });

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
    const manual = this.services.connectionService.regionState?.status === 'stationLoginRequired';
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

      const payload = this.buildStationLoginPayload(data);
      const loginResponse = await this.services.agent.stationLogin({data: payload});
      this.rememberAcceptedStation({source: 'login', payload, response: loginResponse});

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

      const resp = await loginResponse;
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
      this.services.connectionService.publishRegionState({
        status: 'ready',
        reason: manual ? 'region-switch' : 'initial-login',
      });
      this.resumeRtd();

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
      const logoutResponse = this.services.agent.logout({
        data,
      });

      const resp = await logoutResponse;
      if (this.agentConfig?.isAgentLoggedIn) this.clearStationSession();

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
   * Gets the device ID based on login option and dial number
   * @param {string} loginOption The login option (BROWSER, EXTENSION, etc)
   * @param {string} dialNumber The dial number if applicable
   * @returns {string} The device ID
   * @private
   */
  private getDeviceId(loginOption: string, dialNumber: string): string {
    if (loginOption === LoginOption.EXTENSION || loginOption === LoginOption.AGENT_DN) {
      return dialNumber;
    }

    return WEB_RTC_PREFIX + this.agentConfig.agentId;
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
    this.services.connectionService.cancelWaitingAutoAvailable();

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

  private applyAvailableState(response: Agent.StateChangeSuccess): void {
    this.agentConfig.lastStateAuxCodeId = AGENT_STATE_AVAILABLE_ID;
    this.agentConfig.lastStateChangeTimestamp = response.data.lastStateChangeTimestamp;
    this.agentConfig.lastIdleCodeChangeTimestamp =
      response.data.lastIdleCodeChangeTimestamp ?? undefined;
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
      const registrationGeneration = this.wellnessRegistrationGeneration;
      const orgId = this.$webex.credentials.getOrgId();
      const idleCode = await this.services.config.getWellbeingBreakIdleCode(orgId);

      if (
        registrationGeneration !== this.wellnessRegistrationGeneration ||
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
      if (regionSwitch) this.services.connectionService.handleRegionSwitch(regionSwitch);

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
        if (!this.services.connectionService.isRecovering) {
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
    this.services.connectionService.off('reconnectFailed', this.handleReconnectFailure);
    this.services.connectionService.on('reconnectFailed', this.handleReconnectFailure);
    this.services.connectionService.off('regionStateChange', this.handleRegionStateChange);
    this.services.connectionService.on('regionStateChange', this.handleRegionStateChange);
  }

  private handleRegionStateChange = (state: RegionRecoveryState): void => {
    // @ts-ignore
    this.trigger(REGION_RECOVERY_EVENTS.STATE_CHANGE, state);
  };

  private handleReconnectFailure = (error: unknown): void => {
    if (normalizeRecoveryFailure(error).reason === 'RECOVERY_INTERRUPTED') {
      this.terminateRegistration(true);

      return;
    }
    if (this.pendingRegistration) {
      this.pendingRegistration.failure = error as Error;
      this.pendingRegistration.rejectConnectionWait?.(error as Error);
    }
  };

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
      LoggerProxy.log('event=handleConnectionLost | Connection lost', {
        module: CC_FILE,
        method: METHODS.HANDLE_CONNECTION_LOST,
      });
    } else if (msg.isSocketReconnected) {
      // TODO: Emit an event saying connection is re-estabilished
      LoggerProxy.log(
        'event=handleConnectionReconnect | Connection reconnected attempting to request silent relogin',
        {module: CC_FILE, method: METHODS.HANDLE_CONNECTION_LOST}
      );
      if (
        this.$config?.allowAutomatedRelogin &&
        !this.pendingRegistration &&
        this.agentConfig?.isAgentLoggedIn !== false &&
        !this.services.connectionService.isRecovering &&
        this.services.connectionService.regionState?.status !== 'unavailable' &&
        this.services.connectionService.regionState?.status !== 'stationLoginRequired'
      ) {
        try {
          await this.silentRelogin();
        } catch (error) {
          const failure = normalizeRecoveryFailure(error);
          if (failure.status === 401 || failure.status === 403)
            this.services.connectionService.handleRecoveryTerminal(error);
        }
      }
    }
  };

  /**
   * Handles silent relogin after registration completion
   * @private
   */
  private async silentRelogin(initialRegistration = false): Promise<void> {
    LoggerProxy.log('Starting silent relogin process', {
      module: CC_FILE,
      method: METHODS.SILENT_RELOGIN,
    });

    let fallbackAttempted = false;
    try {
      let reLoginResponse: Agent.ReloginSuccess | Agent.StationLoginSuccess;
      try {
        reLoginResponse = await this.services.agent.reload();
      } catch (error) {
        const payload = this.acceptedStation;
        if (
          !payload ||
          getStationRecoveryFailureCategory(normalizeRecoveryFailure(error)) !== 'fallback'
        )
          throw error;
        fallbackAttempted = true;
        try {
          reLoginResponse = await this.services.agent.stationLogin({data: payload});
        } catch (loginError) {
          if (getStationRecoveryFailureCategory(normalizeRecoveryFailure(loginError)) !== 'exists')
            throw loginError;
          reLoginResponse = await this.services.agent.reload();
        }
        if (reLoginResponse.data.type === CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS)
          this.rememberAcceptedStation({
            source: 'login',
            payload,
            response: reLoginResponse as Agent.StationLoginSuccess,
          });
      }
      if (reLoginResponse.data.type !== CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS)
        this.rememberAcceptedStation({
          source: 'reload',
          response: reLoginResponse as Agent.ReloginSuccess,
        });
      if (!initialRegistration) this.resumeRtd();

      const {agentId} = reLoginResponse.data;
      const {lastStateChangeReason, deviceType, dn} =
        reLoginResponse.data as Agent.ReloginSuccess['data'];
      const acceptedPayload = this.acceptedStation;
      if (acceptedPayload)
        await this.handleDeviceType(
          acceptedPayload.deviceType as LoginOption,
          acceptedPayload.dialNumber,
          fallbackAttempted
        );
      else if (Object.values(LoginOption).includes(deviceType as LoginOption))
        await this.handleDeviceType(deviceType as LoginOption, dn);

      if (lastStateChangeReason === 'agent-wss-disconnect') {
        LoggerProxy.log(
          'event=requestAutoStateChange | Requesting state change to available on socket reconnect',
          {module: CC_FILE, method: METHODS.SILENT_RELOGIN}
        );
        const stateChangeData: StateChange = {
          state: AGENT_STATE_AVAILABLE,
          auxCodeId: AGENT_STATE_AVAILABLE_ID,
          lastStateChangeReason,
          agentId,
        };
        try {
          const result = (await this.setAgentState(stateChangeData)) as Agent.StateChangeSuccess;
          this.applyAvailableState(result);
        } catch (error) {
          LoggerProxy.error(
            `event=requestAutoStateChange | Error requesting state change to available on socket reconnect: ${error}`,
            {module: CC_FILE, method: METHODS.SILENT_RELOGIN}
          );
        }
      }
      await this.ensureWxAppPostStationLogin();
      this.services.connectionService.publishRegionState({
        status: 'ready',
        reason: initialRegistration ? 'initial-login' : 'region-switch',
      });

      LoggerProxy.log(
        `Silent relogin process completed successfully with login Option: ${this.agentConfig.deviceType} teamId: ${reLoginResponse.data.teamId}`,
        {
          module: CC_FILE,
          method: METHODS.SILENT_RELOGIN,
          trackingId: reLoginResponse.trackingId,
        }
      );
    } catch (error) {
      if (
        fallbackAttempted &&
        getStationRecoveryFailureCategory(normalizeRecoveryFailure(error)) !== 'auth'
      ) {
        this.services.connectionService.publishRegionState({
          status: 'stationLoginRequired',
          reason: 'session-restore-failed',
        });

        return;
      }
      const {reason, error: detailedError} = getErrorDetails(
        error,
        METHODS.SILENT_RELOGIN,
        CC_FILE
      );
      if (reason === 'AGENT_NOT_FOUND') {
        LoggerProxy.log('Agent not found during relogin, handling silently', {
          module: CC_FILE,
          method: METHODS.SILENT_RELOGIN,
        });

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
          LoggerProxy.info(
            this.isWebRTCRegistrationDisabled()
              ? 'Skipping web calling line registration because disableWebRTCRegistration is enabled'
              : 'Skipping web calling line registration because browser voice is not required',
            {
              module: CC_FILE,
              method: METHODS.HANDLE_DEVICE_TYPE,
            }
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
        LoggerProxy.error(`Unsupported device type: ${deviceType}`, {
          module: CC_FILE,
          method: METHODS.HANDLE_DEVICE_TYPE,
        });
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
