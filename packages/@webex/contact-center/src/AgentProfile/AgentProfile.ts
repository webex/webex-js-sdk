// import {AgentProfileResponse} from './AgentProfiletypes';
// import AgentProfileService from '../AgentProfileService/AgentProfileService';
// import {
//   DesktopProfileResponse,
//   ListAuxCodesResponse,
//   ListTeamsResponse,
//   UserResponse,
// } from '../AgentProfileService/AgentProfileService.types';

// export default class AgentProfile {
//   private ciUserId: string;
//   private orgId: string;
//   private agentProfile: AgentProfileResponse;

//   constructor(ciUserId: string, orgId: string) {
//     this.ciUserId = ciUserId;
//     this.orgId = orgId;
//   }

//   public async getAgentProfile(ciUserId: string, orgId: string): Promise<AgentProfileResponse> {
//     try {
//       if (!ciUserId || !orgId) {
//         console.error('Please provide ciUserId and orgId');
//         Promise.reject(new Error('Please provide ciUserId and orgId'));
//       }

//       const agentProfileService = new AgentProfileService(ciUserId, orgId);

//       // Step: 1
//       // Retrieve a User using the CI ID for a given organization.
//       // Required Path Param: orgId (Organization ID to be used for this operation) and CI ID of the User.
//       // Call the CC internal API to get user by CI User ID.
//       const tempResponse: any = {};
//       const user: UserResponse = await agentProfileService.getUserUsingCI(ciUserId, orgId);
//       tempResponse.agentProfileId = user.agentProfileId;
//       tempResponse.teamIds = user.teamIds;
//       tempResponse.userProfileId = user.userProfileId;

//       // Step: 2
//       // Retrieve an Desktop Profile by ID for a given organization.
//       // Call the CC internal API to get desktop profile by ID.
//       // Required Path Param: (id) ID of the Desktop Profile to be retrieved and orgid (ID of the Organization containing the Desktop Profile to be retrieved.

//       const agentDesktopProfile: DesktopProfileResponse =
//         await agentProfileService.retrieveDesktopProfileById(orgId, user.agentProfileId);
//       tempResponse.buddyTeams = agentDesktopProfile.buddyTeams;
//       tempResponse.idleCodes = agentDesktopProfile.idleCodes;
//       tempResponse.queues = agentDesktopProfile.wrapUpCodes;
//       tempResponse.teams = agentDesktopProfile.teams;
//       tempResponse.loginVoiceOptions = agentDesktopProfile.loginVoiceOptions;

//       // Step: 3
//       // Retrieve a list of Teams for a given organization.
//       // Call the CC internal API to get list of teams by orgId
//       // Required Path Param: orgId (Organization ID to be used for this operation.)
//       const page = 0;
//       const pageSize = 10;
//       const filter = [
//         '57efb0e6-5af0-4245-a67d-d3c5045cdb6e',
//         'a421e0b2-732e-46f3-a057-39160a53afb9',
//       ];
//       const attributes = ['id', 'name', 'active', 'workTypeCode'];
//       const teamsList: ListTeamsResponse = await agentProfileService.getListOfTeams(
//         orgId,
//         page,
//         pageSize,
//         filter,
//         attributes
//       );
//       tempResponse.id = teamsList.id;
//       tempResponse.name = teamsList.name;
//       tempResponse.active = teamsList.active;
//       tempResponse.teamStatus = teamsList.teamStatus;
//       tempResponse.teamType = teamsList.teamType;

//       // Step: 4
//       // Retrieve a list of Auxiliary Codes for a given organization.
//       // Call the CC internal API to get list of Aux code for a given orgId.
//       // Required Path Params: orgId (Organization ID to be used for this operation.)

//       const auxCodesList: ListAuxCodesResponse = await agentProfileService.getListOfAuxCodes(
//         orgId,
//         page,
//         pageSize,
//         filter,
//         attributes
//       );
//       tempResponse.id = auxCodesList.id;
//       tempResponse.active = auxCodesList.active;
//       tempResponse.defaultCode = auxCodesList.defaultCode;
//       tempResponse.isSystemCode = auxCodesList.isSystemCode;
//       tempResponse.description = auxCodesList.description;
//       tempResponse.name = auxCodesList.name;
//       tempResponse.workTypeCode = auxCodesList.workTypeCode;
//       tempResponse.workTypeId = auxCodesList.workTypeId;
//       tempResponse.createdTime = auxCodesList.createdTime;
//       tempResponse.lastUpdatedTime = auxCodesList.lastUpdatedTime;
//       tempResponse.version = auxCodesList.version;

//       this.agentProfile = {...tempResponse};

//       return Promise.resolve(this.agentProfile);
//     } catch (error) {
//       console.error('Error while fetching agent profile', error);

//       return Promise.reject(error);
//     }
//   }

//   // private constructURLForAPIs(methodName: string, orgId: string, ciUserId?: string) {
//   //   let url = '';
//   //   switch (methodName) {
//   //     case 'getUserUsingCI': {
//   //       const baseURL = GET_USER_BY_CI_USER_ID_API.baseUrl;
//   //       const user = GET_USER_BY_CI_USER_ID_API.user;
//   //       const ciUserIdValue = GET_USER_BY_CI_USER_ID_API.by_ci_user_id;
//   //       url = baseURL.concat(orgId, user, ciUserIdValue, ciUserId);
//   //       break;
//   //     }
//   //     case 'retrieveDesktopProfileById': {
//   //       const baseURL = GET_DESKTOP_PROFILE_BY_ID_API.baseUrl;
//   //       const agentProfileValue = GET_DESKTOP_PROFILE_BY_ID_API.agent_profile;
//   //       url = baseURL.concat(orgId, agentProfileValue, ciUserId);
//   //       break;
//   //     }
//   //     case 'getListOfTeams': {
//   //       const baseURL = GET_LIST_OF_TEAMS_API.baseUrl;
//   //       const team = GET_LIST_OF_TEAMS_API.team;
//   //       url = baseURL.concat(orgId, team);
//   //       break;
//   //     }
//   //     case 'getListOfAuxCodes': {
//   //       const baseURL = GET_LIST_AUX_CODES_API.baseUrl;
//   //       const v2 = GET_USER_BY_CI_USER_ID_API.by_ci_user_id;
//   //       const auxiliaryCode = GET_LIST_AUX_CODES_API.auxiliary_code;
//   //       url = baseURL.concat(orgId, v2, auxiliaryCode);
//   //       break;
//   //     }
//   //   }

//   //   return url;
//   // }
// }
