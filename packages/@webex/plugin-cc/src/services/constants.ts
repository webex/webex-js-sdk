export const POST_AUTH = 'postauth';
export const WCC_API_GATEWAY = 'wcc-api-gateway';
export const WCC_CALLING_RTMS_DOMAIN = 'wcc-calling-rtms-domain';
export const DEFAULT_RTMS_DOMAIN = 'rtw.prod-us1.rtmsprod.net';
export const WEBSOCKET_EVENT_TIMEOUT = 20000;

export const AGENT = 'agent';

// CC GATEWAY API URL PATHS
export const SUBSCRIBE_API = 'v1/notification/subscribe';
export const LOGIN_API = 'v1/agents/login';
export const WEB_RTC_PREFIX = 'webrtc-';
export const STATE_CHANGE_API = 'v1/agents/session/state';

export const DEREGISTER_WEBCALLING_LINE_MSG =
  'Deregistering WebCalling line and cleaning up resources';

// WebCallingService method names
export const METHODS = {
  SET_LOGIN_OPTION: 'setLoginOption',
  HANDLE_MEDIA_EVENT: 'handleMediaEvent',
  HANDLE_DISCONNECT_EVENT: 'handleDisconnectEvent',
  REGISTER_CALL_LISTENERS: 'registerCallListeners',
  CLEAN_UP_CALL: 'cleanUpCall',
  GET_RTMS_DOMAIN: 'getRTMSDomain',
  REGISTER_WEB_CALLING_LINE: 'registerWebCallingLine',
  DEREGISTER_WEB_CALLING_LINE: 'deregisterWebCallingLine',
  ANSWER_CALL: 'answerCall',
  MUTE_UNMUTE_CALL: 'muteUnmuteCall',
  IS_CALL_MUTED: 'isCallMuted',
  DECLINE_CALL: 'declineCall',
  MAP_CALL_TO_TASK: 'mapCallToTask',
  GET_TASK_ID_FOR_CALL: 'getTaskIdForCall',
};
