/* eslint-disable @typescript-eslint/no-unused-vars */ // TODO: remove once we define the payloads
import type {ICall} from '../CallingClient/calling/types';
import {CallDetails, CallId, DisplayInformation, IDeviceInfo} from '../common/types';
import {CallError, CallingClientError} from '../Errors';

/** External Eventing Start */
export enum EVENT_KEYS {
  READY = 'calling:ready',
  ALERTING = 'call:alerting',
  CALL_ERROR = 'call:error',
  CALLER_ID = 'call:caller_id',
  CONNECT = 'call:connect',
  CONNECTING = 'callingClient: connecting',
  DISCONNECT = 'call:disconnect',
  ERROR = 'callingClient:error',
  ESTABLISHED = 'call:established',
  HELD = 'call:held',
  HOLD_ERROR = 'call:hold_error',
  INCOMING_CALL = 'callingClient:incoming_call',
  OUTGOING_CALL = 'callingClient:outgoing_call',
  PROGRESS = 'call:progress',
  RECONNECTED = 'callingClient:reconnected',
  RECONNECTING = 'callingClient:reconnecting',
  REGISTERED = 'callingClient:registered',
  REMOTE_MEDIA = 'call:remote_media',
  RESUME_ERROR = 'call:resume_error',
  RESUMED = 'call:resumed',
  TRANSFER_ERROR = 'call:transfer_error',
  UNREGISTERED = 'callingClient:unregistered',
  USER_SESSION_INFO = 'callingClient:user_recent_sessions',
  CB_VOICEMESSAGE_CONTENT_GET = 'call_back_voicemail_content_get',
  CALL_HISTORY_USER_SESSION_INFO = 'callHistory:user_recent_sessions',
  ALL_CALLS_CLEARED = 'callingClient:all_calls_cleared',
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
  phoneNumber: string;
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
  phoneNumber: string;
  contact?: string;
  email?: string;
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
}

export type CallSessionData = {
  userSessions: {
    userSessions: UserSession[];
    statusCode: number;
  };
  eventType: MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE;
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

export type CallingEventTypes = {
  [EVENT_KEYS.READY]: () => void;
};

export type CallEventTypes = {
  [EVENT_KEYS.ALERTING]: (callId: CallId) => void;
  [EVENT_KEYS.CALL_ERROR]: (error: CallError) => void;
  [EVENT_KEYS.CALLER_ID]: (display: CallerIdDisplay) => void;
  [EVENT_KEYS.CONNECT]: (callId: CallId) => void;
  [EVENT_KEYS.DISCONNECT]: (callId: CallId) => void;
  [EVENT_KEYS.ESTABLISHED]: (callId: CallId) => void;
  [EVENT_KEYS.HELD]: (callId: CallId) => void;
  [EVENT_KEYS.HOLD_ERROR]: (error: CallError) => void;
  [EVENT_KEYS.INCOMING_CALL]: (callObj: ICall) => void;
  [EVENT_KEYS.PROGRESS]: (callId: CallId) => void;
  [EVENT_KEYS.REMOTE_MEDIA]: (track: MediaStreamTrack) => void;
  [EVENT_KEYS.RESUME_ERROR]: (error: CallError) => void;
  [EVENT_KEYS.RESUMED]: (callId: CallId) => void;
  [EVENT_KEYS.TRANSFER_ERROR]: (error: CallError) => void;
  [EVENT_KEYS.ALL_CALLS_CLEARED]: () => void;
};

export type MessageId = {
  messageId: string;
};

export type VoicemailEventTypes = {
  [EVENT_KEYS.CB_VOICEMESSAGE_CONTENT_GET]: (messageId: MessageId) => void;
};

export type CallingClientEventTypes = {
  [EVENT_KEYS.CONNECTING]: () => void;
  [EVENT_KEYS.ERROR]: (error: CallingClientError) => void;
  [EVENT_KEYS.USER_SESSION_INFO]: (event: CallSessionEvent) => void;
  [EVENT_KEYS.REGISTERED]: (deviceInfo: IDeviceInfo) => void;
  [EVENT_KEYS.UNREGISTERED]: () => void;
  [EVENT_KEYS.INCOMING_CALL]: (callObj: ICall) => void;
  [EVENT_KEYS.OUTGOING_CALL]: (callId: string) => void;
  [EVENT_KEYS.RECONNECTED]: () => void;
  [EVENT_KEYS.RECONNECTING]: () => void;
  [EVENT_KEYS.ALL_CALLS_CLEARED]: () => void;
};

export type CallHistoryEventTypes = {
  [EVENT_KEYS.CALL_HISTORY_USER_SESSION_INFO]: (event: CallSessionEvent) => void;
};
/* External Eventing End */

/** Internal Eventing Start */
// https://sqbu-github.cisco.com/pages/webrtc-calling/mobius/mobius-api-spec/docs/async.html#operation-publish-calls

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
