/* eslint-disable no-console */
import {WebexPlugin} from '@webex/webex-core';
import {WEBEX_READY} from './constants';
import AgentProfile from './AgentProfile/AgentProfile';

export default class ContactCenter extends WebexPlugin {
  clientType = '';
  wccApiUrl = '';
  namespace = 'WebexCC';

  constructor(...args) {
    super(...args);
    this.webex.once(WEBEX_READY, () => {
      console.log('WebexCC: webex object ready: ', this.webex);
      //   this.emit(CC_READY);
    });
  }

  register(success: boolean) {
    // TODO: Mercury Subsciption code should be added as part of this function
    // Establishing Mercury Connection here to get CI Id, which will be used by getAgentProfile method
    // to get Agent Profile by passing CI Id as a parameter.
    const ciUserId = '01bb0021-6ede-49d4-a47d-fd5af9752665';
    const orgId = '17842240-df69-4620-87d7-e48fd178f79b';
    const agentProfile = new AgentProfile(ciUserId);
    agentProfile.getAgentProfile(ciUserId);

    return new Promise((resolve, reject) => {
      try {
        setTimeout(() => {
          if (success) {
            resolve('Success: Dummy data returned');
          } else {
            throw new Error('Simulated error');
          }
        }, 1000);
      } catch (error) {
        reject(new Error('Simulated error'));
      }
    });
  }
}
