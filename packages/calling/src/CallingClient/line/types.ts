import {IRegistration} from '../registration/types';
import {LineError} from '../../Errors/catalog/LineError';
import {
  CallDetails,
  CorrelationId,
  IDeviceInfo,
  MobiusDeviceId,
  RegistrationStatus,
} from '../../common/types';
import {ICall} from '../calling/types';

export enum LINE_EVENTS {
  CONNECTING = 'connecting',
  ERROR = 'error',
  RECONNECTED = 'reconnected',
  RECONNECTING = 'reconnecting',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  INCOMING_CALL = 'line:incoming_call',
}

export interface ILine {
  userId: string;
  clientDeviceUri: string;
  lineId: string;
  status: RegistrationStatus;
  mobiusDeviceId?: string;
  phoneNumber?: string;
  extension?: string;
  sipAddresses?: string[];
  voicemail?: string;
  lastSeen?: string;
  keepaliveInterval?: number;
  callKeepaliveInterval?: number;
  rehomingIntervalMin?: number;
  rehomingIntervalMax?: number;
  voicePortalNumber?: number;
  voicePortalExtension?: number;
  registration: IRegistration;
  register: () => void;
  deregister: () => void;
  getActiveMobiusUrl: () => string;
  getRegistrationStatus: () => RegistrationStatus;
  getDeviceId: () => MobiusDeviceId | undefined;
  lineEmitter: (event: LINE_EVENTS, deviceInfo?: IDeviceInfo, lineError?: LineError) => void;
  makeCall: (dest: CallDetails) => ICall | undefined;
  getCall: (correlationId: CorrelationId) => ICall;
}

export type LineEventTypes = {
  [LINE_EVENTS.CONNECTING]: () => void;
  [LINE_EVENTS.ERROR]: (error: LineError) => void;
  [LINE_EVENTS.RECONNECTED]: () => void;
  [LINE_EVENTS.RECONNECTING]: () => void;
  [LINE_EVENTS.REGISTERED]: (lineInfo: ILine) => void;
  [LINE_EVENTS.UNREGISTERED]: () => void;
  [LINE_EVENTS.INCOMING_CALL]: (callObj: ICall) => void;
};

export type LineEmitterCallback = (
  event: LINE_EVENTS,
  deviceInfo?: IDeviceInfo,
  clientError?: LineError
) => void;

export type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
