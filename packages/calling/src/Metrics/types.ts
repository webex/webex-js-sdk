import {LineError} from '../Errors/catalog/LineError';
import {CallError, CallingClientError} from '../Errors';
import {CallId, CorrelationId, IDeviceInfo, MobiusServers} from '../common/types';

export enum METRIC_TYPE {
  OPERATIONAL = 'operational',
  BEHAVIORAL = 'behavioral',
}

export enum METRIC_EVENT {
  BNR_ENABLED = 'web-calling-sdk-bnr-enabled',
  BNR_DISABLED = 'web-calling-sdk-bnr-disabled',
  CALL = 'web-calling-sdk-callcontrol',
  CALL_ERROR = 'web-calling-sdk-callcontrol-error',
  CONNECTION_ERROR = 'web-calling-sdk-connection',
  MEDIA = 'web-calling-sdk-media',
  MEDIA_ERROR = 'web-calling-sdk-media-error',
  REGISTRATION = 'web-calling-sdk-registration',
  REGISTRATION_ERROR = 'web-calling-sdk-registration-error',
  KEEPALIVE_ERROR = 'web-calling-sdk-keepalive-error',
  VOICEMAIL = 'web-calling-sdk-voicemail',
  VOICEMAIL_ERROR = 'web-calling-sdk-voicemail-error',
  UPLOAD_LOGS_SUCCESS = 'web-calling-sdk-upload-logs-success',
  UPLOAD_LOGS_FAILED = 'web-calling-sdk-upload-logs-failed',
  MOBIUS_DISCOVERY = 'web-calling-sdk-mobius-discovery',
  MOBIUS_SOCKET = 'web-calling-sdk-mobius-socket',
  MOBIUS_SOCKET_ERROR = 'web-calling-sdk-mobius-socket-error',
}

export enum MOBIUS_SERVER_ACTION {
  REGION_INFO = 'region-info',
  MOBIUS_SERVERS = 'mobius-servers',
}

export enum REG_ACTION {
  REGISTER = 'register',
  DEREGISTER = 'deregister',
  KEEPALIVE_FAILURE = 'keepaliveFailure',
}

export enum MOBIUS_SOCKET_ACTION {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  LISTENER_REGISTERED = 'listener_registered',
  LISTENER_UNREGISTERED = 'listener_unregistered',
  REGISTRATION_DOWN = 'registration_down',
}

export enum TRANSFER_ACTION {
  BLIND = 'TRANSFER_BLIND',
  CONSULT = 'TRANSFER_CONSULT',
}

export enum VOICEMAIL_ACTION {
  GET_VOICEMAILS = 'get_voicemails',
  GET_VOICEMAIL_CONTENT = 'get_voicemail_content',
  GET_VOICEMAIL_SUMMARY = 'get_voicemail_summary',
  MARK_READ = 'mark_read',
  MARK_UNREAD = 'mark_unread',
  DELETE = 'delete',
  TRANSCRIPT = 'transcript',
}

export type SERVER_TYPE = 'PRIMARY' | 'BACKUP' | 'UNKNOWN';

export const UPLOAD_LOGS_ACTION = 'upload_logs';

export enum CONNECTION_ACTION {
  NETWORK_FLAP = 'network_flap',
  MERCURY_DOWN = 'mercury_down',
  MERCURY_UP = 'mercury_up',
}

export enum MEDIA_CONNECTION_ACTION {
  ICE_GATHERING_STATE_CHANGED = 'ICE_GATHERING_STATE_CHANGED',
  PEER_CONNECTION_STATE_CHANGED = 'PEER_CONNECTION_STATE_CHANGED',
  ICE_CONNECTION_STATE_CHANGED = 'ICE_CONNECTION_STATE_CHANGED',
  ICE_CANDIDATE_ERROR = 'ICE_CANDIDATE_ERROR',
  ROAP_FAILURE = 'ROAP_FAILURE',
}

export interface IMetricManager {
  setDeviceInfo: (deviceInfo: IDeviceInfo) => void;

  submitRegistrationMetric: (
    name: METRIC_EVENT,
    metricAction: REG_ACTION,
    type: METRIC_TYPE,
    caller: string,
    serverType: SERVER_TYPE,
    trackingId: string,
    keepaliveCount?: number,
    error?: LineError | CallingClientError
  ) => void;

  submitBNRMetric: (
    name: METRIC_EVENT,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId
  ) => void;

  submitCallMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId,
    callError?: CallError
  ) => void;

  submitMediaMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId,
    localSdp?: string,
    remoteSdp?: string,
    state?: string,
    callError?: CallError
  ) => void;

  submitConnectionMetrics: (
    name: METRIC_EVENT,
    metricAction: CONNECTION_ACTION,
    type: METRIC_TYPE,
    downTimestamp: string,
    upTimestamp: string
  ) => void;

  submitVoicemailMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    messageId?: string,
    voicemailError?: string,
    statusCode?: number
  ) => void;

  submitUploadLogsMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    trackingId?: string,
    feedbackId?: string,
    correlationId?: string,
    stack?: string,
    callId?: string,
    broadworksCorrelationInfo?: string
  ) => void;

  submitRegionInfoMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    mobiusHost: string,
    clientRegion: string,
    countryCode: string,
    trackingId: string
  ) => void;

  submitMobiusServersMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    mobiusServers: MobiusServers,
    trackingId: string
  ) => void;

  submitMobiusSocketMetric: (
    name: METRIC_EVENT,
    metricAction: MOBIUS_SOCKET_ACTION,
    type: METRIC_TYPE,
    wssUrl?: string,
    trackingId?: string,
    error?: string,
    eventType?: string
  ) => void;
}
