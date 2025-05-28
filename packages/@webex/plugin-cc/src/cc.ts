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
  StationReLoginResponse,
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

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  private $config: CCPluginConfig;
  private $webex: WebexSDK;
  private eventEmitter: EventEmitter;
  private agentConfig: Profile;
  private webCallingService: WebCallingService;
  private services: Services;
  private webexRequest: WebexRequest;
  private taskManager: TaskManager;
  private metricsManager: MetricsManager;
  public LoggerProxy = LoggerProxy;

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

  private handleIncomingTask = (task: ITask) => {
    // @ts-ignore
    this.trigger(TASK_EVENTS.TASK_INCOMING, task);
  };

  private handleTaskHydrate = (task: ITask) => {
    // @ts-ignore
    this.trigger(TASK_EVENTS.TASK_HYDRATE, task);
  };

  /**
   * An Incoming Call listener.
   */
  private incomingTaskListener() {
    this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
    this.taskManager.on(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
  }

  /**
   * This is used for making the CC SDK ready by setting up the cc mercury connection.
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
   * This is used to unregister the CC SDK and clean up all resources.
   * @returns Promise<void>
   * @throws Error
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
   * Returns the list of buddy agents in the given state and media according to agent profile settings
   *
   * @param {BuddyAgents} data - The data required to fetch buddy agents, including additional agent profile information.
   * @returns {Promise<BuddyAgentsResponse>} A promise that resolves to the response containing buddy agents information.
   * @throws Error
   * @example getBuddyAgents({state: 'Available', mediaType: 'telephony'})
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
   * This is used for connecting the websocket and fetching the agent profile.
   * @returns Promise<Profile>
   * @throws Error
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
   * This is used for agent login.
   * @param data
   * @returns Promise<StationLoginResponse>
   * @throws Error
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
          // TODO: The public API should not have the following properties so filling them with empty values for now. If needed, we can add them in the future.
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
          status: resp.data.status, // 'LoggedIn'
          type: resp.data.type, // 'AgentStationLoginSuccess'
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

  /** This is used for agent logout.
   * @param data
   * @returns Promise<StationLogoutResponse>
   * @throws Error
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

  /* This is used for agent relogin.
   * @returns Promise<StationReLoginResponse>
   * @throws Error
   */
  public async stationReLogin(): Promise<StationReLoginResponse> {
    LoggerProxy.info('Starting agent station relogin', {
      module: CC_FILE,
      method: METHODS.STATION_RELOGIN,
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS,
        METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED,
      ]);
      const reLoginResponse = await this.services.agent.reload();
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(reLoginResponse),
        },
        ['behavioral', 'business', 'operational']
      );

      LoggerProxy.log(
        `Agent station relogin completed successfully agentID: ${reLoginResponse.data?.agentId} teamId: ${reLoginResponse.data?.teamId}`,
        {
          module: CC_FILE,
          method: METHODS.STATION_RELOGIN,
          trackingId: reLoginResponse.trackingId,
        }
      );

      return reLoginResponse;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
        },
        ['behavioral', 'business', 'operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.STATION_RELOGIN, CC_FILE);
      throw detailedError;
    }
  }

  private getDeviceId(loginOption: string, dialNumber: string): string {
    if (loginOption === LoginOption.EXTENSION || loginOption === LoginOption.AGENT_DN) {
      return dialNumber;
    }

    return WEB_RTC_PREFIX + this.agentConfig.agentId;
  }

  /**
   * This is used for setting agent state.
   * @param options
   * @returns Promise<SetStateResponse>
   * @throws Error
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
   * For setting up the Event Emitter listeners and handlers
   */
  private setupEventListeners() {
    this.services.connectionService.on('connectionLost', this.handleConnectionLost.bind(this));
  }

  /**
   * This method returns the connection configuration.
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
   * Called when the reconnection has been completed
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
   * Called when we finish registration to silently handle the errors
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
   * Handles the device type specific logic
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
   * @param destination
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const destination = '1234567890';
   * const result = await webex.cc.startOutdial(destination).then(()=>{}).catch(()=>{});
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
   * This is used for getting the list of queues.
   * @param search - optional
   * @param filter - optional
   * @param page - default is 0
   * @param pageSize - default is 100
   * @returns Promise<ContactServiceQueue[]>
   * @throws Error
   *
   * @example
   * ```typescript
   * const search = 'queue';
   * const filter = 'id == "e23ad456-1ebd-1b43-b9d0-34f39c7dcb5e"';
   * const page = 0;
   * const pageSize = 100;
   * const result = await webex.cc.getQueues(search, filter, page, pageSize);
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
   * @returns Promise<UploadLogsResponse>
   * @throws Error
   */
  public async uploadLogs(): Promise<UploadLogsResponse> {
    return this.webexRequest.uploadLogs();
  }

  /**
   * Updates the agent device type.
   * This method allows the agent to change their device type (e.g., from BROWSER to EXTENSION or anything else).
   * It will also throw an error if the new device type is the same as the current one.
   * @param data type is AgentProfileUpdate - The data required to update the agent device type, including the login option, team id and dial number.
   * @returns Promise<UpdateDeviceTypeResponse>
   * @throws Error
   * @example
   * ```typescript
   * const data = {
   *   loginOption: 'EXTENSION',
   *   dialNumber: '1234567890',
   *   teamId: 'team-id-if-needed', // Optional, if not provided, current team ID will be used
   * };
   * const result = await webex.cc.updateAgentProfile(data);
   * ```
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
