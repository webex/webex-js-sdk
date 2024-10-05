import log from '../Logger';
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {serviceErrorCodeHandler} from '../common/Utils';
import {
  FAILURE_MESSAGE,
  STATUS_CODE,
  SUCCESS_MESSAGE,
  UCM_CONNECTOR_FILE,
  VOICEMAIL,
  WEBEX_API_CONFIG_INT_URL,
  WEBEX_API_CONFIG_PROD_URL,
} from '../common/constants';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {CF_ENDPOINT, ORG_ENDPOINT, PEOPLE_ENDPOINT} from './constants';
import {
  CallForwardAlwaysSetting,
  CallForwardingSettingsUCM,
  CallSettingResponse,
  IUcmBackendConnector,
  LoggerInterface,
} from './types';

/**
 * This Connector class will implement child interface of ICallSettings and
 * has methods for the CCUC with UCM backend.
 */
export class UcmBackendConnector implements IUcmBackendConnector {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private userId: string;

  private orgId: string;

  private useProdWebexApis: boolean;

  /**
   * @param useProdWebexApis - default value is true
   */
  constructor(webex: WebexSDK, logger: LoggerInterface, useProdWebexApis = true) {
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }

    this.webex = this.sdkConnector.getWebex();
    log.setLogger(logger.level, UCM_CONNECTOR_FILE);
    this.userId = this.webex.internal.device.userId;
    this.orgId = this.webex.internal.device.orgId;
    this.useProdWebexApis = useProdWebexApis;
  }

  /**
   * Reads call waiting setting at the backend.
   */
  public getCallWaitingSetting(): Promise<CallSettingResponse> {
    return this.getMethodNotSupportedResponse();
  }

  /**
   * Reads DND setting at the backend.
   */
  public getDoNotDisturbSetting(): Promise<CallSettingResponse> {
    return this.getMethodNotSupportedResponse();
  }

  /**
   * Updates DND setting at the backend.
   */
  public setDoNotDisturbSetting(): Promise<CallSettingResponse> {
    return this.getMethodNotSupportedResponse();
  }

  /**
   * Reads Call Forward setting at the backend.
   */
  public getCallForwardSetting(): Promise<CallSettingResponse> {
    return this.getMethodNotSupportedResponse();
  }

  /**
   * Updates Call Forward setting at the backend.
   */
  public setCallForwardSetting(): Promise<CallSettingResponse> {
    return this.getMethodNotSupportedResponse();
  }

  /**
   * Reads Voicemail setting at the backend.
   */
  public getVoicemailSetting(): Promise<CallSettingResponse> {
    return this.getMethodNotSupportedResponse();
  }

  /**
   * Updates Voicemail setting at the backend.
   */
  public setVoicemailSetting(): Promise<CallSettingResponse> {
    return this.getMethodNotSupportedResponse();
  }

  /**
   * Returns a default error response for unsupported methods.
   */
  private getMethodNotSupportedResponse(): Promise<CallSettingResponse> {
    const response = serviceErrorCodeHandler(
      {statusCode: 501},
      {file: UCM_CONNECTOR_FILE, method: this.getMethodNotSupportedResponse.name}
    );

    return Promise.resolve(response);
  }

  /**
   * Reads the Call Forwarding Always settings at the backend.
   * This will also check if CFA is set to Voicemail.
   * If CFA is set to destination, that will take precedence.
   * For UCM backend, relevant fields in the response are `enabled` & `destination`.
   *
   * @param directoryNumber - Directory number for which CFA needs to returned.
   */
  public async getCallForwardAlwaysSetting(directoryNumber?: string): Promise<CallSettingResponse> {
    const loggerContext = {
      file: UCM_CONNECTOR_FILE,
      method: this.getCallForwardAlwaysSetting.name,
    };

    const webexApisUrl = this.useProdWebexApis
      ? WEBEX_API_CONFIG_PROD_URL
      : WEBEX_API_CONFIG_INT_URL;

    try {
      if (directoryNumber) {
        const resp = <WebexRequestPayload>await this.webex.request({
          uri: `${webexApisUrl}/${PEOPLE_ENDPOINT}/${
            this.userId
          }/${CF_ENDPOINT.toLowerCase()}?${ORG_ENDPOINT}=${this.orgId}`,
          method: HTTP_METHODS.GET,
        });

        const {callForwarding} = resp.body as CallForwardingSettingsUCM;
        const cfa = callForwarding.always.find(
          (item) => item.dn.endsWith(directoryNumber) || item.e164Number.endsWith(directoryNumber)
        );

        if (cfa) {
          const response = {
            statusCode: Number(resp[STATUS_CODE]),
            message: SUCCESS_MESSAGE,
            data: {
              callSetting: {
                enabled: cfa.destinationVoicemailEnabled || !!cfa.destination,
                destination: cfa.destinationVoicemailEnabled ? VOICEMAIL : cfa.destination,
              } as CallForwardAlwaysSetting,
            },
          };

          return response;
        }
        const response = {
          statusCode: 404,
          message: FAILURE_MESSAGE,
          data: {
            error: 'Directory Number is not assigned to the user',
          },
        };

        return response;
      }
      const response = {
        statusCode: 400,
        message: FAILURE_MESSAGE,
        data: {
          error: 'Directory Number is mandatory for UCM backend',
        },
      };

      return response;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }
}
