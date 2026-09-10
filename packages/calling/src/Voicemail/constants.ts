export const API_V1 = 'api/v1';
export const VOICEMAIL_FILE = 'VoicemailClient';
export const BROADWORKS_VOICEMAIL_FILE = 'BroadworksBackendConnector';
export const CALLS = 'calls';
export const BW_TOKEN_FETCH_ENDPOINT = '/idp/bwtoken/fetch';
/**
 * Issuers whose JWKS the bwtoken signature is trusted to be verified against.
 * A token whose `iss` claim is not in this allowlist is rejected before any
 * key lookup or cryptographic verification is attempted.
 */
export const BW_TOKEN_TRUSTED_ISSUERS = [
  'https://idbroker.webex.com/idb',
  'https://idbrokerbts.webex.com/idb',
];
export const BW_TOKEN_JWKS_PATH = '/oauth2/v2/keys/verificationjwk';
/**
 * Maps a JWS `alg` header to the equivalent Web Crypto (SubtleCrypto) algorithm.
 * Algorithms absent from this map (including `none`) are rejected.
 */
export const BW_TOKEN_JWS_ALG_TO_SUBTLE: Record<string, {name: string; hash: string}> = {
  RS256: {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'},
  RS384: {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384'},
  RS512: {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512'},
};
export const JSON_FORMAT = '?format=json';
export const LIMIT = '&limit';
export const MARK_AS_READ = 'MarkAsRead';
export const MARK_AS_UNREAD = 'MarkAsUnread';
export const MESSAGE_MEDIA_CONTENT = 'messageMediaContent';
export const MESSAGE_SUMMARY = 'MessageSummary';
export const NO_VOICEMAIL_MSG = 'No additional voicemails';
export const NO_VOICEMAIL_STATUS_CODE = 204;
export const OFFSET = '?offset';
export const OFFSET_INDEX = 0;
export const OFFSET_LIMIT = 100;
export const PREFIX = 2;
export const RADIX_RAND = 36;
export const SORT_ORDER = '&sortOrder';
export const TRANSCRIPT_STATUS = 'status';
export const SUMMARY = 'summary';
export const TRANSCRIPT_CONTENT = 'content';
export const VMGATEWAY = 'vmgateway';
export const VOICEMAILS = 'voicemails';
export const VOICE_MESSAGING_MESSAGES = 'VoiceMessagingMessages';
export const NEW_MESSAGES = 'newMessages';
export const OLD_MESSAGES = 'oldMessages';
export const NEW_URGENT_MESSAGES = 'newUrgentMessages';
export const OLD_URGENT_MESSAGES = 'oldUrgentMessages';
/**
 * Method names for logging
 */
export const METHODS = {
  INIT: 'init',
  GET_SDK_CONNECTOR: 'getSDKConnector',
  GET_USER_ID: 'getUserId',
  GET_BW_TOKEN: 'getBwToken',
  SET_XSI_VOICE_MESSAGE_URI: 'setXsiVoiceMessageURI',
  GET_VOICEMAIL_LIST: 'getVoicemailList',
  GET_VOICEMAIL_CONTENT: 'getVoicemailContent',
  GET_VOICEMAIL_SUMMARY: 'getVoicemailSummary',
  VOICEMAIL_MARK_AS_READ: 'voicemailMarkAsRead',
  VOICEMAIL_MARK_AS_UNREAD: 'voicemailMarkAsUnread',
  DELETE_VOICEMAIL: 'deleteVoicemail',
  GET_VM_TRANSCRIPT: 'getVMTranscript',
  RESOLVE_CONTACT: 'resolveContact',
  GET_VOICEMAIL_CONTENT_UCM: 'getVoicemailContentUcm',
  RETURN_UCM_PROMISE: 'returnUcmPromise',
  INITIALIZE_BACKEND_CONNECTOR: 'initializeBackendConnector',
  SUBMIT_METRIC: 'submitMetric',
  GET_AUTH_HEADERS: 'getAuthHeaders',
  SET_UCM_VOICE_MESSAGE_BASE_URI: 'setUcmVoiceMessageBaseURI',
};
