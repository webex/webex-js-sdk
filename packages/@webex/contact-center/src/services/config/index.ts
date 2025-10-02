/**
 * @packageDocumentation
 * @module AgentConfigService
 */

import {HTTP_METHODS} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  AgentResponse,
  OrgInfo,
  OrgSettings,
  TenantData,
  URLMapping,
  TeamList,
  DialPlanEntity,
  Profile,
  ListTeamsResponse,
  AuxCode,
  MultimediaProfileResponse,
  SiteInfo,
} from './types';
import WebexRequest from '../core/WebexRequest';
import {WCC_API_GATEWAY} from '../constants';
import {CONFIG_FILE_NAME} from '../../constants';
import {parseAgentConfigs} from './Util';
import {
  DEFAULT_AUXCODE_ATTRIBUTES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  endPointMap,
  METHODS,
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
      const userConfigPromise = this.getUserUsingCI(orgId, agentId);
      const orgInfoPromise = this.getOrgInfo(orgId);
      const orgSettingsPromise = this.getOrganizationSetting(orgId);
      const tenantDataPromise = this.getTenantData(orgId);
      const urlMappingPromise = this.getURLMapping(orgId);
      const auxCodesPromise = this.getAllAuxCodes(
        orgId,
        DEFAULT_PAGE_SIZE,
        [],
        DEFAULT_AUXCODE_ATTRIBUTES
      );

      const userConfigData = await userConfigPromise;
      LoggerProxy.info(`Fetched user data, userId: ${userConfigData.ciUserId}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_AGENT_CONFIG,
      });

      const agentProfilePromise = this.getDesktopProfileById(orgId, userConfigData.agentProfileId);
      const siteInfoPromise = this.getSiteInfo(orgId, userConfigData.siteId);

      const userDialPlanPromise = agentProfilePromise.then((agentProfileConfigData) =>
        agentProfileConfigData.dialPlanEnabled ? this.getDialPlanData(orgId) : []
      );

      const userTeamPromise = userConfigData.teamIds
        ? this.getAllTeams(orgId, DEFAULT_PAGE_SIZE, userConfigData.teamIds)
        : Promise.resolve([]);

      const [
        agentProfileConfigData,
        siteInfo,
        userDialPlanData,
        userTeamData,
        orgInfo,
        orgSettingsData,
        tenantData,
        urlMappingData,
        auxCodesData,
      ] = await Promise.all([
        agentProfilePromise,
        siteInfoPromise,
        userDialPlanPromise,
        userTeamPromise,
        orgInfoPromise,
        orgSettingsPromise,
        tenantDataPromise,
        urlMappingPromise,
        auxCodesPromise,
      ]);

      const multimediaProfileId =
        userConfigData.multimediaProfileId ||
        userTeamData[0]?.multiMediaProfileId ||
        siteInfo.multimediaProfileId;

      LoggerProxy.info('Fetched all required data', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_AGENT_CONFIG,
      });

      const response = parseAgentConfigs({
        userData: userConfigData,
        teamData: userTeamData,
        tenantData,
        orgInfoData: orgInfo,
        auxCodes: auxCodesData,
        orgSettingsData,
        agentProfileData: agentProfileConfigData,
        dialPlanData: userDialPlanData,
        urlMapping: urlMappingData,
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
   * Fetches the agent configuration data for the given orgId and agentId.
   * @ignore
   * @param {string} orgId - organization ID for which the agent configuration is to be fetched.
   * @param {string} agentId - agent ID for which the configuration is to be fetched.
   * @returns {Promise<AgentResponse>} - A promise that resolves to the agent configuration response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getUserUsingCI(orgId: string, agentId: string): Promise<AgentResponse> {
    LoggerProxy.info('Fetching user data using CI', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_USER_USING_CI,
    });

    try {
      const resource = endPointMap.userByCI(orgId, agentId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getUserUsingCI api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_USER_USING_CI,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getUserUsingCI API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_USER_USING_CI,
      });
      throw error;
    }
  }

  /**
   * Fetches the desktop profile data for the given orgId and desktopProfileId.
   * @ignore
   * @param {string} orgId - organization ID for which the desktop profile is to be fetched.
   * @param {string} desktopProfileId - desktop profile ID for which the data is to be fetched.
   * @returns {Promise<DesktopProfileResponse>} - A promise that resolves to the desktop profile response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getDesktopProfileById(
    orgId: string,
    desktopProfileId: string
  ): Promise<DesktopProfileResponse> {
    LoggerProxy.info('Fetching desktop profile', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_DESKTOP_PROFILE_BY_ID,
    });

    try {
      const resource = endPointMap.desktopProfile(orgId, desktopProfileId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getDesktopProfileById api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_DESKTOP_PROFILE_BY_ID,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getDesktopProfileById API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_DESKTOP_PROFILE_BY_ID,
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
   * fetches the list of teams for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the teams are to be fetched.
   * @param {number} page - the page number to fetch.
   * @param {number} pageSize - the number of teams to fetch per page.
   * @param {string[]} filter - optional filter criteria for the teams.
   * @param {string[]} attributes - optional attributes to include in the response.
   * @returns {Promise<ListTeamsResponse>} - A promise that resolves to the list of teams response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getListOfTeams(
    orgId: string,
    page: number,
    pageSize: number,
    filter: string[]
  ): Promise<ListTeamsResponse> {
    LoggerProxy.info('Fetching list of teams', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_LIST_OF_TEAMS,
    });

    try {
      const resource = endPointMap.listTeams(orgId, page, pageSize, filter);
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
   * Fetches all teams from all pages for the given orgId
   * @ignore
   * @param {string} orgId - organization ID for which the teams are to be fetched.
   * @param {number} pageSize - the number of teams to fetch per page.
   * @param {string[]} filter - optional filter criteria for the teams.
   * @param {string[]} attributes - optional attributes to include in the response.
   * @returns {Promise<TeamList[]>} - A promise that resolves to the list of teams.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getAllTeams(orgId: string, pageSize: number, filter: string[]): Promise<TeamList[]> {
    try {
      let allTeams: TeamList[] = [];
      let page = DEFAULT_PAGE;
      const firstResponse = await this.getListOfTeams(orgId, page, pageSize, filter);
      const totalPages = firstResponse.meta.totalPages;
      allTeams = allTeams.concat(firstResponse.data);
      const requests = [];
      for (page = DEFAULT_PAGE + 1; page < totalPages; page += 1) {
        requests.push(this.getListOfTeams(orgId, page, pageSize, filter));
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
   * Fetches the organization info for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the organization info is to be fetched.
   * @returns {Promise<OrgInfo>} - A promise that resolves to the organization info response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getOrgInfo(orgId: string): Promise<OrgInfo> {
    try {
      const resource = endPointMap.orgInfo(orgId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getOrgInfo api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ORG_INFO,
      });

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.error(`getOrgInfo API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ORG_INFO,
      });
      throw error;
    }
  }

  /**
   * Fetches the organization settings for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the organization settings are to be fetched.
   * @returns {Promise<OrgSettings>} - A promise that resolves to the organization settings response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getOrganizationSetting(orgId: string): Promise<OrgSettings> {
    try {
      const resource = endPointMap.orgSettings(orgId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getOrganizationSetting api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ORGANIZATION_SETTING,
      });

      return Promise.resolve(response.body.data[0]);
    } catch (error) {
      LoggerProxy.error(`getOrganizationSetting API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_ORGANIZATION_SETTING,
      });
      throw error;
    }
  }

  /**
   * Fetches the tenant data for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the tenant data is to be fetched.
   * @returns {Promise<TenantData>} - A promise that resolves to the tenant data response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getTenantData(orgId: string): Promise<TenantData> {
    try {
      const resource = endPointMap.tenantData(orgId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getTenantData api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_TENANT_DATA,
      });

      return Promise.resolve(response.body.data[0]);
    } catch (error) {
      LoggerProxy.error(`getTenantData API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_TENANT_DATA,
      });
      throw error;
    }
  }

  /**
   * Fetches the URL mapping data for the given orgId.
   * @ignore
   * @param {string} orgId - organization ID for which the URL mapping is to be fetched.
   * @returns {Promise<URLMapping[]>} - A promise that resolves to the URL mapping response.
   * @throws {Error} - Throws an error if the API call fails or if the response status is not 200.
   * @private
   */
  public async getURLMapping(orgId: string): Promise<URLMapping[]> {
    try {
      const resource = endPointMap.urlMapping(orgId);
      const response = await this.webexReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.log('getURLMapping api success.', {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_URL_MAPPING,
      });

      return Promise.resolve(response.body.data);
    } catch (error) {
      LoggerProxy.error(`getURLMapping API call failed with ${error}`, {
        module: CONFIG_FILE_NAME,
        method: METHODS.GET_URL_MAPPING,
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
}
