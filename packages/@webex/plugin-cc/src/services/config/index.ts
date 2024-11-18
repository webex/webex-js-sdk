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
} from './types';
import HttpRequest from '../core/HttpRequest';
import {WCC_API_GATEWAY} from '../constants';
import {parseAgentConfigs} from './Util';
import {
  DEFAULT_AUXCODE_ATTRIBUTES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TEAM_ATTRIBUTES,
} from './constants';

export default class AgentConfigService {
  private httpReq: HttpRequest;
  private orgId: string;
  constructor(orgId: string) {
    this.httpReq = HttpRequest.getInstance();
    this.orgId = orgId;
  }

  public async getAgentConfig(agentId: string): Promise<Profile> {
    try {
      // Start all asynchronous calls at once
      const userConfigPromise = this.getUserUsingCI(agentId);
      const orgInfoPromise = this.getOrgInfo();
      const orgSettingsPromise = this.getOrganizationSetting();
      const tenantDataPromise = this.getTenantData();
      const urlMappingPromise = this.getURLMapping();
      const auxCodesPromise = this.getAllAuxCodes(
        DEFAULT_PAGE_SIZE,
        [],
        DEFAULT_AUXCODE_ATTRIBUTES
      );

      // Wait for user configuration data to determine additional data fetching
      const userConfigData = await userConfigPromise;
      LoggerProxy.logger.info('Fetched user data');

      const agentProfilePromise = this.getDesktopProfileById(userConfigData.agentProfileId);

      const userDialPlanPromise = agentProfilePromise.then((agentProfileConfigData) =>
        agentProfileConfigData.dialPlanEnabled ? this.getDialPlanData() : []
      );

      const userTeamPromise = userConfigData.teamIds
        ? this.getAllTeams(DEFAULT_PAGE_SIZE, userConfigData.teamIds, DEFAULT_TEAM_ATTRIBUTES)
        : Promise.resolve([]);

      // Await all promises that can be run in parallel
      const [
        agentProfileConfigData,
        userDialPlanData,
        userTeamData,
        orgInfo,
        orgSettingsData,
        tenantData,
        urlMappingData,
        auxCodesData,
      ] = await Promise.all([
        agentProfilePromise,
        userDialPlanPromise,
        userTeamPromise,
        orgInfoPromise,
        orgSettingsPromise,
        tenantDataPromise,
        urlMappingPromise,
        auxCodesPromise,
      ]);

      LoggerProxy.logger.info('Fetched all required data');

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
      });

      LoggerProxy.logger.info('Parsing completed for agent-config');
      LoggerProxy.logger.info('Fetched configuration data successfully');

      return response;
    } catch (error) {
      LoggerProxy.logger.error(`getAgentConfig call failed with ${error}`);
      throw error;
    }
  }

  /**
   * Method to get Agent using CI.
   * @returns {Promise<AgentResponse>} A promise that eventually resolves to an API response.
   */

  public async getUserUsingCI(agentId: string): Promise<AgentResponse> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `organization/${this.orgId}/user/by-ci-user-id/${agentId}`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getUserUsingCI api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.logger.error(`getUserUsingCI API call failed with ${error}`);
      throw error;
    }
  }

  /**
   * Method to get Desktop Profile by passing desktopProfileId.
   * @param {string} desktopProfileId ID of the Desktop Profile to be retrieved.
   * @returns {Promise<DesktopProfileResponse>} A promise that eventually resolves to an API response.
   */

  public async getDesktopProfileById(desktopProfileId: string): Promise<DesktopProfileResponse> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `organization/${this.orgId}/agent-profile/${desktopProfileId}`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getDesktopProfileById api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.logger.error(`getDesktopProfileById API call failed with ${error}`);
      throw error;
    }
  }

  /**
   * Method to get List of Teams.
   * @param {number} page Index of the page of results to be fetched. Defaults to 0.
   * @param {number} pageSize Number of items to be displayed on a page. Defaults to 10.
   * @param {Array<String>} filter Filter that can be applied to the elements to be fetched. Defaults to [].
   * @param {Array<String>} attributes Specify the attributes to be returned. Defaults to ['id', 'name'].
   * @returns {Promise<Team>} A promise that eventually resolves to an API response.
   */

  public async getListOfTeams(
    page: number,
    pageSize: number,
    filter: string[],
    attributes: string[]
  ): Promise<ListTeamsResponse> {
    try {
      const resource = `organization/${this.orgId}/v2/team?page=${page}&pageSize=${pageSize}${
        filter && filter.length > 0 ? `&filter=id=in=${filter}` : ''
      }&attributes=${attributes}`;

      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getListOfTeams api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.logger.error(`getListOfTeams API call failed with ${error}`);
      throw error;
    }
  }

  public async getAllTeams(
    pageSize: number,
    filter: string[],
    attributes: string[]
  ): Promise<TeamList[]> {
    try {
      let allTeams: TeamList[] = [];
      let page = DEFAULT_PAGE;
      const firstResponse = await this.getListOfTeams(page, pageSize, filter, attributes);
      const totalPages = firstResponse.meta.totalPages;
      allTeams = allTeams.concat(firstResponse.data);
      // Create an array of promises for each page request
      const requests = [];
      for (page = DEFAULT_PAGE + 1; page < totalPages; page += 1) {
        requests.push(this.getListOfTeams(page, pageSize, filter, attributes));
      }
      // Await all requests in parallel
      const responses = await Promise.all(requests);

      // Process the responses
      for (const response of responses) {
        allTeams = allTeams.concat(response.data);
      }

      return allTeams;
    } catch (error) {
      LoggerProxy.logger.error(`getAllTeams API call failed with ${error}`);
      throw error;
    }
  }

  /**
   * Method to get List of AuxCodes.
   * @param {number} page Index of the page of results to be fetched. Defaults to 0.
   * @param {number} pageSize Number of items to be displayed on a page. Defaults to 10.
   * @param {Array<String>} filter Filter that can be applied to the elements to be fetched. Defaults to [].
   * @param {Array<String>} attributes Specify the attributes to be returned. Defaults to ['id', 'name', 'active'].
   * @returns {Promise<ListAuxCodesResponse>} A promise that eventually resolves to an API response.
   */

  public async getListOfAuxCodes(
    page: number,
    pageSize: number,
    filter: string[],
    attributes: string[]
  ): Promise<ListAuxCodesResponse> {
    try {
      const resource = `organization/${
        this.orgId
      }/v2/auxiliary-code?page=${page}&pageSize=${pageSize}${
        filter && filter.length > 0 ? `&filter=id=in=${filter}` : ''
      }&attributes=${attributes}`;

      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getListOfAuxCodes api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.logger.error(`getListOfAuxCodes API call failed with ${error}`);
      throw error;
    }
  }

  public async getAllAuxCodes(
    pageSize: number,
    filter: string[],
    attributes: string[]
  ): Promise<AuxCode[]> {
    try {
      let allAuxCodes: AuxCode[] = [];
      let page = DEFAULT_PAGE;

      // Fetch the first page to determine the total number of pages
      const firstResponse = await this.getListOfAuxCodes(page, pageSize, filter, attributes);
      allAuxCodes = allAuxCodes.concat(firstResponse.data);
      const totalPages = firstResponse.meta.totalPages;

      // Create an array of promises for the remaining page requests
      const promises: Promise<ListAuxCodesResponse>[] = [];
      for (page = DEFAULT_PAGE + 1; page < totalPages; page += 1) {
        promises.push(this.getListOfAuxCodes(page, pageSize, filter, attributes));
      }

      // Await all remaining requests in parallel
      const responses = await Promise.all(promises);

      // Process the responses
      responses.forEach((response) => {
        allAuxCodes = allAuxCodes.concat(response.data);
      });

      return allAuxCodes;
    } catch (error) {
      LoggerProxy.logger.error(`getAllAuxCodes API call failed with ${error}`);
      throw error;
    }
  }

  public async getOrgInfo(): Promise<OrgInfo> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `organization/${this.orgId}`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getOrgInfo api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.logger.error(`getOrgInfo API call failed with ${error}`);
      throw error;
    }
  }

  public async getOrganizationSetting(): Promise<OrgSettings> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `/organization/${this.orgId}/v2/organization-setting?agentView=true`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getOrganizationSetting api success.');

      return Promise.resolve(response.body.data[0]);
    } catch (error) {
      LoggerProxy.logger.error(`getOrganizationSetting API call failed with ${error}`);
      throw error;
    }
  }

  public async getTenantData(): Promise<TenantData> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `organization/${this.orgId}/v2/tenant-configuration?agentView=true`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getTenantData api success.');

      return Promise.resolve(response.body.data[0]);
    } catch (error) {
      LoggerProxy.logger.error(`getTenantData API call failed with ${error}`);
      throw error;
    }
  }

  public async getURLMapping(): Promise<URLMapping[]> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `/organization/${this.orgId}/v2/org-url-mapping?sort=name,ASC`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getURLMapping api success.');

      return Promise.resolve(response.body.data);
    } catch (error) {
      LoggerProxy.logger.error(`getURLMapping API call failed with ${error}`);
      throw error;
    }
  }

  public async getDialPlanData(): Promise<DialPlanEntity[]> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `/organization/${this.orgId}/dial-plan?agentView=true`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      LoggerProxy.logger.log('getDialPlanData api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      LoggerProxy.logger.error(`getDialPlanData API call failed with ${error}`);
      throw error;
    }
  }
}
