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
} from './types';
import {READY, CC_FILE, EMPTY_STRING, AGENT_STATE_CHANGE, AGENT_MULTI_LOGIN} from './constants';
import {AGENT, WEB_RTC_PREFIX} from './services/constants';
import Services from './services';
import HttpRequest from './services/core/HttpRequest';
import LoggerProxy from './logger-proxy';
import {StateChange, Logout, StateChangeSuccess} from './services/agent/types';
import {getErrorDetails} from './services/core/Utils';
import {Profile, WelcomeEvent, CC_EVENTS, CC_AGENT_EVENTS} from './services/config/types';
import {AGENT_STATE_AVAILABLE, AGENT_STATE_AVAILABLE_ID} from './services/config/constants';
import {ConnectionLostDetails} from './services/core/websocket/types';
import TaskManager from './services/task/TaskManager';
import WebCallingService from './services/WebCallingService';
import {ITask, TASK_EVENTS, DialerPayload, TaskResponse} from './services/task/types';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  private $config: CCPluginConfig;
  private $webex: WebexSDK;
  private eventEmitter: EventEmitter;
  private agentConfig: Profile;
  private webCallingService: WebCallingService;
  private services: Services;
  private httpRequest: HttpRequest;
  private taskManager: TaskManager;
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
      this.httpRequest = HttpRequest.getInstance({
        webex: this.$webex,
      });

      this.services = Services.getInstance({
        webex: this.$webex,
        connectionConfig: this.getConnectionConfig(),
      });
      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      this.services.webSocketManager.on('message', this.handleWebSocketMessage);

      this.webCallingService = new WebCallingService(this.$webex);
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
      this.setupEventListeners();

      return await this.connectWebsocket();
    } catch (error) {
      LoggerProxy.error(`Error during register: ${error}`, {
        module: CC_FILE,
        method: this.register.name,
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
      return await this.services.agent.buddyAgents({
        data: {agentProfileId: this.agentConfig.agentProfileID, ...data},
      });
    } catch (error) {
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
          LoggerProxy.log(`agent config is fetched successfully`, {
            module: CC_FILE,
            method: this.connectWebsocket.name,
          });
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

      if (data.loginOption === LoginOption.BROWSER) {
        await this.webCallingService.registerWebCallingLine();
      }

      this.webCallingService.setLoginOption(data.loginOption);

      await loginResponse;

      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      // this.services.webSocketManager.on('message', this.handleWebSocketMessage);
      // this.incomingTaskListener();

      return loginResponse;
    } catch (error) {
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
      const logoutResponse = this.services.agent.logout({
        data,
      });

      await logoutResponse;

      if (this.webCallingService) {
        this.webCallingService.deregisterWebCallingLine();
      }

      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      // this.services.webSocketManager.off('message', this.handleWebSocketMessage);
      // this.taskManager.unregisterIncomingCallEvent();
      // this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
      // this.taskManager.off(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);

      return logoutResponse;
    } catch (error) {
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
      const reLoginResponse = await this.services.agent.reload();

      return reLoginResponse;
    } catch (error) {
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
      const agentStatusResponse = await this.services.agent.stateChange({
        data: {...data, agentId: data.agentId || this.agentConfig.agentId},
      });

      LoggerProxy.log(`SET AGENT STATUS API SUCCESS`, {
        module: CC_FILE,
        method: this.setAgentState.name,
      });

      return agentStatusResponse;
    } catch (error) {
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

      // To handle re-registration of event listeners on silent relogin
      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      // this.incomingTaskListener();

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
      await this.handleDeviceType(deviceType as LoginOption, dn);
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
    this.webCallingService.setLoginOption(deviceType);
    this.agentConfig.deviceType = deviceType;
  }

  /**
   * This is used for making the outdial call.
   * @param outDialPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const outDialPayload = {
   *  entryPointId: entryPointId,
      destination: destination,
      direction: 'OUTBOUND',
      attributes: {},
      mediaType: 'telephony',
      outboundType: 'OUTDIAL',
   * }
   * const result = await webex.cc.startOutdial(outDialPayload).then(()=>{}).catch(()=>{});
   * ```
   */

  public async startOutdial(outDialPayload: DialerPayload): Promise<TaskResponse> {
    try {
      const result = await this.services.dialer.startOutdial({data: outDialPayload});

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'startOutdial', CC_FILE);
      throw detailedError;
    }
  }
}
