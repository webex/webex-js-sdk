import {hydraTypes} from '@webex/common';

// *********** LOWERCASE / CAMELCASE STRINGS ************

export const AUDIO = 'audio';
export const AUDIO_INPUT = 'audioinput';
export const AUDIO_STATUS = 'audioStatus';
export const ALERT = 'alert';
export const ANSWER = 'answer';

export const CALL = 'call';
export const CORRELATION_ID = 'correlationId';
export const CONVERSATION_URL = 'conversationUrl';
export const CALENDAR = 'calendar';
export const CALENDAR_EVENTS_API = 'calendarEvents';
export const CMR_MEETINGS = 'cmrmeetings';
export const CLAIM = 'claim';
export const CONTROLS = 'controls';
export const CONTENT = 'content';
export const COMPLETE = 'complete';
export const WHITEBOARD = 'whiteboard';
export const GATHERING = 'gathering';
export const DEVELOPMENT = 'development';
export const DECLINE = 'decline';

export const ERROR = 'error';
export const ENDED = 'ended';

export const OFFER = 'offer';

export const HECATE = 'hecate';

export const HOST = 'host';

export const JOIN = 'join';

export const LEAVE = 'leave';
export const LIVE = 'live';
export const LOCAL = 'local';
export const LOCI = 'loci';
export const LOCUS_URL = 'locusUrl';
export const END = 'end';

export const MAX_RANDOM_DELAY_FOR_MEETING_INFO = 3 * 60 * 1000;
export const MEETINGINFO = 'meetingInfo';
export const MEET = 'meet';
export const MEET_M = 'm';
export const MEDIA = 'media';

export const OFFLINE = 'offline';
export const ONLINE = 'online';

export const PARTICIPANT = 'participant';

export const PROVISIONAL_TYPE_DIAL_IN = 'DIAL_IN';
export const PROVISIONAL_TYPE_DIAL_OUT = 'DIAL_OUT';

export const REMOTE = 'remote';
export const READY = 'ready';

export const SEND_DTMF_ENDPOINT = 'sendDtmf';
export const SENDRECV = 'sendrecv';
export const SIP_URI = 'sipUri';
export const SHARE = 'share';

export const TYPE = 'type';

export const VIDEO = 'video';
export const VIDEO_INPUT = 'videoinput';
export const VIDEO_STATUS = 'videoStatus';

// *********** UPPERCASE ONLY STRINGS ************
// Please alphabetize
export const _ANSWER_ = 'ANSWER';
export const _ACTIVE_ = 'ACTIVE';
export const _CALL_ = 'CALL';
export const _CREATED_ = 'CREATED';
export const _CONFLICT_ = 'CONFLICT';
export const _CONVERSATION_URL_ = 'CONVERSATION_URL';

export const _ERROR_ = 'ERROR';

export const _FORCED_ = 'FORCED';

export const _IDLE_ = 'IDLE';
export const _IN_LOBBY_ = 'IN_LOBBY';
export const _IN_MEETING_ = 'IN_MEETING';
export const _INCOMING_ = 'INCOMING';
export const _IN_ = 'IN';
export const _ID_ = 'id';

export const _JOIN_ = 'JOIN';
export const _JOINED_ = 'JOINED';

export const _LOCUS_ID_ = 'LOCUS_ID';
export const _LEFT_ = 'LEFT';

export const _MEETING_LINK_ = 'MEETING_LINK';
export const _MEETING_UUID_ = 'MEETING_UUID';
export const _MEETING_ = 'MEETING';
export const _MEETING_CENTER_ = 'MEETING_CENTER';
export const _MEETING_ID_ = 'MEETING_ID';

export const _NOT_IN_MEETING_ = 'NOT_IN_MEETING';
export const _NONE_ = 'NONE';

export const _OFFER_ = 'OFFER';
export const _OBSERVE_ = 'OBSERVE';

export const _PERSONAL_ROOM_ = 'PERSONAL_ROOM';
export const _PEOPLE_ = hydraTypes.PEOPLE;

export const _REQUESTED_ = 'REQUESTED';
export const _RESOURCE_ROOM_ = 'RESOURCE_ROOM';
export const _RECEIVE_ONLY_ = 'RECVONLY';
export const _REMOVE_ = 'REMOVE';
export const _ROOM_ = hydraTypes.ROOM;

export const _SIP_BRIDGE_ = 'SIP_BRIDGE';
export const _SIP_URI_ = 'SIP_URI';
export const _SEND_RECEIVE_ = 'SENDRECV';
export const _SEND_ONLY_ = 'SENDONLY';
export const _INACTIVE_ = 'INACTIVE';
export const _SLIDES_ = 'SLIDES';
export const _S_LINE = 's=-';

export const _USER_ = 'USER';
export const _UNKNOWN_ = 'UNKNOWN';

export const _WEBEX_MEETING_ = 'WEBEX_MEETING';
export const _WAIT_ = 'WAIT';
export const _MOVE_MEDIA_ = 'MOVE_MEDIA';

// *********** PARTICIPANT DELTAS ***********
export const PARTICIPANT_DELTAS = {
  TARGETS: {
    AUDIO: 'audio',
    VIDEO: 'video'
  },
  STATES: {
    DISABLED: 'disabled',
    MUTED: 'muted',
    UNKNOWN: 'unknown',
    UNMUTED: 'unmuted'
  }
};

// *********** STRING HELPERS ***********
// Please alphabetize
export const ALTERNATE_REDIRECT_TRUE = 'alternateRedirect=true';

export const HTTPS_PROTOCOL = 'https://';

export const MEETINGS = 'Meetings';

export const MEDIA_PEER_CONNECTION_NAME = 'MediaPeerConnection';

export const SHARE_PEER_CONNECTION_NAME = 'SharePeerConnection';

export const USE_URI_LOOKUP_FALSE = 'useUriLookup=false';

export const WWW_DOT = 'www.';

export const WEBEX_DOT_COM = 'webex.com';

export const CONVERSATION_SERVICE = 'identityLookup';

export const WBXAPPAPI_SERVICE = 'webex-appapi-service';

// ******************* ARRAYS ********************
// Please alphabetize
export const DEFAULT_EXCLUDED_STATS = ['timestamp', 'ssrc', 'priority'];

/**
 * @description @description Layout type for remote video participants. Allowed values are: Single, Equal, ActivePresence, Prominent, OnePlusN
 * @type {array}
 * @constant
 */
export const LAYOUT_TYPES = ['Single', 'Equal', 'ActivePresence', 'Prominent', 'OnePlusN'];

// ******************* BOOLEANS *******************
// Please alphabetize
export const MODERATOR_TRUE = true;
export const MODERATOR_FALSE = false;

// ******************** NUMBERS ********************

export const INTENT_TO_JOIN = [2423005, 2423006, 2423016, 2423017, 2423018];
export const ICE_TIMEOUT = 2000;
export const ICE_FAIL_TIMEOUT = 3000;

export const RETRY_TIMEOUT = 3000;
export const ROAP_SEQ_PRE = -1;

export const PC_BAIL_TIMEOUT = 8000;

// ******************** REGEX **********************
// Please alphabetize
export const DIALER_REGEX = {
  // modified from https://github.com/kirm/sip.js base
  // and with https://tools.ietf.org/html/rfc3261
  // requires the @ symbol
  SIP_ADDRESS: /^(sips?)?:?(?:([^\s>:@]+)(?::([^\s@>]+))?@)([\w\-.]+)(?::(\d+))?((?:;[^\s=?>;]+(?:=[^\s?;]+)?)*)(?:\?(([^\s&=>]+=[^\s&=>]+)(&[^\s&=>]+=[^\s&=>]+)*))?$/,
  // standard telephony num regex
  PHONE_NUMBER: /^(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/,
  E164_FORMAT: /^\+[1-9]\d{1,14}$/
};

// eslint-disable-next-line max-len
export const IPV4_REGEX = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}|.local/g;

export const VALID_EMAIL_ADDRESS = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const VALID_PMR_ADDRESS = /([a-z0-9][-a-z0-9, '.']{0,62})@([a-z0-9][-a-z0-9, '.']{0,62})\.webex\.com/i;
export const VALID_PMR_LINK = /(https:\/\/)?([a-z0-9][-a-z0-9, '.']{0,62})\.webex\.com\/(meet|join)\/([a-z0-9][-a-z0-9, '.']{0,62})\/?/i;
export const VALID_PIN = /([0-9]{4,6})/;
export const UUID_REG = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


// ******************** OBJECTS ********************
// Please alphabetize, and keep objects organized

// TODO:  move all api params to API section
export const API = {
  CALLIOPEDISCOVERY: 'calliopeDiscovery',
  LOCUS: 'locus'
};

export const CALENDAR_EVENTS = {
  CREATE: 'event:calendar.meeting.create',
  UPDATE: 'event:calendar.meeting.update',
  CREATE_MINIMAL: 'event:calendar.meeting.create.minimal',
  UPDATE_MINIMAL: 'event:calendar.meeting.update.minimal',
  DELETE: 'event:calendar.meeting.delete'
};

export const DEFAULT_GET_STATS_FILTER = {
  types: ['track', 'transport', 'candidate-pair', 'outbound-rtp', 'outboundrtp', 'inbound-rtp', 'inboundrtp', 'remote-inbound-rtp', 'remote-outbound-rtp', 'remote-candidate', 'local-candidate', 'media-source']
};


export const RECORDING_STATE = {
  RECORDING: 'recording',
  IDLE: 'idle',
  PAUSED: 'paused',
  RESUMED: 'resumed'
};

export const SHARE_STATUS = {
  NO_SHARE: 'no_share',
  REMOTE_SHARE_ACTIVE: 'remote_share_active',
  LOCAL_SHARE_ACTIVE: 'local_share_active',
  WHITEBOARD_SHARE_ACTIVE: 'whiteboard_share_active'
};

// TODO: do we want to scope by meeting, members when they come off those objects themselves?
export const EVENT_TRIGGERS = {
  MEETINGS_READY: 'meetings:ready',
  MEETINGS_REGISTERED: 'meetings:registered',
  MEETINGS_UNREGISTERED: 'meetings:unregistered',
  MEDIA_READY: 'media:ready',
  MEDIA_STOPPED: 'media:stopped',
  MEDIA_UPDATE: 'media:update',
  MEDIA_CODEC_MISSING: 'media:codec:missing',
  MEDIA_CODEC_LOADED: 'media:codec:loaded',
  MEETING_STARTED_SHARING_LOCAL: 'meeting:startedSharingLocal',
  MEETING_STOPPED_SHARING_LOCAL: 'meeting:stoppedSharingLocal',
  MEETING_STARTED_SHARING_REMOTE: 'meeting:startedSharingRemote',
  MEETING_STOPPED_SHARING_REMOTE: 'meeting:stoppedSharingRemote',
  MEETING_STARTED_SHARING_WHITEBOARD: 'meeting:startedSharingWhiteboard',
  MEETING_STOPPED_SHARING_WHITEBOARD: 'meeting:stoppedSharingWhiteboard',
  MEETING_MEDIA_LOCAL_STARTED: 'meeting:media:local:start',
  MEETING_MEDIA_REMOTE_STARTED: 'meeting:media:remote:start',
  MEETING_STARTED_RECORDING: 'meeting:recording:started',
  MEETING_STOPPED_RECORDING: 'meeting:recording:stopped',
  MEETING_STARTED_RECEIVING_TRANSCRIPTION: 'meeting:receiveTranscription:started',
  MEETING_STOPPED_RECEIVING_TRANSCRIPTION: 'meeting:receiveTranscription:stopped',
  MEETING_PAUSED_RECORDING: 'meeting:recording:paused',
  MEETING_RESUMED_RECORDING: 'meeting:recording:resumed',
  MEETING_ADDED: 'meeting:added',
  MEETING_REMOVED: 'meeting:removed',
  MEETING_RINGING: 'meeting:ringing',
  MEETING_RINGING_STOP: 'meeting:ringingStop',
  MEETING_SELF_LOBBY_WAITING: 'meeting:self:lobbyWaiting',
  MEETING_SELF_GUEST_ADMITTED: 'meeting:self:guestAdmitted',
  MEETING_SELF_MUTED_BY_OTHERS: 'meeting:self:mutedByOthers',
  MEETING_SELF_UNMUTED_BY_OTHERS: 'meeting:self:unmutedByOthers',
  MEETING_SELF_REQUESTED_TO_UNMUTE: 'meeting:self:requestedToUnmute',
  MEETING_SELF_PHONE_AUDIO_UPDATE: 'meeting:self:phoneAudioUpdate',
  MEETING_CONTROLS_LAYOUT_UPDATE: 'meeting:layout:update',
  MEMBERS_UPDATE: 'members:update',
  MEMBERS_CONTENT_UPDATE: 'members:content:update',
  MEMBERS_HOST_UPDATE: 'members:host:update',
  MEMBERS_SELF_UPDATE: 'members:self:update',
  MEETING_RECONNECTION_STARTING: 'meeting:reconnectionStarting',
  MEETING_RECONNECTION_SUCCESS: 'meeting:reconnectionSuccess',
  MEETING_RECONNECTION_FAILURE: 'meeting:reconnectionFailure',
  MEETING_UNLOCKED: 'meeting:unlocked',
  MEETING_LOCKED: 'meeting:locked',
  MEETING_INFO_AVAILABLE: 'meeting:meetingInfoAvailable',
  MEETING_LOG_UPLOAD_SUCCESS: 'meeting:logUpload:success',
  MEETING_LOG_UPLOAD_FAILURE: 'meeting:logUpload:failure',
  MEETING_ACTIONS_UPDATE: 'meeting:actionsUpdate',
  MEETING_STATE_CHANGE: 'meeting:stateChange',
  MEETING_MEETING_CONTAINER_UPDATE: 'meeting:meetingContainer:update',
  MEETING_EMBEDDED_APPS_UPDATE: 'meeting:embeddedApps:update',
  MEDIA_QUALITY: 'media:quality',
  MEETINGS_NETWORK_DISCONNECTED: 'network:disconnected',
  MEETINGS_NETWORK_CONNECTED: 'network:connected',
  MEETING_SELF_LEFT: 'meeting:self:left',
  NETWORK_QUALITY: 'network:quality',
  MEDIA_NEGOTIATED: 'media:negotiated'
};

export const EVENT_TYPES = {
  SELF: 'self',
  OTHER: 'other',
  LOCAL: 'local',
  REMOTE: 'remote',
  REMOTE_AUDIO: 'remoteAudio',
  REMOTE_VIDEO: 'remoteVideo',
  REMOTE_SHARE: 'remoteShare',
  LOCAL_SHARE: 'localShare',
  ERROR: 'error'
};

// Handles the reason when meeting gets destroyed
// host removed you from the meeting
// You are the host and you left the meeting
// Meeting actually ended
export const MEETING_REMOVED_REASON = {
  SELF_REMOVED: 'SELF_REMOVED', // server or host removed you from the meeting
  FULLSTATE_REMOVED: 'FULLSTATE_REMOVED', // meeting got dropped ? not sure
  MEETING_INACTIVE_TERMINATING: 'MEETING_INACTIVE_TERMINATING', // Meeting got ended or everyone left the meeting
  CLIENT_LEAVE_REQUEST: 'CLIENT_LEAVE_REQUEST', // You triggered leave meeting
  USER_ENDED_SHARE_STREAMS: 'USER_ENDED_SHARE_STREAMS', // user triggered stop share
  NO_MEETINGS_TO_SYNC: 'NO_MEETINGS_TO_SYNC', // After the syncMeeting no meeting exists
  MEETING_CONNECTION_FAILED: 'MEETING_CONNECTION_FAILED' // meeting failed to connect due to ice failures or firewall issue
};

// One one one calls ends for the following reasons
// Partner reject the call or ends the call
// self cancel or end the ongoing call
export const CALL_REMOVED_REASON = {
  CALL_INACTIVE: 'CALL_INACTIVE', // partner and you leave the call
  PARTNER_LEFT: 'PARTNER_LEFT', // partner left the call
  SELF_LEFT: 'SELF_LEFT'// you left/declined the call
};

export const SHARE_STOPPED_REASON = {
  SELF_STOPPED: 'SELF_STOPPED',
  MEETING_REJOIN: 'MEETING_REJOIN'
};

export const EVENTS = {
  ROAP_OK: 'ROAP_OK',
  ROAP_ANSWER: 'ROAP_ANSWER',
  SELF_UNADMITTED_GUEST: 'SELF_UNADMITTED_GUEST',
  SELF_ADMITTED_GUEST: 'SELF_ADMITTED_GUEST',
  MEDIA_INACTIVITY: 'MEDIA_INACTIVITY',
  CONVERSATION_URL_UPDATE: 'CONVERSATION_URL_UPDATE',
  DESTROY_MEETING: 'DESTROY_MEETING',
  REQUEST_UPLOAD_LOGS: 'REQUEST_UPLOAD_LOGS',
  REMOTE_RESPONSE: 'REMOTE_RESPONSE',
  // TODO: move all of these to LOCUSINFO.EVENTS
  LOCUS_INFO_UPDATE_PARTICIPANTS: 'LOCUS_INFO_UPDATE_PARTICIPANTS',
  LOCUS_INFO_UPDATE_HOST: 'LOCUS_INFO_UPDATE_HOST',
  LOCUS_INFO_UPDATE_MEDIA_SHARES: 'LOCUS_INFO_UPDATE_MEDIA_SHARES',
  LOCUS_INFO_UPDATE_SELF: 'LOCUS_INFO_UPDATE_SELF',
  LOCUS_INFO_UPDATE_URL: 'LOCUS_INFO_UPDATE_URL',
  LOCUS_INFO_CAN_ASSIGN_HOST: 'LOCUS_INFO_CAN_ASSIGN_HOST',
  DISCONNECT_DUE_TO_INACTIVITY: 'DISCONNECT_DUE_TO_INACTIVITY'
};

export const MEDIA_STATE = {
  active: 'active',
  inactive: 'inactive'
};

export const ERROR_DICTIONARY = {
  PARAMETER: {
    NAME: 'ParameterError',
    MESSAGE: 'The parameters passed to the function, or object properties needed in the function were null, missing where required, or otherwise incorrect.',
    CODE: 0
  },
  INTENT_TO_JOIN: {
    NAME: 'IntentToJoinError',
    MESSAGE: 'The meeting is locked. This is expected behavior. Call #join again with pin and/or moderator option',
    CODE: 1
  },
  JOIN_MEETING: {
    NAME: 'JoinMeetingError',
    MESSAGE: 'There was an issue joining the meeting, meeting could be in a bad state.',
    CODE: 2
  },
  RECONNECTION: {
    NAME: 'ReconnectionError',
    MESSAGE: 'There was an error in the reconnection flow, the meeting may not reconnect, disconnect and dial again.',
    CODE: 3
  },
  MEDIA: {
    NAME: 'MediaError',
    MESSAGE: 'There was an error with media, the meeting may not have live audio, video or share.',
    CODE: 4
  },
  PERMISSION: {
    NAME: 'PermissionError',
    MESSAGE: 'Not allowed to execute the function, some properties on server, or local client state do not allow you to complete this action.',
    CODE: 5
  },
  STATS: {
    NAME: 'StatsError',
    MESSAGE: 'An error occurred with getStats, stats may not continue for this data stream.',
    CODE: 6
  },
  PASSWORD: {
    NAME: 'PasswordError',
    MESSAGE: 'Password is required, please use verifyPassword()',
    CODE: 7
  },
  CAPTCHA: {
    NAME: 'CaptchaError',
    MESSAGE: 'Captcha is required.',
    CODE: 8
  }
};

export const FLOOR_ACTION = {
  GRANTED: 'GRANTED',
  RELEASED: 'RELEASED',
  ACCEPTED: 'ACCEPTED'
};

export const FULL_STATE = {
  INITIALIZING: 'INITIALIZING',
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
  TERMINATING: 'TERMINATING',
  UNKNOWN: 'UNKNOWN'
};

export const HTTP_VERBS = {
  PUT: 'PUT',
  POST: 'POST',
  GET: 'GET',
  PATCH: 'PATCH'
};

// https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceGatheringState
export const ICE_GATHERING_STATE = {
  NEW: 'new',
  GATHERING: 'gathering',
  COMPLETE: 'complete'
};

// https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState
export const ICE_STATE = {
  CHECKING: 'checking',
  CONNECTED: 'connected',
  CLOSED: 'closed',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected'
};

export const CONNECTION_STATE = {
  NEW: 'new',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  CLOSED: 'closed',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected'
};

export const LOCUS = {
  STATE: {
    INACTIVE: 'INACTIVE',
    ENDED: 'ENDED',
    INITIALIZING: 'INITIALIZING'
  },
  SEQUENCE: {
    UN_DEF: 'undef',
    EMPTY: 'empty',
    DEF: 'def',
    NA: 'na',
    RANGE_START: 'rangeStart',
    RANGE_END: 'rangeEnd'
  },
  SYNCDEBUG: 'sync_debug'
};

export const LOCUSINFO = {
  EVENTS: {
    CONTROLS_MEETING_LAYOUT_UPDATED: 'CONTROLS_MEETING_LAYOUT_UPDATED',
    CONTROLS_RECORDING_UPDATED: 'CONTROLS_RECORDING_UPDATED',
    CONTROLS_MEETING_TRANSCRIBE_UPDATED: 'CONTROLS_MEETING_TRANSCRIBE_UPDATED',
    CONTROLS_MEETING_CONTAINER_UPDATED: 'CONTROLS_MEETING_CONTAINER_UPDATED',
    SELF_UNADMITTED_GUEST: 'SELF_UNADMITTED_GUEST',
    SELF_ADMITTED_GUEST: 'SELF_ADMITTED_GUEST',
    SELF_REMOTE_MUTE_STATUS_UPDATED: 'SELF_REMOTE_MUTE_STATUS_UPDATED',
    LOCAL_UNMUTE_REQUESTED: 'LOCAL_UNMUTE_REQUESTED',
    LOCAL_UNMUTE_REQUIRED: 'LOCAL_UNMUTE_REQUIRED',
    SELF_MODERATOR_CHANGED: 'SELF_MODERATOR_CHANGED',
    MEETING_UPDATE: 'MEETING_UPDATE',
    MEDIA_STATUS_CHANGE: 'MEDIA_STATUS_CHANGE',
    FULL_STATE_TYPE_UPDATE: 'FULL_STATE_TYPE_UPDATE',
    FULL_STATE_MEETING_STATE_CHANGE: 'FULL_STATE_MEETING_STATE_CHANGE',
    MEETING_STATE_CHANGE_TO_ACTIVE: 'MEETING_STATE_CHANGE_TO_ACTIVE',
    MEETING_INFO_UPDATED: 'MEETING_INFO_UPDATED',
    MEETING_LOCKED: 'MEETING_LOCKED',
    MEETING_UNLOCKED: 'MEETING_UNLOCKED',
    SELF_OBSERVING: 'SELF_OBSERVING',
    DISCONNECT_DUE_TO_INACTIVITY: 'DISCONNECT_DUE_TO_INACTIVITY',
    EMBEDDED_APPS_UPDATED: 'EMBEDDED_APPS_UPDATED'
  }
};

export const LOCUSEVENT = {
  LOCUS_MERCURY: 'event:locus',

  // update the tp unit status
  CONTROLS_UPDATED: 'locus.controls_updated',

  // delta events
  DIFFERENCE: 'locus.difference',

  // screen sharing
  FLOOR_GRANTED: 'locus.floor_granted',
  FLOOR_RELEASED: 'locus.floor_released',

  // Roap
  MESSAGE_ROAP: 'locus.message.roap',

  // Join events
  PARTICIPANT_JOIN: 'locus.participant_joined',
  PARTICIPANT_LEFT: 'locus.participant_left',
  PARTICIPANT_DECLINED: 'locus.participant_declined',
  PARTICIPANT_UPDATED: 'locus.participant_updated',
  PARTICIPANT_CONTROLS_UPDATED: 'locus.participant_controls_updated',
  PARTICIPANT_ROLES_UPDATED: 'locus.participant_roles_updated',
  PARTICIPANT_AUDIO_MUTED: 'locus.participant_audio_muted',
  PARTICIPANT_AUDIO_UNMUTED: 'locus.participant_audio_unmuted',
  PARTICIPANT_VIDEO_MUTED: 'locus.participant_video_muted',
  PARTICIPANT_VIDEO_UNMUTED: 'locus.participant_video_unmuted',

  RECORDING_STARTED: 'locus.recording_started',
  RECORDING_START_FAILED: 'locus.recording_start_failed',
  RECORDING_STOPPED: 'locus.recording_stopped',

  SELF_CHANGED: 'locus.self_changed'
};

export const MEDIA_TRACK_CONSTRAINT = {
  CURSOR: {
    // The mouse cursor should always be captured in the generated stream.
    AWLAYS: 'always',
    // The cursor should only be visible while moving, then removed.
    MOTION: 'motion',
    // The cursor should never be visible in the generated stream.
    NEVER: 'never'
  }
};

export const MEETING_ERRORS = {
  METRICS_NOT_SERVER_OR_CLIENT_EXCEPTION: 'METRICS_NOT_SERVER_OR_CLIENT_EXCEPTION',

  BIDIRECTIONAL_ROSTER_NOT_ALLOWED: 'BIDIRECTIONAL_ROSTER_NOT_ALLOWED',
  INVALID_LOCUS_URL: 'INVALID_LOCUS_URL',
  ARGUMENT_NULL_OR_EMPTY: 'ARGUMENT_NULL_OR_EMPTY',
  INVALID_USER: 'INVALID_USER',
  INVALID_PHONE_NUMBER_OR_COUNTRY_CODE: 'INVALID_PHONE_NUMBER_OR_COUNTRY_CODE',
  EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE: 'EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE',
  PHONE_NUMBER_INVALID_COUNTRY_CODE: 'PHONE_NUMBER_INVALID_COUNTRY_CODE',
  PHONE_NUMBER_NOT_A_NUMBER: 'PHONE_NUMBER_NOT_A_NUMBER',
  PHONE_NUMBER_TOO_SHORT_AFTER_IDD: 'PHONE_NUMBER_TOO_SHORT_AFTER_IDD',
  PHONE_NUMBER_TOO_SHORT_NSN: 'PHONE_NUMBER_TOO_SHORT_NSN',
  PHONE_NUMBER_TOO_LONG: 'PHONE_NUMBER_TOO_LONG',
  INVALID_DIALABLE_KEY: 'INVALID_DIALABLE_KEY',
  INVALID_MEETING_LINK: 'INVALID_MEETING_LINK',
  INVALID_SINCE_OR_SEQUENCE_HASH_IN_REQUEST: 'INVALID_SINCE_OR_SEQUENCE_HASH_IN_REQUEST',
  INVALID_LOCUS_ID: 'INVALID_LOCUS_ID',
  EMPTY_SCHEDULED_MEETING_START_TIME: 'EMPTY_SCHEDULED_MEETING_START_TIME',
  INVALID_SCHEDULED_MEETING_DURATION_MINUTES: 'INVALID_SCHEDULED_MEETING_DURATION_MINUTES',
  INVALID_SCHEDULED_MEETING_REMINDER_DURATION_MINUTES: 'INVALID_SCHEDULED_MEETING_REMINDER_DURATION_MINUTES',
  EMPTY_SCHEDULED_MEETING_ORGANIZER: 'EMPTY_SCHEDULED_MEETING_ORGANIZER',
  INVALID_MEETING_ID_FORMAT: 'INVALID_MEETING_ID_FORMAT',
  INVALID_SIP_URL_FORMAT: 'INVALID_SIP_URL_FORMAT',
  EMPTY_INVITEE_RECORD: 'EMPTY_INVITEE_RECORD',
  EMPTY_INVITEE_ADDRESS: 'EMPTY_INVITEE_ADDRESS',
  DESKPHONE_NOTHING_DIALABLE_FOUND: 'DESKPHONE_NOTHING_DIALABLE_FOUND',
  INVALID_INVITEE_ADDRESS: 'INVALID_INVITEE_ADDRESS',
  INVALID_ATTENDEE_ID: 'INVALID_ATTENDEE_ID',
  INVALID_IN_LOBBY: 'INVALID_IN_LOBBY',
  MISSING_REQUESTING_PARTICIPANT_ID: 'MISSING_REQUESTING_PARTICIPANT_ID',
  INVALID_REQUESTING_PARTICIPANT_ID: 'INVALID_REQUESTING_PARTICIPANT_ID',
  SUPPLEMENTARY_USER_INFO_NOT_FOUND: 'SUPPLEMENTARY_USER_INFO_NOT_FOUND',

  UNAUTHORIZED: 'UNAUTHORIZED',
  REMOVED_PARTICIPANT: 'REMOVED_PARTICIPANT',

  FREE_USER_MAX_PARTICIPANTS_EXCEEDED: 'FREE_USER_MAX_PARTICIPANTS_EXCEEDED',
  PAID_USER_MAX_PARTICIPANTS_EXCEEDED: 'PAID_USER_MAX_PARTICIPANTS_EXCEEDED',
  SERVICE_MAX_PARTICIPANTS_EXCEEDED: 'SERVICE_MAX_PARTICIPANTS_EXCEEDED',
  INACTIVE: 'INACTIVE',
  ONE_ON_ONE_TO_SELF_NOT_ALLOWED: 'ONE_ON_ONE_TO_SELF_NOT_ALLOWED',
  JOIN_RESTRICTED_USER: 'JOIN_RESTRICTED_USER',
  GET_RESTRICTED_USER: 'GET_RESTRICTED_USER',
  JOIN_RESTRICTED_USER_NOT_IN_ROOM: 'JOIN_RESTRICTED_USER_NOT_IN_ROOM',
  CREATE_MEDIA_RESTRICTED_USER: 'CREATE_MEDIA_RESTRICTED_USER',
  DUPLICATE_RESOURCE_CREATION_REQUEST: 'DUPLICATE_RESOURCE_CREATION_REQUEST',
  MEETING_NOT_FOUND: 'MEETING_NOT_FOUND',
  NOT_WEBEX_SITE: 'NOT_WEBEX_SITE',
  INVALID_SCHEDULED_MEETING_ORGANIZER: 'INVALID_SCHEDULED_MEETING_ORGANIZER',
  FREE_USER_MAX_PARTICIPANTS_JOINED_EXCEEDED: 'FREE_USER_MAX_PARTICIPANTS_JOINED_EXCEEDED',
  PAID_USER_MAX_PARTICIPANTS_JOINED_EXCEEDED: 'PAID_USER_MAX_PARTICIPANTS_JOINED_EXCEEDED',
  SERVICE_MAX_PARTICIPANTS_ROSTER_EXCEEDED: 'SERVICE_MAX_PARTICIPANTS_ROSTER_EXCEEDED',
  SERVICE_INITIAL_PARTICIPANTS_ROSTER_EXCEEDED: 'SERVICE_INITIAL_PARTICIPANTS_ROSTER_EXCEEDED',
  RESOURCE_GUEST_FORBIDDEN: 'RESOURCE_GUEST_FORBIDDEN',
  SERVICE_NO_MACHINE_OR_SERVICE_ACCOUNT: 'SERVICE_NO_MACHINE_OR_SERVICE_ACCOUNT',
  MODERATOR_ROLE_REMOVAL_NOT_ALLOWED: 'MODERATOR_ROLE_REMOVAL_NOT_ALLOWED',
  RECORDING_CONTROL_NOT_SUPPORTED: 'RECORDING_CONTROL_NOT_SUPPORTED',
  HOST_PIN_LOCKED: 'HOST_PIN_LOCKED',
  INVALID_HOST_PIN: 'INVALID_HOST_PIN',
  REQUESTING_PARTICIPANT_NOT_MODERATOR: 'REQUESTING_PARTICIPANT_NOT_MODERATOR',

  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MEETING_LINK_NOT_FOUND: 'MEETING_LINK_NOT_FOUND',
  MEETING_INFO_NOT_FOUND: 'MEETING_INFO_NOT_FOUND',
  SCHEDULED_MEETING_NOT_FOUND: 'SCHEDULED_MEETING_NOT_FOUND',

  RECORDING_NOT_STARTED: 'RECORDING_NOT_STARTED',
  RECORDING_NOT_ENABLED: 'RECORDING_NOT_ENABLED',
  RECORDING_USER_STORAGE_FULL: 'RECORDING_USER_STORAGE_FULL',
  RECORDING_SITE_STORAGE_FULL: 'RECORDING_SITE_STORAGE_FULL',

  NO_SCHEDULED_MEETING: 'NO_SCHEDULED_MEETING',
  MEETING_FULL_UPDATE_NOT_ALLOWED: 'MEETING_FULL_UPDATE_NOT_ALLOWED',
  MODERATOR_ROLE_REMOVAL_NOT_VALID: 'MODERATOR_ROLE_REMOVAL_NOT_VALID',
  MODERATOR_ROLE_ADDITION_NOT_VALID: 'MODERATOR_ROLE_ADDITION_NOT_VALID',
  INVALID_CALL_START_TIME: 'INVALID_CALL_START_TIME',
  MEETING_STARTED_UPDATE_NOT_ALLOWED: 'MEETING_STARTED_UPDATE_NOT_ALLOWED',

  EXCEEDED_MAX_JOINED_PARTICIPANTS: 'EXCEEDED_MAX_JOINED_PARTICIPANTS',
  EXCEEDED_SERVICE_MAX_PARTICIPANTS: 'EXCEEDED_SERVICE_MAX_PARTICIPANTS',
  MEETING_IS_LOCKED: 'MEETING_IS_LOCKED',
  MEETING_IS_TERMINATING: 'MEETING_IS_TERMINATING',
  MEETING_REQUIRE_MODERATOR_PIN_INTENT: 'MEETING_REQUIRE_MODERATOR_PIN_INTENT',
  MEETING_REQUIRE_MODERATOR_PIN: 'MEETING_REQUIRE_MODERATOR_PIN',
  MEETING_REQUIRE_MODERATOR_ROLE: 'MEETING_REQUIRE_MODERATOR_ROLE',
  PMR_ACCOUNT_SUSPENDED: 'PMR_ACCOUNT_SUSPENDED',
  PMR_ACCOUNT_LOCKED: 'PMR_ACCOUNT_LOCKED',
  INVALID_JOIN_TIME: 'INVALID_JOIN_TIME',
  REQUIRES_WEBEX_LOGIN: 'REQUIRES_WEBEX_LOGIN',

  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  UNABLE_TO_LOOK_UP_DEVICE_INFORMATION: 'UNABLE_TO_LOOK_UP_DEVICE_INFORMATION',
  UNABLE_TO_LOOK_UP_CONVERSATION: 'UNABLE_TO_LOOK_UP_CONVERSATION',
  UNABLE_TO_LOOK_UP_CI_USER: 'UNABLE_TO_LOOK_UP_CI_USER',
  UNABLE_TO_CREATE_CONFLUENCE: 'UNABLE_TO_CREATE_CONFLUENCE',

  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  SOCKET_TIMEOUT: 'SOCKET_TIMEOUT',
  NO_HTTP_RESPONSE: 'NO_HTTP_RESPONSE'
};


export const MEETING_END_REASON = {
  INACTIVE: 'INACTIVE',
  MEDIA_RELEASED: 'MEDIA_RELEASED'
};

export const DISPLAY_HINTS = {
  ADD_GUEST: 'ADD_GUEST',
  ROSTER_WAITING_TO_JOIN: 'ROSTER_WAITING_TO_JOIN',
  RECORDING_CONTROL_START: 'RECORDING_CONTROL_START',
  RECORDING_CONTROL_PAUSE: 'RECORDING_CONTROL_PAUSE',
  RECORDING_CONTROL_STOP: 'RECORDING_CONTROL_STOP',
  RECORDING_CONTROL_RESUME: 'RECORDING_CONTROL_RESUME',
  LOCK_CONTROL_UNLOCK: 'LOCK_CONTROL_UNLOCK',
  LOCK_CONTROL_LOCK: 'LOCK_CONTROL_LOCK',
  LOCK_STATUS_LOCKED: 'LOCK_STATUS_LOCKED',
  LOCK_STATUS_UNLOCKED: 'LOCK_STATUS_UNLOCKED',
  RAISE_HAND: 'RAISE_HAND',
  LOWER_ALL_HANDS: 'LOWER_ALL_HANDS',
  LOWER_SOMEONE_ELSES_HAND: 'LOWER_SOMEONE_ELSES_HAND',
  CAPTION_START: 'CAPTION_START',
  CAPTION_STATUS_ACTIVE: 'CAPTION_STATUS_ACTIVE',
  DISPLAY_REAL_TIME_TRANSLATION: 'DISPLAY_REAL_TIME_TRANSLATION',
  ENABLE_CAPTION_PANEL: 'ENABLE_CAPTION_PANEL',
  DISPLAY_NON_ENGLISH_ASR: 'DISPLAY_NON_ENGLISH_ASR',
  TRANSCRIPTION_CONTROL_START: 'TRANSCRIPTION_CONTROL_START',
  TRANSCRIPTION_CONTROL_STOP: 'TRANSCRIPTION_CONTROL_STOP',
  WEBEX_ASSISTANT_STATUS_ACTIVE: 'WEBEX_ASSISTANT_STATUS_ACTIVE',
  WAITING_FOR_OTHERS: 'WAITING_FOR_OTHERS',
};

export const SELF_ROLES = {
  COHOST: 'COHOST',
  MODERATOR: 'MODERATOR'
};

export const MEETING_STATE = {
  STATES: {
    IDLE: 'IDLE',
    INCOMING: 'INCOMING',
    DIALING: 'DIALING',
    NOTIFIED: 'NOTIFIED',
    DECLINED: 'DECLINED',
    ON_GOING: 'ON_GOING',
    JOINED: 'JOINED',
    TERMINATING: 'TERMINATING',
    LEFT: 'LEFT',
    ENDED: 'ENDED',
    ERROR: 'ERROR'
  }
};

export const MEETING_STATE_MACHINE = {
  TRANSITIONS: {
    FAIL: 'fail',
    RING: 'ring',
    REMOTE: 'remote',
    JOIN: 'join',
    DECLINE: 'decline',
    LEAVE: 'leave',
    END: 'end',
    RESET: 'reset'
  },
  STATES: {
    ERROR: 'ERROR',
    IDLE: 'IDLE',
    ENDED: 'ENDED',
    DECLINED: 'DECLINED',
    RINGING: 'RINGING',
    JOINED: 'JOINED',
    ANSWERED: 'ANSWERED'
  }
};

export const MEETING_AUDIO_STATE_MACHINE = {
  TRANSITIONS: {
    TOGGLE: 'toggle',
    INIT: 'init'
  },
  STATES: {
    MUTE_SELF: 'SELF_AUDIO_OFF',
    UNMUTE_SELF: 'SELF_AUDIO_ON'
  }
};

export const MEETING_VIDEO_STATE_MACHINE = {
  TRANSITIONS: {
    TOGGLE: 'toggle',
    INIT: 'init'
  },
  STATES: {
    MUTE_SELF: 'SELF_VIDEO_OFF',
    UNMUTE_SELF: 'SELF_VIDEO_ON'
  }
};

export const PEER_CONNECTION_STATE = {
  CLOSED: 'closed',
  FAILED: 'failed'
};

export const RECONNECTION = {
  STATE: {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETE: 'COMPLETE',
    FAILURE: 'FAILURE',
    DEFAULT_TRY_COUNT: 0,
    DEFAULT_STATUS: ''
  }
};

export const RESOURCE = {
  CLUSTERS: 'clusters',
  REACHABILITY: 'reachability',
  LOCI: 'loci'
};

export const REACHABILITY = {
  localStorage: 'reachability.result'
};

export const ROAP = {
  ROAP_TRANSITIONS: {
    STEP: 'step'
  },
  ROAP_TYPES: {
    OFFER: 'OFFER',
    ANSWER: 'ANSWER',
    OK: 'OK',
    ERROR: 'ERROR',
    SHUTDOWN: 'SHUTDOWN',
    OFFER_REQUEST: 'OFFER_REQUEST',
    TURN_DISCOVERY_REQUEST: 'TURN_DISCOVERY_REQUEST',
    TURN_DISCOVERY_RESPONSE: 'TURN_DISCOVERY_RESPONSE',
  },
  ROAP_STATE: {
    INIT: 'INIT',
    WAIT_RX_OFFER: 'WAIT_RX_OFFER',
    WAIT_RX_ANSWER: 'WAIT_RX_ANSWER',
    WAIT_RX_OK: 'WAIT_RX_OK',
    WAIT_TX_OFFER: 'WAIT_TX_OFFER',
    WAIT_TX_ANSWER: 'WAIT_TX_ANSWER',
    WAIT_TX_OK: 'WAIT_TX_OK',
    IDLE_LOCAL_OFFER: 'IDLE_LOCAL_OFFER',
    IDLE_REMOTE_OFFER: 'IDLE_REMOTE_OFFER',
    GLARE: 'GLARE',
    ERROR: 'ERROR'
  },
  ROAP_SIGNAL: {
    RX_OFFER: 'RX_OFFER',
    TX_OFFER: 'TX_OFFER',
    RX_ANSWER: 'RX_ANSWER',
    TX_ANSWER: 'TX_ANSWER',
    RX_OK: 'RX_OK',
    TX_OK: 'TX_OK',
    GLARE_RESOLVED: 'GLARE_RESOLVED'
  },
  RECEIVE_ROAP_MSG: 'RECEIVE_ROAP_MSG',
  SEND_ROAP_MSG: 'SEND_ROAP_MSG',
  SEND_ROAP_MSG_SUCCESS: 'SEND_ROAP_MSG_SUCCESS',
  RESET_ROAP_STATE: 'RESET_ROAP_STATE',
  RECEIVE_CALL_LEAVE: 'RECEIVE_CALL_LEAVE',
  ROAP_MERCURY: 'event:locus.message.roap',
  ROAP_VERSION: '2',
  RX_: 'RX_',
  TX_: 'TX_'
};

export const MediaContent = {
  main: 'main',
  slides: 'slides'
};

export const SDP = {
  A_CONTENT_SLIDES: 'a=content:slides',
  ROLLBACK: 'rollback',
  HAVE_LOCAL_OFFER: 'have-local-offer',
  HAVE_REMOTE_OFFER: 'have-remote-offer',
  STABLE: 'stable',
  OFFER: 'offer',
  M_LINE: 'm=',
  MAX_FS: 'max-fs=',
  B_LINE: 'b=TIAS',
  // Edonus repeated key frames request
  PERIODIC_KEYFRAME: 'a=periodic-keyframes:20',
  CARRIAGE_RETURN: '\r\n',
  BAD_MEDIA_PORTS: [0]
};

export const NETWORK_STATUS = {
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  CONNECTED: 'CONNECTED'
};

export const NETWORK_TYPE = {
  VPN: 'vpn',
  UNKNOWN: 'unknown',
  WIFI: 'wifi',
  ETHERNET: 'ethernet'
};

export const STATS = {
  AUDIO_CORRELATE: 'audio',
  VIDEO_CORRELATE: 'video',
  SHARE_CORRELATE: 'share',
  SEND_DIRECTION: 'send',
  RECEIVE_DIRECTION: 'recv',
  REMOTE: 'remote',
  LOCAL: 'local',
};

export const MQA_STATS = {
  MQA_SIZE: 120, // MQA is done on 60 second intervals by server def, add a buffer for missed events
  CA_TYPE: 'MQA',
  DEFAULT_IP: '0.0.0.0',
  DEFAULT_SHARE_SENDER_STATS: {
    common: {
      common: {
        direction: 'sendrecv', // TODO: parse from SDP and save globally
        isMain: false, // always true for share sender
        mariFecEnabled: false, // unavailable
        mariQosEnabled: false, // unavailable
        multistreamEnabled: false // unavailable
      },
      availableBitrate: 0,
      dtlsBitrate: 0, // unavailable
      dtlsPackets: 0, // unavailable
      fecBitrate: 0, // unavailable
      fecPackets: 0, // unavailable
      maxBitrate: 0, // unavailable
      queueDelay: 0, // unavailable
      remoteJitter: 0, // unavailable
      remoteLossRate: 0,
      remoteReceiveRate: 0, // unavailable
      roundTripTime: 0,
      rtcpBitrate: 0, // unavailable
      rtcpPackets: 0, // unavailable
      rtpBitrate: 0, // unavailable
      rtpPackets: 0,
      stunBitrate: 0, // unavailable
      stunPackets: 0, // unavailable
      transportType: 'UDP' // TODO: parse the transport type from the SDP and save globally
    },
    streams: [
      {
        common: {
          codec: 'H264', // TODO: parse the codec from the SDP and save globally
          duplicateSsci: 0, // unavailable
          requestedBitrate: 0, // unavailable
          requestedFrames: 0, // unavailable
          rtpPackets: 0,
          ssci: 0, // unavailable
          transmittedBitrate: 0,
          transmittedFrameRate: 0
        },
        h264CodecProfile: 'BP', // TODO: parse the profile level from h264 in the SDP and save globally
        localConfigurationChanges: 0, // unavailable
        remoteConfigurationChanges: 0, // unavailable
        requestedFrameSize: 0, // unavailable
        requestedKeyFrames: 0, // unavailable
        transmittedFrameSize: 0, // unavailable
        transmittedHeight: 0,
        transmittedKeyFrames: 0,
        transmittedWidth: 0
      }
    ]
  },
  intervalMetadata: {
    memoryUsage: {
      cpuBitWidth: 0,
      mainProcessMaximumMemoryBytes: 0,
      osBitWidth: 0,
      processAverageMemoryUsage: 0,
      processMaximumMemoryBytes: 0,
      processMaximumMemoryUsage: 0,
      systemAverageMemoryUsage: 0,
      systemMaximumMemoryUsage: 0
    },
    peerReflexiveIP: 'NULL', // TODO: save after ice trickling completes and use as a global variable
    processAverageCPU: 0,
    processMaximumCPU: 0,
    systemAverageCPU: 0,
    systemMaximumCPU: 0
  }
};

// ****** MEDIA QUALITY CONSTANTS ****** //

export const QUALITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

export const VIDEO_RESOLUTIONS = {
  [QUALITY_LEVELS.LOW]: {
    video: {
      width: {
        max: 320,
        ideal: 320
      },
      height: {
        max: 180,
        ideal: 180
      }
    }
  },

  [QUALITY_LEVELS.MEDIUM]: {
    video: {
      width: {
        max: 640,
        ideal: 640
      },
      height: {
        max: 360,
        ideal: 360
      }
    }
  },

  [QUALITY_LEVELS.HIGH]: {
    video: {
      width: {
        max: 1280,
        ideal: 1280
      },
      height: {
        max: 720,
        ideal: 720
      }
    }
  }
};

/**
 * Max frame sizes based on h264 configs
 * https://en.wikipedia.org/wiki/Advanced_Video_Coding
 */
export const MAX_FRAMESIZES = {
  [QUALITY_LEVELS.LOW]: 1620,
  [QUALITY_LEVELS.MEDIUM]: 3600,
  [QUALITY_LEVELS.HIGH]: 8192
};


/*
*  mqa Interval for sending stats metrics
*/

export const MQA_INTEVAL = 60000; // mqa analyzer interval its fixed to 60000


export const MEDIA_DEVICES = {
  MICROPHONE: 'microphone',
  SPEAKER: 'speaker',
  CAMERA: 'camera'
};

export const METRICS_JOIN_TIMES_MAX_DURATION = 1200000;

export const PSTN_STATUS = {
  JOINED: 'JOINED', // we have provisioned a pstn device, which can be used to connect
  CONNECTED: 'CONNECTED', // user is connected to audio with pstn device
  LEFT: 'LEFT', // user has disconnected from the pstn device
  TRANSFERRING: 'TRANSFERRING', // usually happens in dial-out after the CONNECTED state
  SUCCESS: 'SUCCESS', // happens after the transfer (TRANSFERRING) is successful
  UNKNOWN: '' // placeholder if we haven't been told what the status is
};

export const PASSWORD_STATUS = {
  NOT_REQUIRED: 'NOT_REQUIRED', // password is not required to join the meeting
  REQUIRED: 'REQUIRED', // client needs to provide the password by calling verifyPassword() before calling join()
  UNKNOWN: 'UNKNOWN', // we are waiting for information from the backend if password is required or not
  VERIFIED: 'VERIFIED' // client has already provided the password and it has been verified, client can proceed to call join()
};

export const MEETING_INFO_FAILURE_REASON = {
  NONE: 'NONE', // meeting info was retrieved succesfully
  WRONG_PASSWORD: 'WRONG_PASSWORD', // meeting requires password and no password or wrong one was provided
  WRONG_CAPTCHA: 'WRONG_CAPTCHA', // wbxappapi requires a captcha code or a wrong captcha code was provided
  OTHER: 'OTHER' // any other error (network, etc)
};

export const BNR_STATUS = {
  SHOULD_ENABLE: 'SHOULD_ENABLE',
  ENABLED: 'ENABLED',
  SHOULD_DISABLE: 'SHOULD_DISABLE',
  NOT_ENABLED: 'NOT_ENABLED'
};

export const EMBEDDED_APP_TYPES = {
  SLIDO: 'SLIDO',
  OTHER: 'OTHER'
};
