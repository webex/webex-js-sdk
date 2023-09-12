import {LineError} from '../../Errors/catalog/LineError';
import {CallError, CallingClientError} from '../../Errors';
import {CallId, CorrelationId, IDeviceInfo} from '../../common/types';

export enum METRIC_TYPE {
  OPERATIONAL = 'operational',
  BEHAVIORAL = 'behavioral',
}

export enum METRIC_EVENT {
  CALL = 'web-calling-sdk-callcontrol',
  CALL_ERROR = 'web-calling-sdk-callcontrol-error',
  MEDIA = 'web-calling-sdk-media',
  MEDIA_ERROR = 'web-calling-sdk-media-error',
  REGISTRATION = 'web-calling-sdk-registration',
  REGISTRATION_ERROR = 'web-calling-sdk-registration-error',
}

export enum REG_ACTION {
  REGISTER = 'register',
  DEREGISTER = 'deregister',
  KEEPALIVE_FAILURE = 'keepaliveFailure',
}

export enum TRANSFER_METRIC {
  BLIND_TRANSFER = 'Blind Transfer',
  CONSULT_TRANSFER = 'Consult Transfer',
}

export interface IMetricManager {
  setDeviceInfo: (deviceInfo: IDeviceInfo) => void;
  submitRegistrationMetric: (
    name: METRIC_EVENT,
    metricAction: REG_ACTION,
    type: METRIC_TYPE,
    error: LineError | CallingClientError | undefined
  ) => void;
  submitCallMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId,
    callError: CallError | undefined
  ) => void;
  submitMediaMetric: (
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId,
    localSdp: string | undefined,
    remoteSdp: string | undefined,
    callError: CallError | undefined
  ) => void;
}
