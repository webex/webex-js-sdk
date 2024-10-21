import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK} from './types';
import AgentConfig from './AgentConfig/AgentConfig';
import {WCC_API_GATEWAY} from './constants';
import {IAgentConfig} from './AgentConfig/types';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'ContactCenter';
  $config: CCPluginConfig;
  $webex: WebexSDK;
  wccApiUrl: string;
  agentConfig: IAgentConfig;

  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.$config = this.config;
    // @ts-ignore
    this.$webex = this.webex;
  }

  async register(success: boolean): Promise<string> {
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);
    // Added this change for Ravi's PR, he will move this under different function if needed.
    // TODO: Mercury Subsciption code should be added as part of this function
    // Establishing Mercury Connection here to get CI Id, which will be used by getAgentProfile method
    // to get Agent Config by passing CI Id as a parameter.
    const ciUserId = 'your_ciUserId';
    const agentConfig = new AgentConfig(ciUserId, this.$webex, this.wccApiUrl);
    this.agentConfig = await agentConfig.getAgentProfile();
    this.$webex.logger.log(`agent config is: ${JSON.stringify(this.agentConfig)})`);

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
}
