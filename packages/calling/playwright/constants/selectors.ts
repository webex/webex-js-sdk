// Element CALLING_SELECTORS (from the calling sample app)
export const CALLING_SELECTORS = {
  // Authentication
  ACCESS_TOKEN_INPUT: '#access-token',
  INITIALIZE_CALLING_BTN: '#access-token-save',
  AUTH_STATUS: '#access-token-status',
  SERVICE_INDICATOR: '#ServiceIndicator',
  SERVICE_DOMAIN: '#ServiceDomain',
  REGION_INPUT: '#region',
  COUNTRY_INPUT: '#country',
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
  /** Prefer over raw #answer — the sample app has a duplicate hidden #answer; this targets the visible incoming strip only. */
  INCOMING_ANSWER_BTN: '#incomingsection:not(.hidden) #answer',
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
  LOCAL_AUDIO: '#local-audio',
  REMOTE_AUDIO: '#remote-audio',

  // Guest Calling
  GUEST_CONTAINER: '#guest-container',
  JWT_TOKEN_FOR_DEST: '#jwt-token-for-dest',
  GUEST_NAME: '#guest-name',
  GENERATE_GUEST_TOKEN_BTN: '#generate-guest-token',

  // Call info
  CALL_OBJECT: '#call-object',
  INCOMING_CALL: '#incoming-call',
  CALL_QUALITY_METRICS: '#call-quality-metrics',

  END_BTN: '#end',

  // Call Settings
  FETCH_SETTINGS_BTN: '#fetch-setting',
  DND_BTN: '#DND-button',
  CALL_WAITING_BTN: '#CallWaiting-button',

  // Call Forward — scoped to avoid collision with duplicate IDs in the voicemail form
  CF_SAVE_BTN: '#callForwardForm #cfButton',
  CF_ALWAYS_CB: '#callForwardForm #alwaysCb',
  CF_ALWAYS_DEST: '#alwaysDest',
  CF_BUSY_CB: '#callForwardForm #busyCb',
  CF_BUSY_DEST: '#busyDest',
  CF_NO_ANSWER_CB: '#notAnsweredCb',
  CF_NO_ANSWER_DEST: '#notAnsweredDest',
  CF_NOT_REACHABLE_CB: '#notReachableCb',
  CF_DIRECTORY_NUMBER: '#directoryNumber',
  CF_ALWAYS_BTN: '#CallForwardAlways-button',
  CF_ALWAYS_DATA: '#callforwardalways-data',
};
