import {WebexSDK, HTTP_METHODS} from '../types';
import {LOGIN_API, STATE_CHANGE_API, WCC_API_GATEWAY} from './constants';
import HttpRequest from './HttpRequest';
import {StateChange, StateChangeSuccess, StationLoginSuccess, UserStationLogin} from './types';

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

  public async setAgentStatus(data: StateChange): Promise<StateChangeSuccess> {
    try {
      const payload = {
        state: data.state,
        auxCodeId: data.auxCodeId,
        agentId: data.agentId,
        lastStateChangeReason: data.lastStateChangeReason,
      };

      const response = await this.httpRequest.sendRequestWithEvent({
        service: WCC_API_GATEWAY,
        resource: STATE_CHANGE_API,
        method: HTTP_METHODS.PUT,
        payload,
        eventType: 'AgentStateChange',
        success: ['AgentStateChangeSuccess'],
        failure: ['AgentStateChangeFailed'],
      });

      return response;
    } catch (error) {
      this.webex.logger.error(`Error during state change: ${error}`);

      return Promise.reject(error);
    }
  }
}
