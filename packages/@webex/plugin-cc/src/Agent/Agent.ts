import AgentLogin from '../AgentService/AgentServie';
import {LOGIN_API} from '../constants';
import {HTTP_METHODS, WebexSDK} from '../types';

export default class Agent {
  webex: WebexSDK;
  wccAPIURL: string;
  agentService: AgentLogin;

  constructor(webex: WebexSDK, wccAPIURL: string) {
    this.webex = webex;
    this.wccAPIURL = wccAPIURL;
    this.agentService = new AgentLogin(webex, wccAPIURL);
  }

  private getDeviceId(loginOption: string, dialNumber: string): string {
    if (loginOption === 'EXTENSION' || loginOption === 'AGENTDN') {
      return dialNumber;
    }

    return '';
  }

  public async stationLogin(options: {
    teamId: string;
    loginOption: string;
    dialNumber?: string;
  }): Promise<any> {
    const {teamId, loginOption, dialNumber} = options;

    try {
      const body = {
        dialNumber,
        teamId,
        isExtension: loginOption === 'EXTENSION',
        roles: ['agent'],
        deviceType: loginOption,
        deviceId: this.getDeviceId(loginOption, dialNumber),
      };
      const loginResponse = await this.webex.request({
        method: HTTP_METHODS.POST,
        uri: `${this.wccAPIURL}${LOGIN_API}`,
        body,
      });
      this.webex.logger.log('LOGIN API INVOKED');

      return loginResponse;
    } catch (error) {
      return Promise.reject(new Error('Error while performing agent login', error));
    }
  }
}
