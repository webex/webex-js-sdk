/* eslint-disable import/prefer-default-export */
// Most client error codes are mapped based on
// https://sqbu-github.cisco.com/WebExSquared/event-dictionary/wiki/Error-codes-for-metric-events

import {ClientEventError, ClientSubServiceType} from '../metrics.types';

export const CALL_DIAGNOSTIC_LOG_IDENTIFIER = 'call-diagnostic-events -> ';

export const AUTHENTICATION_FAILED_CODE = 1010;
export const NETWORK_ERROR = 1026;
export const NEW_LOCUS_ERROR_CLIENT_CODE = 4008;
export const MEETING_INFO_LOOKUP_ERROR_CLIENT_CODE = 4100;
export const UNKNOWN_ERROR = 9999; // Unexpected error that is not a meetingInfo error, locus error or browser media error.
export const ICE_FAILURE_CLIENT_CODE = 2004;
export const MISSING_ROAP_ANSWER_CLIENT_CODE = 2007;
export const DTLS_HANDSHAKE_FAILED_CLIENT_CODE = 2008;
export const ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE = 2010;
export const ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE = 2009;
export const ICE_AND_REACHABILITY_FAILED_CLIENT_CODE = 2011;
export const WBX_APP_API_URL = 'wbxappapi'; // MeetingInfo WebexAppApi response object normally contains a body.url that includes the string 'wbxappapi'

export const WEBEX_SUB_SERVICE_TYPES: Record<string, ClientSubServiceType> = {
  PMR: 'PMR',
  SCHEDULED_MEETING: 'ScheduledMeeting',
  WEBINAR: 'Webinar',
};

// Found in https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
const BROWSER_MEDIA_ERROR_NAMES = {
  PERMISSION_DENIED_ERROR: 'PermissionDeniedError',
  NOT_ALLOWED_ERROR: 'NotAllowedError',
  NOT_READABLE_ERROR: 'NotReadableError',
  ABORT_ERROR: 'AbortError',
  NOT_FOUND_ERROR: 'NotFoundError',
  OVERCONSTRAINED_ERROR: 'OverconstrainedError',
  SECURITY_ERROR: 'SecurityError',
  TYPE_ERROR: 'TypeError',
};

export const BROWSER_MEDIA_ERROR_NAME_TO_CLIENT_ERROR_CODES_MAP = {
  [BROWSER_MEDIA_ERROR_NAMES.PERMISSION_DENIED_ERROR]: 4032, // User did not grant permission
  [BROWSER_MEDIA_ERROR_NAMES.NOT_ALLOWED_ERROR]: 4032, // User did not grant permission
  [BROWSER_MEDIA_ERROR_NAMES.NOT_READABLE_ERROR]: 2729, // Although the user granted permission to use the matching devices, a hardware error occurred at the operating system, browser, or Web page level which prevented access to the device.
  [BROWSER_MEDIA_ERROR_NAMES.ABORT_ERROR]: 2729, // Although the user and operating system both granted access to the hardware device, and no hardware issues occurred that would cause a NotReadableError DOMException, throw if some problem occurred which prevented the device from being used.
  [BROWSER_MEDIA_ERROR_NAMES.NOT_FOUND_ERROR]: 2729, // User did not grant permission
  [BROWSER_MEDIA_ERROR_NAMES.OVERCONSTRAINED_ERROR]: 2729, // Thrown if the specified constraints resulted in no candidate devices which met the criteria requested.
  [BROWSER_MEDIA_ERROR_NAMES.SECURITY_ERROR]: 2729, // Thrown if user media support is disabled on the Document on which getUserMedia() was called. The mechanism by which user media support is enabled and disabled is left up to the individual user agent.
  [BROWSER_MEDIA_ERROR_NAMES.TYPE_ERROR]: 2729, // Thrown if the list of constraints specified is empty, or has all constraints set to false. This can also happen if you try to call getUserMedia() in an insecure context, since navigator.mediaDevices is undefined in an insecure context.
};

export const SDP_OFFER_CREATION_ERROR_MAP = {
  GENERAL: 2050,
  SDP_MUNGE_MISSING_CODECS: 2051,
};

export const ERROR_DESCRIPTIONS = {
  UNKNOWN_CALL_FAILURE: 'UnknownCallFailure',
  LOCUS_RATE_LIMITED_INCOMING: 'LocusRateLimitedIncoming',
  LOCUS_RATE_LIMITED_OUTGOING: 'LocusRateLimitedOutgoing',
  LOCUS_UNAVAILABLE: 'LocusUnavailable',
  LOCUS_CONFLICT: 'LocusConflict',
  TIMEOUT: 'Timeout',
  LOCUS_INVALID_SEQUENCE_HASH: 'LocusInvalidSequenceHash',
  AUTHENTICATION_FAILED: 'AuthenticationFailed',
  NETWORK_ERROR: 'NetworkError',
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
  REQUIRE_WEBEX_LOGIN: 'RequireWebexLogin',
  USER_NOT_ALLOWED_ACCESS_MEETING: 'UserNotAllowedAccessMeeting',
  USER_NEEDS_ACTIVATION: 'UserNeedsActivation',
  SIGN_UP_INVALID_EMAIL: 'SignUpInvalidEmail',
  UNKNOWN_ERROR: 'UnknownError',
  NO_MEDIA_FOUND: 'NoMediaFound',
  STREAM_ERROR_NO_MEDIA: 'StreamErrorNoMedia',
  CAMERA_PERMISSION_DENIED: 'CameraPermissionDenied',
  FRAUD_DETECTION: 'FraudDetection',
  E2EE_NOT_SUPPORTED: 'E2EENotSupported',
  LOCUS_LOBBY_FULL_CMR: 'LocusLobbyFullCMR',
  USER_NOT_INVITED_TO_JOIN: 'UserNotInvitedToJoin',
  MISSING_ROAP_ANSWER: 'MissingRoapAnswer',
  DTLS_HANDSHAKE_FAILED: 'DTLSHandshakeFailed',
  ICE_FAILED_WITHOUT_TURN_TLS: 'ICEFailedWithoutTURN_TLS',
  ICE_FAILED_WITH_TURN_TLS: 'ICEFailedWithTURN_TLS',
  ICE_AND_REACHABILITY_FAILED: 'ICEAndReachabilityFailed',
  SDP_OFFER_CREATION_ERROR: 'SdpOfferCreationError',
  SDP_OFFER_CREATION_ERROR_MISSING_CODEC: 'SdpOfferCreationErrorMissingCodec',
  WDM_RESTRICTED_REGION: 'WdmRegionRestricted',
};

export const SERVICE_ERROR_CODES_TO_CLIENT_ERROR_CODES_MAP = {
  // ---- Webex API ----
  // Taken from https://wiki.cisco.com/display/HFWEB/MeetingInfo+API and https://sqbu-github.cisco.com/WebExSquared/spark-client-framework/blob/master/spark-client-framework/Services/WebexMeetingService/WebexMeetingModel.h
  // Site not support the URL's domain
  58400: 4100,
  99002: 4100,
  // Cannot find the data. Unkown meeting.
  99009: 4100,
  // Meeting is not allow to cross env
  58500: 4100,
  // Input parameters contain invalit item
  400001: 4100,
  // Empty password or token. Meeting is not allow to access since require password
  403004: 4005,
  // Wrong password. Meeting is not allow to access since password error
  403028: 4005,
  // Wrong or expired permission. Meeting is not allow to access since permissionToken error or expire
  403032: 4005,
  // Meeting is required login for current user
  403034: 4036,
  // Meeting is not allow to access since require password or hostKey
  // Empty password or host key
  403036: 4005,
  // Meeting is not allow to access since password or hostKey error
  // Wrong password or host key
  403038: 4005,
  // CMR Meeting Not Supported (meeting exists, but not CMR meeting)
  403040: 4100,
  // Requires Moderator Pin or Guest Pin
  403041: 4005,
  // Email blocked
  403047: 4101,
  // Device not authenticated for your organization
  403408: 4101,
  // Invalid panelist Pin
  403043: 4005,
  // Device not registered in org. Device not authenticated.
  403048: 4101,
  // Not allowed to join external meetings. Violate meeting join policy. Your organization settings don't allow you to join this meeting.
  403049: 4101,
  // Invalid email. Requires sign in meeting's current site.
  403100: 4101,
  // Enforce sign in: need login before access when policy enforce sign in. GuestForceUserSignInPolicy
  403101: 4036,
  // Enforce sign in: sign in with your email address that is approved by your organization
  403102: 4036,
  // Join internal Meeting: need login before access when policy enforce sign in. Guest force user sign in internal meeting policy.
  403103: 4036,
  // Join internal Meeting: The host's organization policy doesn't allow your account to join this meeting. Try switching to another account
  403104: 4101,
  404001: 4101,
  // Site data not found. Unkonwn meeting. Site data not found(or null).
  404006: 4100,
  // Invalid input with too many requests. Too many requests access, please input captcha code
  423001: 4005,
  // Wrong password with too many requests. PasswordError too many time, please input captcha code
  423005: 4005,
  // Wrong password or host key with too many requests
  423006: 4005,
  // PasswordError with right captcha, please input captcha code
  423010: 4005,
  // PasswordOrHostKeyError with right captcha, please input captcha code
  423012: 4005,
  // Unverified or invalid input. Force show captcha. Please input captcha code"
  423013: 4005,
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
  2423006: 4005,
  2423016: 4005,
  2423017: 4005,
  2423018: 4005,
  // LOCUS_OWNER_CONCURRENT_ACTIVE_MEETING_LIMIT_EXCEEDED
  2423012: 12000,
  // LOCUS_LOBBY_FULL_CMR
  2423021: 12001,
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
  // E2EE_NOT_SUPPORTED
  2409062: 12002,
  // LOCUS: ONLY_INVITED_USERS_CAN_ATTEND_THIS_MEETING
  2423025: 12003,

  // ---- U2C Sign in catalog ------
  // The user exists, but hasn't completed activation. Needs to visit Atlas for more processing.
  100002: 4102,
  // The user exists, had completed activation earlier, but requires re-activation because of change in login strategy.
  // Common example is: user signed up using an OAuth provider, but that OAuth provider was removed by org's admin. Now the user needs to re-activate using alternate login strategies: password-pin, new OAuth provider, SSO, etc.
  100007: 4102,
  // The user does not exist
  100001: 4103,
  // The user wasn't found, and the organization used for search is a domain-claimed organization.
  100006: 4103,
  100005: 4103, // Depracated because of an issue in the UCF Clients
  // If both email-hash and domain-hash are null or undefined.
  100004: 4103,

  // ---- WDM ----
  // WDM_BLOCKED_ACCESS_BY_COUNTRY_CODE_BANNED_COUNTRY_ERROR_CODE
  4404002: 13000,
  // WDM_BLOCKED_ACCESS_BY_COUNTRY_CODE_RESTRICTED_COUNTRY_ERROR_CODE
  4404003: 13000,
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
  [AUTHENTICATION_FAILED_CODE]: {
    errorDescription: ERROR_DESCRIPTIONS.AUTHENTICATION_FAILED,
    category: 'network',
    fatal: true,
  },
  1026: {
    errorDescription: ERROR_DESCRIPTIONS.NETWORK_ERROR,
    category: 'network',
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
  [ICE_FAILURE_CLIENT_CODE]: {
    errorDescription: ERROR_DESCRIPTIONS.ICE_FAILURE,
    category: 'media',
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
  [MISSING_ROAP_ANSWER_CLIENT_CODE]: {
    errorDescription: ERROR_DESCRIPTIONS.MISSING_ROAP_ANSWER,
    category: 'media',
    fatal: true,
  },
  [DTLS_HANDSHAKE_FAILED_CLIENT_CODE]: {
    errorDescription: ERROR_DESCRIPTIONS.DTLS_HANDSHAKE_FAILED,
    category: 'media',
    fatal: true,
  },
  [ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE]: {
    errorDescription: ERROR_DESCRIPTIONS.ICE_FAILED_WITHOUT_TURN_TLS,
    category: 'media',
    fatal: true,
  },
  [ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE]: {
    errorDescription: ERROR_DESCRIPTIONS.ICE_FAILED_WITH_TURN_TLS,
    category: 'media',
    fatal: true,
  },
  [ICE_AND_REACHABILITY_FAILED_CLIENT_CODE]: {
    errorDescription: ERROR_DESCRIPTIONS.ICE_AND_REACHABILITY_FAILED,
    category: 'expected',
    fatal: true,
  },
  2050: {
    errorDescription: ERROR_DESCRIPTIONS.SDP_OFFER_CREATION_ERROR,
    category: 'media',
    fatal: true,
    shownToUser: true,
  },
  2051: {
    errorDescription: ERROR_DESCRIPTIONS.SDP_OFFER_CREATION_ERROR_MISSING_CODEC,
    category: 'expected',
    fatal: true,
    shownToUser: true,
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
    errorDescription: ERROR_DESCRIPTIONS.STREAM_ERROR_NO_MEDIA,
    category: 'expected',
    fatal: true,
  },
  3013: {
    errorDescription: ERROR_DESCRIPTIONS.ROOM_TOO_LARGE_FREE_ACCOUNT,
    category: 'expected',
    fatal: false,
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
    category: 'network',
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
  4032: {
    errorDescription: ERROR_DESCRIPTIONS.CAMERA_PERMISSION_DENIED,
    category: 'expected',
    fatal: true,
  },
  4036: {
    errorDescription: ERROR_DESCRIPTIONS.REQUIRE_WEBEX_LOGIN,
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
  4101: {
    errorDescription: ERROR_DESCRIPTIONS.USER_NOT_ALLOWED_ACCESS_MEETING,
    category: 'expected',
    fatal: true,
  },
  4102: {
    errorDescription: ERROR_DESCRIPTIONS.USER_NEEDS_ACTIVATION,
    category: 'expected',
    fatal: true,
  },
  4103: {
    errorDescription: ERROR_DESCRIPTIONS.SIGN_UP_INVALID_EMAIL,
    category: 'expected',
    fatal: true,
  },
  2729: {
    errorDescription: ERROR_DESCRIPTIONS.NO_MEDIA_FOUND,
    category: 'expected',
    fatal: false,
  },
  9999: {
    errorDescription: ERROR_DESCRIPTIONS.UNKNOWN_ERROR,
    category: 'other',
    fatal: true,
  },
  12000: {
    errorDescription: ERROR_DESCRIPTIONS.FRAUD_DETECTION,
    category: 'expected',
    fatal: true,
    name: 'locus.response',
    shownToUser: true,
  },
  12001: {
    errorDescription: ERROR_DESCRIPTIONS.LOCUS_LOBBY_FULL_CMR,
    category: 'expected',
    fatal: true,
    name: 'locus.response',
    shownToUser: true,
  },
  12002: {
    errorDescription: ERROR_DESCRIPTIONS.E2EE_NOT_SUPPORTED,
    category: 'expected',
    fatal: true,
    name: 'locus.response',
    shownToUser: true,
  },
  12003: {
    errorDescription: ERROR_DESCRIPTIONS.USER_NOT_INVITED_TO_JOIN,
    category: 'expected',
    fatal: true,
  },
  13000: {
    errorDescription: ERROR_DESCRIPTIONS.WDM_RESTRICTED_REGION,
    category: 'expected',
    fatal: true,
  },
};

export const CALL_DIAGNOSTIC_EVENT_FAILED_TO_SEND = 'js_sdk_call_diagnostic_event_failed_to_send';
