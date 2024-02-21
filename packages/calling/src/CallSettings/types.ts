import {LOGGER} from '../Logger/types';

export interface LoggerInterface {
  level: LOGGER;
}

export type ToggleSetting = {
  enabled: boolean;
  ringSplashEnabled?: boolean;
};

/**
 * `CallForwardAlwaysSetting` object used for Call forwarding APIs in case of always forwarding.
 */
export type CallForwardAlwaysSetting = {
  /**
   * This indicates if the call forward always is enabled or disabled.
   */
  enabled: boolean;
  /**
   * If this property is set to true, a brief tone will be played on the user's line when a call has been forwarded.
   */
  ringReminderEnabled?: boolean;
  /**
   * This property signifies whether incoming calls are directed to the voicemail of the destination number,
   * provided that the destination is an internal phone number with an enabled voicemail service.
   */
  destinationVoicemailEnabled?: boolean;
  /**
   * Specify the destination number to which the call is forwarded when the call goes unanswered.
   * Destination is a phone number or a voicemail.
   */
  destination?: string;
};

/**
 * `CallForwardSetting` object used within the callSetting object for Call forwarding APIs
 */
export type CallForwardSetting = {
  callForwarding: {
    /**
     * Object to configure properties to enable/disable call forward to a destination of your choice for all the incoming calls.
     */
    always: CallForwardAlwaysSetting;
    /**
     * Object to configure properties to enable/disable call forwarding to a destination of your choice when the user's line is busy.
     */
    busy: {
      /**
       * This indicates if the call forward is enabled or disabled when the user's line is busy.
       */
      enabled: boolean;
      /**
       * This property signifies whether incoming calls are directed to the voicemail of the destination number when the user's line is busy,
       * provided that the destination is an internal phone number with an enabled voicemail service.
       */
      destinationVoicemailEnabled?: boolean;
      /**
       * Specify the destination number to which the call is forwarded in case of an unanswered call, if this feature is enabled.
       * The destination can be either a phone number or a voicemail service.
       */
      destination?: string;
    };
    /**
     * Object to configure properties to enable/disable call forward to a destination of your choice in case the call goes unanswered.
     */
    noAnswer: {
      /**
       * This indicates if the call forward is enabled or disabled when the call goes unanswered.
       */
      enabled: boolean;
      /**
       * This property indicates number of rings before the call is forwarded to the destination number if unanswered.
       */
      numberOfRings?: number;
      /**
       * System-wide maximum number of rings allowed to specify under numberOfRings property.
       */
      systemMaxNumberOfRings?: number;
      /**
       * This property signifies whether incoming calls are directed to the voicemail of the destination number when the call goes unanswered,
       * provided that the destination is an internal phone number with an enabled voicemail service.
       */
      destinationVoicemailEnabled?: boolean;
      /**
       * If noAnswer is enabled, incoming calls are routed to the specified destination number in the event that the call remains unanswered.
       * This destination can be either a phone number or a voicemail.
       */
      destination?: string;
    };
  };
  /**
   * Object to configure properties to enable/disable call forward to a destination of your choice when the user's line is not connected to the network.
   */
  businessContinuity: {
    /**
     * This indicates if the call forward is enabled or disabled when the user's line is not connected to the network.
     */
    enabled: boolean;
    /**
     * This property signifies whether incoming calls are directed to the voicemail of the destination number in case the user's line is not connected to the network,
     * provided that the destination is an internal phone number with an enabled voicemail service.
     */
    destinationVoicemailEnabled?: boolean;
    /**
     * Once the "businessContinuity" feature is enabled, calls will be redirected to the specified destination number in case the user's line is not connected to the network.
     * The designated destination can either be a phone number or a voicemail service.
     */
    destination?: string;
  };
};

/**
 * `VoicemailSetting` object used within the callSetting object for Voicemail APIs
 */
export type VoicemailSetting = {
  /**
   * Boolean property to indicate if the voicemail is enabled/disabled for the user.
   */
  enabled: boolean;
  /**
   * Object to configure properties for enabling/disabling the forwarding of all the incoming calls to voicemail.
   * Please note that this setting can only be adjusted when voicemail is enabled.
   */
  sendAllCalls: {
    /**
     * This indicates if the voicemail is enabled/disabled for all the incoming calls.
     */
    enabled: boolean;
  };
  /**
   * Object to configure properties for enabling/disabling the forwarding of busy calls to voicemail.
   * Please note that this setting can only be adjusted when voicemail is enabled.
   */
  sendBusyCalls: {
    /**
     * This indicates if the voicemail is enabled/disabled for the calls when the user's line is busy.
     */
    enabled: boolean;
    /**
     * Type of voicemail greeting to be played when the user's line is busy, 'default' or 'custom' is specified here.
     */
    greeting?: string;
    /**
     * This indicates if the custom voicemail greeting is uploaded or not.
     */
    greetingUploaded?: boolean;
  };
  /**
   * Object to configure properties for enabling/disabling the forwarding of unanswered calls to voicemail.
   * Please note that this setting can only be adjusted when voicemail is enabled.
   */
  sendUnansweredCalls: {
    /**
     * This indicates if the voicemail is enabled/disabled for the calls when the call goes unanswered.
     */
    enabled: boolean;
    /**
     * Type of voicemail greeting to be played when the call goes unanswered, 'default' or 'custom' is specified here.
     */
    greeting?: string;
    /**
     * This indicates if the custom voicemail greeting is uploaded or not.
     */
    greetingUploaded?: boolean;
    /**
     * This property indicates number of rings before the call goes to voicemail if unanswered.
     */
    numberOfRings: number;
    /**
     * System-wide maximum number of rings allowed to specify under numberOfRings property.
     */
    systemMaxNumberOfRings?: number;
  };
  /**
   * Settings for sending notifications when there are any new voicemails.
   */
  notifications: {
    /**
     * Boolean property to indicate if sending notifications for any new voicemails is enabled/disabled.
     */
    enabled: boolean;
    /**
     * Notifications are sent to the email address specifed here when there are any new voicemails.
     */
    destination?: string;
  };
  /**
   * Settings for voicemail caller to transfer to a different number by pressing zero (0).
   */
  transferToNumber?: {
    /**
     * Boolean property to indicate if voicemail caller transfer to a destination is enabled/disabled if they press zero (0).
     */
    enabled: boolean;
    /**
     * 	The number voicemail caller will be transferred to when they press zero (0).
     */
    destination: string;
  };
  /**
   * Settings for sending a copy of new voicemail message audio via email.
   */
  emailCopyOfMessage: {
    /**
     * Boolean property to enable sending the copy of the new voicemail message audio will be sent to the designated email address.
     */
    enabled: boolean;
    /**
     * Email address to which the new voicemail audio will be sent
     */
    emailId?: string;
  };
  /**
   * Object to configure the storage for new voicemails
   */
  messageStorage: {
    /**
     * Property to indicate on the line that there are new voicemails in the mailbox if enabled.
     */
    mwiEnabled: boolean;
    /**
     * Designates which type of voicemail message storage to use, 'internal' or 'external' is specified here.
     */
    storageType: string;
    /**
     * External email address to which the new voicemail audio will be sent.
     */
    externalEmail?: string;
  };
  /**
   * 	Settings for sending fax messages for new voicemails.
   */
  faxMessage?: {
    /**
     * Boolean property to enable sending fax messages to the designated number for new voicemails.
     */
    enabled: boolean;
    /**
     * Designated phone number is specified here where fax messages will be sent to if enabled for new voicemails.
     */
    phoneNumber?: string;
    /**
     * Designated optional extension is specified here where fax messages will be sent to if enabled for new voicemails.
     */
    extension?: string;
  };
  /**
   *
   */
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
 * This encompasses set of APIs that allows to retrieve and update the settings like CallWaiting, DND, CallForward, Voicemail and more.

 * These APIs return promises that resolve to a `CallSettingResponse` object, which contains a status code, data, and message.
 * The data field within this response object holds the `callSetting` object, which can take on different types depending on the specific API called.
 *
 * @example
 * ```json
 * {
 *  statusCode: 200,
 *    data: {
 *      callSetting: ToggleSetting | CallForwardSetting | VoicemailSetting | CallForwardAlwaysSetting
 *    },
 *  message: 'SUCCESS'| 'FAILURE' | null
 * }
 * ```
 */
export interface ICallSettings {
  /**
   * This API is used to fetch the call waiting setting.
   *
   * @example
   * ```javascript
   * const callWaitingResponse = await callSettings.getCallWaitingSetting();
   * ```
   *
   * The callWaitingResponse object will have callSetting object with the properties as mentioned in `ToggleSetting`.
   *
   * @example
   * ToggleSetting:
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
  getCallWaitingSetting(): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the do not disturb(DND) status.
   *
   * @example
   * ```javascript
   * const dndResponse = await callSettings.getDoNotDisturbSetting();
   * ```
   *
   * The dndResponse object will have callSetting object with the properties as mentioned in `ToggleSetting`.
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
   * This API is used to set DND to true or false based on parameter received.
   *
   * @example
   * ```javascript
   * const dndResponse = await callSettings.setDoNotDisturbSetting(true|false);
   * ```
   */
  setDoNotDisturbSetting(flag: boolean): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the call forward setting.
   *
   *  @example
   * ```javascript
   * const callForwardResponse = await callSettings.getCallForwardSetting();
   * ```
   *
   * The `callForwardResponse` object will have callSetting object with the properties as mentioned in {@link CallForwardSetting}.
   */
  getCallForwardSetting(): Promise<CallSettingResponse>;

  /**
   * This API is used to set the call forward setting.
   * ```javascript
   * const callForwardResponse = await callSettings.setCallForwardSetting(callForwardSetting);
   * ```
   *
   * The `callForwardSetting` object will be populated with the properties as mentioned in {@link CallForwardSetting} and passed as a parameter to the API.
   */
  setCallForwardSetting(request: CallForwardSetting): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the voicemail.
   *  @example
   * ```javascript
   * const voicemailResponse = await callSettings.getVoicemailSetting();
   * ```
   *
   * The `voicemailResponse` object will have callSetting object with the properties as mentioned in {@link VoicemailSetting}.
   */
  getVoicemailSetting(): Promise<CallSettingResponse>;

  /**
   * This API is used to set voicemail.
   *
   * @example
   * ```javascript
   * const voicemailResponse = await callSettings.setVoicemailSetting();
   * ```
   *
   * The `voicemailSetting` object will be populated with the properties as mentioned in {@link VoicemailSetting} and passed as a parameter to the API.
   */
  setVoicemailSetting(request: VoicemailSetting): Promise<CallSettingResponse>;

  /**
   * This API is used to fetch the call forward settings including the Voicemail.
   *
   * @param directoryNumber - Directory number for which the call forward always setting is to be fetched.
   * This parameter is only required for Cloud Connected Unified Communications(CCUC): https://www.cisco.com/c/en/us/products/unified-communications/webex-cloud-connected-uc/index.html backend.
   *
   * @example
   * ```javascript
   * const callForwardAlwaysResponse = await callSettings.setVoicemailSetting();
   * ```
   *
   * The `callForwardAlwaysResponse` object will have callSetting object with the properties as mentioned in {@link CallForwardAlwaysSetting}.
   */
  getCallForwardAlwaysSetting(directoryNumber?: string): Promise<CallSettingResponse>;
}

export type IWxCallBackendConnector = ICallSettings;
export type IUcmBackendConnector = ICallSettings;

export type CallForwardingAlwaysSettingsUCM = {
  dn: string;
  destination?: string;
  destinationVoicemailEnabled: boolean;
  e164Number: string;
};

export type CallForwardingSettingsUCM = {
  callForwarding: {
    always: CallForwardingAlwaysSettingsUCM[];
  };
};
