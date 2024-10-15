import {HTTP_METHODS, WebexSDK} from '../types';

export default class AgentLogin {
  webex: WebexSDK;
  wccAPIURL: string;

  constructor(webex: WebexSDK, wccAPIURL: string) {
    this.webex = webex;
    this.wccAPIURL = wccAPIURL;
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
        roles: ['agent'],
        deviceType: agentDeviceType,
        deviceId,
      };
      const loginResponse = await this.webex.request({
        method: HTTP_METHODS.POST,
        uri: `${this.wccAPIURL}v1/agents/login`,
        body,
      });
      this.webex.logger.log('LOGIN API INVOKED');

      return loginResponse;
    } catch (error) {
      console.error('Error while performing agent login', error);

      return Promise.reject(new Error('Error while performing agent login', error));
    }
  }
}
