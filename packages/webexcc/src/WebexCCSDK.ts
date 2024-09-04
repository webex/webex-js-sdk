/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

export default class WebexCCSDK {
  webex: any;
  ccApiURL = '';
  deviceId = '';
  registered = false;
  constructor(webex: any) {
    this.webex = webex;
  }

  public isRegistred(): boolean {
    return this.registered;
  }

  public async register() {
    if (this.registered) {
      console.log('CC: register --> INFO, already registered');

      return Promise.resolve();
    }

    return (
      this.webex.internal.device
        .register()
        // @ts-ignore
        .then(() => {
          this.registered = true;
          const deviceId = this.webex.internal.device.getId();
          const deviceIdParts = deviceId.split('/');
          this.deviceId = deviceIdParts[deviceIdParts.length - 1];
          console.log('Device registered: ', this.deviceId);
        })
    );
  }

  public async unregister() {
    if (!this.registered) {
      console.log('CC: unregister --> INFO, already unregistered');

      return Promise.resolve();
    }

    return (
      // @ts-ignore
      this.webex.internal.llmcc
        .disconnect()
        // @ts-ignore
        .then(() => this.webex.internal.device.unregister())
        .then(() => {
          this.registered = false;
          console.log('CC: unregister --> INFO, unregistered');
        })
    );
  }

  // Step 3: Get teams for a specific organization
  public async getTeams(): Promise<any> {
    try {
      await this.webex.internal.services.waitForCatalog('postauth');
      this.ccApiURL = this.webex.internal.services.get('wcc-api-gateway');
      const orgId = this.webex.credentials.getOrgId();
      console.log('getTeams: %d');
      this.subscribeNotifications();

      return this.webex
        .request({
          method: 'GET',
          uri: `${this.ccApiURL}organization/${orgId}/team`,
        })
        .then((res: any) => res.body);
    } catch (error: any) {
      throw new Error(
        `Failed to get teams: ${error.response?.data?.error_description || error.message}`
      );
    }
  }

  public async listAuxiliaryCodes(
    filter?: string,
    attributes?: string,
    page = 0,
    pageSize = 10
  ): Promise<any> {
    const params: any = {
      page,
      pageSize,
    };

    if (filter) {
      params.filter = filter;
    }

    if (attributes) {
      params.attributes = attributes;
    }

    try {
      const orgId = this.webex.credentials.getOrgId();

      return this.webex
        .request({
          method: 'GET',
          uri: `${this.ccApiURL}organization/${orgId}/v2/auxiliary-code`,
          qs: params,
        })
        .then((res: any) => res.body);
    } catch (error: any) {
      throw new Error(
        `Failed to list auxiliary codes: ${
          error.response?.body?.error_description || error.message
        }`
      );
    }
  }

  public async subscribeNotifications(): Promise<void> {
    return this.webex.internal.llmcc
      .registerWithBodyAndConnect(`${this.ccApiURL}v1/notification/subscribe`, {
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: true,
        force: true,
      })
      .then((registerAndConnectResult: any) => {
        // @ts-ignore - Fix type
        this.webex.internal.llmcc.off('event', ({data}) => {
          console.log('event: eventdata:  ', data);
        });
        // @ts-ignore - Fix type

        this.webex.internal.llmcc.on('event', ({data}) => {
          console.log('event: cc Event:  ', data);
        });
        console.log('Meeting:index#updateLLMConnection --> enabled to receive relay events!');

        return Promise.resolve(registerAndConnectResult);
      });
  }

  public async acceptTask(taskId: string): Promise<number> {
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${taskId}/accept`,
      });

      console.log('Accept task response.statusCode: ', response.statusCode);

      return response.statusCode; // Note: `statusCode` is typically used in webex.request
    } catch (error: any) {
      throw new Error(
        `Failed to accept task: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  public async loginAgentWithSelectedTeam(teamId: string): Promise<number> {
    const body = {
      dialNumber: this.deviceId,
      teamId,
      isExtension: true,
      roles: ['agent'],
      deviceType: 'BROWSER',
      deviceId: this.deviceId,
    };

    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/agents/login`,
        body,
      });
      console.log('login  response.statusCode:  ', response.statusCode);

      return response.statusCode; // Note: `statusCode` is typically used in webex.request
    } catch (error: any) {
      throw new Error(
        `Failed to login agent: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  public async logoutAgent(logoutReason: string): Promise<number> {
    const body = {
      logoutReason,
    };

    try {
      const response = await this.webex.request({
        method: 'PUT',
        uri: `${this.ccApiURL}v1/agents/logout`,
        body,
      });

      return response.statusCode; // Note: `statusCode` is typically used in webex.request
    } catch (error: any) {
      throw new Error(
        `Failed to logout agent: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  public async changeAgentState(
    state: string,
    auxCodeId: string,
    agentId: string,
    lastStateChangeReason?: string
  ): Promise<number> {
    const body = {
      state,
      auxCodeId,
      ...(lastStateChangeReason && {lastStateChangeReason}),
    };

    try {
      const response = await this.webex.request({
        method: 'PUT',
        uri: `${this.ccApiURL}v1/agents/session/state`,
        body,
      });

      return response.statusCode; // Note: `statusCode` is typically used in webex.request
    } catch (error: any) {
      throw new Error(
        `Failed to change agent state: ${error.response?.body?.error_description || error.message}`
      );
    }
  }
}
