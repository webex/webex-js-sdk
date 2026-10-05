/**
 * @packageDocumentation
 * @module AgentConfigService
 */

import {HTTP_METHODS} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {
  ListAuxCodesResponse,
  OrgDesktopLoginResponse,
  UserDesktopLoginResponse,
  Team,
  TeamList,
  DialPlanEntity,
  Profile,
  ListTeamsResponse,
  AuxCode,
  MultimediaProfileResponse,
  SiteInfo,
  OutdialAniEntriesResponse,
  OutdialAniParams,
  Entity,
} from './types';
import WebexRequest from '../core/WebexRequest';
import {WCC_API_GATEWAY} from '../constants';
import {CONFIG_FILE_NAME, METHODS as MAIN_METHODS} from '../../constants';
import {parseAgentConfigs} from './Util';
import {
  DEFAULT_AUXCODE_ATTRIBUTES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  endPointMap,
  METHODS,
  WELLBEING_BREAK_IDLE_CODE,
} from './constants';

/**
 * The AgentConfigService class provides methods to fetch agent configuration data.
 * @private
 * @ignore
 */
export default class AgentConfigService {
  private webexReq: WebexRequest;
  constructor() {
    this.webexReq = WebexRequest.getInstance();
  }

  /**
   * Fetches the agent configuration data for the given orgId and agentId.
   * @param {string} orgId - organization ID for which the agent configuration is to be fetched.
   * @param {string} agentId - agent ID for which the configuration is to be fetched.
   * @returns {Promise<Profile>} - A promise that resolves to the agent configuration profile.
   * @throws {Error} - Throws an error if any API call fails or if the response status is not 200.
   * @public
   */
  public async getAgentConfig(orgId: string, agentId: string): Promise<Profile> {
    try {
      const orgConfigPromise = this.getOrgDesktopLoginConfig(orgId);
      const userConfigPromise = this.getUserDesktopLoginConfig(orgId, agentId);
      const auxCodesPromise = this.getAllAuxCodes(
        orgId,
        DEFAULT_PAGE_SIZE,
        [],
        DEFAULT_AUXCODE_ATTRIBUTES
      );

      const userConfig = await userConfigPromise;
      const {user: userData, agentProfile: agentProfileData} = userConfig;
      LoggerProxy.info(`Fetched user data, userId: ${userData.ciUserId}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_AGENT_CONFIG,
      });

      const siteInfoPromise = this.getSiteInfo(orgId, userData.siteId);
      const userTeamPromise = this.getAllTeams(orgId, DEFAULT_PAGE_SIZE, userData.dbId);
      const userDialPlanPromise = agentProfileData.dialPlanEnabled
        ? this.getDialPlanData(orgId)
        : Promise.resolve([]);

      const [siteInfo, userDialPlanData, userTeamData, orgConfig, auxCodesData] = await Promise.all(
        [siteInfoPromise, userDialPlanPromise, userTeamPromise, orgConfigPromise, auxCodesPromise]
      );
      const multimediaProfileId =
        userTeamData[0]?.multiMediaProfileId || siteInfo.multimediaProfileId;

      LoggerProxy.info('Fetched all required data', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_AGENT_CONFIG,
      });

      const response = parseAgentConfigs({
        orgConfig,
        userData,
        agentProfileData,
        // Profile.teams declares Team[] while the team API returns TeamList rows; the raw rows
        // are intentionally what reaches public output. See config-spec.md.
        teamData: userTeamData as unknown as Team[],
        auxCodes: auxCodesData,
        dialPlanData: userDialPlanData,
        multimediaProfileId,
      });

      LoggerProxy.info('Parsing completed for agent-config', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_AGENT_CONFIG,
      });
      LoggerProxy.info('Fetched configuration data successfully', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_AGENT_CONFIG,
      });

      return response;
    } catch (error) {
      LoggerProxy.error(`getAgentConfig call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_AGENT_CONFIG,
      });
      throw error;
    }
  }

  /**
   * Fetches the aggregated organization desktop-login configuration for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the configuration is to be fetched.
   * @returns {Promise<OrgDesktopLoginResponse>} - A promise that resolves to the organization configuration.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getOrgDesktopLoginConfig(orgId: string): Promise<OrgDesktopLoginResponse> {
    LoggerProxy.info('Fetching organization desktop-login configuration', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_ORG_DESKTOP_LOGIN_CONFIG,
    });

    try {
      const resource = endPointMap.orgDesktopLogin(orgId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getOrgDesktopLoginConfig api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ORG_DESKTOP_LOGIN_CONFIG,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getOrgDesktopLoginConfig API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ORG_DESKTOP_LOGIN_CONFIG,
      });
      throw error;
    }
  }

  /**
   * Fetches the aggregated user desktop-login configuration for the given orgId and ciUserId.
   * @ignore
   * @param {string} orgId - organization ID for which the configuration is to be fetched.
   * @param {string} ciUserId - CI user ID of the agent whose configuration is to be fetched.
   * @returns {Promise<UserDesktopLoginResponse>} - A promise that resolves to the user configuration.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getUserDesktopLoginConfig(
    orgId: string,
    ciUserId: string
  ): Promise<UserDesktopLoginResponse> {
    LoggerProxy.info('Fetching user desktop-login configuration', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_USER_DESKTOP_LOGIN_CONFIG,
    });

    try {
      const resource = endPointMap.userDesktopLogin(orgId, ciUserId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getUserDesktopLoginConfig api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_USER_DESKTOP_LOGIN_CONFIG,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getUserDesktopLoginConfig API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_USER_DESKTOP_LOGIN_CONFIG,
      });
      throw error;
    }
  }

  /**
   * Fetches the multimedia profile data for the given orgId and multimediaProfileId.
   * @ignore
   * @param {string} orgId - organization ID for which the multimedia profile is to be fetched.
   * @param {string} multimediaProfileId - multimedia profile ID for which the data is to be fetched.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @returns {Promise<MultimediaProfileResponse>} - A promise that resolves to the multimedia profile response.
   * @private
   */
  public async getMultimediaProfileById(
    orgId: string,
    multimediaProfileId: string
  ): Promise<MultimediaProfileResponse> {
    LoggerProxy.info('Fetching multimedia profile', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_MULTIMEDIA_PROFILE_BY_ID,
    });

    try {
      const resource = endPointMap.multimediaProfile(orgId, multimediaProfileId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getMultimediaProfileById API success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_MULTIMEDIA_PROFILE_BY_ID,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getMultimediaProfileById API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_MULTIMEDIA_PROFILE_BY_ID,
      });
      throw error;
    }
  }

  /**
   * fetches the list of teams the given user belongs to.
   * @ignore
   * @param {string} orgId - organization ID for which the teams are to be fetched.
   * @param {number} page - the page number to fetch.
   * @param {number} pageSize - the number of teams to fetch per page.
   * @param {string} userDbId - database ID of the user whose teams are to be fetched.
   * @returns {Promise<ListTeamsResponse>} - A promise that resolves to the list of teams response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getListOfTeams(
    orgId: string,
    page: number,
    pageSize: number,
    userDbId: string
  ): Promise<ListTeamsResponse> {
    LoggerProxy.info('Fetching list of teams', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_LIST_OF_TEAMS,
    });

    try {
      const resource = endPointMap.listTeams(orgId, page, pageSize, userDbId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getListOfTeams api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_LIST_OF_TEAMS,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getListOfTeams API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_LIST_OF_TEAMS,
      });
      throw error;
    }
  }

  /**
   * Fetches all teams the given user belongs to, from all pages
   * @ignore
   * @param {string} orgId - organization ID for which the teams are to be fetched.
   * @param {number} pageSize - the number of teams to fetch per page.
   * @param {string} userDbId - database ID of the user whose teams are to be fetched.
   * @returns {Promise<TeamList[]>} - A promise that resolves to the list of teams.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getAllTeams(orgId: string, pageSize: number, userDbId: string): Promise<TeamList[]> {
    try {
      let allTeams: TeamList[] = [];
      let page = DEFAULT_PAGE;
      const firstResponse = await this.getListOfTeams(orgId, page, pageSize, userDbId);
      const totalPages = firstResponse.meta.totalPages;
      allTeams = allTeams.concat(firstResponse.data);
      const requests = [];
      for (page = DEFAULT_PAGE + 1; page < totalPages; page += 1) {
        requests.push(this.getListOfTeams(orgId, page, pageSize, userDbId));
      }
      const responses = await Promise.all(requests);

      for (const response of responses) {
        allTeams = allTeams.concat(response.data);
      }

      return allTeams;
    } catch (error) {
      LoggerProxy.error(`getAllTeams API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ALL_TEAMS,
      });
      throw error;
    }
  }

  /**
   *  fetches the list of aux codes for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the aux codes are to be fetched.
   * @param {number} page - the page number to fetch.
   * @param {number} pageSize - the number of aux codes to fetch per page.
   * @param {string[]} filter - optional filter criteria for the aux codes.
   * @param {string[]} attributes - optional attributes to include in the response.
   * @returns {Promise<ListAuxCodesResponse>} - A promise that resolves to the list of aux codes response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getListOfAuxCodes(
    orgId: string,
    page: number,
    pageSize: number,
    filter: string[],
    attributes: string[]
  ): Promise<ListAuxCodesResponse> {
    LoggerProxy.info('Fetching list of aux codes', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_LIST_OF_AUX_CODES,
    });

    try {
      const resource = endPointMap.listAuxCodes(orgId, page, pageSize, filter, attributes);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getListOfAuxCodes api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_LIST_OF_AUX_CODES,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getListOfAuxCodes API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_LIST_OF_AUX_CODES,
      });
      throw error;
    }
  }

  /**
   * Fetches all aux codes from all pages for the given orgId
   * @ignore
   * @param {string} orgId - organization ID for which the aux codes are to be fetched.
   * @param {number} pageSize - the number of aux codes to fetch per page.
   * @param {string[]} filter - optional filter criteria for the aux codes.
   * @param {string[]} attributes - optional attributes to include in the response.
   * @returns {Promise<AuxCode[]>} - A promise that resolves to the list of aux codes.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getAllAuxCodes(
    orgId: string,
    pageSize: number,
    filter: string[],
    attributes: string[]
  ): Promise<AuxCode[]> {
    try {
      let allAuxCodes: AuxCode[] = [];
      let page = DEFAULT_PAGE;

      const firstResponse = await this.getListOfAuxCodes(orgId, page, pageSize, filter, attributes);
      allAuxCodes = allAuxCodes.concat(firstResponse.data);
      const totalPages = firstResponse.meta.totalPages;

      const promises: Promise<ListAuxCodesResponse>[] = [];
      for (page = DEFAULT_PAGE + 1; page < totalPages; page += 1) {
        promises.push(this.getListOfAuxCodes(orgId, page, pageSize, filter, attributes));
      }

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        allAuxCodes = allAuxCodes.concat(response.data);
      });

      return allAuxCodes;
    } catch (error) {
      LoggerProxy.error(`getAllAuxCodes API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ALL_AUX_CODES,
      });
      throw error;
    }
  }

  /**
   * Retrieves the exact system-managed WellbeingBreak idle code.
   * This query intentionally bypasses Desktop Profile filtering so the system code does not
   * need to appear in the normal agent-selectable idle-code list.
   * @param orgId - Organization identifier
   * @returns The normalized WellbeingBreak entity
   * @throws When the request fails or the exact system code is unavailable
   * @internal
   */
  public async getWellbeingBreakIdleCode(orgId: string): Promise<Entity> {
    LoggerProxy.info('Fetching WellbeingBreak system idle code', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_WELLBEING_BREAK_IDLE_CODE,
    });

    try {
      let page = DEFAULT_PAGE;
      let totalPages = 1;

      do {
        // Pagination is intentionally sequential so the lookup can stop as soon as the code is found.
        // eslint-disable-next-line no-await-in-loop
        const response = await this.webexReq.request({
          service: WCC_API_GATEWAY,
          resource: endPointMap.systemIdleCodes(orgId, page, DEFAULT_PAGE_SIZE),
          method: HTTP_METHODS.GET,
        });

        if (response.statusCode !== 200) {
          throw new Error(`API call failed with ${response.statusCode}`);
        }

        const result = response.body as ListAuxCodesResponse;
        const wellbeingCode = result.data?.find(
          (code) =>
            code.active === true &&
            code.isSystemCode === true &&
            code.name === WELLBEING_BREAK_IDLE_CODE
        );

        if (wellbeingCode) {
          return {
            id: wellbeingCode.id,
            name: wellbeingCode.name,
            isSystem: true,
            isDefault: wellbeingCode.defaultCode,
          };
        }

        totalPages = result.meta?.totalPages ?? 1;
        page += 1;
      } while (page < totalPages);

      throw new Error('WELLBEING_BREAK_IDLE_CODE_NOT_FOUND');
    } catch (error) {
      LoggerProxy.error(`getWellbeingBreakIdleCode API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_WELLBEING_BREAK_IDLE_CODE,
      });
      throw error;
    }
  }

  /**
   * Fetches the site data for the given orgId and siteId.
   * @ignore
   * @param {string} orgId - organization ID for which the site info is to be fetched.
   * @param {string} siteId - site ID for which the data is to be fetched.
   * @returns {Promise<SiteInfo>} - A promise that resolves to the site info response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getSiteInfo(orgId: string, siteId: string): Promise<SiteInfo> {
    LoggerProxy.info('Fetching site information', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_SITE_INFO,
    });
    try {
      const resource = endPointMap.siteInfo(orgId, siteId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getSiteInfo api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_SITE_INFO,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getSiteInfo API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_SITE_INFO,
      });
      throw error;
    }
  }

  /**
   * Fetches the dial plan data for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the dial plan data is to be fetched.
   * @returns {Promise<DialPlanEntity[]>} - A promise that resolves to the dial plan data response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getDialPlanData(orgId: string): Promise<DialPlanEntity[]> {
    try {
      const resource = endPointMap.dialPlan(orgId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getDialPlanData api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_DIAL_PLAN_DATA,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getDialPlanData API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_DIAL_PLAN_DATA,
      });
      throw error;
    }
  }

  // getQueues removed - use Queue instead

  /**
   * Fetches outdial ANI (Automatic Number Identification) entries for the given orgId and outdial ANI ID.
   * @ignore
   * @param {string} orgId - organization ID for which the outdial ANI entries are to be fetched.
   * @param {OutdialAniParams} params - parameters object containing outdialANI and optional pagination/filtering options
   * @returns {Promise<OutdialAniEntriesResponse>} - A promise that resolves to the outdial ANI entries response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getOutdialAniEntries(
    orgId: string,
    params: OutdialAniParams
  ): Promise<OutdialAniEntriesResponse> {
    const {outdialANI, page, pageSize, search, filter, attributes} = params;

    LoggerProxy.info('Fetching outdial ANI entries', {
      module: CONFIG_FILE_NAME,
      method: MAIN_METHODS.GET_OUTDIAL_ANI_ENTRIES,
    });

    try {
      const queryParams = [];
      if (page !== undefined) queryParams.push(`page=${page}`);
      if (pageSize !== undefined) queryParams.push(`pageSize=${pageSize}`);
      if (search) queryParams.push(`search=${search}`);
      if (filter) queryParams.push(`filter=${filter}`);
      if (attributes) queryParams.push(`attributes=${attributes}`);

      const queryString = queryParams.length > 0 ? queryParams.join('&') : '';
      const resource = endPointMap.outdialAniEntries(orgId, outdialANI, queryString);

      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      LoggerProxy.log('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: MAIN_METHODS.GET_OUTDIAL_ANI_ENTRIES,
      });

      return response.body?.data;
    } catch (error) {
      LoggerProxy.error(`getOutdialAniEntries API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: MAIN_METHODS.GET_OUTDIAL_ANI_ENTRIES,
      });
      throw error;
    }
  }
}
