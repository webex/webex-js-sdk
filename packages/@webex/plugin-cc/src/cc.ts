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
import {getErrorDetails} from './services/core/Utils';
import {Profile, WelcomeEvent, CC_EVENTS, ContactServiceQueue} from './services/config/types';
import {
  AGENT_STATE_AVAILABLE,
  AGENT_STATE_AVAILABLE_ID,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} from './services/config/constants';
import {ConnectionLostDetails} from './services/core/websocket/types';
import TaskManager from './services/task/TaskManager';
import WebCallingService from './services/WebCallingService';
import {ITask, TASK_EVENTS, TaskResponse, DialerPayload} from './services/task/types';
import MetricsManager from './metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from './metrics/constants';
import {Failure} from './services/core/GlobalTypes';

/**
 * @class ContactCenter
 * @extends WebexPlugin
 * @implements IContactCenter
 * @description
 Contact Center Plugin main class which provides functionality for agent management
 * in Webex Contact Center. This includes capabilities for:
 * - Agent login/logout
 * - State management
 * - Task handling
 * - Call Controls
 *     - Mute/Unmute Call
 *     - Hold/Resume Call
 *     - Pause/Resume Call Recording
 *     - Transfer Task
 *     - Consult & Transfer Call
 * - Outdial
 *
 * @example
 * ```typescript
 * const cc = webex.cc;
 * await cc.register();
 * await cc.stationLogin({ teamId: 'team123', loginOption: 'AGENT_DN', dialNumber: '+1234567890' });
 * await cc.setAgentState({ state: 'Available' });
 * ```
 *
 * @public
 */
export default class ContactCenter extends WebexPlugin implements IContactCenter {
  /** Plugin namespace identifier */
  namespace = 'cc';

  /** Plugin configuration */
  private $config: CCPluginConfig;

  /** Reference to the Webex SDK instance */
  private $webex: WebexSDK;

  /** Event emitter for handling plugin events */
  private eventEmitter: EventEmitter;

  /** Agent configuration and profile information */
  private agentConfig: Profile;

  /** Service for handling web-based calling functionality */
  private webCallingService: WebCallingService;

  /** Core services for Contact Center operations */
  private services: Services;

  /** Service for handling Webex API requests */
  private webexRequest: WebexRequest;

  /** Manager for handling contact center tasks */
  private taskManager: TaskManager;

  /** Manager for handling metrics and analytics */
  private metricsManager: MetricsManager;

  /** Logger for the Contact Center plugin */
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
   * Initializes the Contact Center SDK by setting up the web socket connections
   * @returns {Promise<Profile>} Agent profile information after successful registration
   * @throws {Error} If registration fails
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * // After registration, you can perform operations like login, state change, etc.
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
   * Unregisters the Contact Center SDK by closing all the web socket connections and removing event listeners
   * @remarks
   * This method does not do a station signout.
   * @returns {Promise<void>} Resolves when deregistration is complete
   * @throws {Error} If deregistration fails
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * // Perform operations like login, state change, etc.
   * await cc.deregister();
   * ```
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
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   * await cc.getBuddyAgents({state: 'Available', mediaType: 'telephony'});
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
   * await cc.stationLogin({
   *  teamId: 'team123',
   *  loginOption: 'EXTENSION',
   *  dialNumber: '1002'
   * });
   * // After successful login, you can perform operations like state change, task handling, etc.
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
      const {error: detailedError} = getErrorDetails(error, METHODS.STATION_LOGIN, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Performs a station logout operation for the agent
   * @remarks
   * A logout operation cannot happen if the agent is in an interaction or haven't logged in yet.
   * @param {Logout} data Logout parameters
   * @returns {Promise<StationLogoutResponse>} Response indicating logout status
   * @throws {Error} If logout fails
   * @public
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
   * Sets the state of the agent to Available or any of the Idle states
   * @param {StateChange} data State change parameters including the new state
   * @returns {Promise<SetStateResponse>} Response with updated state information
   * @throws {Error} If state change fails
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   * await cc.setAgentState({
   *    state: 'Available',
   *    auxCodeId: '12345',
   *    lastStateChangeReason: 'Manual state change',
   *    agentId: 'agent123',
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

    LoggerProxy.log(`Received event: ${eventData.type}`, {
      module: CC_FILE,
      method: METHODS.HANDLE_WEBSOCKET_MESSAGE,
    });

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
   * This is used for making the outdial call.
   * @param destination - The destination number to dial
   * @returns Promise<TaskResponse> Resolves with the outdial task response
   * @throws Error If the outdial operation fails
   * @public
   * @example
   * ```typescript
   * const destination = '+1234567890';
   * const cc = webex.cc;
   * await cc.register();
   * const task = await cc.startOutdial(destination);
   * // Can do task operations like accept, reject, etc.
   * ```
   * Refer to {@link ITask | ITask interface} for more details.
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
   * This is used for getting the list of queues to which a task can be consulted or transferred.
   * @param search - optional search string
   * @param filter - optional filter string
   * @param page - page number (default is 0)
   * @param pageSize - number of items per page (default is 100)
   * @returns Promise<ContactServiceQueue[]> Resolves with the list of queues
   * @throws Error If the operation fails
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   * const queues = await cc.getQueues();
   * ```
   */
  public async getQueues(
    search?: string,
    filter?: string,
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE
  ): Promise<ContactServiceQueue[]> {
    LoggerProxy.info('Fetching queues', {
      module: CC_FILE,
      method: METHODS.GET_QUEUES,
    });

    const orgId = this.$webex.credentials.getOrgId();

    if (!orgId) {
      LoggerProxy.error('Org ID not found.', {
        module: CC_FILE,
        method: METHODS.GET_QUEUES,
      });

      throw new Error('Org ID not found.');
    }

    const result = await this.services.config.getQueues(orgId, page, pageSize, search, filter);

    LoggerProxy.log(`Successfully retrieved ${result?.length} queues`, {
      module: CC_FILE,
      method: METHODS.GET_QUEUES,
    });

    return result;
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
   *    await cc.register();
   * }
   * catch (error) {
   *    console.error('Error during registration:', error);
   *    cc.uploadLogs();
   * }
   * ```
   */
  public async uploadLogs(): Promise<UploadLogsResponse> {
    return this.webexRequest.uploadLogs();
  }

  /**
   * Updates the agent device type.
   * This method allows the agent to change their device type (e.g., from BROWSER to EXTENSION or anything else).
   * It will also throw an error if the new device type is the same as the current one.
   * @param data type is AgentDeviceUpdate - The data required to update the agent device type, including the new login option and dial number.
   * @returns Promise<UpdateDeviceTypeResponse> Resolves with the device type update response
   * @throws Error If the update fails
   * @example
   * ```typescript
   * const data = {
   *   loginOption: 'EXTENSION',
   *   dialNumber: '1234567890',
   *   teamId: 'team-id-if-needed', // Optional, if not provided, current team ID will be used
   * };
   * const result = await webex.cc.updateAgentProfile(data);
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   * await cc.updateAgentDeviceType(data);
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
}
