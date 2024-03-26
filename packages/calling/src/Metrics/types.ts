import {LineError} from '../Errors/catalog/LineError';
import {CallError, CallingClientError} from '../Errors';
import {CallId, CorrelationId, IDeviceInfo} from '../common/types';

export enum METRIC_TYPE {
  OPERATIONAL = 'operational',
  BEHAVIORAL = 'behavioral',
}

export enum METRIC_EVENT {
  BNR_ENABLED = 'web-calling-sdk-bnr-enabled',
  BNR_DISABLED = 'web-calling-sdk-bnr-disabled',
  CALL = 'web-calling-sdk-callcontrol',
  CALL_ERROR = 'web-calling-sdk-callcontrol-error',
  MEDIA = 'web-calling-sdk-media',
  MEDIA_ERROR = 'web-calling-sdk-media-error',
  REGISTRATION = 'web-calling-sdk-registration',
  REGISTRATION_ERROR = 'web-calling-sdk-registration-error',
  VOICEMAIL = 'web-calling-sdk-voicemail',
  VOICEMAIL_ERROR = 'web-calling-sdk-voicemail-error',
}

export enum REG_ACTION {
  REGISTER = 'register',
  DEREGISTER = 'deregister',
  KEEPALIVE_FAILURE = 'keepaliveFailure',
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

export interface IMetricManager {
  setDeviceInfo: (deviceInfo: IDeviceInfo) => void;
  submitRegistrationMetric: (
    name: METRIC_EVENT,
    metricAction: REG_ACTION,
    type: METRIC_TYPE,
    error: LineError | CallingClientError | undefined
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
    callError?: CallError
  ) => void;
  submitVoicemailMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    messageId?: string,
    voicemailError?: string,
    statusCode?: number
  ) => void;
}
