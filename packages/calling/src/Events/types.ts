/* eslint-disable @typescript-eslint/no-unused-vars */ // TODO: remove once we define the payloads
import {ILine} from '../api';
import {LINE_EVENTS} from '../CallingClient/line/types';
import type {ICall} from '../CallingClient/calling/types';
import {CallId, DisplayInformation} from '../common/types';
import {CallError, CallingClientError, LineError} from '../Errors';

/** External Eventing Start */
export enum COMMON_EVENT_KEYS {
  CB_VOICEMESSAGE_CONTENT_GET = 'call_back_voicemail_content_get',
  CALL_HISTORY_USER_SESSION_INFO = 'callHistory:user_recent_sessions',
  CALL_HISTORY_USER_VIEWED_SESSIONS = 'callHistory:user_viewed_sessions',
}

export enum LINE_EVENT_KEYS {
  INCOMING_CALL = 'incoming_call',
}

export enum CALLING_CLIENT_EVENT_KEYS {
  ERROR = 'callingClient:error',
  OUTGOING_CALL = 'callingClient:outgoing_call',
  USER_SESSION_INFO = 'callingClient:user_recent_sessions',
  ALL_CALLS_CLEARED = 'callingClient:all_calls_cleared',
}

export enum CALL_EVENT_KEYS {
  ALERTING = 'alerting',
  CALL_ERROR = 'call_error',
  CALLER_ID = 'caller_id',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ESTABLISHED = 'established',
  HELD = 'held',
  HOLD_ERROR = 'hold_error',
  PROGRESS = 'progress',
  REMOTE_MEDIA = 'remote_media',
  RESUME_ERROR = 'resume_error',
  RESUMED = 'resumed',
  TRANSFER_ERROR = 'transfer_error',
}

export enum SUPPLEMENTARY_SERVICES {
  HOLD = 'hold',
  RESUME = 'resume',
  DIVERT = 'divert',
  TRANSFER = 'transfer',
  PARK = 'park',
}

export enum MOBIUS_MIDCALL_STATE {
  HELD = 'HELD',
  CONNECTED = 'CONNECTED',
}

export enum Disposition {
  ANSWERED = 'Answered',
  CANCELED = 'Canceled',
  INITIATED = 'Initiated',
  MISSED = 'MISSED',
}

export type CallRecordLink = {
  locusUrl?: string;
  conversationUrl?: string;
  callbackAddress: string;
};

export type CallBackInfo = {
  callbackAddress: string;
  callbackType: string;
};

export type LookUpInfo = {
  lookupLink: string;
  type: string;
};

export type CallRecordSelf = {
  id: string;
  name?: string;
  phoneNumber?: string;
  cucmDN?: string;
  ucmLineNumber?: number;
};

export type CallRecordListOther = {
  ownerId?: string;
  id: string;
  name?: string;
  sipUrl?: string;
  primaryDisplayString?: string;
  secondaryDisplayString?: string;
  isPrivate: boolean;
  callbackAddress: string;
  phoneNumber?: string;
  contact?: string;
  email?: string;
};

export type RedirectionDetails = {
  phoneNumber?: string;
  sipUrl?: string;
  name?: string;
  reason: string;
  userId?: string;
  isPrivate: boolean;
};

export enum SessionType {
  SPARK = 'SPARK',
  WEBEX_CALLING = 'WEBEXCALLING',
}

export type UserSession = {
  id: string;
  sessionId: string;
  disposition: Disposition;
  startTime: string;
  endTime: string;
  url: string;
  durationSeconds: number;
  joinedDurationSeconds: number;
  participantCount: number;
  isDeleted: boolean;
  isPMR: boolean;
  correlationIds: string[];
  links: CallRecordLink;
  self: CallRecordSelf;
  durationSecs: number;
  other: CallRecordListOther;
  sessionType: SessionType;
  direction: string;
  callingSpecifics?: {
    redirectionDetails: RedirectionDetails;
  };
};

export type CallingParty = {
  name?: string;
  number?: string;
  privacyEnabled?: boolean;
  userId?: string;
  address?: string;
};

export type Item = {
  id?: string;
  duration?: number;
  callingParty?: CallingParty;
  urgent?: boolean;
  confidential?: boolean;
  read?: boolean;
  created?: string;
  messageId?: string;
  time?: number;
};

export enum MOBIUS_EVENT_KEYS {
  SERVER_EVENT_INCLUSIVE = 'event:mobius',
  CALL_SESSION_EVENT_INCLUSIVE = 'event:janus.user_recent_sessions',
  CALL_SESSION_EVENT_LEGACY = 'event:janus.user_sessions',
  CALL_SESSION_EVENT_VIEWED = 'event:janus.user_viewed_sessions',
}

export type CallSessionData = {
  userSessions: {
    userSessions: UserSession[];
    statusCode: number;
  };
  eventType:
    | MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE
    | MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_LEGACY;
};

export type CallSessionEvent = {
  id: string;
  data: CallSessionData;
  timestamp: number;
  trackingId: string;
};

export enum MEDIA_CONNECTION_EVENT_KEYS {
  ROAP_MESSAGE_TO_SEND = 'roap:messageToSend',
  MEDIA_TYPE_AUDIO = 'audio',
}

export type CallerIdDisplay = {
  correlationId: string;
  callerId: DisplayInformation;
};

export type LineEventTypes = {
  [LINE_EVENTS.CONNECTING]: () => void;
  [LINE_EVENTS.ERROR]: (error: LineError) => void;
  [LINE_EVENTS.RECONNECTED]: () => void;
  [LINE_EVENTS.RECONNECTING]: () => void;
  [LINE_EVENTS.REGISTERED]: (lineInfo: ILine) => void;
  [LINE_EVENTS.UNREGISTERED]: () => void;
  [LINE_EVENTS.INCOMING_CALL]: (callObj: ICall) => void;
};

export type CallEventTypes = {
  [CALL_EVENT_KEYS.ALERTING]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.CALL_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.CALLER_ID]: (display: CallerIdDisplay) => void;
  [CALL_EVENT_KEYS.CONNECT]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.DISCONNECT]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.ESTABLISHED]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.HELD]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.HOLD_ERROR]: (error: CallError) => void;
  [LINE_EVENT_KEYS.INCOMING_CALL]: (callObj: ICall) => void;
  [CALL_EVENT_KEYS.PROGRESS]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.REMOTE_MEDIA]: (track: MediaStreamTrack) => void;
  [CALL_EVENT_KEYS.RESUME_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.RESUMED]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.TRANSFER_ERROR]: (error: CallError) => void;
  [CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED]: () => void;
};

export type MessageId = {
  messageId: string;
};

export type VoicemailEventTypes = {
  [COMMON_EVENT_KEYS.CB_VOICEMESSAGE_CONTENT_GET]: (messageId: MessageId) => void;
};

export type CallingClientEventTypes = {
  [CALLING_CLIENT_EVENT_KEYS.ERROR]: (error: CallingClientError) => void;
  [CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO]: (event: CallSessionEvent) => void;
  [CALLING_CLIENT_EVENT_KEYS.OUTGOING_CALL]: (callId: string) => void;
  [CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED]: () => void;
};

export type CallHistoryEventTypes = {
  [COMMON_EVENT_KEYS.CALL_HISTORY_USER_SESSION_INFO]: (event: CallSessionEvent) => void;
  [COMMON_EVENT_KEYS.CALL_HISTORY_USER_VIEWED_SESSIONS]: (event: CallSessionViewedEvent) => void;
};
/* External Eventing End */

/** Internal Eventing Start */
enum CALL_STATE {
  HELD = 'held',
  REMOTE_HELD = 'remoteheld',
  CONNECTED = 'connected',
}

type eventType = string;

type callProgressData = {
  alerting: boolean;
  inbandROAP: boolean;
};

export type CallerIdInfo = {
  'x-broadworks-remote-party-info'?: string;
  'p-asserted-identity'?: string;
  from?: string;
};

type callId = string;
type deviceId = string;
type correlationId = string;
type callUrl = string;
type causecode = number;
type cause = string;

type eventData = {
  callerId: CallerIdInfo;
  callState: CALL_STATE;
};

type midCallServiceData = {
  eventType: eventType;
  eventData: eventData;
};

type midCallService = Array<midCallServiceData>;
interface BaseMessage {
  eventType: eventType;
  correlationId: correlationId;
  deviceId: deviceId;
  callId: callId;
  callUrl: callUrl;
}
export interface CallSetupMessage extends BaseMessage {
  callerId: CallerIdInfo;
  trackingId: string;
  alertType: string;
}
interface CallProgressMessage extends BaseMessage {
  callProgressData: callProgressData;
  callerId: CallerIdInfo;
}

export const WEBSOCKET_SCOPE = 'mobius';

export enum WEBSOCKET_KEYS {
  CALL_PROGRESS = 'callprogress',
  CALL_CONNECTED = 'callconnected',
  CALL_DISCONNECTED = 'callconnected',
  CALL_INFO = 'callinfo',
  CALL = 'call',
  ROAP = 'ROAP',
}
/** Internal Eventing End */

/** State Machine Events */

export type CallEvent =
  /* Received Events */
  | {type: 'E_RECV_CALL_SETUP'; data?: unknown}
  | {type: 'E_RECV_CALL_PROGRESS'; data?: unknown}
  | {type: 'E_RECV_CALL_CONNECT'; data?: unknown}
  | {type: 'E_RECV_CALL_DISCONNECT'; data?: unknown}

  /* Sent Events */
  | {type: 'E_SEND_CALL_SETUP'; data?: unknown}
  | {type: 'E_SEND_CALL_ALERTING'; data?: unknown}
  | {type: 'E_SEND_CALL_CONNECT'; data?: unknown}
  | {type: 'E_SEND_CALL_DISCONNECT'; data?: unknown}

  /* Common Events */
  | {type: 'E_CALL_ESTABLISHED'; data?: unknown}
  | {type: 'E_CALL_INFO'; data?: unknown}
  | {type: 'E_UNKNOWN'; data?: unknown}
  | {type: 'E_CALL_CLEARED'; data?: unknown}
  | {type: 'E_CALL_HOLD'; data?: unknown}
  | {type: 'E_CALL_RESUME'; data?: unknown};

/* ROAP Events */
export type RoapEvent =
  | {type: 'E_SEND_ROAP_OFFER'; data?: unknown}
  | {type: 'E_SEND_ROAP_ANSWER'; data?: unknown}
  | {type: 'E_RECV_ROAP_OFFER'; data?: unknown}
  | {type: 'E_RECV_ROAP_ANSWER'; data?: unknown}
  | {type: 'E_ROAP_ERROR'; data?: unknown}
  | {type: 'E_ROAP_OK'; data?: unknown}
  | {type: 'E_RECV_ROAP_OFFER_REQUEST'; data?: unknown} // ROAP request to explicitly ask Client to do OFFER
  | {type: 'E_ROAP_TEARDOWN'; data?: unknown};

// TODO: export RoapMessage type from the media SDK to use here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RoapMessage {
  seq: number;
  messageType: 'OFFER' | 'ANSWER' | 'OK' | 'ERROR' | 'OFFER_REQUEST';
  offererSessionId?: string;
  answererSessionId?: string;
  sdp?: string;
  version?: string;
  tieBreaker?: string;
  errorType?: string;
}

export type UserReadSessions = {
  sessionId: string;
};

export type CallSessionViewedData = {
  userReadSessions: {
    userReadSessions: UserReadSessions[];
    statusCode: number;
  };
  eventType: MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_VIEWED;
};

export type CallSessionViewedEvent = {
  id: string;
  data: CallSessionViewedData;
  timestamp: number;
  trackingId: string;
};

export type EndTimeSessionId = {
  endTime: string;
  sessionId: string;
};

export type SanitizedEndTimeAndSessionId = {
  endTime: number;
  sessionId: string;
};

export type UCMLine = {
  dnorpattern: string;
  index: number;
  label: string | null;
};

export type UCMDevice = {
  name: string;
  model: number;
  lines: UCMLine[];
};

export type UCMLinesApiResponse = {
  devices: UCMDevice[];
};
