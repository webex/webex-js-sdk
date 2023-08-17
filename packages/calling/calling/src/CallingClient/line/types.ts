import {IRegistration} from '../registration/types';
import {LineError} from '../../Errors/catalog/LineError';
import {IDeviceInfo, MobiusDeviceId, MobiusStatus} from '../../common/types';

export enum LineStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
}

export enum LINE_EVENTS {
  CONNECTING = 'connecting',
  ERROR = 'error',
  RECONNECTED = 'reconnected',
  RECONNECTING = 'reconnecting',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
}

export interface ILine {
  userId: string;
  clientDeviceUri: string;
  lineId: string;
  status: LineStatus;
  mobiusDeviceId?: string;
  mobiusUri?: string;
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
  getRegistrationStatus: () => MobiusStatus;
  getDeviceId: () => MobiusDeviceId | undefined;
  lineEmitter: (event: LINE_EVENTS, deviceInfo?: IDeviceInfo, lineError?: LineError) => void;
}

export type LineEventTypes = {
  [LINE_EVENTS.CONNECTING]: () => void;
  [LINE_EVENTS.ERROR]: (error: LineError) => void;
  [LINE_EVENTS.RECONNECTED]: () => void;
  [LINE_EVENTS.RECONNECTING]: () => void;
  [LINE_EVENTS.REGISTERED]: (deviceInfo: IDeviceInfo) => void;
  [LINE_EVENTS.UNREGISTERED]: () => void;
};

export type LineEmitterCallback = (
  event: LINE_EVENTS,
  deviceInfo?: IDeviceInfo,
  clientError?: LineError
) => void;

export type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
