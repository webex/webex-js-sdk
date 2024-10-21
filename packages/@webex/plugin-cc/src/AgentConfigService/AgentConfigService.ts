import {WebexSDK, HTTP_METHODS} from '../types';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from './types';
import Request from '../request';

export default class AgentConfigService {
  ciUserId: string;
  orgId: string;
  webex: WebexSDK;
  wccAPIURL: string;
  requestInstance: Request;

  constructor(ciUserId: string, orgId: string, webex: WebexSDK, wccAPIURL: string) {
    this.ciUserId = ciUserId;
    this.orgId = orgId;
    this.webex = webex;
    this.wccAPIURL = wccAPIURL;
    this.requestInstance = new Request(this.webex);
  }

  /**
   * Method to get User using CI.
   * @returns {Promise<UserResponse>} A promise that eventually resolves to an API response.
   */

  public async getUserUsingCI(): Promise<UserResponse> {
    try {
      const URL = `${this.wccAPIURL}organization/${this.orgId}/user/by-ci-user-id/${this.ciUserId}`;
      const response = await this.requestInstance.request(URL, HTTP_METHODS.GET);

      this.webex.logger.log('getUserUsingCI api called successfully.');

      return Promise.resolve(response?.body);
    } catch (error) {
      return Promise.reject(new Error(`Error while calling getUserUsingCI API, ${error}`));
    }
  }

  /**
   * Method to get Desktop Profile by passing Org Id.
   * @param {string} desktopProfileId ID of the Desktop Profile to be retrieved.
   * @returns {Promise<DesktopProfileResponse>} A promise that eventually resolves to an API response.
   */

  public async getDesktopProfileById(desktopProfileId: string): Promise<DesktopProfileResponse> {
    try {
      const URL = `${this.wccAPIURL}organization/${this.orgId}/agent-profile/${desktopProfileId}`;
      const response = await this.requestInstance.request(URL, HTTP_METHODS.GET);
      this.webex.logger.log('retrieveDesktopProfileById api called successfully.');

      return Promise.resolve(response?.body);
    } catch (error) {
      return Promise.reject(
        new Error(`Error while calling retrieveDesktopProfileById API, ${error}`)
      );
    }
  }

  /**
   * Method to get List of Teams.
   * @param {number} page Index of the page of results to be fetched.
   * @param {number} pageSize Number of items to be displayed on a page.
   * @param {Array<String>} filter Filter which can be applied to the elements to be fetched.
   * @param {Array<String>} attributes Specify the attributes to be returned. Supported attributes are id, name, active and workTypeCode.
   * @returns {Promise<ListTeamsResponse>} A promise that eventually resolves to an API response.
   */

  public async getListOfTeams(
    page?: number,
    pageSize?: number,
    filter?: string[],
    attributes?: string[]
  ): Promise<ListTeamsResponse> {
    try {
      let URL = '';
      if (filter && filter.length > 0)
        URL = `${this.wccAPIURL}organization/${this.orgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`;
      else
        URL = `${this.wccAPIURL}organization/${this.orgId}/team?page=${page}&pageSize=${pageSize}&attributes=${attributes}`;

      const response = await this.requestInstance.request(URL, HTTP_METHODS.GET);

      this.webex.logger.log('getListOfTeams api called successfully.');

      return Promise.resolve(response?.body);
    } catch (error) {
      return Promise.reject(new Error(`Error while calling getListOfTeams API, ${error}`));
    }
  }

  /**
   * Method to get List of AuxCodes.
   * @param {number} page (Optional) Index of the page of results to be fetched.
   * @param {number} pageSize (Optional) Number of items to be displayed on a page.
   * @param {Array<String>} filter (Optional) Filter which can be applied to the elements to be fetched.
   * @param {Array<String>} attributes (Optional) Specify the attributes to be returned. Supported attributes are id, name, active and workTypeCode.
   * @returns {Promise<ListAuxCodesResponse>} A promise that eventually resolves to an API response.
   */

  public async getListOfAuxCodes(
    page?: number,
    pageSize?: number,
    filter?: string[],
    attributes?: string[]
  ): Promise<ListAuxCodesResponse> {
    try {
      let URL = '';
      if (filter && filter.length > 0)
        URL = `${this.wccAPIURL}organization/${this.orgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`;
      else
        URL = `${this.wccAPIURL}organization/${this.orgId}/team?page=${page}&pageSize=${pageSize}&attributes=${attributes}`;

      const response = await this.requestInstance.request(URL, HTTP_METHODS.GET);

      this.webex.logger.log('getListOfAuxCodes api called successfully.');

      return Promise.resolve(response?.body);
    } catch (error) {
      return Promise.reject(new Error(`Error while calling getListOfAuxCodes API, ${error}`));
    }
  }
}
