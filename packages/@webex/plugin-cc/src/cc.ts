import {WebexPlugin} from '@webex/webex-core';
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
import {READY, CC_FILE, EMPTY_STRING} from './constants';
import WebCallingService from './services/WebCallingService';
import {AGENT, WEB_RTC_PREFIX} from './services/constants';
import Services from './services';
import HttpRequest from './services/core/HttpRequest';
import LoggerProxy from './logger-proxy';
import {StateChange, Logout} from './services/agent/types';
import {getErrorDetails} from './services/core/Utils';
import {Profile, WelcomeEvent} from './services/config/types';
import {AGENT_STATE_AVAILABLE} from './services/config/constants';
import {ConnectionLostDetails} from './services/core/WebSocket/types';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  private $config: CCPluginConfig;
  private $webex: WebexSDK;
  private agentConfig: Profile;
  private webCallingService: WebCallingService;
  private services: Services;
  private httpRequest: HttpRequest;

  constructor(...args) {
    super(...args);

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

      this.webCallingService = new WebCallingService(this.$webex, this.$config.callingClientConfig);

      LoggerProxy.initialize(this.$webex.logger);
    });
  }

  /**
   * This is used for making the CC SDK ready by setting up the cc mercury connection.
   */
  public async register(): Promise<Profile> {
    try {
      this.setupEventListeners();

      return await this.connectWebsocket();
    } catch (error) {
      this.$webex.logger.error(`file: ${CC_FILE}: Error during register: ${error}`);

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
      const {error: detailedError} = getErrorDetails(error, 'getBuddyAgents');
      throw detailedError;
    }
  }

  /**
   * This is used for connecting the websocket and fetching the agent profile.
   * @returns Promise<IAgentProfile>
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
          this.$webex.logger.log(`file: ${CC_FILE}: agent config is fetched successfully`);
          if (this.$config && this.$config.allowAutomatedRelogin) {
            await this.silentRelogin();
          }

          return this.agentConfig;
        })
        .catch((error) => {
          throw error;
        });
    } catch (error) {
      this.$webex.logger.error(`file: ${CC_FILE}: Error during register: ${error}`);

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

      await loginResponse;

      return loginResponse;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'stationLogin');
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

      return logoutResponse;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'stationLogout');
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
      const {error: detailedError} = getErrorDetails(error, 'stationReLogin');
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

      this.$webex.logger.log(`file: ${CC_FILE}: SET AGENT STATUS API SUCCESS`);

      return agentStatusResponse;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'setAgentState');
      throw detailedError;
    }
  }

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
   * Called when we reconnection has been completed
   */
  private async handleConnectionLost(msg: ConnectionLostDetails): Promise<void> {
    if (msg.isConnectionLost) {
      // TODO: Emit an event saying connection is lost
      this.$webex.logger.info('event=handleConnectionLost | Connection lost');
    } else if (msg.isSocketReconnected) {
      // TODO: Emit an event saying connection is re-estabilished
      this.$webex.logger.info(
        'event=handleConnectionReconnect | Connection reconnected attempting to request silent relogin'
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
      const {auxCodeId, agentId, lastStateChangeReason} = reLoginResponse.data;

      if (lastStateChangeReason === 'agent-wss-disconnect') {
        this.$webex.logger.info(
          'event=requestAutoStateChange | Requesting state change to available on socket reconnect'
        );
        const stateChangeData: StateChange = {
          state: AGENT_STATE_AVAILABLE,
          auxCodeId,
          lastStateChangeReason,
          agentId,
        };
        await this.setAgentState(stateChangeData);
      }
      // Updating isAgentLoggedIn as true to indicate to the end user
      this.agentConfig.isAgentLoggedIn = true;
    } catch (error) {
      const {reason, error: detailedError} = getErrorDetails(error, 'silentReLogin');
      if (reason === 'AGENT_NOT_FOUND') {
        this.$webex.logger.info('Agent not found during re-login, handling silently');

        return;
      }
      throw detailedError;
    }
  }
}
