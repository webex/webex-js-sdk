import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK} from './types';
import AgentConfig from './AgentConfig/AgentConfig';
import {CC_FILE, WCC_API_GATEWAY} from './constants';
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
    const agentId = 'ciUserId';
    const agentConfig = new AgentConfig(agentId, this.$webex, this.wccApiUrl);
    this.agentConfig = await agentConfig.getAgentProfile();
    this.$webex.logger.log(
      `agent config is: ${JSON.stringify(this.agentConfig)} file: ${CC_FILE} method: ${
        this.register.name
      }`
    );

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
