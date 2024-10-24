import {IAgentConfig, WORK_TYPE_CODE} from './types';
import AgentConfigService from '../AgentConfigService/AgentConfigService';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  AgentResponse,
  AuxCode,
} from '../AgentConfigService/types';
import {WebexSDK} from '../types';
import {DEFAULT_ATTRIBUTES, DEFAULT_PAGE, DEFAULT_PAGE_SIZE} from './constants';

export default class AgentConfig {
  agentId: string;
  agentProfile: IAgentConfig = {
    teams: [] as ListTeamsResponse[],
    idleCodes: [] as AuxCode[],
    wrapUpCodes: [] as AuxCode[],
  } as IAgentConfig;

  webex: WebexSDK;
  wccAPIURL: string;

  constructor(agentId: string, webex: WebexSDK, wccAPIURL: string) {
    this.agentId = agentId;
    this.webex = webex;
    this.wccAPIURL = wccAPIURL;
  }

  /**
   * Method to get Agent Profile.
   * @returns {Promise<IAgentConfig>} A promise that eventually resolves to an API response and return configuration of an Agent.
   * @example
   * Create AgentConfig class instance and invoke getAgentProfile method.
   * const agentConfig = new AgentConfig('agentId', 'webexObject', 'contactCenterApiUrl');
   * const agentConfigResponse = await agentConfig.getAgentProfile();
   */

  public async getAgentProfile(): Promise<IAgentConfig> {
    try {
      const orgId: string = this.webex.internal.device.orgId;

      const agentConfigService = new AgentConfigService(
        this.agentId,
        orgId,
        this.webex,
        this.wccAPIURL
      );

      const agent: AgentResponse = await agentConfigService.getUserUsingCI();
      this.agentProfile.agentId = this.agentId;
      this.agentProfile.agentFirstName = agent.firstName;
      this.agentProfile.agentLastName = agent.lastName;
      this.agentProfile.agentProfileId = agent.agentProfileId;
      this.agentProfile.agentMailId = agent.email;

      const agentDesktopProfile: DesktopProfileResponse =
        await agentConfigService.getDesktopProfileById(agent.agentProfileId);

      this.agentProfile.loginVoiceOptions = agentDesktopProfile.loginVoiceOptions;

      const teamListFilter = agent.teamIds;

      const auxCodeFilter = [];

      if (
        agentDesktopProfile.accessWrapUpCode !== 'ALL' &&
        agentDesktopProfile.accessIdleCode !== 'ALL'
      ) {
        auxCodeFilter.push(agentDesktopProfile.wrapUpCodes);
        auxCodeFilter.push(agentDesktopProfile.idleCodes);
      }

      // Call the below two APIs parallel to optimise the Performance.

      const [teamsList, auxCodesList]: [ListTeamsResponse, ListAuxCodesResponse] =
        await Promise.all([
          agentConfigService.getListOfTeams(
            DEFAULT_PAGE,
            DEFAULT_PAGE_SIZE,
            teamListFilter,
            DEFAULT_ATTRIBUTES
          ),
          agentConfigService.getListOfAuxCodes(
            DEFAULT_PAGE,
            DEFAULT_PAGE_SIZE,
            auxCodeFilter,
            DEFAULT_ATTRIBUTES
          ),
        ]);

      this.agentProfile.teams.push(teamsList);

      this.agentProfile.wrapUpCodes = auxCodesList.data.filter(
        (auxCode) => auxCode.workTypeCode === WORK_TYPE_CODE.WRAP_UP_CODE
      );
      this.agentProfile.idleCodes = auxCodesList.data.filter(
        (auxCode) => auxCode.workTypeCode === WORK_TYPE_CODE.IDLE_CODE
      );

      if (
        agentDesktopProfile.accessIdleCode === 'ALL' &&
        agentDesktopProfile.accessWrapUpCode !== 'ALL'
      ) {
        this.agentProfile.wrapUpCodes = this.agentProfile.wrapUpCodes.filter(
          (auxCode) => auxCode.workTypeCode === WORK_TYPE_CODE.WRAP_UP_CODE
        );
      } else if (
        agentDesktopProfile.accessIdleCode !== 'ALL' &&
        agentDesktopProfile.accessWrapUpCode === 'ALL'
      ) {
        this.agentProfile.idleCodes = this.agentProfile.wrapUpCodes.filter(
          (auxCode) => auxCode.workTypeCode === WORK_TYPE_CODE.IDLE_CODE
        );
      }

      return Promise.resolve(this.agentProfile);
    } catch (error) {
      return Promise.reject(new Error(`Error while fetching agent profile, ${error}`));
    }
  }
}
