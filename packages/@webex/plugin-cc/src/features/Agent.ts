import {LoginOption, WebexSDK} from '../types';
import HttpRequest from '../services/HttpRequest';
import AgentService from '../services/AgentService';
import {AgentLoginRequest, StateChange} from '../services/types';
import {StationLoginResponse} from './types';
import {AGENT, WEB_RTC_PREFIX} from '../services/constants';

export default class Agent {
  private webex: WebexSDK;
  private agentService: AgentService;
  private httpRequest: HttpRequest;

  constructor(webex: WebexSDK, httpRequest: HttpRequest) {
    this.webex = webex;
    this.httpRequest = httpRequest;
    this.agentService = new AgentService(webex, this.httpRequest);
  }

  private getDeviceId(loginOption: string, dialNumber: string): string {
    if (loginOption === LoginOption.EXTENSION || loginOption === LoginOption.AGENT_DN) {
      return dialNumber;
    }

    return WEB_RTC_PREFIX + dialNumber;
  }

  public async stationLogin(data: AgentLoginRequest): Promise<StationLoginResponse> {
    try {
      const loginResponse = await this.agentService.stationLogin({
        dialNumber: data.dialNumber,
        teamId: data.teamId,
        deviceType: data.loginOption,
        isExtension: data.loginOption === LoginOption.EXTENSION,
        deviceId: this.getDeviceId(data.loginOption, data.dialNumber),
        roles: [AGENT],
      });
      this.webex.logger.log('LOGIN API SUCCESS');

      return {
        data: loginResponse,
      };
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public async setAgentStatus(data: StateChange) {
    try {
      const agentStatusResponse = await this.agentService.setAgentStatus({
        state: data.state,
        auxCodeId: data.auxCodeId,
        agentId: data.agentId,
        lastStateChangeReason: data.lastStateChangeReason,
      });

      return {data: agentStatusResponse};
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
