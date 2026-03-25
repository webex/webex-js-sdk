export type ServiceIndicator = 'calling' | 'contactcenter' | 'guestcalling';

export const SAMPLE_APP_PATH = '/samples/calling/';

// Timeouts
export const AWAIT_TIMEOUT = 10000;
export const SDK_INIT_TIMEOUT = 60000;
export const REGISTRATION_TIMEOUT = 40000;
export const OPERATION_TIMEOUT = 30000;

// Element selectors (from the calling sample app)
export const SELECTORS = {
  // Authentication
  ACCESS_TOKEN_INPUT: '#access-token',
  INITIALIZE_CALLING_BTN: '#access-token-save',
  AUTH_STATUS: '#access-token-status',
  SERVICE_INDICATOR: '#ServiceIndicator',
  SERVICE_DOMAIN: '#ServiceDomain',
  FEDRAMP_CHECKBOX: '#fedramp',
  ENABLE_PRODUCTION_BTN: '#enableProduction',

  // Registration
  REGISTER_BTN: '#registration-register',
  UNREGISTER_BTN: '#registration-unregister',
  REGISTRATION_STATUS: '#registration-status',

  // Call Controls
  DESTINATION_INPUT: '#destination',
  MAKE_CALL_BTN: '#create-call-action',
  END_CALL_BTN: '#end-call',
  ANSWER_BTN: '#answer',
  MUTE_BTN: '#mute_button',
  HOLD_BTN: '#hold_button',
  DTMF_INPUT: '#dtmf_digit',
  SEND_DIGIT_BTN: '#send-digit',

  // Transfer
  TRANSFER_TARGET_INPUT: '#transfer_target',
  TRANSFER_OPTIONS: '#transfer-options',
  TRANSFER_BTN: '#transfer',
  END_SECOND_CALL_BTN: '#end-second',
  TRANSFER_STATUS: '#transfer-call',

  // Media
  GET_MEDIA_STREAMS_BTN: '#sd-get-media-streams',
  LOCAL_VIDEO: '#local-video',
  LOCAL_AUDIO: '#local-audio',
  REMOTE_VIDEO: '#remote-video',
  REMOTE_AUDIO: '#remote-audio',

  // Guest Calling
  GUEST_CONTAINER: '#guest-container',
  JWT_TOKEN_FOR_DEST: '#jwt-token-for-dest',
  GUEST_NAME: '#guest-name',
  GENERATE_GUEST_TOKEN_BTN: 'button:has-text("Generate Guest Token")',

  // Call info
  CALL_OBJECT: '#call-object',
  INCOMING_CALL: '#incoming-call',
  CALL_QUALITY_METRICS: '#call-quality-metrics',

  END_BTN: '#end',
};
