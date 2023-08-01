import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  LoggerInterface,
  ToggleSetting,
  CallForwardSetting,
  CallSettingResponse,
  VoicemailSetting,
  IWxCallBackendConnector,
  CallForwardAlwaysSetting,
} from './types';
import log from '../Logger';
import {WebexRequestPayload, HTTP_METHODS, DecodeType, CALLING_BACKEND} from '../common/types';
import {
  SERVICES_ENDPOINT,
  STATUS_CODE,
  SUCCESS_MESSAGE,
  XML_TYPE,
  WEBEX_CALLING_CONNECTOR_FILE,
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
import {getXsiActionEndpoint, inferIdFromUuid, serviceErrorCodeHandler} from '../common/Utils';

/**
 * This Connector class will implement child interface of ICallSettings and
 * has methods for the Webex Calling backend.
 */
export class WxCallBackendConnector implements IWxCallBackendConnector {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private userId: string;

  private personId: string;

  private orgId: string;

  private xsiEndpoint!: string;

  private hydraEndpoint: string;

  private VOICEMAIL = 'VOICEMAIL';

  constructor(webex: WebexSDK, logger: LoggerInterface) {
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }

    this.webex = this.sdkConnector.getWebex();
    /* eslint no-underscore-dangle: 0 */
    this.hydraEndpoint = this.webex.internal.services._serviceUrls.hydra;
    log.setLogger(logger.level, WEBEX_CALLING_CONNECTOR_FILE);

    this.userId = this.webex.internal.device.userId;
    this.personId = inferIdFromUuid(this.webex.internal.device.userId, DecodeType.PEOPLE);
    this.orgId = inferIdFromUuid(this.webex.internal.device.orgId, DecodeType.ORGANIZATION);
  }

  /**
   * Reads call waiting setting at the backend.
   */
  public async getCallWaitingSetting(): Promise<CallSettingResponse> {
    const loggerContext = {
      file: CALL_SETTINGS_FILE,
      method: 'getCallWaitingSetting',
    };

    try {
      if (!this.xsiEndpoint) {
        this.xsiEndpoint = await getXsiActionEndpoint(
          this.webex,
          loggerContext,
          CALLING_BACKEND.WXC
        );
        log.info(`xsiEndpoint: ${this.xsiEndpoint}`, loggerContext);
      }

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
        statusCode: Number(resp[STATUS_CODE]),
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
        statusCode: Number(resp[STATUS_CODE]),
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
        statusCode: Number(resp[STATUS_CODE]),
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
        statusCode: Number(resp[STATUS_CODE]),
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
        statusCode: Number(resp[STATUS_CODE]),
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
        statusCode: Number(resp[STATUS_CODE]),
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
   * Reads the Call Forwarding Always settings at the backend.
   * This will also check if CFA is set to Voicemail.
   * If CFA is set to destination, that will take precedence.
   */
  public async getCallForwardAlwaysSetting(): Promise<CallSettingResponse> {
    const loggerContext = {
      file: WEBEX_CALLING_CONNECTOR_FILE,
      method: this.getCallForwardAlwaysSetting.name,
    };
    const cfResponse = await this.getCallForwardSetting();

    if (cfResponse.statusCode === 200) {
      const cfa = (cfResponse.data.callSetting as CallForwardSetting).callForwarding.always;

      /** CFA is set to destination */
      if (cfa.enabled) {
        if (cfa.destination) {
          const response = {
            ...cfResponse,
            data: {
              callSetting: cfa,
            },
          };

          return response;
        }
        log.warn(`CFA is enabled, but destination is not set`, loggerContext);
      }
      const vmResponse = await this.getVoicemailSetting();

      if (vmResponse.statusCode === 200) {
        const vm = vmResponse.data.callSetting as VoicemailSetting;

        /** CFA is enabled to voicemail */
        if (vm.enabled && vm.sendAllCalls.enabled) {
          const response = {
            ...cfResponse,
            data: {
              callSetting: {
                ...cfa,
                enabled: true,
                destination: this.VOICEMAIL,
              } as CallForwardAlwaysSetting,
            },
          };

          return response;
        }

        /** No CFA is set */
        const response = {
          ...cfResponse,
          data: {
            callSetting: {
              ...cfa,
              enabled: false,
              destination: undefined,
            } as CallForwardAlwaysSetting,
          },
        };

        return response;
      }

      log.warn(`Unable to retrieve voicemail settings.`, loggerContext);

      vmResponse.data.error = 'Unable to retrieve voicemail settings.';

      return vmResponse;
    }

    return cfResponse;
  }
}
