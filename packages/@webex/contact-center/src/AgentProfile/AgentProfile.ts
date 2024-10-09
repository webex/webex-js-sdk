/* eslint-disable no-console */
import {AgentProfileResponse} from './AgentProfiletypes';
import AgentProfileService from '../AgentProfileService/AgentProfileService';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from '../AgentProfileService/AgentProfileService.types';

export default class AgentProfile {
  ciUserId: string;
  agentProfile: AgentProfileResponse;

  constructor(ciUserId: string) {
    this.ciUserId = ciUserId;
  }

  public async getAgentProfile(ciUserId: string): Promise<AgentProfileResponse> {
    try {
      const orgId = this.webex.credentials.getOrgId();
      if (!ciUserId || !orgId) {
        console.error('Please provide ciUserId and orgId');
        Promise.reject(new Error('Please provide ciUserId and orgId'));
      }

      const agentProfileService = new AgentProfileService(ciUserId, orgId);

      // Step: 1
      // Retrieve a User using the CI ID for a given organization.
      // Required Path Param: orgId (Organization ID to be used for this operation) and CI ID of the User.
      // Call the CC internal API to get user by CI User ID.
      const tempResponse: any = {};
      const user: UserResponse = await agentProfileService.getUserUsingCI(ciUserId, orgId);
      console.log('user is', user);
      tempResponse.agentProfileId = user.agentProfileId;
      tempResponse.teamIds = user.teamIds;
      tempResponse.userProfileId = user.userProfileId;

      // Step: 2
      // Retrieve an Desktop Profile by ID for a given organization.
      // Call the CC internal API to get desktop profile by ID.
      // Required Path Param: (id) ID of the Desktop Profile to be retrieved and orgid (ID of the Organization containing the Desktop Profile to be retrieved.

      const agentDesktopProfile: DesktopProfileResponse =
        await agentProfileService.retrieveDesktopProfileById(orgId, user.agentProfileId);
      console.log('agent desktop profile is', agentDesktopProfile);
      tempResponse.buddyTeams = agentDesktopProfile.buddyTeams;
      tempResponse.idleCodes = agentDesktopProfile.idleCodes;
      tempResponse.queues = agentDesktopProfile.wrapUpCodes;
      tempResponse.teams = agentDesktopProfile.teams;
      tempResponse.loginVoiceOptions = agentDesktopProfile.loginVoiceOptions;

      // Step: 3
      // Retrieve a list of Teams for a given organization.
      // Call the CC internal API to get list of teams by orgId
      // Required Path Param: orgId (Organization ID to be used for this operation.)
      const page = 0;
      const pageSize = 10;
      const filter = user.teamIds;
      const attributes = ['id', 'name', 'active', 'workTypeCode'];
      const teamsList: ListTeamsResponse = await agentProfileService.getListOfTeams(
        orgId,
        page,
        pageSize,
        filter,
        attributes
      );
      console.log('teams list is', teamsList);
      tempResponse.id = teamsList.id;
      tempResponse.name = teamsList.name;
      tempResponse.active = teamsList.active;
      tempResponse.teamStatus = teamsList.teamStatus;
      tempResponse.teamType = teamsList.teamType;

      // Step: 4
      // Retrieve a list of Auxiliary Codes for a given organization.
      // Call the CC internal API to get list of Aux code for a given orgId.
      // Required Path Params: orgId (Organization ID to be used for this operation.)

      const auxCodesList: ListAuxCodesResponse = await agentProfileService.getListOfAuxCodes(
        orgId,
        page,
        pageSize,
        filter,
        attributes
      );
      console.log('aux codes is', auxCodesList);
      tempResponse.id = auxCodesList.id;
      tempResponse.active = auxCodesList.active;
      tempResponse.defaultCode = auxCodesList.defaultCode;
      tempResponse.isSystemCode = auxCodesList.isSystemCode;
      tempResponse.description = auxCodesList.description;
      tempResponse.name = auxCodesList.name;
      tempResponse.workTypeCode = auxCodesList.workTypeCode;
      tempResponse.workTypeId = auxCodesList.workTypeId;
      tempResponse.createdTime = auxCodesList.createdTime;
      tempResponse.lastUpdatedTime = auxCodesList.lastUpdatedTime;
      tempResponse.version = auxCodesList.version;

      this.agentProfile = {...tempResponse};

      return Promise.resolve(this.agentProfile);
    } catch (error) {
      console.error('Error while fetching agent profile', error);

      return Promise.reject(error);
    }
  }
}
