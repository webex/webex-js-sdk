/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

import {LOGGER, createClient} from "@webex/calling";

export default class WebexCCSDK {
  webex: any;
  callingClient: any;
  callingClientConfig: any;
  call: any;
  ccApiURL = '';
  deviceId = '';
  deviceType = '';
  registered = false;
  taskId = '';
  mediaResourceId = '';
  auxCodeId = '';
  wrapUpReason='';
  constructor(webex: any) {
    this.webex = webex;
    this.callingClientConfig = {
      logger: {
        level: LOGGER.INFO
      },
      serviceData: {
        indicator: 'contactcenter',
        domain: 'test.example.com'
      }
    }
    // this.callingClient = callingClient;
  }

  private async registerWebCallingLine() {
    this.callingClient = await createClient(this.webex, this.callingClientConfig);
    const line: any = Object.values(this.callingClient.getLines())[0];
    line.register();
    line.on('registered', (deviceInfo: any) => {
      console.log(`WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`);
      // Emit the final register success event from CC SDK from here for Desktop Login
    });
  
    // Start listening for incoming calls
    line.on('line:incoming_call', (callObj: any) => {
      this.call = callObj;
      const incomingCallEvent = new CustomEvent('line:incoming_call', {
        detail: {
          call: this.call,
        },
      });

      window.dispatchEvent(incomingCallEvent);

      this.call.on('caller_id', (CallerIdEmitter: any) => {
        console.log(
          `callerId : Name: ${CallerIdEmitter.callerId.name}, Number: ${CallerIdEmitter.callerId.name}, Avatar: ${CallerIdEmitter.callerId.avatarSrc}, UserId: ${CallerIdEmitter.callerId.id}`
        );
      });
    });
  }

  private handleAgentEvents = (payload: any) => {
    console.log('WxCC-SDK: Event Data: ', payload);
    switch (payload.data.type) {
      case 'AgentStationLoginSuccess': {
        console.log('WxCC-SDK: Station Login Success');
        if(payload.data.deviceType === 'BROWSER') {
          this.registerWebCallingLine();
        } else {
           // Emit the final register success event from CC SDK from here for EXtension/DN Login
        }
        this.deviceType = payload.data.deviceType;
        break;
      }

      case 'AgentStationLoginFailed': {
        const failureReason = payload.data.reason;
        const failureReasonCode = payload.data.reasonCode;
        console.log(`WxCC-SDK: Station Login Failed due to ${failureReasonCode}: ${failureReason}`);
        break;
      }

      case 'AgentStateChangeSuccess': {
        console.log('WxCC-SDK: State change: ', payload.data.subStatus);
        break;
      }

      case 'AgentReloginSuccess': {
        break;
      }

      case 'AgentReloginFailed': {
        break;
      }

      case 'AgentContactReserved': {
        console.log('WxCC-SDK: Agent Contact Reserved event: ', payload.data.interactionId);
        this.taskId = payload.data.interactionId;
        break;
      }

      case 'AgentOfferContact': {
        this.mediaResourceId = payload.data.mediaResourceId;
        break;
      }

      case 'AgentContactAssigned': {
        console.log('WxCC-SDK: AgentContactAssigned indicating call has been answered');
        const enableControlsEvent = new CustomEvent('enable-controls', {
          detail: {
            deviceType: this.deviceType
          }
        });
        window.dispatchEvent(enableControlsEvent);
        break;
      }

      case 'AgentContactAssignFailed': {
        console.log('WxCC-SDK: AgentContactAssignedFailed indicating call answer failed');
        break;
      }

      case 'AgentOfferContactRona': {
        console.log('WxCC-SDK: AgentOfferContactRona received');
        break;
      }

      case 'AgentContactHeld': {
        console.log('WxCC-SDK: Hold task was executed succesfully');
        break;
      }

      case 'AgentContactUnHeld': {
        console.log('WxCC-SDK: Resume task was executed succesfully');
        break;
      }

      case 'ContactEnded': {
        const reason = payload.data.reason;
        console.log('WxCC-SDK: Call ended due to ', reason);
        break;
      }

      case 'AgentWrapup': {

        break;
      }

      case 'AgentContactWrappedUp': {
        break;
      }

      case 'ContactRecordingStarted': {
        break;
      }

      case 'AgentOfferConsult': {
        break;
      }

      case 'AgentConsultCreated': {
        break;
      }

      case 'AgentConsultEnded': {
        break;
      }

      case 'AgentConsultFailed': {
        break;
      }

      case 'AgentConsultEndFailed': {
        break;
      }

      case 'AgentConsulting': {
        break;
      }

      case 'ConsultTransfer': {
        break;
      }
      
      default: {
        break;
      }
    }
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
        .then((res: any) => {
          for(const item of res.data) {
            if (item.workTypeCode === 'WRAP_UP_CODE') {
              this.auxCodeId = item.id;
              this.wrapUpReason = item.name;
            }
          }
        });
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
        this.webex.internal.llmcc.off('event', this.handleAgentEvents);
        // @ts-ignore - Fix type

        this.webex.internal.llmcc.on('event', this.handleAgentEvents);
        console.log('Meeting:index#updateLLMConnection --> enabled to receive relay events!');

        return Promise.resolve(registerAndConnectResult);
      });
  }

  public async loginAgentWithSelectedTeam(teamId: string, agentDeviceType: string, deviceId: string): Promise<number> {
    const body = {
      dialNumber: deviceId,
      teamId,
      isExtension: agentDeviceType === 'EXTENSION' ? true : false,
      roles: ['agent'],
      deviceType: agentDeviceType,
      deviceId: deviceId,
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

  public async buddyAgent(): Promise<number> {
    try {
      const response = await this.webex.request({
        method: 'PUT',
        uri: `${this.ccApiURL}v1/agents/buddyList`,
        body: {
          agentProfileId: '25126bcc-e54e-45ba-92c5-cfe744395bfc',
          mediaType: 'telephony',
        }
      });

      return response.statusCode;
    } catch (error: any) {
      throw new Error(
        `Failed to get buddy agent: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  public async acceptTask(taskId: string): Promise<number> {
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/accept`,
      });

      console.log('Accept task response.statusCode: ', response.statusCode);

      return response.statusCode; // Note: `statusCode` is typically used in webex.request
    } catch (error: any) {
      throw new Error(
        `Failed to accept task: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  // For outbound request, create the task
  public async createTask(): Promise<any> {
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks`,
        body: {
          destination:'dialed number',
          entryPointId: '',
          outboundType: "OUTDIAL",
          mediaType: 'telephony',
          origin: 'source number',
        }
      });

      console.log('Create task response ', response);

      return response.data; // This data will have the taskID
    } catch (error: any) {
      throw new Error(
        `Failed to create task: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  // To put call on hold, applicable for all types of login
  public async holdTask(taskId: string): Promise<number> {
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/hold`,
        body: {
          mediaResourceId: this.mediaResourceId
        }
      });

      console.log('Hold task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to hold task: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

   // To resume the held call, applicable for all types of login
   public async resumeTask(taskId: string): Promise<number> {
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/unhold`,
        body: {
          mediaResourceId: this.mediaResourceId
        }
      });

      console.log('Resume task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to resume task: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

 // To initiate a consult, applicable for all types of login
  public async consultTask(consultDest: string, consultDestType: string): Promise<number> {
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/consult`,
        body: {
          to: consultDest,   // This would be the value for agent or the entrypoint number entered for consult
          destinationType: consultDestType,  // This would be agent or dial number
        }
      });

      console.log('Consult task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to consult: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

   // To initiate a consult, applicable for all types of login
   public async consultEndTask(): Promise<number> {
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/consult/end`,
      });

      console.log('Consult end task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to end consult: ${error.response?.body?.error_description || error.message}`
      );
    }
  }
  
  // To initiate a transfer, applicable for all types of login for direct transfer using buddy agent/dial number
  public async transferTask(transferDest: string, transferDestType: string): Promise<number> {
    // Fetch buddy list first and choose based on that
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/transfer`,
        body: {
          to: transferDest,   // This would be the value for agent or the entrypoint number entered for consult
          destinationType: transferDestType,  // This would be agent or dial number
        }
      });

      console.log('Transfer task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to direct transfer: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

    // To initiate a transfer, applicable for all types of login for consult transfer using buddy agent/dial number
    public async consultTransferTask(transferDest: string, transferDestType: string): Promise<number> {
      // Fetch buddy list first and choose based on that
      try {
        const response = await this.webex.request({
          method: 'POST',
          uri: `${this.ccApiURL}v1/tasks/${this.taskId}/consult/transfer`,
          body: {
            to: transferDest,   // This would be the value for agent or the entrypoint number entered for consult
            destinationType: transferDestType,  // This would be agent or dial number
          }
        });
  
        console.log('Consult Transfer task response: ', response);
  
        return response
      } catch (error: any) {
        throw new Error(
          `Failed to consult transfer: ${error.response?.body?.error_description || error.message}`
        );
      }
    }

  public async pauseRecordingTask(): Promise<number> {
    // Fetch buddy list first and choose based on that
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/record/pause`,
      });

      console.log('Pause recording task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to pause recording: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  public async resumeRecordingTask(): Promise<number> {
    // Fetch buddy list first and choose based on that
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/record/resume`,
        body: {
          autoResumed: false
        }
      });

      console.log('Resume recording task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to resume recording: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  // Only applicable for webtrc calls, not applicable for extension/dn login
  public async endTask(taskId: string): Promise<number> {
    // Fetch buddy list first and choose based on that
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/end`,
      });

      console.log('Consult task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to consult: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  public async wrapUpTask(taskId: string): Promise<number> {
    // Fetch buddy list first and choose based on that
    try {
      const response = await this.webex.request({
        method: 'POST',
        uri: `${this.ccApiURL}v1/tasks/${this.taskId}/wrapup`,
        body: {
          auxCodeId: '2acaf3db-2dd6-4676-be92-176125aa4284',
          wrapUpReason: 'Sale'
        }
      });

      console.log('WrapUp task response: ', response);

      return response
    } catch (error: any) {
      throw new Error(
        `Failed to wrapup: ${error.response?.body?.error_description || error.message}`
      );
    }
  }

  public async muteUnmute() {

  }
  
}
