export const CALL_SETTINGS_FILE = 'CallSettings';
export const PEOPLE_ENDPOINT = 'people';
export const USER_ENDPOINT = 'user';
export const ORG_ENDPOINT = 'orgId';
export const DND_ENDPOINT = 'features/doNotDisturb';
export const CF_ENDPOINT = 'features/callForwarding';
export const VM_ENDPOINT = 'features/voicemail';
export const CALL_WAITING_ENDPOINT = 'CallWaiting';
export const XSI_VERSION = 'v2.0';

// Method name constants
export const METHODS = {
  INITIALIZE_BACKEND_CONNECTOR: 'initializeBackendConnector',
  GET_CALL_WAITING_SETTING: 'getCallWaitingSetting',
  GET_DO_NOT_DISTURB_SETTING: 'getDoNotDisturbSetting',
  SET_DO_NOT_DISTURB_SETTING: 'setDoNotDisturbSetting',
  GET_CALL_FORWARD_SETTING: 'getCallForwardSetting',
  SET_CALL_FORWARD_SETTING: 'setCallForwardSetting',
  GET_VOICEMAIL_SETTING: 'getVoicemailSetting',
  SET_VOICEMAIL_SETTING: 'setVoicemailSetting',
  GET_CALL_FORWARD_ALWAYS_SETTING: 'getCallForwardAlwaysSetting',
  GET_METHOD_NOT_SUPPORTED_RESPONSE: 'getMethodNotSupportedResponse',
};
