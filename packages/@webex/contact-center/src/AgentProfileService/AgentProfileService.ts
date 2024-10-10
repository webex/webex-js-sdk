/* eslint-disable no-console */
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from './AgentProfileService.types';
import {AGENT_PROFILE_BASE_URL} from './constants';

export default class AgentProfileService {
  ciUserId: string;
  orgId: string;

  constructor(ciUserId: string, orgId: string) {
    this.ciUserId = ciUserId;
    this.orgId = orgId;
  }

  /**
   * Method to get User using CI.
   * @param {string} ciUserId The CI Id of the user.
   * @param {string} orgId The ID of an Organization.
   * @returns {Promise<UserResponse>} A promise that eventually resolves to an API response.
   */

  public async getUserUsingCI(ciUserId: string, orgId: string): Promise<UserResponse> {
    try {
      if (!ciUserId || !orgId) Promise.reject(new Error('ciUserId or orgId is undefined'));

      const URL = `${AGENT_PROFILE_BASE_URL}${orgId}/user/by-ci-user-id/${ciUserId}`;
      console.log('getUserUsingCI api called successfully.');

      return Promise.resolve(this.makeGETRequest(URL));
    } catch (error) {
      console.error('Error while calling getUserUsingCI API', error);

      return Promise.reject(error);
    }
  }

  /**
   * Method to get Desktop Profile by passing Org Id.
   * @param {string} orgId The ID of an Organization.
   * @param {string} desktopProfileId ID of the Desktop Profile to be retrieved.
   * @returns {Promise<DesktopProfileResponse>} A promise that eventually resolves to an API response.
   */

  public async retrieveDesktopProfileById(
    orgId: string,
    desktopProfileId: string
  ): Promise<DesktopProfileResponse> {
    try {
      if (!orgId || !desktopProfileId)
        Promise.reject(new Error('orgId or desktopProfileId is undefined'));

      const URL = `${AGENT_PROFILE_BASE_URL}${orgId}/agent-profile/${desktopProfileId}`;

      return Promise.resolve(this.makeGETRequest(URL));
    } catch (error) {
      console.error('Error while calling retrieveDesktopProfileById API', error);

      return Promise.reject(error);
    }
  }

  /**
   * Method to get List of Teams.
   * @param {string} orgId The ID of an Organization.
   * @param {number} page (Optional) Index of the page of results to be fetched.
   * @param {number} pageSize (Optional) Number of items to be displayed on a page.
   * @param {Array<String>} filter (Optional) Filter which can be applied to the elements to be fetched.
   * @param {Array<String>} attributes (Optional) Specify the attributes to be returned. Supported attributes are id, name, active and workTypeCode.
   * @returns {Promise<ListTeamsResponse>} A promise that eventually resolves to an API response.
   */

  public async getListOfTeams(
    orgId: string,
    page?: number,
    pageSize?: number,
    filter?: string[],
    attributes?: string[]
  ): Promise<ListTeamsResponse> {
    try {
      if (!orgId) Promise.reject(new Error('orgId is undefined'));
      const URL = `${AGENT_PROFILE_BASE_URL}${orgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`;

      return Promise.resolve(this.makeGETRequest(URL));
    } catch (error) {
      console.error('Error while calling getListOfTeams API', error);

      return Promise.reject(error);
    }
  }

  /**
   * Method to get List of AuxCodes.
   * @param {string} orgId The ID of an Organization.
   * @param {number} page (Optional) Index of the page of results to be fetched.
   * @param {number} pageSize (Optional) Number of items to be displayed on a page.
   * @param {Array<String>} filter (Optional) Filter which can be applied to the elements to be fetched.
   * @param {Array<String>} attributes (Optional) Specify the attributes to be returned. Supported attributes are id, name, active and workTypeCode.
   * @returns {Promise<ListAuxCodesResponse>} A promise that eventually resolves to an API response.
   */

  public async getListOfAuxCodes(
    orgId: string,
    page?: number,
    pageSize?: number,
    filter?: string[],
    attributes?: string[]
  ): Promise<ListAuxCodesResponse> {
    try {
      if (!orgId) Promise.reject(new Error('orgId is undefined'));
      const URL = `${AGENT_PROFILE_BASE_URL}${orgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`;

      return Promise.resolve(this.makeGETRequest(URL));
    } catch (error) {
      console.error('Error while calling getListOfAuxCodes API', error);

      return Promise.reject(error);
    }
  }

  /**
   * Common method to make GET Requests.
   * @param {string} URL The URL of the Request.
   * @returns {Promise<any>} A promise that eventually resolves to an individual API response.
   */

  public async makeGETRequest(URL: string): Promise<any> {
    try {
      const response = await this.webex.request({
        method: 'GET',
        uri: {URL},
        headers: {
          Accept: 'application/json',
        },
      });

      return response;
    } catch (error) {
      console.log('Error while making GET Request', error);
      throw new Error(error);
    }
  }
}
