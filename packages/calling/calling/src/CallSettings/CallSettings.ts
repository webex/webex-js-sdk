import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  ICallSettings,
  LoggerInterface,
  ToggleSetting,
  CallForwardSetting,
  CallSettingResponse,
  VoicemailSetting,
} from './types';
import log from '../Logger';
import {WebexRequestPayload, HTTP_METHODS, DecodeType} from '../common/types';
import {
  ITEMS,
  SERVICES_ENDPOINT,
  STATUS_CODE,
  SUCCESS_MESSAGE,
  XML_TYPE,
  XSI_ACTION_ENDPOINT,
  XSI_ACTION_ENDPOINT_ORG_URL_PARAM,
} from '../common/constants';
import {
  CALL_SETTINGS_FILE,
  CALL_WAITING_ENDPOINT,
  CF_ENDPOINT,
  DND_ENDPOINT,
  ORG_ENDPOINT,
  PEOPLE_ENDPOINT,
  USER_ENDPOINT,
  VM_ENDPOINT,
  XSI_VERSION,
} from './constants';
import {inferIdFromUuid, serviceErrorCodeHandler} from '../common/Utils';

/**
 *
 */
export class CallSettings implements ICallSettings {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private hydraEndpoint: string;

  private userId?: string;

  private personId: string;

  private orgId: string;

  private xsiEndpoint?: string;

  /**
   * @param webex - A webex instance.
   * @param logger - Logger to set logger level.
   */
  constructor(webex: WebexSDK, logger: LoggerInterface) {
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }

    this.webex = this.sdkConnector.getWebex();
    /* eslint no-underscore-dangle: 0 */
    this.hydraEndpoint = this.webex.internal.services._serviceUrls.hydra;
    log.setLogger(logger.level);
    this.userId = this.webex.internal.device.userId;
    this.personId = inferIdFromUuid(this.webex.internal.device.userId, DecodeType.PEOPLE);
    this.orgId = inferIdFromUuid(this.webex.internal.device.orgId, DecodeType.ORGANIZATION);
  }

  /**
   * Reads call waiting setting at the backend.
   *
   * @returns Promise<CallSettingResponse>.
   */
  public async getCallWaitingSetting() {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'getCallWaitingSetting',
    };

    try {
      const userIdResponse = <WebexRequestPayload>await this.webex.request({
        uri: `${this.hydraEndpoint}/${XSI_ACTION_ENDPOINT_ORG_URL_PARAM}`,
        method: HTTP_METHODS.GET,
      });
      const responseUrl = userIdResponse.body as WebexRequestPayload;

      this.xsiEndpoint = responseUrl[ITEMS][0][XSI_ACTION_ENDPOINT];

      const callWaitingUrl = `${this.xsiEndpoint}/${XSI_VERSION}/${USER_ENDPOINT}/${this.userId}/${SERVICES_ENDPOINT}/${CALL_WAITING_ENDPOINT}`;

      const response = await fetch(`${callWaitingUrl}`, {
        method: HTTP_METHODS.GET,
        headers: {
          Authorization: await this.webex.credentials.getUserToken(),
        },
      });

      if (!response.ok) {
        /* Throw error code if any the exception error */
        throw new Error(`${response.status}`);
      }
      const xmlData = await response.text();
      const parser = new DOMParser();
      const xmlDOM = parser.parseFromString(xmlData, XML_TYPE);
      const callWaitingDetails = xmlDOM.getElementsByTagName('active');
      const status = callWaitingDetails[0].childNodes[0].textContent;

      const toggleSetting: ToggleSetting = {
        enabled: status === 'true',
      };
      const responseDetails: CallSettingResponse = {
        statusCode: 200,
        data: {
          callSetting: toggleSetting,
        },
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      const errorInfo = {
        statusCode: err instanceof Error ? Number(err.message) : '',
      } as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Reads DND setting at the backend.
   *
   * @returns Promise<CallSettingResponse>.
   */
  public async getDoNotDisturbSetting(): Promise<CallSettingResponse> {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'getDoNotDisturbSetting',
    };

    try {
      const resp = <WebexRequestPayload>await this.webex.request({
        uri: `${this.hydraEndpoint}/${PEOPLE_ENDPOINT}/${this.personId}/${DND_ENDPOINT}?${ORG_ENDPOINT}=${this.orgId}`,
        method: HTTP_METHODS.GET,
      });
      const dndSettingResponse = resp.body as ToggleSetting;
      const responseDetails: CallSettingResponse = {
        statusCode: resp[STATUS_CODE] as number,
        data: {
          callSetting: dndSettingResponse,
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
   * Updates DND setting at the backend.
   *
   * @param enabled - Boolean value to set.
   * @returns Promise<CallSettingResponse>.
   */
  public async setDoNotDisturbSetting(enabled: boolean): Promise<CallSettingResponse> {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'setDoNotDisturbSetting',
    };

    try {
      const dndRequestBody: ToggleSetting = {
        enabled,
        ringSplashEnabled: false,
      };

      const resp = <WebexRequestPayload>await this.webex.request({
        uri: `${this.hydraEndpoint}/${PEOPLE_ENDPOINT}/${this.personId}/${DND_ENDPOINT}?${ORG_ENDPOINT}=${this.orgId}`,
        method: HTTP_METHODS.PUT,
        body: dndRequestBody,
      });

      const responseDetails: CallSettingResponse = {
        statusCode: resp[STATUS_CODE] as number,
        data: {
          callSetting: dndRequestBody,
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
   * Reads Call Forward setting at the backend.
   *
   * @returns Promise<CallSettingResponse>.
   */
  public async getCallForwardSetting(): Promise<CallSettingResponse> {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'getCallForwardingSetting',
    };

    try {
      const resp = <WebexRequestPayload>await this.webex.request({
        uri: `${this.hydraEndpoint}/${PEOPLE_ENDPOINT}/${this.personId}/${CF_ENDPOINT}?${ORG_ENDPOINT}=${this.orgId}`,
        method: HTTP_METHODS.GET,
      });
      const cfResponse = resp.body as CallForwardSetting;
      const responseDetails: CallSettingResponse = {
        statusCode: resp[STATUS_CODE] as number,
        data: {
          callSetting: cfResponse,
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
   * Updates Call Forward setting at the backend.
   *
   * @param callForwardingRequest - Values to be updated.
   * @returns Promise<CallSettingResponse>.
   */
  public async setCallForwardSetting(
    callForwardingRequest: CallForwardSetting
  ): Promise<CallSettingResponse> {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'setCallForwardingSetting',
    };

    try {
      const resp = <WebexRequestPayload>await this.webex.request({
        uri: `${this.hydraEndpoint}/${PEOPLE_ENDPOINT}/${this.personId}/${CF_ENDPOINT}?${ORG_ENDPOINT}=${this.orgId}`,
        method: HTTP_METHODS.PUT,
        body: callForwardingRequest,
      });

      const responseDetails: CallSettingResponse = {
        statusCode: resp[STATUS_CODE] as number,
        data: {
          callSetting: callForwardingRequest,
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
   * Reads Voicemail setting at the backend.
   *
   * @returns Promise<CallSettingResponse>.
   */
  public async getVoicemailSetting(): Promise<CallSettingResponse> {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'getVoicemailSetting',
    };

    try {
      const resp = <WebexRequestPayload>await this.webex.request({
        uri: `${this.hydraEndpoint}/${PEOPLE_ENDPOINT}/${this.personId}/${VM_ENDPOINT}?${ORG_ENDPOINT}=${this.orgId}`,
        method: HTTP_METHODS.GET,
      });
      const vmResponse = resp.body as VoicemailSetting;
      const responseDetails: CallSettingResponse = {
        statusCode: resp[STATUS_CODE] as number,
        data: {
          callSetting: vmResponse,
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
   * Updates Voicemail setting at the backend.
   *
   * @param voicemailRequest - Values to be updated.
   * @returns Promise<CallSettingResponse>.
   */
  public async setVoicemailSetting(
    voicemailRequest: VoicemailSetting
  ): Promise<CallSettingResponse> {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'setVoicemailSetting',
    };

    try {
      const resp = <WebexRequestPayload>await this.webex.request({
        uri: `${this.hydraEndpoint}/${PEOPLE_ENDPOINT}/${this.personId}/${VM_ENDPOINT}?${ORG_ENDPOINT}=${this.orgId}`,
        method: HTTP_METHODS.PUT,
        body: voicemailRequest,
      });

      const responseDetails: CallSettingResponse = {
        statusCode: resp[STATUS_CODE] as number,
        data: {
          callSetting: voicemailRequest,
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
   * SDK connector function.
   *
   * @returns SdkConnector.
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }
}

/**
 * @param webex - A webex instance.
 * @param logger - Logger to set logger level.
 */
export const createCallSettingsClient = (webex: WebexSDK, logger: LoggerInterface): ICallSettings =>
  new CallSettings(webex, logger);
