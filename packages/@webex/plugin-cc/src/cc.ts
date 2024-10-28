/* eslint-disable no-console */
import {WebexPlugin} from '@webex/webex-core';
import AgentConfig from './features/Agentconfig';
import {IAgentProfile} from './features/types';
import {
  CCPluginConfig,
  IContactCenter,
  WebexSDK,
  SubscribeRequest,
  WelcomeEvent,
  STATION_LOGIN_TYPE,
} from './types';
import {READY, CC_FILE} from './constants';
import Agent from './features/Agent';
import HttpRequest from './services/HttpRequest';
import WebRTCCalling from './WebRTCCalling';
import {LogoutSuccess, StationLoginSuccess} from './services/types';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  private $config: CCPluginConfig;
  private $webex: WebexSDK;
  private agentConfig: IAgentProfile;
  private registered = false;
  private httpRequest: HttpRequest;
  private agent: Agent;
  private webRTCCalling: WebRTCCalling;

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
      this.httpRequest = new HttpRequest({
        webex: this.$webex,
      });

      this.agent = new Agent(this.$webex, this.httpRequest);
    });
  }

  /**
   * This is used for making the CC SDK ready by setting up the cc mercury connection.
   */
  public async register(): Promise<IAgentProfile> {
    try {
      return await this.connectWebSocketAndFetchProfile();
    } catch (error) {
      this.$webex.logger.error(`Error during register: ${error}`);

      return Promise.reject(new Error('Error while performing register`', error));
    }
  }

  /**
   * This is used for connecting the websocket and fetching the agent profile.
   * @returns Promise<IAgentProfile>
   * @throws Error
   * @private
   */
  private async connectWebSocketAndFetchProfile() {
    const connectionConfig: SubscribeRequest = {
      force: this.$config?.force ?? true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
      clientType: this.$config?.clientType ?? 'WebexCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin ?? true,
    };

    try {
      const welcomeData: WelcomeEvent = await this.httpRequest.subscribeNotifications({
        body: connectionConfig,
      });

      const agentId = welcomeData.agentId;
      const agentConfig = new AgentConfig(agentId, this.$webex, this.httpRequest);
      this.agentConfig = await agentConfig.getAgentProfile();
      this.$webex.logger.log(
        `agent config is: ${JSON.stringify(this.agentConfig)} file: ${CC_FILE} method: ${
          this.register.name
        }`
      );

      return this.agentConfig;
    } catch (error) {
      this.$webex.logger.error(`Error during register: ${error}`);

      return Promise.reject(new Error('Error while performing register`', error));
    }
  }

  /**
   * This is used for agent login.
   * @param options
   * @returns Promise<StationLoginSuccess>
   * @throws Error
   */
  public async stationLogin(options: {
    teamId: string;
    loginOption: STATION_LOGIN_TYPE;
    dialNumber?: string;
  }): Promise<StationLoginSuccess> {
    try {
      let {dialNumber} = options;
      let callingSDKRegister: Promise<void> | null = null;

      if (options.loginOption === STATION_LOGIN_TYPE.BROWSER) {
        this.webRTCCalling = new WebRTCCalling(this.$webex, this.$config);
        callingSDKRegister = this.webRTCCalling.registerWebCallingLine();
        dialNumber = this.agentConfig.agentId; // replacing dialNumber with agentId for BROWSER case
      }

      const loginPromise = this.agent.stationLogin({
        ...options,
        dialNumber: dialNumber || this.agentConfig.agentId,
      });

      if (callingSDKRegister) {
        // STATION_LOGIN_TYPE.BROWSER case we have to wait until calling sdk also registered.
        await Promise.all([callingSDKRegister, loginPromise]);
      } else {
        await loginPromise;
      }

      this.$webex.logger.log('LOGIN API SUCCESS');

      return loginPromise;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * This is used for agent logout.
   * @param options
   * @returns Promise<LogoutSuccess>
   * @throws Error
   */
  public async stationLogout(options: {logoutReason: string}): Promise<LogoutSuccess> {
    try {
      const response = await this.agent.stationLogout(options);

      if (this.webRTCCalling) {
        this.webRTCCalling.deregisterWebCallingLine();
      }

      return response;
    } catch (error) {
      this.$webex.logger.error('LOGOUT API FAILED');

      return Promise.reject(new Error('Error while performing agent logout', error.message));
    }
  }
}
