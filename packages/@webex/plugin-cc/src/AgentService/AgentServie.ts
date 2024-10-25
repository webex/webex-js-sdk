import {AGENT, LOGIN_API} from '../constants';
import HttpRequest from '../HttpRequest';
import {HTTP_METHODS, WebexSDK} from '../types';

export default class AgentLogin {
  webex: WebexSDK;
  wccAPIURL: string;
  requestInstance: HttpRequest;

  constructor(webex: WebexSDK, wccAPIURL: string) {
    this.webex = webex;
    this.wccAPIURL = wccAPIURL;
    this.requestInstance = new HttpRequest(this.webex);
  }

  public async loginAgentWithSelectedTeam(
    teamId: string,
    agentDeviceType: string,
    deviceId: string
  ) {
    try {
      const body = {
        dialNumber: deviceId,
        teamId,
        isExtension: agentDeviceType === 'EXTENSION',
        roles: [AGENT],
        deviceType: agentDeviceType,
        deviceId,
      };

      const loginResponse = await this.requestInstance.request(
        `${this.wccAPIURL}${LOGIN_API}`,
        HTTP_METHODS.POST,
        body
      );
      this.webex.logger.log('LOGIN API INVOKED');

      return loginResponse;
    } catch (error) {
      return Promise.reject(new Error('Error while performing agent login', error));
    }
  }
}
