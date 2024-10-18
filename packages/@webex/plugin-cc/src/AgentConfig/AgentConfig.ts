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

      const teamListsFilter = user?.teamIds;

      const auxCodesFilter = [];

      if (
        agentDesktopProfile?.accessWrapUpCode !== 'ALL' &&
        agentDesktopProfile?.accessIdleCode !== 'ALL'
      ) {
        auxCodesFilter.push(agentDesktopProfile?.wrapUpCodes);
        auxCodesFilter.push(agentDesktopProfile?.idleCodes);
      }

      // Call the below two APIs parallel to optimise the Performance.

      const [teamsList, auxCodesList]: [ListTeamsResponse, ListAuxCodesResponse] =
        await Promise.all([
          agentConfigService.getListOfTeams(
            orgId,
            DEFAULT_PAGE,
            DEFAULT_PAGE_SIZE,
            teamListsFilter,
            DEFAULT_ATTRIBUTES
          ),
          agentConfigService.getListOfAuxCodes(
            orgId,
            DEFAULT_PAGE,
            DEFAULT_PAGE_SIZE,
            auxCodesFilter,
            DEFAULT_ATTRIBUTES
          ),
        ]);

      // for (const team of teamsList.body) {
      //   this.agentProfile.teams.push({
      //     id: team?.id,
      //   });
      // }

      // auxCodeListData = [1, 2, 4, 5];
      // 92 - idleCodes = [1,2,3]; [1,2]
      // 94 - wrapCodes = [4,5,6]; [4,5]

      // this.agentProfile.idleCodes = auxCodesList.data.filter()
      // this.agentProfile.wrapCodes = '';

      // let wraupcodes = codes.filter(worktypecode == 'Wrapup-code')
      // let idleCodes = codes.filter(worktypecode == 'idle-code')

      // filter the idleCode and wrapCodes based on accessIdleCodes and accessWrapUpCodes

      // if (
      //   agentDesktopProfile?.accessIdleCode === 'ALL' &&
      //   agentDesktopProfile?.accessWrapUpCode !== 'ALL'
      // ) {
      //   this.agentProfile.wrapUpCodes = this.agentProfile.wrapUpCodes.filter(
      //     agentDesktopProfile?.wrapUpCodes
      //     // in this case it should have only [4,5]

      //     // agentDesktopProfile?.wrapUpCodes = [4,5]
      //   );
      // } else if (
      //   agentDesktopProfile?.accessIdleCode !== 'ALL' &&
      //   agentDesktopProfile?.accessWrapUpCode === 'ALL'
      // ) {
      //   this.agentProfile.idleCodes = this.agentProfile.idleCodes.filter()
      //     agentDesktopProfile?.idleCodes
      //     // in this case it should have only [1,2]

      //     // agentDesktopProfile?.idleCodes = [4,5]
      //   );

      // }

      return Promise.resolve(this.agentProfile);
    } catch (error) {
      return Promise.reject(new Error(`Error while fetching agent profile, ${error}`));
    }
  }
}
