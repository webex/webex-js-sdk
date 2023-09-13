/* eslint-disable import/prefer-default-export */
// Most client error codes are mapped based on
// https://sqbu-github.cisco.com/WebExSquared/event-dictionary/wiki/Error-codes-for-metric-events

import {ClientEventError} from '../metrics.types';

export const NEW_LOCUS_ERROR_CLIENT_CODE = 4008;
export const MEETING_INFO_LOOKUP_ERROR_CLIENT_CODE = 4100;
export const ICE_FAILURE_CLIENT_CODE = 2004;

const ERROR_DESCRIPTIONS = {
  UNKNOWN_CALL_FAILURE: 'UnknownCallFailure',
  LOCUS_RATE_LIMITED_INCOMING: 'LocusRateLimitedIncoming',
  LOCUS_RATE_LIMITED_OUTGOING: 'LocusRateLimitedOutgoing',
  LOCUS_UNAVAILABLE: 'LocusUnavailable',
  LOCUS_CONFLICT: 'LocusConflict',
  TIMEOUT: 'Timeout',
  LOCUS_INVALID_SEQUENCE_HASH: 'LocusInvalidSequenceHash',
  UPDATE_MEDIA_FAILED: 'UpdateMediaFailed',
  FAILED_TO_CONNECT_MEDIA: 'FailedToConnectMedia',
  MEDIA_ENGINE_LOST: 'MediaEngineLost',
  MEDIA_CONNECTION_LOST: 'MediaConnectionLost',
  ICE_FAILURE: 'IceFailure',
  MEDIA_ENGINE_HANG: 'MediaEngineHang',
  ICE_SERVER_REJECTED: 'IceServerRejected',
  CALL_FULL: 'CallFull',
  ROOM_TOO_LARGE: 'RoomTooLarge',
  GUEST_ALREADY_ADDED: 'GuestAlreadyAdded',
  LOCUS_USER_NOT_AUTHORISED: 'LocusUserNotAuthorised',
  CLOUDBERRY_UNAVAILABLE: 'CloudberryUnavailable',
  ROOM_TOO_LARGE_FREE_ACCOUNT: 'RoomTooLarge_FreeAccount',
  MEETING_INACTIVE: 'MeetingInactive',
  MEETING_LOCKED: 'MeetingLocked',
  MEETING_TERMINATING: 'MeetingTerminating',
  MODERATOR_PIN_OR_GUEST_REQUIRED: 'Moderator_Pin_Or_Guest_Required',
  MODERATOR_PIN_OR_GUEST_PIN_REQUIRED: 'Moderator_Pin_Or_Guest_PIN_Required',
  MODERATOR_REQUIRED: 'Moderator_Required',
  USER_NOT_MEMBER_OF_ROOM: 'UserNotMemberOfRoom',
  NEW_LOCUS_ERROR: 'NewLocusError',
  NETWORK_UNAVAILABLE: 'NetworkUnavailable',
  MEETING_UNAVAILABLE: 'MeetingUnavailable',
  MEETING_ID_INVALID: 'MeetingIDInvalid',
  MEETING_SITE_INVALID: 'MeetingSiteInvalid',
  LOCUS_INVALID_JOINTIME: 'LocusInvalidJoinTime',
  LOBBY_EXPIRED: 'LobbyExpired',
  MEDIA_CONNECTION_LOST_PAIRED: 'MediaConnectionLostPaired',
  PHONE_NUMBER_NOT_A_NUMBER: 'PhoneNumberNotANumber',
  PHONE_NUMBER_TOO_LONG: 'PhoneNumberTooLong',
  INVALID_DIALABLE_KEY: 'InvalidDialableKey',
  ONE_ON_ONE_TO_SELF_NOT_ALLOWED: 'OneOnOneToSelfNotAllowed',
  REMOVED_PARTICIPANT: 'RemovedParticipant',
  MEETING_LINK_NOT_FOUND: 'MeetingLinkNotFound',
  PHONE_NUMBER_TOO_SHORT_AFTER_IDD: 'PhoneNumberTooShortAfterIdd',
  INVALID_INVITEE_ADDRESS: 'InvalidInviteeAddress',
  PMR_USER_ACCOUNT_LOCKED_OUT: 'PMRUserAccountLockedOut',
  GUEST_FORBIDDEN: 'GuestForbidden',
  PMR_ACCOUNT_SUSPENDED: 'PMRAccountSuspended',
  EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE: 'EmptyPhoneNumberOrCountryCode',
  CONVERSATION_NOT_FOUND: 'ConversationNotFound',
  SIP_CALLEE_BUSY: 'SIPCalleeBusy',
  SIP_CALLEE_NOT_FOUND: 'SIPCalleeNotFound',
  START_RECORDING_FAILED: 'StartRecordingFailed',
  RECORDING_IN_PROGRESS_FAILED: 'RecordingInProgressFailed',
  MEETING_INFO_LOOKUP_ERROR: 'MeetingInfoLookupError',
  CALL_FULL_ADD_GUEST: 'CallFullAddGuest',
};

export const SERVICE_ERROR_CODES_TO_CLIENT_ERROR_CODES_MAP = {
  // ---- Webex API ----
  // Site not support the URL's domain
  58400: 4100,
  99002: 4100,
  // Cannot find the data
  99009: 4100,
  // CMR Meeting Not Supported (meeting exists, but not CMR meeting)
  403040: 4100,
  // Requires Moderator Pin or Guest Pin
  403041: 4005,
  // Meeting is not allow to access since password or hostKey error
  403038: 4005,
  // Meeting is not allow to access since require password or hostKey
  403036: 4005,
  // Invalid panelist Pin
  403043: 4100,
  // Device not registered in org
  403048: 4100,
  // Not allowed to join external meetings
  403049: 4100,
  403100: 4100,
  // Enforce sign in: need login before access when policy enforce sign in
  403101: 4100,
  // Enforce sign in: sign in with your email address that is approved by your organization
  403102: 4100,
  // Join internal Meeting: need login before access when policy enforce sign in
  403103: 4100,
  // Join internal Meeting: The host's organization policy doesn't allow your account to join this meeting. Try switching to another account
  403104: 4100,
  404001: 4100,
  // Site data not found
  404006: 4100,
  // Too many requests access
  429005: 4100,

  // ---- Locus ------
  // FREE_USER_MAX_PARTICIPANTS_EXCEEDED
  2403001: 3007,
  // PAID_USER_MAX_PARTICIPANTS_EXCEEDED
  2403002: 3002,
  // SERVICE_MAX_PARTICIPANTS_EXCEEDED
  2403003: 3002,
  // LOCUS_INACTIVE
  2403004: 4001,
  // LOCUS_FREE_USER_MAX_PARTICIPANTS_JOINED_EXCEEDED
  2403018: 3001,
  // LOCUS_PAID_USER_MAX_PARTICIPANTS_JOINED_EXCEEDED
  2403019: 3001,
  // LOCUS_LOCKED
  2423003: 4002,
  // LOCUS_TERMINATING
  2423004: 4003,
  // LOCUS_REQUIRES_MODERATOR_PIN_OR_GUEST
  2423005: 4005,
  // LOCUS_REQUIRES_MODERATOR_ROLE
  2423007: 4006,
  // LOCUS_JOIN_RESTRICTED_USER_NOT_IN_ROOM
  2403010: 4007,
  // LOCUS_MEETING_NOT_FOUND
  2403014: 4011,
  // LOCUS_NOT_WEBEX_SITE
  2403015: 4012,
  // LOCUS_INVALID_JOIN_TIME
  2423010: 4013,
  // LOCUS_PHONE_NUMBER_NOT_A_NUMBER
  2400008: 4016,
  // LOCUS_PHONE_NUMBER_TOO_LONG
  2400011: 4017,
  // LOCUS_INVALID_DIALABLE_KEY
  2400012: 4018,
  // LOCUS_ONE_ON_ONE_TO_SELF_NOT_ALLOWED
  2403007: 4019,
  // LOCUS_REMOVED_PARTICIPANT
  2401002: 4020,
  // LOCUS_MEETING_LINK_NOT_FOUND
  2404002: 4021,
  // LOCUS_PHONE_NUMBER_TOO_SHORT_AFTER_IDD
  2400009: 4022,
  // LOCUS_INVALID_INVITEE_ADDRESS
  2400025: 4023,
  // LOCUS_PMR_USER_ACCOUNT_LOCKEDOUT
  2423009: 4024,
  // LOCUS_RESOURCE_GUEST_FORBIDDEN
  2403022: 4025,
  // LOCUS_PMR_SUSPENDED
  2423008: 4026,
  // LOCUS_EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE
  2400006: 4027,
  // LOCUS_INVALID_SINCE_OR_SEQUENCE_HASH_IN_REQUEST
  2400014: 1006,
  // LOCUS_CONVERSATION_NOT_FOUND
  2404001: 4028,
  // LOCUS_RECORDING_CONTROL_NOT_SUPPORTED
  2403025: 4029,
  // LOCUS_RECORDING_NOT_STARTED
  2405001: 4029,
  // LOCUS_RECORDING_NOT_ENABLED
  2409005: 4029,
};

export const CLIENT_ERROR_CODE_TO_ERROR_PAYLOAD: Record<number, Partial<ClientEventError>> = {
  1000: {
    errorDescription: ERROR_DESCRIPTIONS.UNKNOWN_CALL_FAILURE,
    category: 'signaling',
    fatal: true,
    name: 'locus.response',
  },
  1001: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_RATE_LIMITED_INCOMING,
    category: 'signaling',
    fatal: true,
    name: 'locus.response',
  },
  1002: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_RATE_LIMITED_OUTGOING,
    category: 'signaling',
    fatal: true,
    name: 'locus.response',
  },
  1003: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_UNAVAILABLE,
    category: 'signaling',
    fatal: true,
    name: 'locus.response',
  },
  1004: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_CONFLICT,
    category: 'signaling',
    fatal: true,
    name: 'locus.response',
  },
  1005: {
    errorDescription: ERROR_DESCRIPTIONS.TIMEOUT,
    category: 'signaling',
    fatal: true,
    name: 'locus.response',
  },
  1006: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_INVALID_SEQUENCE_HASH,
    category: 'signaling',
    fatal: true,
  },
  1007: {
    errorDescription: ERROR_DESCRIPTIONS.UPDATE_MEDIA_FAILED,
    category: 'signaling',
    fatal: true,
  },
  2001: {
    errorDescription: ERROR_DESCRIPTIONS.FAILED_TO_CONNECT_MEDIA,
    category: 'signaling',
    fatal: true,
  },
  2002: {
    errorDescription: ERROR_DESCRIPTIONS.MEDIA_ENGINE_LOST,
    category: 'signaling',
    fatal: true,
  },
  2003: {
    errorDescription: ERROR_DESCRIPTIONS.MEDIA_CONNECTION_LOST,
    category: 'signaling',
    fatal: true,
  },
  2004: {
    errorDescription: ERROR_DESCRIPTIONS.ICE_FAILURE,
    category: 'signaling',
    fatal: true,
  },
  2005: {
    errorDescription: ERROR_DESCRIPTIONS.MEDIA_ENGINE_HANG,
    category: 'signaling',
    fatal: true,
  },
  2006: {
    errorDescription: ERROR_DESCRIPTIONS.ICE_SERVER_REJECTED,
    category: 'signaling',
    fatal: true,
  },
  3001: {
    errorDescription: ERROR_DESCRIPTIONS.CALL_FULL,
    category: 'expected',
    fatal: true,
  },
  3002: {
    errorDescription: ERROR_DESCRIPTIONS.ROOM_TOO_LARGE,
    category: 'expected',
    fatal: true,
  },
  3004: {
    errorDescription: ERROR_DESCRIPTIONS.GUEST_ALREADY_ADDED,
    category: 'expected',
    fatal: false,
  },
  3005: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_USER_NOT_AUTHORISED,
    category: 'expected',
    fatal: true,
  },
  3006: {
    errorDescription: ERROR_DESCRIPTIONS.CLOUDBERRY_UNAVAILABLE,
    category: 'expected',
    fatal: true,
  },
  3007: {
    errorDescription: ERROR_DESCRIPTIONS.ROOM_TOO_LARGE_FREE_ACCOUNT,
    category: 'expected',
    fatal: true,
  },
  4001: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_INACTIVE,
    category: 'expected',
    fatal: true,
  },
  4002: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_LOCKED,
    category: 'expected',
    fatal: true,
    name: 'locus.response',
  },
  4003: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_TERMINATING,
    category: 'expected',
    fatal: true,
    name: 'locus.leave',
  },
  4004: {
    errorDescription: ERROR_DESCRIPTIONS.MODERATOR_PIN_OR_GUEST_REQUIRED,
    category: 'expected',
    fatal: false,
  },
  4005: {
    errorDescription: ERROR_DESCRIPTIONS.MODERATOR_PIN_OR_GUEST_PIN_REQUIRED,
    category: 'expected',
    fatal: false,
  },
  4006: {
    errorDescription: ERROR_DESCRIPTIONS.MODERATOR_REQUIRED,
    category: 'expected',
    fatal: false,
  },
  4007: {
    errorDescription: ERROR_DESCRIPTIONS.USER_NOT_MEMBER_OF_ROOM,
    category: 'expected',
    fatal: true,
  },
  4008: {
    errorDescription: ERROR_DESCRIPTIONS.NEW_LOCUS_ERROR,
    category: 'signaling',
    fatal: true,
  },
  4009: {
    errorDescription: ERROR_DESCRIPTIONS.NETWORK_UNAVAILABLE,
    category: 'expected',
    fatal: true,
  },
  4010: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_UNAVAILABLE,
    category: 'expected',
    fatal: true,
  },
  4011: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_ID_INVALID,
    category: 'expected',
    fatal: true,
  },
  4012: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_SITE_INVALID,
    category: 'expected',
    fatal: true,
  },
  4013: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_INVALID_JOINTIME,
    category: 'expected',
    fatal: true,
  },
  4014: {
    errorDescription: ERROR_DESCRIPTIONS.LOBBY_EXPIRED,
    category: 'expected',
    fatal: true,
  },
  4015: {
    errorDescription: ERROR_DESCRIPTIONS.MEDIA_CONNECTION_LOST_PAIRED,
    category: 'expected',
    fatal: false,
  },
  4016: {
    errorDescription: ERROR_DESCRIPTIONS.PHONE_NUMBER_NOT_A_NUMBER,
    category: 'expected',
    fatal: true,
    name: 'locus.response',
  },
  4017: {
    errorDescription: ERROR_DESCRIPTIONS.PHONE_NUMBER_TOO_LONG,
    category: 'expected',
    fatal: true,
    name: 'locus.response',
  },
  4018: {
    errorDescription: ERROR_DESCRIPTIONS.INVALID_DIALABLE_KEY,
    category: 'expected',
    fatal: true,
    name: 'locus.response',
  },
  4019: {
    errorDescription: ERROR_DESCRIPTIONS.ONE_ON_ONE_TO_SELF_NOT_ALLOWED,
    category: 'expected',
    fatal: true,
  },
  4020: {
    errorDescription: ERROR_DESCRIPTIONS.REMOVED_PARTICIPANT,
    category: 'expected',
    fatal: true,
  },
  4021: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_LINK_NOT_FOUND,
    category: 'expected',
    fatal: true,
  },
  4022: {
    errorDescription: ERROR_DESCRIPTIONS.PHONE_NUMBER_TOO_SHORT_AFTER_IDD,
    category: 'expected',
    fatal: true,
  },
  4023: {
    errorDescription: ERROR_DESCRIPTIONS.INVALID_INVITEE_ADDRESS,
    category: 'expected',
    fatal: true,
  },
  4024: {
    errorDescription: ERROR_DESCRIPTIONS.PMR_USER_ACCOUNT_LOCKED_OUT,
    category: 'expected',
    fatal: true,
  },
  4025: {
    errorDescription: ERROR_DESCRIPTIONS.GUEST_FORBIDDEN,
    category: 'expected',
    fatal: true,
  },
  4026: {
    errorDescription: ERROR_DESCRIPTIONS.PMR_ACCOUNT_SUSPENDED,
    category: 'expected',
    fatal: true,
  },
  4027: {
    errorDescription: ERROR_DESCRIPTIONS.EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE,
    category: 'expected',
    fatal: true,
  },
  4028: {
    errorDescription: ERROR_DESCRIPTIONS.CONVERSATION_NOT_FOUND,
    category: 'expected',
    fatal: true,
  },
  4029: {
    errorDescription: ERROR_DESCRIPTIONS.START_RECORDING_FAILED,
    category: 'expected',
    fatal: true,
  },
  4030: {
    errorDescription: ERROR_DESCRIPTIONS.RECORDING_IN_PROGRESS_FAILED,
    category: 'expected',
    fatal: true,
  },
  5000: {
    errorDescription: ERROR_DESCRIPTIONS.SIP_CALLEE_BUSY,
    category: 'expected',
    fatal: true,
  },
  5001: {
    errorDescription: ERROR_DESCRIPTIONS.SIP_CALLEE_NOT_FOUND,
    category: 'expected',
    fatal: true,
  },

  // Webex App API Error Codes
  4100: {
    errorDescription: ERROR_DESCRIPTIONS.MEETING_INFO_LOOKUP_ERROR,
    category: 'signaling',
    fatal: true,
  },
  3003: {
    errorDescription: ERROR_DESCRIPTIONS.CALL_FULL_ADD_GUEST,
    category: 'expected',
    fatal: false,
  },
};

export const CALL_DIAGNOSTIC_EVENT_FAILED_TO_SEND = 'js_sdk_call_diagnostic_event_failed_to_send';
