import {WebexSDK, HTTP_METHODS, Team} from '../../types';
import {DesktopProfileResponse, ListAuxCodesResponse, AgentResponse} from './types';
import HttpRequest from '../core/HttpRequest';
import {WCC_API_GATEWAY} from '../constants';

export default class AgentConfigService {
  agentId: string;
  orgId: string;
  webex: WebexSDK;
  httpReq: HttpRequest;

  constructor(agentId: string, webex: WebexSDK, httpRequest: HttpRequest) {
    this.agentId = agentId;
    this.webex = webex;
    this.orgId = this.webex.internal.device.orgId;
    this.httpReq = httpRequest;
  }

  /**
   * Method to get Agent using CI.
   * @returns {Promise<AgentResponse>} A promise that eventually resolves to an API response.
   */

  public async getUserUsingCI(): Promise<AgentResponse> {
    try {
      const response = await this.httpReq.request({
        service: WCC_API_GATEWAY,
        resource: `organization/${this.orgId}/user/by-ci-user-id/${this.agentId}`,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(`API call failed with ${response.statusCode}`);
      }

      this.webex.logger.log('getUserUsingCI api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Method to get Desktop Profile by passing Org Id.
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

      this.webex.logger.log('getDesktopProfileById api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      return Promise.reject(error);
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
  ): Promise<Team> {
    try {
      const resource = `organization/${this.orgId}/team?page=${page}&pageSize=${pageSize}${
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

      this.webex.logger.log('getListOfTeams api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      return Promise.reject(error);
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

      this.webex.logger.log('getListOfAuxCodes api success.');

      return Promise.resolve(response.body);
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
