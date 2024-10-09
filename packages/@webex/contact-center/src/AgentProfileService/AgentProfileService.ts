/* eslint-disable no-console */
import {DesktopProfileResponse, UserResponse} from './AgentProfileService.types';
import {AGENT_PROFILE_BASE_URL} from './constants';

export default class AgentProfileService {
  ciUserId: string;
  orgId: string;

  constructor(ciUserId: string, orgId: string) {
    this.ciUserId = ciUserId;
    this.orgId = orgId;
  }

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

  public async getListOfTeams(
    orgId: string,
    page?: number,
    pageSize?: number,
    filter?: string[],
    attributes?: string[]
  ) {
    try {
      if (!orgId) Promise.reject(new Error('orgId is undefined'));
      const URL = `${AGENT_PROFILE_BASE_URL}${orgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`;

      return Promise.resolve(this.makeGETRequest(URL));
    } catch (error) {
      console.error('Error while calling getListOfTeams API', error);

      return Promise.reject(error);
    }
  }

  public async getListOfAuxCodes(
    orgId: string,
    page?: number,
    pageSize?: number,
    filter?: string[],
    attributes?: string[]
  ) {
    try {
      if (!orgId) Promise.reject(new Error('orgId is undefined'));
      const URL = `${AGENT_PROFILE_BASE_URL}${orgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`;

      return Promise.resolve(this.makeGETRequest(URL));
    } catch (error) {
      console.error('Error while calling getListOfAuxCodes API', error);

      return Promise.reject(error);
    }
  }

  public async makeGETRequest(URL: string) {
    const response = await this.webex.request({
      method: 'GET',
      uri: {URL},
      withCredentials: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      responseType: 'application/json',
    });

    return response;
  }
}
