import {LOGGER} from '../Logger/types';

export interface LoggerInterface {
  level: LOGGER;
}

export type ToggleSetting = {
  enabled: boolean;
  ringSplashEnabled?: boolean;
};

export type CallForwardAlwaysSetting = {
  enabled: boolean;
  ringReminderEnabled?: boolean;
  destinationVoicemailEnabled?: boolean;
  destination?: string;
};

export type CallForwardSetting = {
  callForwarding: {
    always: CallForwardAlwaysSetting;
    busy: {
      enabled: boolean;
      destinationVoicemailEnabled?: boolean;
      destination?: string;
    };
    noAnswer: {
      enabled: boolean;
      numberOfRings?: number;
      systemMaxNumberOfRings?: number;
      destinationVoicemailEnabled?: boolean;
      destination?: string;
    };
  };
  businessContinuity: {
    enabled: boolean;
    destinationVoicemailEnabled?: boolean;
    destination?: string;
  };
};

export type VoicemailSetting = {
  enabled: boolean;
  sendAllCalls: {
    enabled: boolean;
  };
  sendBusyCalls: {
    enabled: boolean;
    greeting?: string;
    greetingUploaded?: boolean;
  };
  sendUnansweredCalls: {
    enabled: boolean;
    greeting?: string;
    greetingUploaded?: boolean;
    numberOfRings: number;
    systemMaxNumberOfRings?: number;
  };
  notifications: {
    enabled: boolean;
    destination?: string;
  };
  transferToNumber?: {
    enabled: boolean;
    destination: string;
  };
  emailCopyOfMessage: {
    enabled: boolean;
    emailId?: string;
  };
  messageStorage: {
    mwiEnabled: boolean;
    storageType: string;
    externalEmail?: string;
  };
  faxMessage?: {
    enabled: boolean;
    phoneNumber?: string;
    extension?: string;
  };
  voiceMessageForwardingEnabled?: boolean;
};

export type CallSettingResponse = {
  statusCode: number;
  data: {
    callSetting?: ToggleSetting | CallForwardSetting | VoicemailSetting | CallForwardAlwaysSetting;
    error?: string;
  };
  message: string | null;
};

/**
 * Interface for Call Settings Module.
 * This contains the APIs that allows to fetch and update the settings like CallWaiting, DND, CallForward, Voicemail etc.
 *
 * These APIs return a promise which resolves to the CallSettingResponse object.
 * This response object will have the status code, data and message and the data will have the callSetting object
 * which can be of different types based on the API called.
 *
 * Example
 * ```json
 * {
 *  statusCode: 200,
 *    data: {
 *      callSetting: ToggleSetting | CallForwardSetting | VoicemailSetting | CallForwardAlwaysSetting
 *    },
 *  message: 'SUCCESS'| 'FAILURE' | null
 * }
 * ```
 *
 */
export interface ICallSettings {
  /**
   * This API is used to fetch the call waiting setting.
   *
   * Example
   * ```javascript
   * const callWaitingResponse = await callSettings.getCallWaitingSetting();
   * ```
   *
   * The callWaitingResponse object will have callSetting object with the properties as mentioned in ToggleSetting.
   *
   * Example - ToggleSetting
   * ```json
   * {
   *  statusCode: 200,
   *    data: {
   *      callSetting: {
   *        enabled: true,
   *        ringSplashEnabled: true
   *      },
   *    },
   *  message: null
   * }
   * ```
   *
   */
  getCallWaitingSetting(): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the do not disturb(DND) status.
   *
   * Example
   * ```javascript
   * const dndResponse = await callSettings.getDoNotDisturbSetting();
   * ```
   *
   * The dndResponse object will have callSetting object with the properties as mentioned in ToggleSetting.
   *
   * Example - ToggleSetting
   * ```json
   * {
   *  statusCode: 200,
   *    data: {
   *      callSetting: {
   *        enabled: true,
   *        ringSplashEnabled: true
   *      },
   *    },
   *  message: null
   * }
   * ```
   */
  getDoNotDisturbSetting(): Promise<CallSettingResponse>;

  /**
   * This API is used to set DND to true or false based on paramter received.
   *
   * Example
   * ```javascript
   * const dndResponse = await callSettings.setDoNotDisturbSetting(true|false);
   * ```
   */
  setDoNotDisturbSetting(flag: boolean): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the call forward setting.
   *
   *  Example
   * ```javascript
   * const callForwardResponse = await callSettings.getCallForwardSetting();
   * ```
   *
   * The callForwardResponse object will have callSetting object with the properties as mentioned in CallForwardSetting.
   *
   * Example - CallForwardSettings - https://github.com/webex/webex-js-sdk/wiki/Calling-Voicemail#callforwardsetting
   */
  getCallForwardSetting(): Promise<CallSettingResponse>;

  /**
   * This API is used to set the call forward setting.
   * ```javascript
   * const callForwardResponse = await callSettings.setCallForwardSetting(callForwardSetting);
   * ```
   *
   * The callForwardSetting object will be populated with the properties as required and passed as a parameter to the API.
   *
   * Example - CallForwardSettings - https://github.com/webex/webex-js-sdk/wiki/Calling-Voicemail#callforwardsetting
   *
   */
  setCallForwardSetting(request: CallForwardSetting): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the voicemail.
   *  Example
   * ```javascript
   * const voicemailResponse = await callSettings.getVoicemailSetting();
   * ```
   *
   * The voicemailResponse object will have callSetting object with the properties as mentioned in VoicemailSetting.
   *
   * Example - VoicemailSetting - https://github.com/webex/webex-js-sdk/wiki/Calling-Voicemail#voicemailsetting
   */
  getVoicemailSetting(): Promise<CallSettingResponse>;

  /**
   * This API is used to set voicemail.
   *   Example
   * ```javascript
   * const voicemailResponse = await callSettings.setVoicemailSetting();
   * ```
   *
   * The VoicemailSetting object will be populated with the properties as required and passed as a parameter to the API.
   *
   * Example - VoicemailSetting - https://github.com/webex/webex-js-sdk/wiki/Calling-Voicemail#voicemailsetting
   */
  setVoicemailSetting(request: VoicemailSetting): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the settings for callForwardAlways.
   */
  getCallForwardAlwaysSetting(directoryNumber?: string): Promise<CallSettingResponse>;
}

export type IWxCallBackendConnector = ICallSettings;
export type IUcmBackendConnector = ICallSettings;

export type CallForwardingAlwaysSettingsUCM = {
  dn: string;
  destination?: string;
  destinationVoicemailEnabled: boolean;
};

export type CallForwardingSettingsUCM = {
  callForwarding: {
    always: CallForwardingAlwaysSettingsUCM[];
  };
};
