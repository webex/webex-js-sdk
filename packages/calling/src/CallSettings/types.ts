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

export interface ICallSettings {
  getCallWaitingSetting: () => Promise<CallSettingResponse>;
  getDoNotDisturbSetting: () => Promise<CallSettingResponse>;
  setDoNotDisturbSetting: (flag: boolean) => Promise<CallSettingResponse>;
  getCallForwardSetting: () => Promise<CallSettingResponse>;
  setCallForwardSetting: (request: CallForwardSetting) => Promise<CallSettingResponse>;
  getVoicemailSetting: () => Promise<CallSettingResponse>;
  setVoicemailSetting: (request: VoicemailSetting) => Promise<CallSettingResponse>;
  getCallForwardAlwaysSetting: (directoryNumber?: string) => Promise<CallSettingResponse>;
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
