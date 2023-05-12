/* eslint-disable dot-notation */
/* eslint-disable no-underscore-dangle */
import SDKConnector from '../SDKConnector';
import {
  RAW_REQUEST,
  SUCCESS_MESSAGE,
  SUCCESS_STATUS_CODE,
  TRANSCRIPT,
  USER,
  XML_TYPE,
} from '../common/constants';
import {
  serviceErrorCodeHandler,
  getXsiActionEndpoint,
  getSortedVoicemailList,
  resolveContact,
  storeVoicemailList,
  fetchVoicemailList,
} from '../common/Utils';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  LoggerInterface,
  IWxCallBackendConnector,
  MessageInfo,
  VoicemailResponseEvent,
  VoicemailList,
  CALLING_BACKEND,
  CallingPartyInfo,
} from './types';
import log from '../Logger';
import {DisplayInformation, HTTP_METHODS, SORT, WebexRequestPayload} from '../common/types';
import {
  BW_XSI_ENDPOINT_VERSION,
  JSON_FORMAT,
  MARK_AS_READ,
  MARK_AS_UNREAD,
  MESSAGE_MEDIA_CONTENT,
  TRANSCRIPT_CONTENT,
  VOICE_MESSAGING_MESSAGES,
  WEBEX_CALLING_VOICEMAIL_FILE,
  NO_VOICEMAIL_MSG,
  NO_VOICEMAIL_STATUS_CODE,
  RADIX_RAND,
  PREFIX,
} from './constants';
/**
 *
 */
export class WxCallBackendConnector implements IWxCallBackendConnector {
  public xsiEndpoint!: WebexRequestPayload;

  public userId!: string;

  private context: string;

  private sdkConnector: ISDKConnector;

  private xsiVoiceMessageURI!: string;

  private webex: WebexSDK;

  /**
   * @param webex - An object of the webex-js-sdk type.
   * @param logger - Logger interface.
   */
  constructor(webex: WebexSDK, logger: LoggerInterface) {
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.context = Math.random().toString(RADIX_RAND).substring(PREFIX);
    this.webex = this.sdkConnector.getWebex();
    this.userId = this.webex.internal.device.userId;
    log.setLogger(logger.level);
  }

  /**
   * Initializing Webex calling voicemail connector.
   *
   * @returns Response.
   */
  public init() {
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'init',
    };

    log.info('Initializing Webex calling voicemail connector', loggerContext);
    const response = this.setXsiVoiceMessageURI();

    return response as unknown as VoicemailResponseEvent;
  }

  /**
   * SDK connector function.
   *
   * @returns SdkConnector.
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }

  /**
   * Register XSI URL.
   */
  private async setXsiVoiceMessageURI() {
    let responseDetails;
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'setXsiVoiceMessageURI',
    };

    this.xsiEndpoint = await getXsiActionEndpoint(this.webex, loggerContext, CALLING_BACKEND.WXC);
    log.info(`XsiEndpoint is ${this.xsiEndpoint}`, loggerContext);
    if (this.userId) {
      this.xsiVoiceMessageURI = `${this.xsiEndpoint}/${BW_XSI_ENDPOINT_VERSION}/${USER}/${this.userId}/${VOICE_MESSAGING_MESSAGES}`;
      responseDetails = {
        statusCode: SUCCESS_STATUS_CODE,
        data: {},
        message: SUCCESS_MESSAGE,
      };
    }

    return responseDetails;
  }

  /**
   * Fetch voicemail list for Webex users.
   *
   * @param sort - Sort voicemail list (ASC | DESC).
   * @param offset - Number of records to skip.
   * @param offsetLimit - Number of voicemail list to fetch from the offset.
   * @param refresh - Refresh the list of voicemails from backend.
   * @returns Promise.
   */
  public async getVoicemailList(
    offset: number,
    offsetLimit: number,
    sort: SORT,
    refresh?: boolean
  ) {
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'getVoicemailList',
    };

    log.info(`Offset: ${offset} Offset limit: ${offsetLimit} Sort type:${sort}`, loggerContext);

    let messageinfo: MessageInfo[] | undefined;

    if (refresh) {
      const urlXsi = `${this.xsiVoiceMessageURI}${JSON_FORMAT}`;

      const sortParam = Object.values(SORT).includes(sort) ? sort : SORT.DEFAULT;

      try {
        const response = <WebexRequestPayload>await this.webex.request({
          uri: `${urlXsi}`,
          method: HTTP_METHODS.GET,
        });

        const voicemailListResponse = response.body as VoicemailList;

        if (
          Object.keys(voicemailListResponse?.VoiceMessagingMessages?.messageInfoList).length === 0
        ) {
          messageinfo = [];
        } else if (
          !Array.isArray(
            voicemailListResponse?.VoiceMessagingMessages?.messageInfoList?.messageInfo
          )
        ) {
          messageinfo = Array(
            voicemailListResponse?.VoiceMessagingMessages?.messageInfoList?.messageInfo
          ) as MessageInfo[];
        } else {
          messageinfo = voicemailListResponse?.VoiceMessagingMessages?.messageInfoList
            ?.messageInfo as MessageInfo[];
          messageinfo = getSortedVoicemailList(messageinfo, sortParam);
        }

        storeVoicemailList(this.context, messageinfo);
      } catch (err: unknown) {
        const errorInfo = err as WebexRequestPayload;
        const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

        return errorStatus;
      }
    }

    const {messages, moreVMAvailable} = fetchVoicemailList(
      this.context,
      offset,
      offsetLimit,
      loggerContext
    );

    const responseDetails: VoicemailResponseEvent = {
      statusCode: moreVMAvailable ? SUCCESS_STATUS_CODE : NO_VOICEMAIL_STATUS_CODE,
      data: {
        voicemailList: messages,
      },
      message: moreVMAvailable ? SUCCESS_MESSAGE : NO_VOICEMAIL_MSG,
    };

    return responseDetails;
  }

  /**
   * Fetch the voicemail contents for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   * @returns Promise.
   */
  public async getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'getVoicemailContent',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: `${voicemailContentUrl}`,
        method: HTTP_METHODS.GET,
      });

      const parser = new DOMParser();
      const xmlDOM = parser.parseFromString(response[RAW_REQUEST].response, XML_TYPE);
      const mediaDetails = xmlDOM.getElementsByTagName(MESSAGE_MEDIA_CONTENT)[0];
      const mediaType = mediaDetails.childNodes[1]?.textContent;
      const mediaContent = mediaDetails.childNodes[2]?.textContent;

      log.info(`Media type is  ${mediaType}`, loggerContext);
      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.statusCode as number,
        data: {
          voicemailContent: {
            type: mediaType,
            content: mediaContent,
          },
        },
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      log.info(`Voice mail content error is ${errorStatus}`, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Fetch voicemail read message status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   * @returns Promise.
   */
  public async voicemailMarkAsRead(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'voicemailMarkAsRead',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}/${MARK_AS_READ}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: voicemailContentUrl,
        method: HTTP_METHODS.PUT,
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
   * Fetch voicemail unread message status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   * @returns Promise.
   */
  public async voicemailMarkAsUnread(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'voicemailMarkAsUnread',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}/${MARK_AS_UNREAD}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: voicemailContentUrl,
        method: HTTP_METHODS.PUT,
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
   * Fetch voicemail delete status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   * @returns Promise.
   */
  public async deleteVoicemail(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'deleteVoicemail',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: voicemailContentUrl,
        method: HTTP_METHODS.DELETE,
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
   * Fetch voicemail transcript for the messageId.
   *
   * @param messageId - MessageId to fetch voicemail transcript.
   * @returns Promise.
   */
  public async getVMTranscript(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: WEBEX_CALLING_VOICEMAIL_FILE,
      method: 'getVMTranscript',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}/${TRANSCRIPT}`;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: voicemailContentUrl,
        method: HTTP_METHODS.GET,
      });

      const parser = new DOMParser();
      const xmlDOM = parser.parseFromString(response[RAW_REQUEST].response, XML_TYPE);
      const transcript = xmlDOM.getElementsByTagName(TRANSCRIPT_CONTENT)[0];

      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.statusCode as number,
        data: {
          voicemailTranscript: transcript.textContent,
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
   * Resolve the Contact from userId or display name.
   *
   * @param callingPartyInfo - Calling Party Info.
   */
  public resolveContact(callingPartyInfo: CallingPartyInfo): Promise<DisplayInformation | null> {
    return resolveContact(callingPartyInfo);
  }
}
