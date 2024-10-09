// /* eslint-disable no-console */
// import {DesktopProfileResponse, UserRequest} from './AgentProfileService.types';
// import {AGENT_PROFILE_BASE_URL} from './constants';

// export default class AgentProfileService {
//   private ciUserId: string;
//   private orgId: string;

//   constructor(ciUserId: string, orgId: string) {
//     this.ciUserId = ciUserId;
//     this.orgId = orgId;
//   }

//   public async getUserUsingCI(ciUserId: string, orgId: string): Promise<UserRequest> {
//     try {
//       const URL = `${AGENT_PROFILE_BASE_URL}${orgId}/user/by-ci-user-id/${ciUserId}`;
//       console.log('getUserUsingCI api called successfully.');

//       return Promise.resolve(this.makeGETRequest(URL));
//     } catch (error) {
//       console.error('Error while calling getUserUsingCI', error);
//       Promise.reject(error);
//     }
//   }

//   public async retrieveDesktopProfileById(
//     desktopProfileId: string,
//     orgId: string
//   ): Promise<DesktopProfileResponse> {
//     try {
//       const URL = AGENT_PROFILE_BASE_URL;

//       return this.makeGETRequest(URL);
//     } catch (error) {
//       console.error('Error while cal');
//       Promise.reject(error);
//     }
//   }

//   public async getListOfTeams(
//     orgId: string,
//     page: number,
//     pageSize: number,
//     filter: string[],
//     attributes: string[]
//   ) {
//     const URL = AGENT_PROFILE_BASE_URL;

//     return this.makeGETRequest(URL);
//   }

//   public async getListOfAuxCodes(
//     orgId: string,
//     page: number,
//     pageSize: number,
//     filter: string[],
//     attributes: string[]
//   ) {
//     const URL = AGENT_PROFILE_BASE_URL;

//     return this.makeGETRequest(URL);
//   }

//   async makeGETRequest(URL: string) {
//     const response = await this.webex.request({
//       method: 'GET',
//       uri: {URL},
//       withCredentials: true,
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded',
//         authorization: 'Bearer yxwabvadljasfk12avads...',
//       },
//       responseType: 'application/json',
//     });

//     return response;
//   }
// }
