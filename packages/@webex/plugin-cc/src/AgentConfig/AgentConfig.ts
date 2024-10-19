import {IAgentConfig} from './types';
import AgentConfigService from '../AgentConfigService/AgentConfigService';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from '../AgentConfigService/types';
import {WebexSDK} from '../types';
import {DEFAULT_ATTRIBUTES, DEFAULT_PAGE, DEFAULT_PAGE_SIZE} from './constants';

export default class AgentConfig {
  ciUserId: string;
  agentProfile: IAgentConfig;
  webex: WebexSDK;
  wccAPIURL: string;

  constructor(ciUserId: string, webex: WebexSDK, wccAPIURL: string) {
    this.webex = webex;
    this.ciUserId = ciUserId;
    this.wccAPIURL = wccAPIURL;
  }

  /**
   * Method to get Agent Profile.
   * @returns {Promise<AgentProfileResponse>} A promise that eventually resolves to an API response and return configuration of an Agent.
   * @example
   * Create an AgentProfile class instance and invoke the getAgentProfile method.
   * const agentProfile = new AgentProfile('ciUserId', 'webexObject', 'contactCenterApiUrl');
   * const agentProfileResponse = agentProfile.getAgentProfile();
   * console.log(JSON.stringify(agentProfileResponse));
   */

  public async getAgentProfile(): Promise<IAgentConfig> {
    try {
      const orgId = await this.webex.credentials.getOrgId();

      const agentConfigService = new AgentConfigService(
        this.ciUserId,
        orgId,
        this.webex,
        this.wccAPIURL
      );

      const user: UserResponse = await agentConfigService.getUserUsingCI(this.ciUserId, orgId);

      const agentDesktopProfile: DesktopProfileResponse =
        await agentConfigService.getDesktopProfileById(orgId, user?.agentProfileId);
      this.agentProfile.loginVoiceOptions = agentDesktopProfile?.loginVoiceOptions;

      const teamListFilter = user?.teamIds;

      const auxCodeFilter = [];

      if (
        agentDesktopProfile?.accessWrapUpCode !== 'ALL' &&
        agentDesktopProfile?.accessIdleCode !== 'ALL'
      ) {
        auxCodeFilter.push(agentDesktopProfile?.wrapUpCodes);
        auxCodeFilter.push(agentDesktopProfile?.idleCodes);
      }

      // Call the below two APIs parallel to optimise the Performance.

      const [teamsList, auxCodesList]: [ListTeamsResponse, ListAuxCodesResponse] =
        await Promise.all([
          agentConfigService.getListOfTeams(
            orgId,
            DEFAULT_PAGE,
            DEFAULT_PAGE_SIZE,
            teamListFilter,
            DEFAULT_ATTRIBUTES
          ),
          agentConfigService.getListOfAuxCodes(
            orgId,
            DEFAULT_PAGE,
            DEFAULT_PAGE_SIZE,
            auxCodeFilter,
            DEFAULT_ATTRIBUTES
          ),
        ]);

      this.agentProfile.teams.push(teamsList);

      this.agentProfile.wrapUpCodes = auxCodesList.data.filter(
        (auxCode) => auxCode.workTypeCode === 'WRAP_UP_CODE'
      );
      this.agentProfile.idleCodes = auxCodesList.data.filter(
        (auxCode) => auxCode.workTypeCode === 'IDLE_CODE'
      );

      if (
        agentDesktopProfile?.accessIdleCode === 'ALL' &&
        agentDesktopProfile?.accessWrapUpCode !== 'ALL'
      ) {
        this.agentProfile.wrapUpCodes = this.agentProfile.wrapUpCodes.filter(
          (auxCode) => auxCode.workTypeCode === 'WRAP_UP_CODE'
        );
      } else if (
        agentDesktopProfile?.accessIdleCode !== 'ALL' &&
        agentDesktopProfile?.accessWrapUpCode === 'ALL'
      ) {
        this.agentProfile.idleCodes = this.agentProfile.wrapUpCodes.filter(
          (auxCode) => auxCode.workTypeCode === 'IDLE_CODE'
        );
      }

      return Promise.resolve(this.agentProfile);
    } catch (error) {
      return Promise.reject(new Error(`Error while fetching agent profile, ${error}`));
    }
  }
}
