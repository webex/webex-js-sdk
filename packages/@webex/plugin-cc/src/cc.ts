/* eslint-disable no-console */
import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK} from './types';
import AgentProfile from './AgentProfile/AgentProfile';
import {AgentProfileResponse} from './AgentProfile/types';
import AgentLogin from './AgentLogin/AgentLogin';
import {CC_EVENTS, REGISTER_TIMEOUT, SUBSCRIBE_API, WCC_API_GATEWAY} from './constants';
import CCMercury from './CCMercury';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'ContactCenter';
  $config: CCPluginConfig;
  $webex: WebexSDK;
  wccApiUrl: string;
  agentProfile: AgentProfileResponse;
  ccMercury: typeof CCMercury;
  ciUserId: string;

  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.$config = this.config;
    // @ts-ignore
    this.$webex = this.webex;
    // this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);
    this.ccMercury = new CCMercury(
      {},
      {
        parent: this.$webex,
      }
    );
  }

  async register(success: boolean): Promise<string> {
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY); // Added this change for Ravi's PR, he will move this under different function if needed.
    // TODO: Mercury Subsciption code should be added as part of this function
    // Establishing Mercury Connection here to get CI Id, which will be used by getAgentProfile method
    // to get Agent Profile by passing CI Id as a parameter.
    const ciUserId = '01bb0021-6ede-49d4-a47d-fd5af9752665';
    const agentProfile = new AgentProfile(ciUserId, this.$webex, this.wccApiUrl);
    this.agentProfile = await agentProfile.getAgentProfile(ciUserId);
    this.$webex.logger.log(`agent profile is: ${this.agentProfile}`);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (success) {
          resolve('Success: Dummy data returned');
        } else {
          reject(new Error('Simulated Error'));
        }
      }, 1000);
    });
  }

  // async register(): Promise<string> {
  //   this.$webex.logger.log(`ContactCenter: Registering ${this.$config}`);
  //   const wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);
  //   this.ccMercury.registerAndConnect(`${wccApiUrl}${SUBSCRIBE_API}`, {
  //     force: this.$config?.force || true,
  //     isKeepAliveEnabled: this.$config?.isKeepAliveEnabled || false,
  //     clientType: this.$config?.clientType || 'WxCCSDK',
  //     allowMultiLogin: this.$config?.allowMultiLogin || true,
  //   });

  //   return new Promise((resolve, reject) => {
  //     const timeoutDuration = REGISTER_TIMEOUT; // Define your timeout duration here (e.g., 10 seconds)

  //     const timeout = setTimeout(() => {
  //       reject(new Error('Subscription Failed: Time out'));
  //     }, timeoutDuration);

  //     this.ccMercury.on('event', async (event) => {
  //       console.log('inside CC mercury event', event);
  //       if (event.type === CC_EVENTS.Welcome) {
  //         console.log('inside if condition mercury event', event.type);
  //         this.ciUserId = event.data.agentId;
  //         const agentProfile = new AgentProfile(this.ciUserId, this.$webex, this.wccApiUrl);
  //         this.agentProfile = await agentProfile.getAgentProfile(this.ciUserId);
  //         // eslint-disable-next-line no-console
  //         console.log('agentProfile is', this.agentProfile);
  //         this.$webex.logger.log(`agent profile is: ${JSON.stringify(this.agentProfile)}`);
  //         clearTimeout(timeout); // Clear the timeout if the Welcome event occurs
  //         resolve(`Success: agentProfile is ${this.agentProfile}`); // TODO: resolve with AgentProfile after Parv's PR
  //       }
  //     });
  //   });
  // }

  getAgentProfileData() {
    return this.agentProfile;
  }

  async doAgentLogin(teamId: string, agentDeviceType: string, deviceId: string) {
    try {
      const agentLogin = new AgentLogin(this.$webex, this.wccApiUrl);
      const agentLoginResponse = await agentLogin.loginAgentWithSelectedTeam(
        teamId,
        agentDeviceType,
        deviceId
      );
      // eslint-disable-next-line no-console
      console.log('API SUCCESS: agentLoginAPIResponse is', agentLoginResponse);
      this.$webex.logger.log(`agentLoginAPIResponse is, ${JSON.stringify(agentLoginResponse)}`);
      this.AgentLoginEvent();
    } catch (error) {
      console.error('Error While Logging Agent', error);
      Promise.reject(new Error('Error While Logging Agent', error));
    }
  }

  AgentLoginEvent(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutDuration = REGISTER_TIMEOUT; // Define your timeout duration here (e.g., 10 seconds)

      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Agent Login  did not occur within the expected time frame'));
      }, timeoutDuration);

      this.ccMercury.on('event', (event) => {
        if (event.type === 'AgentStationLoginSuccess') {
          clearTimeout(timeout); // Clear the timeout if the Agent Login Successful.
          resolve(`Success: Agent Login Successful. ${event?.data}`);
        } else {
          reject(new Error(`Failure: Agent Login Failure!`));
        }
      });
    });
  }
}
