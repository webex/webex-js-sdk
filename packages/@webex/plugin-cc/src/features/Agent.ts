import {STATION_LOGIN_TYPE, WebexSDK} from '../types';
import HttpRequest from '../services/HttpRequest';
import AgentService from '../services/AgentService';
import {LogoutSuccess, StationLoginSuccess} from '../services/types';

export default class Agent {
  private webex: WebexSDK;
  private agentService: AgentService;
  private httpRequest: HttpRequest;

  constructor(webex: WebexSDK, httpRequest: HttpRequest) {
    this.webex = webex;
    this.httpRequest = httpRequest;
    this.agentService = new AgentService(webex, this.httpRequest);
  }

  public async stationLogin(options: {
    teamId: string;
    loginOption: STATION_LOGIN_TYPE;
    dialNumber?: string; // only used when loginOption is AGENT_DN or EXTENSION
  }): Promise<StationLoginSuccess> {
    const {teamId, loginOption, dialNumber} = options;

    try {
      const loginResponse = await this.agentService.stationLogin({
        teamId,
        loginOption,
        dialNumber,
      });
      this.webex.logger.log('LOGIN API SUCCESS');

      return loginResponse;
    } catch (error) {
      return Promise.reject(new Error('Error while performing agent login', error));
    }
  }

  public async stationLogout(options: {logoutReason: string}): Promise<LogoutSuccess> {
    const {logoutReason} = options;

    try {
      const response = await this.agentService.stationLogout({
        logoutReason,
      });
      this.webex.logger.log('Logout API SUCCESS');

      return response;
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
