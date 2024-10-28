import {STATION_LOGIN_TYPE, WebexSDK, HTTP_METHODS} from '../types';
import {AGENT, LOGIN_API, LOGOUT_API, WCC_API_GATEWAY, WEB_RTC_PREFIX} from './constants';
import HttpRequest from './HttpRequest';
import {LogoutSuccess, StationLoginSuccess} from './types';

export default class AgentService {
  private webex: WebexSDK;
  private httpRequest: HttpRequest;

  constructor(webex: WebexSDK, httpRequest: HttpRequest) {
    this.webex = webex;
    this.httpRequest = httpRequest;
  }

  private getDeviceId(loginOption: string, dialNumber: string): string {
    if (
      loginOption === STATION_LOGIN_TYPE.EXTENSION ||
      loginOption === STATION_LOGIN_TYPE.AGENT_DN
    ) {
      return dialNumber;
    }

    return WEB_RTC_PREFIX + dialNumber;
  }

  public async stationLogin(options: {
    teamId: string;
    loginOption: string;
    dialNumber: string;
  }): Promise<StationLoginSuccess> {
    try {
      const {teamId, loginOption, dialNumber} = options;
      const payload = {
        dialNumber,
        teamId,
        isExtension: loginOption === STATION_LOGIN_TYPE.EXTENSION,
        roles: [AGENT],
        deviceType: loginOption,
        deviceId: this.getDeviceId(loginOption, dialNumber),
      };

      const data = await this.httpRequest.sendRequestWithEvent({
        service: WCC_API_GATEWAY,
        resource: LOGIN_API,
        method: HTTP_METHODS.POST,
        payload,
        eventType: 'StationLogin',
        success: ['AgentStationLoginSuccess'],
        failure: ['AgentStationLoginFailed'],
      });

      return data;
    } catch (error) {
      this.webex.logger.error(`Error during station login: ${error}`);

      return Promise.reject(error);
    }
  }

  public async stationLogout(options: {logoutReason: string}): Promise<LogoutSuccess> {
    try {
      const {logoutReason} = options;
      const payload = {
        logoutReason,
      };
      const data = await this.httpRequest.sendRequestWithEvent({
        service: WCC_API_GATEWAY,
        resource: LOGOUT_API,
        method: HTTP_METHODS.PUT,
        payload,
        eventType: 'Logout',
        success: ['AgentLogoutSuccess'],
        failure: ['AgentLogoutFailed'],
      });

      return data;
    } catch (error) {
      this.webex.logger.error(`Error during station logout: ${error}`);

      return Promise.reject(error);
    }
  }
}
