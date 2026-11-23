import {
  VOICE_CONNECTION_STATUS,
  VoiceConnectionState,
  VoiceLineStatus,
  VoiceMobiusSocketStatus,
} from './types';

export {REGION_RECOVERY_ERROR_CODES} from './services/core/constants';

/** Complete region recovery snapshots emitted to the host. */
export const REGION_RECOVERY_EVENTS = {STATE_CHANGE: 'region:stateChange'} as const;

export const EVENT = 'event';
export const READY = 'ready';
export const TIMEOUT_DURATION = 20000; // 20 seconds timeout duration for webrtc registration
export const EMPTY_STRING = '';
export const PRODUCT_NAME = 'wxcc_sdk';
// FILE NAMES
export const LOG_PREFIX = 'PLUGIN_CC';
export const WEB_CALLING_SERVICE_FILE = 'WebCallingService';
export const CONFIG_FILE_NAME = 'config-index';
export const CC_FILE = 'cc';
export const WELLNESS_BREAK_HANDLER = 'Wellness_Break_Handler';
export const CONNECTION_SERVICE_FILE = 'connection-service';
export const WEB_SOCKET_MANAGER_FILE = 'WebSocketManager';
export const AQM_REQS_FILE = 'aqm-reqs';
export const WEBEX_REQUEST_FILE = 'WebexRequest';
export const TASK_MANAGER_FILE = 'TaskManager';
export const TASK_FILE = 'Task';
// AGENT OUTDIAL CONSTANTS
export const INBOUND_DIRECTION = 'INBOUND';
export const OUTDIAL_DIRECTION = 'OUTBOUND';
export const ATTRIBUTES = {};
export const OUTDIAL_MEDIA_TYPE = 'telephony';
export const OUTBOUND_TYPE = 'OUTDIAL';

// Log related constants
export const UNKNOWN_ERROR = 'Unknown error';
export const MERCURY_DISCONNECTED_SUCCESS = 'Mercury disconnected successfully';
export const DEFAULT_VOICE_CONNECTION_STATE: Readonly<VoiceConnectionState> = Object.freeze({
  status: VOICE_CONNECTION_STATUS.NOT_REQUIRED,
  lineStatus: VoiceLineStatus.UNKNOWN,
  mobiusSocketStatus: VoiceMobiusSocketStatus.UNKNOWN,
});

// METHOD NAMES
export const METHODS = {
  REGISTER: 'register',
  RECORD_BEST_EFFORT: 'recordBestEffort',
  PUBLISH_HOST_EVENT: 'publishHostEvent',
  IS_RECOVERY_DIAGNOSTIC_REASON: 'isRecoveryDiagnosticReason',
  RECORD_RECOVERY_DIAGNOSTIC: 'recordRecoveryDiagnostic',
  NORMALIZE_RECOVERY_DIAGNOSTIC_ID: 'normalizeRecoveryDiagnosticId',
  SHOULD_SUBSCRIBE_RTD: 'shouldSubscribeRtd',
  GET_RTD_RECOVERY_GUARD: 'getRtdRecoveryGuard',
  IS_CURRENT_RTD_EPOCH: 'isCurrentRtdEpoch',
  PAUSE_RTD: 'pauseRtd',
  RESUME_RTD: 'resumeRtd',
  CAPTURE_RECOVERY_OWNER: 'captureRecoveryOwner',
  ASSERT_RECOVERY_OWNER: 'assertRecoveryOwner',
  AWAIT_RECOVERY_OWNER: 'awaitRecoveryOwner',
  ASSERT_STATE_DISPATCH_CURRENT: 'assertStateDispatchCurrent',
  IS_CURRENT_AUTO_AVAILABLE: 'isCurrentAutoAvailable',
  ARM_AUTO_AVAILABLE: 'armAutoAvailable',
  HANDLE_AUTO_AVAILABLE_VOICE_CHANGE: 'handleAutoAvailableVoiceChange',
  CANCEL_AUTO_AVAILABLE: 'cancelAutoAvailable',
  DISPATCH_AUTO_AVAILABLE: 'dispatchAutoAvailable',
  RECONCILE_AGENT_STATE_NOTIFICATION: 'reconcileAgentStateNotification',
  PERFORM_AGENT_STATE_CHANGE: 'performAgentStateChange',
  ASSERT_RECOVERY_ADMISSION: 'assertRecoveryAdmission',
  FENCE_RECOVERY_WORK: 'fenceRecoveryWork',
  SET_RECOVERY_PHASE: 'setRecoveryPhase',
  GET_TASK_RECOVERY_GUARD: 'getTaskRecoveryGuard',
  BEGIN_SESSION_REQUEST: 'beginSessionRequest',
  END_SESSION_REQUEST: 'endSessionRequest',
  CANCEL_REGION_RECOVERY: 'cancelRegionRecovery',
  CLEAR_ACCEPTED_STATION: 'clearAcceptedStation',
  CLEAR_SWITCH_HISTORY: 'clearSwitchHistory',
  TERMINATE_REGISTRATION: 'terminateRegistration',
  NORMALIZE_REGION_SWITCH: 'normalizeRegionSwitch',
  IS_CURRENT_RECOVERY: 'isCurrentRecovery',
  RESET_ORDINARY_CONNECTION: 'resetOrdinaryConnection',
  HANDLE_RECOVERY_TERMINAL: 'handleRecoveryTerminal',
  REQUIRE_REGION_RELOAD: 'requireRegionReload',
  HANDLE_REGION_SWITCH: 'handleRegionSwitch',
  ASSERT_PRIMARY_IDENTITY: 'assertPrimaryIdentity',
  BUILD_STATION_LOGIN_PAYLOAD: 'buildStationLoginPayload',
  REMEMBER_ACCEPTED_STATION: 'rememberAcceptedStation',
  RECONCILE_STATION_SNAPSHOT: 'reconcileStationSnapshot',
  APPLY_STATION_SESSION: 'applyStationSession',
  RECOVERY_FAILURE_CATEGORY: 'recoveryFailureCategory',
  WAIT_FOR_RECOVERY_RETRY: 'waitForRecoveryRetry',
  RESTORE_REGION_SESSION: 'restoreRegionSession',
  RECONCILE_STATION_NOTIFICATION: 'reconcileStationNotification',
  PUBLISH_REGION_STATE: 'publishRegionState',
  BUILD_REGION_STATE: 'buildRegionState',
  RESET_REGION_STATE: 'resetRegionState',
  IS_CURRENT_REGISTRATION: 'isCurrentRegistration',
  IS_CURRENT_STATION: 'isCurrentStation',
  AWAIT_REGISTRATION_WORK: 'awaitRegistrationWork',
  HYDRATE_MULTI_REGION_SETTINGS: 'hydrateMultiRegionSettings',
  ON_MULTI_REGION_SETTINGS_CHANGED: 'onMultiRegionSettingsChanged',
  DEREGISTER: 'deregister',
  GET_BUDDY_AGENTS: 'getBuddyAgents',
  CONNECT_WEBSOCKET: 'connectWebsocket',
  STATION_LOGIN: 'stationLogin',
  STATION_LOGOUT: 'stationLogout',
  STATION_RELOGIN: 'stationReLogin',
  SET_AGENT_STATE: 'setAgentState',
  HANDLE_WEBSOCKET_MESSAGE: 'handleWebsocketMessage',
  SETUP_EVENT_LISTENERS: 'setupEventListeners',
  GET_CONNECTION_CONFIG: 'getConnectionConfig',
  HANDLE_CONNECTION_LOST: 'handleConnectionLost',
  SILENT_RELOGIN: 'silentRelogin',
  HANDLE_DEVICE_TYPE: 'handleDeviceType',
  START_OUTDIAL: 'startOutdial',
  GET_QUEUES: 'getQueues',
  UPLOAD_LOGS: 'uploadLogs',
  UPDATE_AGENT_PROFILE: 'updateAgentProfile',
  GET_DEVICE_ID: 'getDeviceId',
  HANDLE_INCOMING_TASK: 'handleIncomingTask',
  HANDLE_TASK_HYDRATE: 'handleTaskHydrate',
  INCOMING_TASK_LISTENER: 'incomingTaskListener',
  ACCEPT: 'accept',
  REJECT: 'decline',
  HOLD: 'hold',
  RESUME: 'resume',
  HOLD_RESUME: 'holdResume',
  TRANSFER_CALL: 'transfer',
  CONSULT_TRANSFER: 'consultTransfer',
  CONSULT_CONFERENCE: 'consultConference',
  DROP_CONFERENCE_PARTICIPANT: 'dropConferenceParticipant',
  EXIT_CONFERENCE: 'exitConference',
  TRANSFER_CONFERENCE: 'transferConference',
  TOGGLE_MUTE: 'toggleMute',
  TRANSMIT_DTMF: 'transmitDtmf',
  COMPLETE_TRANSFER: 'completeTransfer',
  GET_OUTDIAL_ANI_ENTRIES: 'getOutdialAniEntries',
  ACCEPT_PREVIEW_CONTACT: 'acceptPreviewContact',
  SKIP_PREVIEW_CONTACT: 'skipPreviewContact',
  REMOVE_PREVIEW_CONTACT: 'removePreviewContact',
  GET_BASE_URL: 'getBaseUrl',
  SEND_EVENT: 'sendEvent',
  GET_REAL_TIME_ASSISTANCE: 'getRealTimeAssistance',
  SEND_REAL_TIME_ASSISTANCE_USER_ACTION: 'sendRealTimeAssistanceUserAction',
  FETCH_HISTORIC_TRANSCRIPTS: 'fetchHistoricTranscripts',
  REQUEST_WELLNESS_BREAK: 'requestWellnessBreak',
  RESPOND_TO_WELLNESS_BREAK: 'respondToWellnessBreak',
  GET_WELLBEING_BREAK_IDLE_CODE: 'getWellbeingBreakIdleCode',
  SET_MANAGE_WEBEX_CALLING_IN_WXCC: 'setManageWebexCallingInWxcc',
  IS_WX_BETTER_TOGETHER_ENABLED: 'isWxBetterTogetherEnabled',
  SYNC_WXAPP_MUTE_FROM_MERCURY: 'syncWxAppMuteFromMercury',
  GET_CALL_DETAILS_ON_WEBEX: 'getCallDetailsOnWebex',
  ENSURE_WXAPP_MERCURY_CONNECTED: 'ensureWxAppMercuryConnected',
};

export const AI_SUMMARY_ERROR_CODES = {
  POST_CALL_SUMMARY_DISABLED: 'POST_CALL_SUMMARY_DISABLED',
  MID_CALL_SUMMARY_DISABLED: 'MID_CALL_SUMMARY_DISABLED',
  AI_ASSISTANT_BASE_URL_NOT_AVAILABLE: 'AI_ASSISTANT_BASE_URL_NOT_AVAILABLE',
  POST_CALL_SUMMARY_TIMEOUT: 'POST_CALL_SUMMARY_TIMEOUT',
  MID_CALL_SUMMARY_TIMEOUT: 'MID_CALL_SUMMARY_TIMEOUT',
} as const;

export const AI_SUMMARY_INVALID_RESPONSE_PAYLOAD = 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD';

export const AI_ASSISTANT_CLIENT_TYPE = 'WxCC' as const;
