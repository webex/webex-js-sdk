import {STATION_LOGIN_TYPE, WebexSDK, HTTP_METHODS} from '../types';
import {AGENT, LOGIN_API, LOGOUT_API, WCC_API_GATEWAY, WEB_RTC_PREFIX} from './constants';
import HttpRequest from './HttpRequest';
import {LogoutSuccess, StationLoginSuccess} from './types';
import {POST_AUTH} from '../constants';

export default class AgentService {
  private webex: WebexSDK;
  private httpRequest: HttpRequest;

  constructor(webex: WebexSDK, httpRequest: HttpRequest) {
    this.webex = webex;
    this.httpRequest = httpRequest;
  }

  private getDeviceId(loginOption: string, dialNumber: string, agentId: string): string {
    if (
      loginOption === STATION_LOGIN_TYPE.EXTENSION ||
      loginOption === STATION_LOGIN_TYPE.AGENT_DN
    ) {
      return dialNumber;
    }

    return WEB_RTC_PREFIX + agentId;
  }

  public async stationLogin(options: {
    teamId: string;
    loginOption: string;
    dialNumber: string;
    agentId: string;
  }): Promise<StationLoginSuccess> {
    try {
      await this.webex.internal.services.waitForCatalog(POST_AUTH);
      const wccAPIURL = this.webex.internal.services.get(WCC_API_GATEWAY);
      const {teamId, loginOption, dialNumber, agentId} = options;
      const dialString = loginOption === STATION_LOGIN_TYPE.BROWSER ? agentId : dialNumber;
      const payload = {
        dialNumber: dialString,
        teamId,
        isExtension: loginOption === STATION_LOGIN_TYPE.EXTENSION,
        roles: [AGENT],
        deviceType: loginOption,
        deviceId: this.getDeviceId(loginOption, dialNumber, agentId),
      };

      const data = await this.httpRequest.sendRequestWithEvent({
        url: `${wccAPIURL}${LOGIN_API}`,
        method: HTTP_METHODS.POST,
        payload,
        eventType: 'StationLogin',
        success: ['AgentStationLoginSuccess'],
        failure: ['AgentStationLoginFailed'],
      });

      return data;
    } catch (error) {
      this.webex.logger.error(`Error during station login: ${error}`);

      return Promise.reject(new Error('Error while performing agent login', error));
    }
  }

  public async stationLogout(options: {logoutReason: string}): Promise<LogoutSuccess> {
    try {
      const {logoutReason} = options;
      const payload = {
        logoutReason,
      };
      await this.webex.internal.services.waitForCatalog(POST_AUTH);
      const wccAPIURL = this.webex.internal.services.get(WCC_API_GATEWAY);
      const data = await this.httpRequest.sendRequestWithEvent({
        url: `${wccAPIURL}${LOGOUT_API}`,
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
