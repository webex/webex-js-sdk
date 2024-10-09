// import {WebexPlugin} from '@webex/webex-core';
// import {WEBEX_READY} from './constants';
// import AgentProfile from './AgentProfile/AgentProfile';

// export default class ContactCenter extends WebexPlugin {
//   clientType = '';
//   wccApiUrl = '';
//   namespace = 'WebexCC';

//   constructor(...args) {
//     super(...args);
//     this.webex.once(WEBEX_READY, () => {
//       // console.log('WebexCC: webex object ready: ', this.webex);
//       // this.emit(CC_READY);
//     });
//   }

//   register(success: boolean) {
//     // TODO: Mercury Subsciption code should be added as part of this function
//     // Establishing Mercury Connection here to get CI Id, which will be used by getAgentProfile method
//     // to get Agent Profile by passing CI Id as a parameter.
//     const ciUserId = '40001433-c751-42aa-a180-3a26d6e816e2';
//     const orgId = '123456';
//     const agentProfile = new AgentProfile(ciUserId, orgId);
//     agentProfile.getAgentProfile(ciUserId, orgId);

//     return new Promise((resolve, reject) => {
//       try {
//         setTimeout(() => {
//           if (success) {
//             resolve('Success: Dummy data returned');
//           } else {
//             throw new Error('Simulated error');
//           }
//         }, 1000);
//       } catch (error) {
//         reject(new Error('Simulated error'));
//       }
//     });
//   }
// }
