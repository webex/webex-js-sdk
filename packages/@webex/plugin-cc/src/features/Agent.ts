import {STATION_LOGIN_TYPE, WebexSDK} from '../types';
import AsyncRequestHandler from '../services/AsyncRequestHandler';
import AgentService from '../services/AgentService';
import {StationLoginSuccess} from '../services/types';

export default class Agent {
  private webex: WebexSDK;
  private agentService: AgentService;
  private asyncRequestHandler: AsyncRequestHandler;

  constructor(webex: WebexSDK, asyncRequestHandler: AsyncRequestHandler) {
    this.webex = webex;
    this.asyncRequestHandler = asyncRequestHandler;
    this.agentService = new AgentService(webex, this.asyncRequestHandler);
  }

  public async stationLogin(options: {
    teamId: string;
    loginOption: STATION_LOGIN_TYPE;
    dialNumber?: string; // only used when loginOption is AGENT_DN or EXTENSION
    agentId: string;
  }): Promise<StationLoginSuccess> {
    const {teamId, loginOption, dialNumber, agentId} = options;

    try {
      const loginResponse = await this.agentService.stationLogin({
        teamId,
        loginOption,
        dialNumber,
        agentId,
      });
      this.webex.logger.log('LOGIN API SUCCESS');

      return loginResponse;
    } catch (error) {
      return Promise.reject(new Error('Error while performing agent login', error));
    }
  }

  public async stationLogout(options: {logoutReason: string}): Promise<any> {
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
