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
} from './constants';
import {AGENT, WEB_RTC_PREFIX} from './services/constants';
import Services from './services';
import WebexRequest from './services/core/WebexRequest';
import LoggerProxy from './logger-proxy';
import {StateChange, Logout, StateChangeSuccess, AGENT_EVENTS} from './services/agent/types';
import {getErrorDetails, isValidDialNumber} from './services/core/Utils';
import {Profile, WelcomeEvent, CC_EVENTS} from './services/config/types';
import {AGENT_STATE_AVAILABLE, AGENT_STATE_AVAILABLE_ID} from './services/config/constants';
import {ConnectionLostDetails} from './services/core/websocket/types';
import TaskManager from './services/task/TaskManager';
import WebCallingService from './services/WebCallingService';
import {ITask, TASK_EVENTS, TaskResponse, DialerPayload} from './services/task/types';
import MetricsManager from './metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from './metrics/constants';
import {Failure} from './services/core/GlobalTypes';
import EntryPoint from './services/EntryPoint';
import AddressBook from './services/AddressBook';
import Queue from './services/Queue';
import type {
  EntryPointListResponse,
  EntryPointSearchParams,
  ContactServiceQueuesResponse,
  ContactServiceQueueSearchParams,
} from './types';

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
 *       teamId: profile.teams[0].teamId,
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
  private queue: Queue;

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
      this.services.webSocketManager.on('message', this.handleWebsocketMessage);

      this.webCallingService = new WebCallingService(this.$webex);
      this.metricsManager = MetricsManager.getInstance({webex: this.$webex});
      this.taskManager = TaskManager.getTaskManager(
        this.services.contact,
        this.webCallingService,
        this.services.webSocketManager
      );
      this.incomingTaskListener();

      // Initialize API instances
      // will have future function for indivdual fetch etc so better be in an object
      this.entryPoint = new EntryPoint(this.$webex);
      this.addressBook = new AddressBook(this.$webex, () => this.agentConfig?.addressBookId);
      this.queue = new Queue(this.$webex);

      // Initialize logger
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
   * Sets up event listeners for incoming tasks and task hydration
   * Subscribes to task events from the task manager
   * @private
   */
  private incomingTaskListener() {
    this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
    this.taskManager.on(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
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
   * console.log('Teams:', profile.teams.map(t => t.teamId));
   * console.log('WebRTC Enabled:', profile.webRtcEnabled);
   * console.log('Supported Login Options:', profile.loginVoiceOptions);
   *
   * // Now you can proceed with station login, state changes, etc.
   * await cc.stationLogin({ teamId: profile.teams[0].teamId, loginOption: 'BROWSER' });
   * ```
   */
  public async register(): Promise<Profile> {
    LoggerProxy.info('Starting CC SDK registration', {
      module: CC_FILE,
      method: METHODS.REGISTER,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
      ]);
      this.setupEventListeners();

      const resp = await this.connectWebsocket();
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

      return resp;
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
        {
          orgId: error.orgId,
        },
        ['operational']
      );
      LoggerProxy.error(`Error during register: ${error}`, {
        module: CC_FILE,
        method: METHODS.REGISTER,
      });
      this.webexRequest.uploadLogs({
        correlationId: error?.trackingId,
      });

      throw error;
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
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
      ]);

      this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
      this.taskManager.off(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
      this.taskManager.unregisterIncomingCallEvent();

      this.services.webSocketManager.off('message', this.handleWebsocketMessage);
      this.services.connectionService.off('connectionLost', this.handleConnectionLost);

      if (
        this.agentConfig.webRtcEnabled &&
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

      if (!this.services.webSocketManager.isSocketClosed) {
        this.services.webSocketManager.close(false, 'Unregistering the SDK');
      }

      // Clear any cached agent configuration
      this.agentConfig = null;

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
        data: {agentProfileId: this.agentConfig.agentProfileID, ...data},
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          mediaType: data.mediaType,
          buddyAgentState: data.state,
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
          mediaType: data.mediaType,
          buddyAgentState: data.state,
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
    LoggerProxy.info('Connecting to websocket', {
      module: CC_FILE,
      method: METHODS.CONNECT_WEBSOCKET,
    });
    try {
      return this.services.webSocketManager
        .initWebSocket({
          body: this.getConnectionConfig(),
        })
        .then(async (data: WelcomeEvent) => {
          const agentId = data.agentId;
          const orgId = this.$webex.credentials.getOrgId();
          this.agentConfig = await this.services.config.getAgentConfig(orgId, agentId);
          LoggerProxy.log(`Agent config is fetched successfully`, {
            module: CC_FILE,
            method: METHODS.CONNECT_WEBSOCKET,
          });
          // TODO: Make profile a singleton to make it available throughout app/sdk so we dont need to inject info everywhere
          this.taskManager.setWrapupData(this.agentConfig.wrapUpData);
          this.taskManager.setAgentId(this.agentConfig.agentId);

          if (
            this.agentConfig.webRtcEnabled &&
            this.agentConfig.loginVoiceOptions.includes(LoginOption.BROWSER)
          ) {
            this.$webex.internal.mercury
              .connect()
              .then(() => {
                LoggerProxy.log('Authentication: webex.internal.mercury.connect successful', {
                  module: CC_FILE,
                  method: METHODS.CONNECT_WEBSOCKET,
                });
              })
              .catch((error) => {
                LoggerProxy.error(`Error occurred during mercury.connect() ${error}`, {
                  module: CC_FILE,
                  method: METHODS.CONNECT_WEBSOCKET,
                });
              });
          }
          if (this.$config && this.$config.allowAutomatedRelogin) {
            await this.silentRelogin();
          }

          return this.agentConfig;
        })
        .catch((error) => {
          throw error;
        });
    } catch (error) {
      LoggerProxy.error(`Error during register: ${error}`, {
        module: CC_FILE,
        method: METHODS.CONNECT_WEBSOCKET,
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
    LoggerProxy.info('Starting agent station login', {
      module: CC_FILE,
      method: METHODS.STATION_LOGIN,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
        METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
      ]);

      if (data.loginOption === LoginOption.AGENT_DN && !isValidDialNumber(data.dialNumber)) {
        const error = new Error('INVALID_DIAL_NUMBER');
        // @ts-ignore - adding custom key to the error object
        error.details = {data: {reason: 'INVALID_DIAL_NUMBER'}} as Failure;

        throw error;
      }

      const loginResponse = this.services.agent.stationLogin({
        data: {
          dialNumber:
            data.loginOption === LoginOption.BROWSER ? this.agentConfig.agentId : data.dialNumber,
          teamId: data.teamId,
          deviceType: data.loginOption,
          isExtension: data.loginOption === LoginOption.EXTENSION,
          deviceId: this.getDeviceId(data.loginOption, data.dialNumber),
          roles: [AGENT],
          teamName: EMPTY_STRING,
          siteId: EMPTY_STRING,
          usesOtherDN: false,
          auxCodeId: EMPTY_STRING,
        },
      });

      if (this.agentConfig.webRtcEnabled && data.loginOption === LoginOption.BROWSER) {
        await this.webCallingService.registerWebCallingLine();
      }

      const resp = await loginResponse;
      const {channelsMap, ...loginData} = resp.data;
      this.agentConfig.currentTeamId = resp.data.teamId;
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

      this.webCallingService.setLoginOption(data.loginOption);
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

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          logoutReason: data.logoutReason,
        },
        ['behavioral', 'business', 'operational']
      );

      if (this.webCallingService) {
        this.webCallingService.deregisterWebCallingLine();
      }

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
          logoutReason: data.logoutReason,
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
    LoggerProxy.info('Setting agent state', {
      module: CC_FILE,
      method: METHODS.SET_AGENT_STATE,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
      ]);
      const agentStatusResponse = await this.services.agent.stateChange({
        data: {...data, agentId: data.agentId || this.agentConfig.agentId},
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(agentStatusResponse),
          requestedState: data.state,
          teamId: this.agentConfig?.teams[0]?.teamId ?? EMPTY_STRING,
          status: agentStatusResponse.data?.status,
          subStatus: agentStatusResponse.data?.subStatus,
          auxCodeId: data.auxCodeId,
          lastStateChangeReason: data.lastStateChangeReason || EMPTY_STRING,
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
          lastStateChangeReason: data.lastStateChangeReason || EMPTY_STRING,
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.SET_AGENT_STATE, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Processes incoming websocket messages and emits corresponding events
   * Handles various event types including agent state changes, login events,
   * and other agent-related notifications
   * @private
   * @param {string} event The raw websocket event message
   */
  private handleWebsocketMessage = (event: string) => {
    const eventData = JSON.parse(event);
    // Re-emit all the events related to agent except keep-alives
    if (!eventData.keepalive && eventData.data && eventData.data.type) {
      // @ts-ignore
      this.emit(eventData.data.type, eventData.data);
    }

    if (!eventData.type) {
      return;
    }

    LoggerProxy.log(`Received event: ${eventData?.data?.type ?? eventData.type}`, {
      module: CC_FILE,
      method: METHODS.HANDLE_WEBSOCKET_MESSAGE,
    });

    // Emit metrics for all websocket events except keepalive and welcome
    const topLevelType = eventData.type;
    const nestedType = eventData?.data?.type;
    if (topLevelType !== CC_EVENTS.WELCOME && eventData.keepalive !== 'true') {
      const metricsPayload: Record<string, any> = {
        ws_event_type: nestedType || topLevelType,
        top_level_type: topLevelType,
        has_data: Boolean(eventData.data),
      };
      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.WEBSOCKET_EVENT_RECEIVED, metricsPayload, [
        'operational',
      ]);
    }

    switch (eventData.type) {
      case CC_EVENTS.AGENT_MULTI_LOGIN:
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
        const stationLoginData = {
          ...loginData,
          mmProfile: {
            chat: channelsMap.chat?.length,
            email: channelsMap.email?.length,
            social: channelsMap.social?.length,
            telephony: channelsMap.telephony?.length,
          },
          notifsTrackingId: eventData.trackingId,
        };
        this.webCallingService.setLoginOption(loginData.deviceType as LoginOption);
        // @ts-ignore
        this.emit(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, stationLoginData);
        break;
      }
      case CC_EVENTS.AGENT_RELOGIN_SUCCESS:
        {
          const {channelsMap, ...loginData} = eventData.data;
          const stationReLoginData = {
            ...loginData,
            mmProfile: {
              chat: channelsMap.chat?.length,
              email: channelsMap.email?.length,
              social: channelsMap.social?.length,
              telephony: channelsMap.telephony?.length,
            },
            notifsTrackingId: eventData.trackingId,
          };
          // @ts-ignore
          this.emit(AGENT_EVENTS.AGENT_RELOGIN_SUCCESS, stationReLoginData);
        }
        break;
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
   * Initializes event listeners for the Contact Center service
   * Sets up handlers for connection state changes and other core events
   * @private
   */
  private setupEventListeners() {
    this.services.connectionService.on('connectionLost', this.handleConnectionLost.bind(this));
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
  private async handleConnectionLost(msg: ConnectionLostDetails): Promise<void> {
    if (msg.isConnectionLost) {
      // TODO: Emit an event saying connection is lost
      LoggerProxy.info('event=handleConnectionLost | Connection lost', {
        module: CC_FILE,
        method: METHODS.HANDLE_CONNECTION_LOST,
      });
    } else if (msg.isSocketReconnected) {
      // TODO: Emit an event saying connection is re-estabilished
      LoggerProxy.info(
        'event=handleConnectionReconnect | Connection reconnected attempting to request silent relogin',
        {module: CC_FILE, method: METHODS.HANDLE_CONNECTION_LOST}
      );
      if (this.$config && this.$config.allowAutomatedRelogin) {
        await this.silentRelogin();
      }
    }
  }

  /**
   * Handles silent relogin after registration completion
   * @private
   */
  private async silentRelogin(): Promise<void> {
    LoggerProxy.info('Starting silent relogin process', {
      module: CC_FILE,
      method: METHODS.SILENT_RELOGIN,
    });

    try {
      const reLoginResponse = await this.services.agent.reload();
      const {
        agentId,
        lastStateChangeReason,
        deviceType,
        dn,
        lastStateChangeTimestamp,
        lastIdleCodeChangeTimestamp,
      } = reLoginResponse.data;
      let {auxCodeId} = reLoginResponse.data;
      this.agentConfig.lastStateChangeTimestamp = lastStateChangeTimestamp;
      this.agentConfig.lastIdleCodeChangeTimestamp = lastIdleCodeChangeTimestamp;
      this.agentConfig.currentTeamId = reLoginResponse.data.teamId;
      await this.handleDeviceType(deviceType as LoginOption, dn);

      if (lastStateChangeReason === 'agent-wss-disconnect') {
        LoggerProxy.info(
          'event=requestAutoStateChange | Requesting state change to available on socket reconnect',
          {module: CC_FILE, method: METHODS.SILENT_RELOGIN}
        );
        auxCodeId = AGENT_STATE_AVAILABLE_ID;
        const stateChangeData: StateChange = {
          state: AGENT_STATE_AVAILABLE,
          auxCodeId,
          lastStateChangeReason,
          agentId,
        };
        try {
          const agentStatusResponse = (await this.setAgentState(
            stateChangeData
          )) as StateChangeSuccess;
          this.agentConfig.lastStateChangeTimestamp =
            agentStatusResponse.data.lastStateChangeTimestamp;

          this.agentConfig.lastIdleCodeChangeTimestamp =
            agentStatusResponse.data.lastIdleCodeChangeTimestamp;
        } catch (error) {
          LoggerProxy.error(
            `event=requestAutoStateChange | Error requesting state change to available on socket reconnect: ${error}`,
            {module: CC_FILE, method: METHODS.SILENT_RELOGIN}
          );
        }
      }
      this.agentConfig.lastStateAuxCodeId = auxCodeId;
      this.agentConfig.isAgentLoggedIn = true;
      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      this.services.webSocketManager.on('message', this.handleWebsocketMessage);

      LoggerProxy.log(
        `Silent relogin process completed successfully with login Option: ${reLoginResponse.data.deviceType} teamId: ${reLoginResponse.data.teamId}`,
        {
          module: CC_FILE,
          method: METHODS.SILENT_RELOGIN,
          trackingId: reLoginResponse.trackingId,
        }
      );
    } catch (error) {
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
      throw detailedError;
    }
  }

  /**
   * Handles device type specific configuration and setup
   * Configures services and settings based on the login device type
   * @param {LoginOption} deviceType The type of device being used for login
   * @param {string} dn The dial number associated with the device
   * @returns {Promise<void>}
   * @private
   */
  private async handleDeviceType(deviceType: LoginOption, dn: string): Promise<void> {
    this.webCallingService.setLoginOption(deviceType);
    this.agentConfig.deviceType = deviceType;
    switch (deviceType) {
      case LoginOption.BROWSER:
        try {
          await this.webCallingService.registerWebCallingLine();
        } catch (error) {
          LoggerProxy.error(`Error registering web calling line: ${error}`, {
            module: CC_FILE,
            method: METHODS.HANDLE_DEVICE_TYPE,
          });
          throw error;
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
   *   const task = await cc.startOutdial(destination);
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
  public async startOutdial(destination: string): Promise<TaskResponse> {
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
          mediaType: OUTDIAL_MEDIA_TYPE,
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.START_OUTDIAL, CC_FILE);
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
      // Only block if both loginOption AND teamId remain unchanged
      if (
        this.webCallingService?.loginOption === data.loginOption &&
        data.teamId === this.agentConfig.currentTeamId
      ) {
        const message =
          'Will not proceed with device update as new Device type is same as current device type and teamId is same as current teamId';
        const err = new Error(message) as GenericError;
        err.details = {
          type: 'Identical Device Change Failure',
          orgId: this.$webex.credentials.getOrgId(),
          trackingId,
          data: {
            agentId: this.agentConfig.agentId,
            reasonCode: 'R002',
            reason: message,
          },
        };
        throw err;
      }

      await this.stationLogout({
        logoutReason: 'User requested agent device change',
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
   * Returns paginated entry points for the organization.
   * Thin wrapper around internal EntryPoint instance.
   * @public
   */
  public async getEntryPoints(
    params: EntryPointSearchParams = {}
  ): Promise<EntryPointListResponse> {
    return this.entryPoint.getEntryPoints(params);
  }

  /**
   * Returns paginated contact service queues for the organization.
   * Thin wrapper around internal Queue instance.
   * @public
   */
  public async getQueues(
    params: ContactServiceQueueSearchParams = {}
  ): Promise<ContactServiceQueuesResponse> {
    return this.queue.getQueues(params);
  }
}
