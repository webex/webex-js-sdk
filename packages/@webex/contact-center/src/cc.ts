/* eslint-disable no-console */
import {WebexPlugin} from '@webex/webex-core';
import AgentProfile from './AgentProfile/AgentProfile';
import {CCConfig, IContactCenter, WebexSDK} from './types';
import {WCC_API_GATEWAY} from './constants';
import {AgentProfileResponse} from './AgentProfile/AgentProfiletypes';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'WebexCC';
  $config: CCConfig;
  $webex: WebexSDK;
  wccAPIURL: string;
  agentProfile: AgentProfileResponse;

  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.$config = this.config;
    // @ts-ignore
    this.$webex = this.webex;
  }

  async register(success: boolean): Promise<string> {
    this.wccAPIURL = this.$webex.internal.services.get(WCC_API_GATEWAY); // Added this change for Ravi's PR, he will move this under different function if needed.
    // TODO: Mercury Subsciption code should be added as part of this function
    // TODO: Mercury Subsciption code should be added as part of this function
    // Establishing Mercury Connection here to get CI Id, which will be used by getAgentProfile method
    // to get Agent Profile by passing CI Id as a parameter.
    const ciUserId = 'dummy_uuid';
    const agentProfile = new AgentProfile(ciUserId, this.$webex, this.wccAPIURL);
    this.agentProfile = await agentProfile.getAgentProfile(ciUserId);

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
