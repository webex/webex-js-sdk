/* eslint-disable @typescript-eslint/no-explicit-any */
import {LocalMicrophoneStream} from '@webex/internal-media-core';
import {CallError} from '../../Errors/catalog/CallError';
import {CallDetails, CallDirection, CallId, DisplayInformation} from '../../common/types';
import {Eventing} from '../../Events/impl';
import {CallerIdInfo, CallEvent, CallEventTypes, RoapEvent, RoapMessage} from '../../Events/types';

export enum MobiusEventType {
  CALL_SETUP = 'mobius.call',
  CALL_PROGRESS = 'mobius.callprogress',
  CALL_CONNECTED = 'mobius.callconnected',
  CALL_MEDIA = 'mobius.media',
  CALL_DISCONNECTED = 'mobius.calldisconnected',
}

export enum MediaState {
  OFFER = 'OFFER',
  ANSWER = 'ANSWER',
  OFFER_REQUEST = 'OFFER_REQUEST',
  OK = 'OK',
  ERROR = 'ERROR',
}

export enum DisconnectCode {
  BUSY = 115,
  NORMAL = 0,
  MEDIA_INACTIVITY = 131,
}

export enum DisconnectCause {
  BUSY = 'User Busy.',
  NORMAL = 'Normal Disconnect.',
  MEDIA_INACTIVITY = 'Media Inactivity.',
}

/* Work in Progress */
export enum MidCallEventType {
  CALL_INFO = 'callInfo',
  CALL_STATE = 'callState',
}

export type MidCallCallerId = {
  callerId: CallerIdInfo;
};
export type DisconnectReason = {
  code: DisconnectCode;
  cause: DisconnectCause;
};

export enum RoapScenario {
  ANSWER = 'ANSWER',
  OK = 'OK',
  OFFER = 'OFFER',
  ERROR = 'ERROR',
  OFFER_RESPONSE = 'OFFER_RESPONSE',
}

export enum MobiusCallState {
  PROCEEDING = 'sig_proceeding',
  PROGRESS = 'sig_progress',
  ALERTING = 'sig_alerting',
  CONNECTED = 'sig_connected',
}

export type MobiusCallResponse = {
  statusCode: number;
  body: {
    device: {
      deviceId: string;
      correlationId: string;
    };
    callId: CallId;
    callData?: {
      callState: MobiusCallState;
    };
  };
};

export type MidCallEvent = {
  eventType: string;
  eventData: unknown;
};

export type SupplementaryServiceState = {
  callState: string;
};

export type MobiusCallData = {
  callProgressData?: {
    alerting: boolean;
    inbandMedia: boolean;
  };
  message?: RoapMessage;
  callerId: {
    from: string;
  };
  midCallService?: Array<MidCallEvent>;
  callId: CallId;
  callUrl: string;
  deviceId: string;
  correlationId: string;
  eventType: MobiusEventType;
  broadworksCorrelationInfo?: string;
};

export type MobiusCallEvent = {
  id: string;
  data: MobiusCallData;
  timestamp: number;
  trackingId: string;
};

export type PatchResponse = {
  statusCode: number;
  body: {
    device: {
      deviceId: string;
      correlationId: string;
    };
    callId: CallId;
  };
};

export type SSResponse = {
  statusCode: number;
  body: {
    device: {
      deviceId: string;
      correlationId: string;
    };
    callId: CallId;
  };
};

export type DivertContext = {
  destination: string;
  toVoicemail: boolean;
};

export type TransferContext = {
  transferorCallId: CallId;
  destination?: string;
  transferToCallId?: CallId;
};

export enum TransferType {
  BLIND = 'BLIND',
  CONSULT = 'CONSULT',
}

export type ParkContext = {
  isGroupPark: boolean;
  destination: string;
};

export type MediaContext = {
  previousState: string; // To be used for midcall and error handling.
};

export type VoiceQualityMetrics = {
  VoRxCodec: string;
  VoPktSizeMs: number;
  maxJitter: number;
  VoOneWayDelayMs: number;
  networkType: string;
  hwType: string;
};

export type TransmitterVqPayload = {
  VoTxCodec: string;
  rtpBitRate: number;
};

export type ReceiveStatistics = {
  Dur: number;
  Pkt: number;
  Oct: number;
  LatePkt: number;
  LostPkt: number;
  AvgJit: number;
  VQMetrics: VoiceQualityMetrics;
};

export type TransmitStatistics = {
  Dur: number;
  Pkt: number;
  Oct: number;
  VQMetrics: TransmitterVqPayload;
};

export type CallRtpStats = {
  'rtp-rxstat': ReceiveStatistics;
  'rtp-txstat': TransmitStatistics;
};

export interface ICall extends Eventing<CallEventTypes> {
  getCallId: () => string;
  getCorrelationId: () => string;
  getDirection: () => CallDirection;
  setCallId: (callId: CallId) => void;
  sendCallStateMachineEvt: (event: CallEvent) => void;
  sendMediaStateMachineEvt: (event: RoapEvent) => void;
  getDisconnectReason: () => DisconnectReason;
  end: () => void;
  isMuted: () => boolean;
  isConnected: () => boolean;
  isHeld: () => boolean;
  doHoldResume: () => void;
  mute: (localAudioStream: LocalMicrophoneStream) => void;
  getCallerInfo: () => DisplayInformation;
  startCallerIdResolution: (callerInfo: CallerIdInfo) => void;
  handleMidCallEvent: (event: MidCallEvent) => void;
  dial: (localAudioStream: LocalMicrophoneStream) => void;
  sendDTMF: (tone: string) => void;
  answer: (localAudioStream: LocalMicrophoneStream) => void;
  completeTransfer: (
    transferType: TransferType,
    transferCallId?: CallId,
    transferTarget?: string
  ) => void;
  getBroadworksCorrelationInfo: () => string | undefined;
  setBroadworksCorrelationInfo: (broadworksCorrelationInfo: string) => void;
  getCallRtpStats: () => Promise<CallRtpStats>;
}

export type DeleteRecordCallBack = (callId: CallId) => void;
export type CallEmitterCallBack = (callerInfo: DisplayInformation) => void;
export type CallErrorEmitterCallBack = (error: CallError) => void;
export type RetryCallBack = (interval: number) => void;

export interface ICallManager extends Eventing<CallEventTypes> {
  createCall: (destination: CallDetails, direction: CallDirection, deviceId: string) => ICall;
  endCall: (callId: CallId) => void;
  getCall: (callId: CallId) => ICall;
  updateActiveMobius: (url: string) => void;
  getActiveCalls: () => Record<string, ICall>;
}
