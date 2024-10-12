/* eslint-disable no-console */
import {AgentProfileResponse} from './AgentProfiletypes';
import AgentProfileService from '../AgentProfileService/AgentProfileService';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from '../AgentProfileService/AgentProfileService.types';
import {WebexSDK} from '../types';
import {page, pageSize} from '../AgentProfileService/constants';

export default class AgentProfile {
  ciUserId: string;
  agentProfile: AgentProfileResponse;
  webex: WebexSDK;

  constructor(ciUserId: string, webex: WebexSDK, agentProfile: AgentProfileResponse) {
    this.webex = webex;
    this.ciUserId = ciUserId;
    this.agentProfile = agentProfile;
  }

  /**
   * Method to get Agent Profile by providing ciUserId.
   * @param {string} ciUserId The CI ID of a User.
   * @returns {Promise<AgentProfileResponse>} A promise that eventually resolves to an API response and return configuration of an Agent.
   */

  public async getAgentProfile(ciUserId: string): Promise<AgentProfileResponse> {
    console.log('inside getAgentProfile function');
    try {
      const orgId = await this.webex.credentials.getOrgId();
      if (!ciUserId || !orgId) {
        console.error('Please provide ciUserId and orgId');
        Promise.reject(new Error('Please provide ciUserId and orgId'));
      }

      const agentProfileService = new AgentProfileService(ciUserId, orgId, this.webex);

      const user: UserResponse = await agentProfileService.getUserUsingCI(ciUserId, orgId);
      console.log('user is', user);
      this.agentProfile.userDetails = {
        agentProfileId: user?.body?.agentProfileId,
        teamIds: user?.body?.teamIds,
        userProfileId: user?.body?.userProfileId,
      };

      console.log('agentProfileId is', user?.body?.agentProfileId);
      console.log('teamIds is', user?.body?.teamIds);
      console.log('userProfileId is', user?.body?.userProfileId);

      const agentDesktopProfile: DesktopProfileResponse =
        await agentProfileService.retrieveDesktopProfileById(orgId, user?.body?.agentProfileId);
      console.log('agent desktop profile is', agentDesktopProfile);
      this.agentProfile.agentDesktopProfile = {
        buddyTeams: agentDesktopProfile?.body?.buddyTeams,
        idleCodes: agentDesktopProfile?.body?.idleCodes,
        wrapUpCodes: agentDesktopProfile?.body?.wrapUpCodes,
        loginVoiceOptions: agentDesktopProfile?.body?.loginVoiceOptions,
        queues: agentDesktopProfile?.body?.queues,
        teams: agentDesktopProfile?.body?.viewableStatistics?.teams,
      };
      const filter = user?.body?.teamIds;
      console.log('filter is', user?.body?.teamIds);
      // By giving workTypeCode inside the attributes the API is giving 400 bad request;
      // {
      //   "trackingId": "ccconfig_fcbc8fd3-a180-46e9-8518-1058dda36846",
      //   "error": {
      //     "key": "400",
      //     "reason": "Invalid requested columns :workTypeCode",
      //     "message": [
      //       {
      //         "description": "Invalid requested columns :workTypeCode"
      //       }
      //     ]
      //   }
      // }

      // Call the below two APIs parallel to optimise the Performance.
      const [teamsList, auxCodesList]: [ListTeamsResponse, ListAuxCodesResponse] =
        await Promise.all([
          agentProfileService.getListOfTeams(orgId, page, pageSize, filter),
          agentProfileService.getListOfAuxCodes(orgId, page, pageSize, filter),
        ]);
      console.log('teams list is', teamsList);
      this.agentProfile.teamsList = teamsList?.body;

      console.log('aux codes is', auxCodesList);
      this.agentProfile.auxCodesList = auxCodesList?.body?.data;

      console.log('agent profile is', this.agentProfile);

      return Promise.resolve(this.agentProfile);
    } catch (error) {
      console.error('Error while fetching agent profile', error);

      return Promise.reject(error);
    }
  }
}
