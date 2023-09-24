/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-shadow */
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  WebexRequestPayload,
  SORT,
  HTTP_METHODS,
  DisplayInformation,
  CALLING_BACKEND,
} from '../common/types';
import {getVgActionEndpoint, serviceErrorCodeHandler} from '../common/Utils';
import {
  SUCCESS_MESSAGE,
  USERS,
  CONTENT,
  UCM_CONNECTOR_FILE,
  FAILURE_MESSAGE,
} from '../common/constants';
import log from '../Logger';
import {API_V1, LIMIT, OFFSET, SORT_ORDER, VMGATEWAY, VOICEMAILS} from './constants';
import {
  CallingPartyInfo,
  IUcmBackendConnector,
  LoggerInterface,
  MessageInfo,
  UcmVmMessageInfo,
  UcmVMResponse,
  VoicemailResponseEvent,
  UcmVMContentResponse,
  VoicemailEvent,
  ResponseString$,
  ResponseNumber$,
} from './types';

/**
 *
 */
export class UcmBackendConnector implements IUcmBackendConnector {
  public vgEndpoint!: string | unknown;

  public userId!: string;

  public orgId!: string;

  private sdkConnector!: ISDKConnector;

  private webex: WebexSDK;

  private vgVoiceMessageURI!: string;

  /**
   * @param webex - Webex object to get the userid, service urls, etc...
   * @param logger - Logger to set logger level.
   */
  constructor(webex: WebexSDK, logger: LoggerInterface) {
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.userId = this.webex.internal.device.userId;
    this.orgId = this.webex.internal.device.orgId;
    log.setLogger(logger.level, UCM_CONNECTOR_FILE);
  }

  /**
   *
   */
  public init() {
    const loggerContext = {
      file: UCM_CONNECTOR_FILE,
      method: 'init',
    };

    log.info('Initializing UCM calling voicemail connector', loggerContext);
    const response = this.setUcmVoiceMessageBaseURI();

    return response as unknown as VoicemailResponseEvent;
  }

  /**
   *
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }

  /**
   *
   */
  private setUcmVoiceMessageBaseURI() {
    this.vgEndpoint = getVgActionEndpoint(this.webex, CALLING_BACKEND.UCM);
    this.vgVoiceMessageURI = `${this.vgEndpoint}/${VMGATEWAY}/${API_V1}/${USERS}/${this.userId}/`;

    return this.vgVoiceMessageURI;
  }

  /**
   * Fetch voicemail list for UCM users.
   *
   * @param offset - Number of records to skip.  TODO: Once we start implementing pagination.
   * @param offsetLimit - Number of voicemail list to fetch. TODO: Once we start implementing pagination.
   * @param sort - Sort voicemail list (ASC | DESC). TODO: Once we start implementing sorting.
   * @returns Promise.
   */
  public async getVoicemailList(offset: number, offsetLimit: number, sort: SORT) {
    const loggerContext = {
      file: UCM_CONNECTOR_FILE,
      method: 'getVoicemailList',
    };

    log.info(`Offset: ${offset} Offset limit: ${offsetLimit} Sort type:${sort}`, loggerContext);
    const urlVg = `${this.vgVoiceMessageURI}${VOICEMAILS}/${OFFSET}=${offset}${LIMIT}=${offsetLimit}${SORT_ORDER}=${sort}`;

    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: `${urlVg}`,
        method: HTTP_METHODS.GET,
        headers: {
          orgId: this.orgId,
        },
      });
      const msgInfo = response.body as UcmVMResponse;
      const messageinfoArray: MessageInfo[] = [];
      const ucmVmMsgInfo = msgInfo.Message as unknown as UcmVmMessageInfo[];

      ucmVmMsgInfo.forEach((msgInfoObj) => {
        const message = {} as MessageInfo;
        let stringObj = {} as ResponseString$;
        const numberObj = {} as ResponseNumber$;

        stringObj.$ = msgInfoObj.Duration;
        message.duration = stringObj;
        numberObj.$ = Number(msgInfoObj.ArrivalTime);
        message.time = numberObj;
        stringObj = {$: ''};
        stringObj.$ = msgInfoObj.MsgId;
        message.messageId = stringObj;
        if (msgInfoObj.Read === 'true') {
          message.read = {};
        }
        const callerIdObj = msgInfoObj.CallerId;
        const callingParty = {} as CallingPartyInfo;

        stringObj = {$: ''};
        stringObj.$ = callerIdObj.CallerName;
        callingParty.name = stringObj;
        stringObj = {$: ''};
        stringObj.$ = this.userId;
        callingParty.userId = stringObj;
        stringObj = {$: ''};
        stringObj.$ = callerIdObj.CallerNumber;
        callingParty.address = stringObj;
        message.callingPartyInfo = callingParty;
        messageinfoArray.push(message);
      });

      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.statusCode as number,
        data: {
          voicemailList: messageinfoArray,
        },
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * @param messageId - MessageId from voicemail list api to get voicemail content.
   */
  public async getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: UCM_CONNECTOR_FILE,
      method: 'getVoicemailContent',
    };

    try {
      const response = (await this.getVoicemailContentUcm(messageId)) as VoicemailResponseEvent;

      return response as VoicemailResponseEvent;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      log.info(`Voice mail content error is ${errorStatus}`, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Fetches a quantitative summary of voicemails for a user.
   * Not implemented for this connector.
   */
  public async getVoicemailSummary(): Promise<VoicemailResponseEvent | null> {
    return Promise.resolve(null);
  }

  /**
   * @param messageId - MessageId from voicemail list api to get voicemail content.
   */
  public async getVoicemailContentUcm(messageId: string) {
    return new Promise((resolve, reject) => {
      const voicemailContentUrl = `${this.vgVoiceMessageURI}${VOICEMAILS}/${messageId}/${CONTENT}`;
      const mercuryApi = `${this.webex.internal.services._serviceUrls.mercuryApi}`;

      this.returnUcmPromise(voicemailContentUrl, mercuryApi)
        .then((response: VoicemailResponseEvent) => {
          if (response.statusCode === 200) {
            resolve(response);
          } else if (response.statusCode === 202) {
            this.sdkConnector.registerListener(
              'event:ucm.voicemail_download_complete',
              async (event) => {
                const responseEvent = event as VoicemailEvent;
                const voicemailContentUrl = `${this.vgVoiceMessageURI}${VOICEMAILS}/${responseEvent?.data?.messageId}/${CONTENT}`;
                const response = await this.returnUcmPromise(voicemailContentUrl, mercuryApi);

                if (response.statusCode === 200) {
                  this.sdkConnector.unregisterListener('event:ucm.voicemail_download_complete');
                  resolve(response);
                } else {
                  this.sdkConnector.unregisterListener('event:ucm.voicemail_download_complete');
                  reject(response);
                }
              }
            );
          } else {
            reject(response);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  /**
   * @param voicemailContentUrl - Voicemail Content Url to get voicemail content.
   * @param mercuryApi - MercuryApi from webex serviceUrls.
   */
  async returnUcmPromise(voicemailContentUrl: string, mercuryApi: string) {
    const response = <WebexRequestPayload>await this.webex.request({
      uri: `${voicemailContentUrl}`,
      method: HTTP_METHODS.GET,
      headers: {
        orgId: this.orgId,
        deviceUrl: this.webex.internal.device.url,
        mercuryHostname: mercuryApi,
      },
    });
    const contentInfo = response?.body as UcmVMContentResponse;
    const respHeaders = response.headers;
    const statusCode = response.statusCode;
    const mediaType = respHeaders?.mediatype as string;
    const mediaContent = contentInfo as string;
    const responseDetails = {
      statusCode: statusCode as number,
      data: {
        voicemailContent: {
          type: mediaType,
          content: mediaContent,
        },
      },
      message: SUCCESS_MESSAGE,
    };

    if (statusCode !== 200 && statusCode !== 204) {
      responseDetails.message = FAILURE_MESSAGE;
    }

    return responseDetails;
  }

  /**
   * @param messageId - MessageId from voicemail list api to get voicemail mark as read.
   */
  public async voicemailMarkAsRead(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: UCM_CONNECTOR_FILE,
      method: 'voicemailMarkAsRead',
    };

    try {
      const voicemailContentUrl = `${this.vgVoiceMessageURI}${VOICEMAILS}/${messageId}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: voicemailContentUrl,
        method: HTTP_METHODS.PUT,
        headers: {
          orgId: this.orgId,
        },
        body: {
          read: 'true',
        },
      });

      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.statusCode as number,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   *  @param messageId - MessageId from voicemail list api to get voicemail mark as unread.
   */
  public async voicemailMarkAsUnread(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: UCM_CONNECTOR_FILE,
      method: 'voicemailMarkAsUnread',
    };

    try {
      const voicemailContentUrl = `${this.vgVoiceMessageURI}${VOICEMAILS}/${messageId}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: voicemailContentUrl,
        method: HTTP_METHODS.PUT,
        headers: {
          orgId: this.orgId,
        },
        body: {
          read: 'false',
        },
      });

      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.statusCode as number,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * @param messageId - MessageId from voicemail list api to delete voicemail.
   */
  public async deleteVoicemail(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: UCM_CONNECTOR_FILE,
      method: 'deleteVoicemail',
    };

    try {
      const voicemailContentUrl = `${this.vgVoiceMessageURI}${VOICEMAILS}/${messageId}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: voicemailContentUrl,
        method: HTTP_METHODS.DELETE,
        headers: {
          orgId: this.orgId,
        },
      });

      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.statusCode as number,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Fetch voicemail transcripts for given messageId
   * Not implemented for this connector.
   *
   * @param messageId - MessageId to fetch voicemail transcript.
   */
  public async getVMTranscript(messageId: string): Promise<VoicemailResponseEvent | null> {
    log.info(`Message Id: ${messageId}`, {});

    return Promise.resolve(null);
  }

  /**
   * Resolve the Contact from userId or display name.
   * Not implemented for this connector.
   *
   * @param callingPartyInfo - Calling Party Info.
   */
  public resolveContact(callingPartyInfo: CallingPartyInfo): Promise<DisplayInformation | null> {
    log.info(`Calling Party Info: ${callingPartyInfo}`, {});

    return Promise.resolve(null);
  }
}
