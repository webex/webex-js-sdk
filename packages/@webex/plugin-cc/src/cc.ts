import {WebexPlugin} from '@webex/webex-core';
import AgentConfig from './features/Agentconfig';
import {IAgentProfile, StationLoginResponse} from './features/types';
import {
  CCPluginConfig,
  IContactCenter,
  WebexSDK,
  SubscribeRequest,
  LoginOption,
  WelcomeEvent,
} from './types';
import {READY, CC_FILE} from './constants';
import HttpRequest from './services/HttpRequest';
import WebCallingService from './WebCallingService';
import {AgentLogin} from './services/types';
import Agent from './features/Agent';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  private $config: CCPluginConfig;
  private $webex: WebexSDK;
  private agentConfig: IAgentProfile;
  private registered = false;
  private httpRequest: HttpRequest;
  private agent: Agent;
  private webCallingService: WebCallingService;

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
      return await this.connectWebsocket();
    } catch (error) {
      this.$webex.logger.error(`file: ${CC_FILE}: Error during register: ${error}`);

      return Promise.reject(new Error('Error while performing register`', error));
    }
  }

  /**
   * This is used for connecting the websocket and fetching the agent profile.
   * @returns Promise<IAgentProfile>
   * @throws Error
   * @private
   */
  private async connectWebsocket() {
    const connectionConfig: SubscribeRequest = {
      force: this.$config?.force ?? true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
      clientType: this.$config?.clientType ?? 'WebexCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin ?? true,
    };

    try {
      return this.httpRequest
        .subscribeNotifications({
          body: connectionConfig,
        })
        .then(async (data: WelcomeEvent) => {
          const agentId = data.agentId;
          const agentConfig = new AgentConfig(agentId, this.$webex, this.httpRequest);
          this.agentConfig = await agentConfig.getAgentProfile();
          this.$webex.logger.log(`file: ${CC_FILE}: agent config is fetched successfully`);

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
   * @returns Promise<StationLoginSuccess>
   * @throws Error
   */
  public async stationLogin(data: AgentLogin): Promise<StationLoginResponse> {
    const loginResponse = this.agent.stationLogin({
      ...data,
      dialNumber: data.dialNumber || this.agentConfig.agentId,
    });

    if (data.loginOption === LoginOption.BROWSER) {
      this.webCallingService = new WebCallingService(this.$webex, this.$config.callingClientConfig);

      await this.webCallingService.registerWebCallingLine();
    }

    await loginResponse;

    return loginResponse;
  }
}
