/* eslint-disable valid-jsdoc */
import {getCallingBackEnd} from '../common/Utils';
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  ICallSettings,
  LoggerInterface,
  CallForwardSetting,
  CallSettingResponse,
  VoicemailSetting,
} from './types';
import log from '../Logger';
import {CALLING_BACKEND} from '../common/types';

import {WxCallBackendConnector} from './WxCallBackendConnector';
import {CALL_SETTINGS_FILE} from './constants';
import {UcmBackendConnector} from './UcmBackendConnector';

/**
 * The purpose of the `CallSettingsClient` instance is to provide the APIs to retrieve and update the settings like CallWaiting, DND, CallForward, Voicemail etc. based on different calling backends.
 * The appropriate calling backends is initialized according to the user entitlements while instantiating the CallSettings Client.
 *
 * Example
 * ```javascript
 * const callSettings = createCallSettingsClient(webex, logger);
 * ```
 *
 * @implements {ICallSettings}
 */
export class CallSettings implements ICallSettings {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private callingBackend!: CALLING_BACKEND;

  private backendConnector!: ICallSettings;

  /**
   * @ignore
   */
  constructor(webex: WebexSDK, logger: LoggerInterface, useProdWebexApis?: boolean) {
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }

    log.setLogger(logger.level, CALL_SETTINGS_FILE);
    this.webex = this.sdkConnector.getWebex();
    this.initializeBackendConnector(logger, useProdWebexApis);
  }

  /**
   * Setup and initialize the Call Settings backend connector class object.
   */
  private initializeBackendConnector(logger: LoggerInterface, useProdWebexApis?: boolean) {
    this.callingBackend = getCallingBackEnd(this.webex);
    log.info(`Initializing Connector for ${this.callingBackend} backend`, {
      file: CALL_SETTINGS_FILE,
      method: this.initializeBackendConnector.name,
    });

    switch (this.callingBackend) {
      case CALLING_BACKEND.BWRKS:
      case CALLING_BACKEND.WXC:
        this.backendConnector = new WxCallBackendConnector(this.webex, logger);
        break;

      case CALLING_BACKEND.UCM:
        this.backendConnector = new UcmBackendConnector(this.webex, logger, useProdWebexApis);
        break;

      default:
        throw new Error('Calling backend is not identified, exiting....');
    }
  }

  /**
   * Reads call waiting setting in Webex.
   */
  public async getCallWaitingSetting() {
    return this.backendConnector.getCallWaitingSetting();
  }

  /**
   * Reads DND setting in Webex.
   */
  public async getDoNotDisturbSetting(): Promise<CallSettingResponse> {
    return this.backendConnector.getDoNotDisturbSetting();
  }

  /**
   * Updates DND setting in Webex.
   * @param enabled - true to enable DND, false to disable DND.
   */
  public async setDoNotDisturbSetting(enabled: boolean): Promise<CallSettingResponse> {
    return this.backendConnector.setDoNotDisturbSetting(enabled);
  }

  /**
   * Reads Call Forward setting in Webex.
   *
   */
  public async getCallForwardSetting(): Promise<CallSettingResponse> {
    return this.backendConnector.getCallForwardSetting();
  }

  /**
   * Updates Call Forward setting in Webex.
   * @param callForwardingRequest - CallForwardSetting object.
   */
  public async setCallForwardSetting(
    callForwardingRequest: CallForwardSetting
  ): Promise<CallSettingResponse> {
    return this.backendConnector.setCallForwardSetting(callForwardingRequest);
  }

  /**
   * Reads Voicemail setting in Webex.
   */
  public async getVoicemailSetting(): Promise<CallSettingResponse> {
    return this.backendConnector.getVoicemailSetting();
  }

  /**
   * Updates Voicemail setting in Webex.
   * @param voicemailRequest - VoicemailSetting object.
   */
  public async setVoicemailSetting(
    voicemailRequest: VoicemailSetting
  ): Promise<CallSettingResponse> {
    return this.backendConnector.setVoicemailSetting(voicemailRequest);
  }

  /**
   * Reads the Call Forwarding Always settings in Webex.
   * This will also check if CFA is set to Voicemail.
   * If CFA is set to destination, that will take precedence.
   * @param directoryNumber - Directory number of the user.
   */
  public async getCallForwardAlwaysSetting(directoryNumber?: string): Promise<CallSettingResponse> {
    return this.backendConnector.getCallForwardAlwaysSetting(directoryNumber);
  }
}

/**
 * Creates an instance of CallSettings Client.
 */
export const createCallSettingsClient = (
  webex: WebexSDK,
  logger: LoggerInterface,
  useProdWebexApis?: boolean
): ICallSettings => new CallSettings(webex, logger, useProdWebexApis);
