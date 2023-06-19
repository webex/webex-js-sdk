/* eslint-disable no-underscore-dangle */
import {ERROR_CODE} from '../Errors/types';
import SDKConnector from '../SDKConnector';
import {
  BASE64,
  BEARER,
  BINARY,
  SUCCESS_MESSAGE,
  SUCCESS_STATUS_CODE,
  OBJECT,
  TOKEN,
  USER,
  XML_TYPE,
} from '../common/constants';
import {
  serviceErrorCodeHandler,
  getXsiActionEndpoint,
  getSortedVoicemailList,
  storeVoicemailList,
  fetchVoicemailList,
} from '../common/Utils';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  IBroadworksCallBackendConnector,
  MessageInfo,
  VoicemailResponseEvent,
  BroadworksTokenType,
  VoicemailList,
  CALLING_BACKEND,
  CallingPartyInfo,
} from './types';
import log from '../Logger';
import {DisplayInformation, HTTP_METHODS, SORT, WebexRequestPayload} from '../common/types';
import {
  BROADWORKS_VOICEMAIL_FILE,
  BW_TOKEN_FETCH_ENDPOINT,
  BW_XSI_ENDPOINT_VERSION,
  JSON_FORMAT,
  MARK_AS_READ,
  MARK_AS_UNREAD,
  MESSAGE_MEDIA_CONTENT,
  VOICE_MESSAGING_MESSAGES,
  NO_VOICEMAIL_MSG,
  NO_VOICEMAIL_STATUS_CODE,
  RADIX_RAND,
  PREFIX,
} from './constants';
import {LoggerConfig} from '../Logger/types';
/**
 *
 */
export class BroadworksBackendConnector implements IBroadworksCallBackendConnector {
  public bwtoken!: string;

  public userId!: string;

  public xsiAccessToken!: string;

  public xsiEndpoint!: WebexRequestPayload;

  private context: string;

  private sdkConnector!: ISDKConnector;

  private webex: WebexSDK;

  private xsiVoiceMessageURI!: string;

  /**
   * @param webex -.
   * @param logger -.
   */
  constructor(webex: WebexSDK, logger: LoggerConfig) {
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.context = Math.random().toString(RADIX_RAND).substring(PREFIX);
    log.setLogger(logger.level);
  }

  /**
   * Initializing Broadworks voicemail connector.
   *
   * @returns Response.
   */
  public init() {
    const loggerContext = {
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'init',
    };

    log.info('Initializing Broadworks voicemail connector', loggerContext);

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
   * Decoding the userId from the broadworks token.
   */
  private async getUserId() {
    const loggerContext = {
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'getUserId',
    };

    try {
      await this.getBwToken();
      if (this.bwtoken && this.bwtoken.split('.').length > 1) {
        const decodedString = Buffer.from(this.bwtoken.split('.')[1], BASE64).toString(BINARY);

        this.userId = JSON.parse(decodedString).sub;

        return this.userId;
      }

      const error = ERROR_CODE.UNAUTHORIZED;

      /* If the token is not valid, throw 401 and stop the execution */
      throw new Error(`${error}`);
    } catch (err: unknown) {
      /* Catch the 401 error from try block, return the error object to user */
      const errorInfo = {
        statusCode: err instanceof Error ? Number(err.message) : '',
      } as WebexRequestPayload;

      return serviceErrorCodeHandler(errorInfo, loggerContext);
    }
  }

  /**
   * Fetch the Broadworks token.
   */
  private async getBwToken() {
    try {
      const bwTokenResponse = await (<WebexRequestPayload>this.webex.request({
        uri: `${this.webex.internal.services._serviceUrls.broadworksIdpProxy}${BW_TOKEN_FETCH_ENDPOINT}`,
        method: HTTP_METHODS.GET,
      }));

      const response = bwTokenResponse.body as BroadworksTokenType;

      this.bwtoken = response[TOKEN][BEARER];
    } catch (err: unknown) {
      log.info(`Broadworks token exception ${err}`, {});
    }
  }

  /**
   * Register XSI URL.
   */
  private async setXsiVoiceMessageURI() {
    const loggerContext = {
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'setXsiVoiceMessageURI',
    };

    let userIdResponse = await this.getUserId();

    this.xsiEndpoint = await getXsiActionEndpoint(this.webex, loggerContext, CALLING_BACKEND.BWRKS);
    this.xsiAccessToken = `${BEARER} ${this.bwtoken}`;
    log.info(`XsiEndpoint is ${this.xsiEndpoint}`, loggerContext);

    if (userIdResponse && typeof userIdResponse !== OBJECT) {
      this.xsiVoiceMessageURI = `${this.xsiEndpoint}/${BW_XSI_ENDPOINT_VERSION}/${USER}/${userIdResponse}/${VOICE_MESSAGING_MESSAGES}`;
      userIdResponse = {
        statusCode: SUCCESS_STATUS_CODE,
        data: {},
        message: SUCCESS_MESSAGE,
      };
    }

    return userIdResponse;
  }

  /**
   * Fetch voicemail list for Broadworks user.
   *
   * @param sort - Sort voicemail list (ASC | DESC). TODO: Once we start implementing sorting.
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
  ): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'getVoicemailList',
    };

    log.info(`Offset: ${offset} Offset limit: ${offsetLimit} Sort type:${sort}`, loggerContext);
    const urlXsi = `${this.xsiVoiceMessageURI}${JSON_FORMAT}`;
    let messageinfo: MessageInfo[] | undefined;
    const sortParam = Object.values(SORT).includes(sort) ? sort : SORT.DEFAULT;

    if (refresh) {
      try {
        const response = await fetch(`${urlXsi}`, {
          method: HTTP_METHODS.GET,
          headers: {
            Authorization: this.xsiAccessToken,
          },
        });

        if (!response.ok) {
          /* Throw error code if any the exception error */
          throw new Error(`${response.status}`);
        }
        const voicemailListResponse = (await response.json()) as VoicemailList;

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
        /* Catch the exception error code from try block, return the error object to user */
        const errorInfo = {
          statusCode: err instanceof Error ? Number(err.message) : '',
        } as WebexRequestPayload;
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
   * @param messageId - String result from the voicemail list.
   * @returns Promise.
   */
  public async getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent> {
    const loggerContext = {
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'getVoicemailContent',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}`;
      const response = await fetch(`${voicemailContentUrl}`, {
        method: 'GET',
        headers: {
          Authorization: this.xsiAccessToken,
        },
      });

      if (!response.ok) {
        /* Throw error code if any the exception error */
        throw new Error(`${response.status}`);
      }
      const xmlData = await response.text();
      const parser = new DOMParser();
      const xmlDOM = parser.parseFromString(xmlData, XML_TYPE);
      const mediaDetails = xmlDOM.getElementsByTagName(MESSAGE_MEDIA_CONTENT)[0];
      const mediaType = mediaDetails.childNodes[1]?.textContent;
      const mediaContent = mediaDetails.childNodes[2]?.textContent;

      log.info(`Media type is  ${mediaType}`, loggerContext);
      const responseDetails: VoicemailResponseEvent = {
        statusCode: response?.status,
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
      /* Catch the exception error code from try block, return the error object to user */
      const errorInfo = {
        statusCode: err instanceof Error ? Number(err.message) : '',
      } as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

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
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'voicemailMarkAsRead',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}/${MARK_AS_READ}`;
      const response = await fetch(voicemailContentUrl, {
        method: HTTP_METHODS.PUT,
        headers: {
          Authorization: this.xsiAccessToken,
        },
      });

      if (!response.ok) {
        /* Throw error code if any the exception error */
        throw new Error(`${response.status}`);
      }

      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.status,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      /* Catch the exception error code from try block, return the error object to user */
      const errorInfo = {
        statusCode: err instanceof Error ? Number(err.message) : '',
      } as WebexRequestPayload;
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
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'voicemailMarkAsUnread',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}/${MARK_AS_UNREAD}`;
      const response = await fetch(voicemailContentUrl, {
        method: HTTP_METHODS.PUT,
        headers: {
          Authorization: this.xsiAccessToken,
        },
      });

      if (!response.ok) {
        /* Throw error code if any the exception error */
        throw new Error(`${response.status}`);
      }

      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.status,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      /* Catch the exception error code from try block, return the error object to user */
      const errorInfo = {
        statusCode: err instanceof Error ? Number(err.message) : '',
      } as WebexRequestPayload;
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
      file: BROADWORKS_VOICEMAIL_FILE,
      method: 'deleteVoicemail',
    };

    try {
      const voicemailContentUrl = `${this.xsiEndpoint}${messageId}`;
      const response = await fetch(voicemailContentUrl, {
        method: HTTP_METHODS.DELETE,
        headers: {
          Authorization: this.xsiAccessToken,
        },
      });

      if (!response.ok) {
        /* Throw error code if any the exception error */
        throw new Error(`${response.status}`);
      }
      const responseDetails: VoicemailResponseEvent = {
        statusCode: response.status,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      /* Catch the exception error code from try block, return the error object to user */
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
