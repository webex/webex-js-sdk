import {LineError} from '../../Errors/catalog/LineError';
import {IDeviceInfo, MobiusDeviceId, MobiusStatus} from '../../common/types';

export interface ICallSettingResponse {
  // will be done as part of call related jira
  dummy: any;
}

export interface ICallerInfo {
  // will be done as part of call related jira
  dummy: any;
}

export enum LineStatus {
  INACTIVE = 'inactive',
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
  lineId: string;
  clientDeviceUri: string;
  phoneNumber: string;
  extension: string;
  status: LineStatus;
  sipAddresses: string[];
  voicemail: string;
  lastSeen: string;
  keepaliveInterval: number;
  callKeepaliveInterval: number;
  rehomingIntervalMin: number;
  rehomingIntervalMax: number;
  voicePortalNumber: number;
  voicePortalExtension: number;
  register: () => void;
  deregister: () => void;
  sendKeepAlive: (deviceInfo: IDeviceInfo) => void;
  getCallForwardSetting: () => Promise<ICallSettingResponse>;
  getCallWaitingSetting: () => Promise<ICallSettingResponse>;
  setCallWaitingSetting: () => Promise<ICallSettingResponse>;
  setCallForwardSetting: () => Promise<ICallSettingResponse>;
  getActiveMobiusUrl: () => string;
  getRegistrationStatus: () => MobiusStatus;
  getDeviceId: () => MobiusDeviceId | undefined;

  // below methods will be covered in call related jira
  /*
    makeCall: () => ICall;
    getCall: () => void;
    getCallManager: () => void;
    */
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
  [LINE_EVENTS.REGISTERED]: (deviceInfo: IDeviceInfo) => void;
  [LINE_EVENTS.UNREGISTERED]: () => void;
};

export type LineEmitterCallback = (
  event: LINE_EVENTS,
  deviceInfo?: IDeviceInfo,
  clientError?: LineError
) => void;

export type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
