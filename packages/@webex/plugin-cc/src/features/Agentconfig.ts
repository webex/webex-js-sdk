import {WORK_TYPE_CODE} from './types';
import AgentConfigService from '../services/config';
import {IAgentProfile, Team, AuxCode, WebexSDK} from '../types';
import {DEFAULT_ATTRIBUTES, DEFAULT_PAGE, DEFAULT_PAGE_SIZE} from './constants';
import HttpRequest from '../services/core/HttpRequest';

export default class AgentConfig {
  agentId: string;
  agentProfile: IAgentProfile = {
    teams: [] as Team[],
    idleCodes: [] as AuxCode[],
    wrapUpCodes: [] as AuxCode[],
  } as IAgentProfile;

  webex: WebexSDK;
  httpRequest: HttpRequest;

  constructor(agentId: string, webex: WebexSDK, httpRequest: HttpRequest) {
    this.agentId = agentId;
    this.webex = webex;
    this.httpRequest = httpRequest;
  }

  /**
   * Method to get Agent Profile.
   * @returns {Promise<IAgentProfile>} A promise that eventually resolves to an API response and return configuration of an Agent.
   * @example
   * Create AgentConfig class instance and invoke getAgentProfile method.
   * const agentConfig = new AgentConfig('agentId', 'webexObject', 'contactCenterApiUrl');
   * const agentConfigResponse = await agentConfig.getAgentProfile();
   */

  public async getAgentProfile(): Promise<IAgentProfile> {
    try {
      const agentConfigService = new AgentConfigService(this.agentId, this.webex, this.httpRequest);

      const agent = await agentConfigService.getUserUsingCI();
      const {firstName, lastName, agentProfileId, email} = agent;
      this.agentProfile = {
        ...this.agentProfile,
        agentId: this.agentId,
        agentName: `${firstName} ${lastName}`,
        agentProfileId,
        agentMailId: email,
      };

      const agentDesktopProfile = await agentConfigService.getDesktopProfileById(
        agent.agentProfileId
      );

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

      const [teamsList, auxCodesList] = await Promise.all([
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

      const teams = Array.isArray(teamsList)
        ? teamsList.map((team: Team) => ({
            id: team.id,
            name: team.name,
          }))
        : [];

      this.agentProfile.teams.push(...teams);

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
        this.agentProfile.idleCodes = this.agentProfile.idleCodes.filter(
          (auxCode) => auxCode.workTypeCode === WORK_TYPE_CODE.IDLE_CODE
        );
      }

      return Promise.resolve(this.agentProfile);
    } catch (error) {
      return Promise.reject(new Error(`Fetching Agent Profile failed: ${error.message}`));
    }
  }
}
