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
import HttpRequest from './services/core/HttpRequest';
import WebRTCCalling from './WebRTCCalling';
import {AgentLoginRequest} from './services/config/types';
import LoggerProxy from './logger-proxy';
import {Services} from './services';
import {AGENT, WEB_RTC_PREFIX} from './services/constants';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  private $config: CCPluginConfig;
  private $webex: WebexSDK;
  private agentConfig: IAgentProfile;
  private registered = false;
  private httpRequest: HttpRequest;
  private webRTCCalling: WebRTCCalling;
  private services: Services;

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

      this.services = Services.getInstance();

      LoggerProxy.initialize(this.$webex.logger);
    });
  }

  /**
   * This is used for making the CC SDK ready by setting up the cc mercury connection.
   */
  public async register(): Promise<IAgentProfile> {
    try {
      return await this.connectWebSocketAndFetchProfile();
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
  private async connectWebSocketAndFetchProfile() {
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
   * @param options
   * @returns Promise<StationLoginSuccess>
   * @throws Error
   */
  public async stationLogin(data: AgentLoginRequest): Promise<StationLoginResponse> {
    try {
      let callingSDKRegister: Promise<void> | null = null;

      if (data.loginOption === LoginOption.BROWSER) {
        this.webRTCCalling = new WebRTCCalling(this.$webex, {}); // TODO: add callingClientConfig
        callingSDKRegister = this.webRTCCalling.registerWebCallingLine();
        data.dialNumber = this.agentConfig.agentId; // replacing dialNumber with agentId for BROWSER case
      }

      const loginPromise = this.services.agent.stationLogin({
        data: {
          dialNumber: data.dialNumber || this.agentConfig.agentId,
          teamId: data.teamId,
          deviceType: data.loginOption,
          isExtension: data.loginOption === LoginOption.EXTENSION,
          deviceId: this.getDeviceId(data.loginOption, data.dialNumber),
          roles: [AGENT],
          teamName: '',
          siteId: '',
          usesOtherDN: false,
          auxCodeId: '',
        },
      });

      if (callingSDKRegister) {
        // LoginOption.BROWSER case we have to wait until calling sdk also registered.
        await Promise.all([callingSDKRegister, loginPromise]);
      } else {
        await loginPromise;
      }

      this.$webex.logger.log(`file: ${CC_FILE}: Station Login Success`);

      return loginPromise;
    } catch (error: any) {
      this.$webex.logger.log(`file: ${CC_FILE}: Station Login FAILED: ${error.id}`);
      throw new Error(error.details.data.reason ?? 'Error while performing station login');
    }
  }

  private getDeviceId(loginOption: string, dialNumber: string): string {
    if (loginOption === LoginOption.EXTENSION || loginOption === LoginOption.AGENT_DN) {
      return dialNumber;
    }

    return WEB_RTC_PREFIX + dialNumber;
  }
}
