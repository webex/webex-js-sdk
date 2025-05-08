import {WebexPlugin} from '@webex/webex-core';
import EventEmitter from 'events';
import {
  SetStateResponse,
  CCPluginConfig,
  IContactCenter,
  WebexSDK,
  LoginOption,
  AgentLogin,
  StationLoginResponse,
  StationLogoutResponse,
  StationReLoginResponse,
  BuddyAgentsResponse,
  BuddyAgents,
  SubscribeRequest,
  UploadLogsResponse,
} from './types';
import {
  READY,
  CC_FILE,
  EMPTY_STRING,
  AGENT_STATE_CHANGE,
  AGENT_MULTI_LOGIN,
  OUTDIAL_DIRECTION,
  ATTRIBUTES,
  OUTDIAL_MEDIA_TYPE,
  OUTBOUND_TYPE,
  UNKNOWN_ERROR,
  MERCURY_DISCONNECTED_SUCCESS,
} from './constants';
import {AGENT, WEB_RTC_PREFIX} from './services/constants';
import Services from './services';
import WebexRequest from './services/core/WebexRequest';
import LoggerProxy from './logger-proxy';
import {StateChange, Logout, StateChangeSuccess} from './services/agent/types';
import {getErrorDetails} from './services/core/Utils';
import {
  Profile,
  WelcomeEvent,
  CC_EVENTS,
  CC_AGENT_EVENTS,
  ContactServiceQueue,
} from './services/config/types';
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
      this.services.webSocketManager.on('message', this.handleWebSocketMessage);

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
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
      ]);
      this.setupEventListeners();

      const resp = await this.connectWebsocket();
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
          deviceType: resp.deviceType || EMPTY_STRING,
        },
        ['operational']
      );

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
        method: this.register.name,
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

      this.services.webSocketManager.off('message', this.handleWebSocketMessage);
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
            method: 'deregister',
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
        method: 'deregister',
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
        method: 'deregister',
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
      const {error: detailedError} = getErrorDetails(error, 'getBuddyAgents', CC_FILE);
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
            method: this.connectWebsocket.name,
          });

          if (
            this.agentConfig.webRtcEnabled &&
            this.agentConfig.loginVoiceOptions.includes(LoginOption.BROWSER)
          ) {
            this.$webex.internal.mercury
              .connect()
              .then(() => {
                LoggerProxy.info('Authentication: webex.internal.mercury.connect successful', {
                  module: CC_FILE,
                  method: this.connectWebsocket.name,
                });
              })
              .catch((error) => {
                LoggerProxy.error(`Error occurred during mercury.connect() ${error}`, {
                  module: CC_FILE,
                  method: this.connectWebsocket.name,
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
        method: this.connectWebsocket.name,
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
      const {error: detailedError} = getErrorDetails(error, 'stationLogin', CC_FILE);
      throw detailedError;
    }
  }

  /** This is used for agent logout.
   * @param data
   * @returns Promise<StationLogoutResponse>
   * @throws Error
   */
  public async stationLogout(data: Logout): Promise<StationLogoutResponse> {
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
      const {error: detailedError} = getErrorDetails(error, 'stationLogout', CC_FILE);
      throw detailedError;
    }
  }

  /* This is used for agent relogin.
   * @returns Promise<StationReLoginResponse>
   * @throws Error
   */
  public async stationReLogin(): Promise<StationReLoginResponse> {
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
      const {error: detailedError} = getErrorDetails(error, 'stationReLogin', CC_FILE);
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

      LoggerProxy.log(`SET AGENT STATUS API SUCCESS`, {
        module: CC_FILE,
        method: this.setAgentState.name,
      });

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
      const {error: detailedError} = getErrorDetails(error, 'setAgentState', CC_FILE);
      throw detailedError;
    }
  }

  private handleWebSocketMessage = (event: string) => {
    const eventData = JSON.parse(event);
    // Re-emit the events related to agent
    if (Object.values(CC_AGENT_EVENTS).includes(eventData.data?.type)) {
      // @ts-ignore
      this.emit(eventData.data.type, eventData.data);
    }

    if (eventData.type === CC_EVENTS.AGENT_STATE_CHANGE) {
      // @ts-ignore
      this.emit(AGENT_STATE_CHANGE, eventData.data);
    }

    if (eventData.type === CC_EVENTS.AGENT_MULTI_LOGIN) {
      // @ts-ignore
      this.emit(AGENT_MULTI_LOGIN, eventData.data);
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
        method: this.handleConnectionLost.name,
      });
    } else if (msg.isSocketReconnected) {
      // TODO: Emit an event saying connection is re-estabilished
      LoggerProxy.info(
        'event=handleConnectionReconnect | Connection reconnected attempting to request silent relogin',
        {module: CC_FILE, method: this.handleConnectionLost.name}
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
      await this.handleDeviceType(deviceType as LoginOption, dn);

      if (lastStateChangeReason === 'agent-wss-disconnect') {
        LoggerProxy.info(
          'event=requestAutoStateChange | Requesting state change to available on socket reconnect',
          {module: CC_FILE, method: this.silentRelogin.name}
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
            {module: CC_FILE, method: this.silentRelogin.name}
          );
        }
      }
      this.agentConfig.lastStateAuxCodeId = auxCodeId;
      this.agentConfig.isAgentLoggedIn = true;
      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      this.services.webSocketManager.on('message', this.handleWebSocketMessage);
    } catch (error) {
      const {reason, error: detailedError} = getErrorDetails(error, 'silentReLogin', CC_FILE);
      if (reason === 'AGENT_NOT_FOUND') {
        LoggerProxy.log('Agent not found during re-login, handling silently', {
          module: CC_FILE,
          method: 'silentRelogin',
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
        await this.webCallingService.registerWebCallingLine();
        break;
      case LoginOption.AGENT_DN:
      case LoginOption.EXTENSION:
        this.agentConfig.defaultDn = dn;
        break;
      default:
        LoggerProxy.error(`Unsupported device type: ${deviceType}`, {
          module: CC_FILE,
          method: this.handleDeviceType.name,
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
      const {error: detailedError} = getErrorDetails(error, 'startOutdial', CC_FILE);
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
    const orgId = this.$webex.credentials.getOrgId();

    if (!orgId) {
      LoggerProxy.error('Org ID not found.', {
        module: CC_FILE,
        method: this.getQueues.name,
      });

      throw new Error('Org ID not found.');
    }

    return this.services.config.getQueues(orgId, page, pageSize, search, filter);
  }

  /**
   * Uploads logs to help troubleshoot SDK issues.
   *
   * This method collects the current SDK logs including network requests, WebSocket
   * messages, and client-side events, then securely submits them to Webex's diagnostics
   * service. The returned tracking ID, feedbackID can be provided to Webex support for faster
   * issue resolution.
   * @returns Promise<SubmitLogsResponse>
   * @throws Error
   */
  public async uploadLogs(): Promise<UploadLogsResponse> {
    return this.webexRequest.uploadLogs();
  }
}
