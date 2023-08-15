import {IRegistration} from '../registration/types';
import {LineError} from '../../Errors/catalog/LineError';
import {ILineInfo, MobiusDeviceId, MobiusStatus} from '../../common/types';

export interface ICallerInfo {
  // will be done as part of call related jira
  dummy: any;
}

export enum LineStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
}

export interface ICall {
  answer: () => void;
  dial: () => void;
  end: () => void;
  getCallId: () => string;
  getCallerInfo: () => ICallerInfo;
  sendDigit: () => void;
  mute: () => void;
  doHoldResume: () => void;
  completeTransfer: () => void;
}

export interface ILine {
  userId: string;
  clientDeviceUri: string;
  lineId: string;
  status: LineStatus;
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
  sendKeepAlive: (lineInfo: ILineInfo) => void;
  getActiveMobiusUrl: () => string;
  getRegistrationStatus: () => MobiusStatus;
  getDeviceId: () => MobiusDeviceId | undefined;
  lineEmitter: (event: LINE_EVENTS, lineInfo?: ILineInfo, lineError?: LineError) => void;
}

export enum LINE_EVENTS {
  CONNECTING = 'connecting',
  ERROR = 'error',
  RECONNECTED = 'reconnected',
  RECONNECTING = 'reconnecting',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
}

export type LineEventTypes = {
  [LINE_EVENTS.CONNECTING]: () => void;
  [LINE_EVENTS.ERROR]: (error: LineError) => void;
  [LINE_EVENTS.RECONNECTED]: () => void;
  [LINE_EVENTS.RECONNECTING]: () => void;
  [LINE_EVENTS.REGISTERED]: (lineInfo: ILineInfo) => void;
  [LINE_EVENTS.UNREGISTERED]: () => void;
};

export type LineEmitterCallback = (
  event: LINE_EVENTS,
  lineInfo?: ILineInfo,
  clientError?: LineError
) => void;

export type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
