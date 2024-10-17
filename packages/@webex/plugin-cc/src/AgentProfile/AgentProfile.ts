import {AgentProfileResponse} from './types';
import AgentProfileService from '../AgentProfileService/AgentProfileService';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from '../AgentProfileService/types';
import {WebexSDK} from '../types';
import {defaultAttributes, defaultPage, defaultPageSize} from '../AgentProfileService/constants';

export default class AgentProfile {
  ciUserId: string;
  agentProfile: AgentProfileResponse;
  webex: WebexSDK;
  wccAPIURL: string;

  constructor(ciUserId: string, webex: WebexSDK, wccAPIURL: string) {
    this.webex = webex;
    this.ciUserId = ciUserId;
    this.agentProfile = {
      userDetails: {} as UserResponse['body'],
      agentDesktopProfile: {} as DesktopProfileResponse['body'],
      teamsList: [] as ListTeamsResponse['body'],
      auxCodesList: [] as ListAuxCodesResponse['body']['data'],
    };
    this.wccAPIURL = wccAPIURL;
  }

  /**
   * Method to get Agent Profile.
   * @returns {Promise<AgentProfileResponse>} A promise that eventually resolves to an API response and return configuration of an Agent.
   * @example
   * // Create a AgentProfile class instance and invoke the getAgentProfile method.
   * const agentProfile = new AgentProfile('ciUserId', 'webexObject', 'contactCenterApiUrl');
   * const agentProfileResponse = agentProfile.getAgentProfile();
   * console.log(JSON.stringify(agentProfileResponse));
   */

  public async getAgentProfile(): Promise<AgentProfileResponse> {
    try {
      const orgId = await this.webex.credentials.getOrgId();
      if (!this.ciUserId || !orgId) {
        Promise.reject(new Error('Please provide ciUserId and orgId'));
      }

      const agentProfileService = new AgentProfileService(
        this.ciUserId,
        orgId,
        this.webex,
        this.wccAPIURL
      );

      const user: UserResponse = await agentProfileService.getUserUsingCI(this.ciUserId, orgId);
      this.agentProfile.userDetails = {
        agentProfileId: user?.body?.agentProfileId || '',
        teamIds: user?.body?.teamIds || [''],
        userProfileId: user?.body?.userProfileId || '',
      };

      const agentDesktopProfile: DesktopProfileResponse =
        await agentProfileService.retrieveDesktopProfileById(orgId, user?.body?.agentProfileId);
      this.agentProfile.agentDesktopProfile = {
        buddyTeams: agentDesktopProfile?.body?.buddyTeams || [''],
        idleCodes: agentDesktopProfile?.body?.idleCodes || [''],
        wrapUpCodes: agentDesktopProfile?.body?.wrapUpCodes || [''],
        loginVoiceOptions: agentDesktopProfile?.body?.loginVoiceOptions || [''],
        queues: agentDesktopProfile?.body?.queues || [''],
      };

      const filter = user?.body?.teamIds;

      // Call the below two APIs parallel to optimise the Performance.
      const [teamsList, auxCodesList]: [ListTeamsResponse, ListAuxCodesResponse] =
        await Promise.all([
          agentProfileService.getListOfTeams(
            orgId,
            defaultPage,
            defaultPageSize,
            filter,
            defaultAttributes
          ),
          agentProfileService.getListOfAuxCodes(
            orgId,
            defaultPage,
            defaultPageSize,
            filter,
            defaultAttributes
          ),
        ]);

      for (const team of teamsList.body) {
        this.agentProfile.teamsList.push({
          id: team?.id || '',
          name: team?.name || '',
          active: team?.active || false,
          teamStatus: team?.teamStatus || '',
          teamType: team?.teamType || '',
        });
      }

      for (const auxCode of auxCodesList.body.data) {
        this.agentProfile.auxCodesList.push({
          id: auxCode?.id || '',
          active: auxCode?.active || false,
          defaultCode: auxCode?.defaultCode || false,
          isSystemCode: auxCode?.isSystemCode || false,
          description: auxCode?.description || '',
          name: auxCode?.name || '',
          workTypeCode: auxCode?.workTypeCode || '',
          workTypeId: auxCode?.workTypeId || '',
          createdTime: auxCode?.createdTime || 0,
          lastUpdatedTime: auxCode?.lastUpdatedTime || 0,
          version: auxCode?.version || 0,
        });
      }

      return Promise.resolve(this.agentProfile);
    } catch (error) {
      return Promise.reject(new Error(`Error while fetching agent profile, ${error}`));
    }
  }
}
