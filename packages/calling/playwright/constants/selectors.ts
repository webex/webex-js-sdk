// Element CALLING_SELECTORS (from the calling sample app)
export const CALLING_SELECTORS = {
  // Authentication
  ACCESS_TOKEN_INPUT: '#access-token',
  INITIALIZE_CALLING_BTN: '#access-token-save',
  AUTH_STATUS: '#access-token-status',
  SERVICE_INDICATOR: '#ServiceIndicator',
  SERVICE_DOMAIN: '#ServiceDomain',
  MOBIUS_WSS: '#mobius-wss',
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
  /**
   * Answer button in the incoming-call section. Starts disabled; becomes enabled when a
   * line:incoming_call event fires. Use .toBeEnabled() to wait for an incoming call,
   * .toBeDisabled() to assert no incoming call (e.g. call forwarded / DND active).
   */
  INCOMING_ANSWER_BTN: '#incomingsection #answer',
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

  // Call History
  CALL_HISTORY_BTN: '#Call-history',
  CALL_HISTORY_HEADER: '#callHistoryHeaderId',
  CALL_HISTORY_TABLE_BODY: '#callHistoryTableId',

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
  CF_NOT_REACHABLE_DEST: '#notReachableDest',
  CF_DIRECTORY_NUMBER: '#directoryNumber',
  CF_ALWAYS_BTN: '#CallForwardAlways-button',
  CF_ALWAYS_DATA: '#callforwardalways-data',

  // CF No Answer — number of rings field
  CF_NO_ANSWER_RINGS: '#notAnsweredRings',

  // Voicemail — scoped to #voicemailForm to avoid collision with CF form IDs
  VM_ENABLED_CB: '#vmCb',
  VM_SAVE_BTN: '#voicemailForm #cfButton',
  VM_SEND_ALL_CB: '#voicemailForm #alwaysCb',
  VM_SEND_BUSY_CB: '#voicemailForm #busyCb',
  VM_UNANSWERED_CB: '#voicemailForm #vmNotAnsweredCb',
  VM_UNANSWERED_RINGS: '#vmNotAnsweredRings',
  VM_MWI_CB: '#voicemailForm #notifCb',
  VM_NOTIF_EMAIL_CB: '#voicemailForm #notifEmailCb',
  VM_NOTIF_EMAIL_ID: '#notifEmailId',
  VM_EMAIL_COPY_CB: '#voicemailForm #vmEmailCb',
  VM_EMAIL_COPY_ID: '#vmEmailId',
};
