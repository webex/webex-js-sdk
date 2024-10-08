// import {
//   GET_DESKTOP_PROFILE_BY_ID_API,
//   GET_LIST_AUX_CODES_API,
//   GET_LIST_OF_TEAMS_API,
//   GET_USER_BY_CI_USER_ID_API,
// } from './constants';
// import {AgentProfileResponse} from './AgentProfiletypes';

// export default class AgentProfile {
//   agentProfile: AgentProfileResponse;

//   constructor(agentProfile: AgentProfileResponse) {
//     this.agentProfile = agentProfile;
//   }

//   // to get Agent Profile by passing CI Id as a parameter.
//   // const ciUserId = '40001433-c751-42aa-a180-3a26d6e816e2';
//   // this.agentProfile = this.getAgentProfile(ciUserId);

//   // public async getAgentProfile(ciUserId: string, orgId: string): Promise<AgentProfileResponse> {
//   //   // Step: 1
//   //   // Retrieve a User using the CI ID for a given organization.
//   //   // Required Path Param: orgId (Organization ID to be used for this operation) and CI ID of the User.
//   //   // Call the CC internal API to get user by CI User ID.
//   //   // const user = await this.getUserUsingCI(ciUserId, orgId);

//   //   // Step: 2
//   //   // Retrieve an Desktop Profile by ID for a given organization.
//   //   // Call the CC internal API to get desktop profile by ID.
//   //   // Required Path Param: (id) ID of the Desktop Profile to be retrieved and orgid (ID of the Organization containing the Desktop Profile to be retrieved.

//   //   // const desktopProfile = await this.retrieveDesktopProfileById(user?.desktopProfileId, orgId);

//   //   // Step: 3
//   //   // Retrieve a list of Teams for a given organization.
//   //   // Call the CC internal API to get list of teams by orgId
//   //   // Required Path Param: orgId (Organization ID to be used for this operation.)

//   //   // const teamsList = await this.getListOfTeams(orgId);

//   //   // Step: 4
//   //   // Retrieve a list of Auxiliary Codes for a given organization.
//   //   // Call the CC internal API to get list of Aux code for a given orgId.
//   //   // Required Path Params: orgId (Organization ID to be used for this operation.)

//   //   // const auxCodesList = await this.getListOfAuxCodes(orgId);

//   //   return this.agentProfile;
//   // }

//   private async getUserUsingCI(ciUserId: string, orgId: string) {
//     const URL = await this.constructURLForAPIs('getUserUsingCI', orgId, ciUserId);
//     const getUserResponse = await this.webex.request({
//       method: 'GET',
//       uri: {URL},
//       withCredentials: true,
//       headers: '',
//       responseType: 'application/json',
//     });

//     return getUserResponse;
//   }

//   private async retrieveDesktopProfileById(desktopProfileId: string, orgId: string) {
//     const URL = await this.constructURLForAPIs('retrieveDesktopProfileById', orgId);
//     const desktopProfileResponse = await this.webex.request({
//       method: 'GET',
//       uri: {URL},
//       withCredentials: true,
//       headers: '',
//       responseType: 'application/json',
//     });

//     return desktopProfileResponse;
//   }

//   private async getListOfTeams(orgId: string) {
//     const URL = await this.constructURLForAPIs('getListOfTeams', orgId);
//     const listOfTeamsResponse = await this.webex.request({
//       method: 'GET',
//       uri: {URL},
//     });

//     return listOfTeamsResponse;
//   }

//   private async getListOfAuxCodes(orgId: string) {
//     const URL = await this.constructURLForAPIs('getListOfAuxCodes', orgId);
//     const listOfAuxCodesResponse = await this.webex.request({
//       method: 'GET',
//       uri: {URL},
//     });

//     return listOfAuxCodesResponse;
//   }

//   private constructURLForAPIs(methodName: string, orgId: string, ciUserId?: string) {
//     let url = '';
//     switch (methodName) {
//       case 'getUserUsingCI': {
//         const baseURL = GET_USER_BY_CI_USER_ID_API.baseUrl;
//         const user = GET_USER_BY_CI_USER_ID_API.user;
//         const ciUserIdValue = GET_USER_BY_CI_USER_ID_API.by_ci_user_id;
//         url = baseURL.concat(orgId, user, ciUserIdValue, ciUserId);
//         break;
//       }
//       case 'retrieveDesktopProfileById': {
//         const baseURL = GET_DESKTOP_PROFILE_BY_ID_API.baseUrl;
//         const agentProfileValue = GET_DESKTOP_PROFILE_BY_ID_API.agent_profile;
//         url = baseURL.concat(orgId, agentProfileValue, ciUserId);
//         break;
//       }
//       case 'getListOfTeams': {
//         const baseURL = GET_LIST_OF_TEAMS_API.baseUrl;
//         const team = GET_LIST_OF_TEAMS_API.team;
//         url = baseURL.concat(orgId, team);
//         break;
//       }
//       case 'getListOfAuxCodes': {
//         const baseURL = GET_LIST_AUX_CODES_API.baseUrl;
//         const v2 = GET_USER_BY_CI_USER_ID_API.by_ci_user_id;
//         const auxiliaryCode = GET_LIST_AUX_CODES_API.auxiliary_code;
//         url = baseURL.concat(orgId, v2, auxiliaryCode);
//         break;
//       }
//     }

//     return url;
//   }
// }
