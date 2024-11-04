import {WebexSDK, HTTP_METHODS} from '../types';
import {LOGIN_API, WCC_API_GATEWAY} from './constants';
import HttpRequest from './HttpRequest';
import {StationLoginSuccess, UserStationLogin} from './types';

export default class AgentService {
  private webex: WebexSDK;
  private httpRequest: HttpRequest;

  constructor(webex: WebexSDK, httpRequest: HttpRequest) {
    this.webex = webex;
    this.httpRequest = httpRequest;
  }

  public async stationLogin(data: UserStationLogin): Promise<StationLoginSuccess> {
    try {
      const payload = {
        dialNumber: data.dialNumber,
        teamId: data.teamId,
        isExtension: data.isExtension,
        roles: data.roles,
        deviceType: data.deviceType,
        deviceId: data.deviceId,
      };

      const response = await this.httpRequest.sendRequestWithEvent({
        service: WCC_API_GATEWAY,
        resource: LOGIN_API,
        method: HTTP_METHODS.POST,
        payload,
        eventType: 'StationLogin',
        success: ['AgentStationLoginSuccess'],
        failure: ['AgentStationLoginFailed'],
      });

      return response;
    } catch (error) {
      this.webex.logger.error(`Error during station login: ${error}`);

      return Promise.reject(error);
    }
  }
}
