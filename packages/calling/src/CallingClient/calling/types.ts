/* eslint-disable @typescript-eslint/no-explicit-any */
import {LocalMicrophoneStream} from '@webex/internal-media-core';
import {CallError} from '../../Errors/catalog/CallError';
import {
  CallDetails,
  CallDirection,
  CallId,
  CorrelationId,
  DisplayInformation,
} from '../../common/types';
import {Eventing} from '../../Events/impl';
import {CallerIdInfo, CallEvent, CallEventTypes, RoapEvent, RoapMessage} from '../../Events/types';
import {ILine} from '../line/types';

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

export enum MUTE_TYPE {
  USER = 'user_mute',
  SYSTEM = 'system_mute',
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

/**
 * Represents an interface for managing call-related operations.
 */
export interface ICall extends Eventing<CallEventTypes> {
  /**
   * Fetches the identifier of the line associated with this call.
   *
   */
  lineId: string;

  /**
   * Fetches the unique call identifier.
   *
   */
  getCallId(): string;

  /**
   * Fetches the correlation identifier for this call.
   *
   */
  getCorrelationId(): string;

  /**
   * Fetches the direction of the call (e.g., inbound or outbound).
   *
   */
  getDirection(): CallDirection;

  /**
   * Sets the call identifier.
   *
   * @param callId - The new call identifier.
   */
  setCallId(callId: CallId): void;

  /**
   * Sends a call state machine event.
   *
   * @param event - The call event to send.
   * @ignore
   */
  sendCallStateMachineEvt(event: CallEvent): void;

  /**
   * Sends a media state machine event.
   *
   * @param event - The Roap event to send.
   * @ignore
   */
  sendMediaStateMachineEvt(event: RoapEvent): void;

  /**
   * Fetches the reason for disconnecting the call.
   *
   */
  getDisconnectReason(): DisconnectReason;

  /**
   * Disconnects the call.
   */
  end(): void;

  /**
   * Checks if the call is muted.
   *
   */
  isMuted(): boolean;

  /**
   * Checks if the call is connected.
   *
   */
  isConnected(): boolean;

  /**
   * Checks if the call is on hold.
   *
   */
  isHeld(): boolean;

  /**
   * Performs a hold or resume action on the call.
   */
  doHoldResume(): void;

  /**
   * Mutes or unmutes the call's local audio stream.
   *
   * @param localAudioStream - The local audio stream to mute or unmute.
   * @param muteType - Identifies if mute was triggered by system or user.
   */
  mute(localAudioStream: LocalMicrophoneStream, muteType?: MUTE_TYPE): void;

  /**
   * Fetches the caller information associated with the call.
   *
   */
  getCallerInfo(): DisplayInformation;

  /**
   * Initiates caller ID resolution for the call.
   * callerInfo data can be retrieved later by calling {@link getCallerInfo} method.
   * @param callerInfo - The caller ID information to resolve.
   */
  startCallerIdResolution(callerInfo: CallerIdInfo): void;

  /**
   * Handles a mid-call event.
   * @param event - The mid-call event to handle.
   * @ignore
   */
  handleMidCallEvent(event: MidCallEvent): void;

  /**
   * Dials the call using the provided local audio stream.
   *
   * @param localAudioStream - The local audio stream for the call.
   * @example
   * ```
   * const localAudioStream  = await Calling.createMicrophoneStream({audio: true});
   * call.dial(localAudioStream);
   * ```
   */
  dial(localAudioStream: LocalMicrophoneStream): void;

  /**
   * Sends a DTMF digit during the call.
   *
   * @param tone - The DTMF tone to send.
   * @example
   * ```
   * call.sendDigit('1');
   * ```
   */
  sendDigit(tone: string): void;

  /**
   * Answers the call using the provided local audio stream.
   *
   * @param localAudioStream - The local audio stream for the call.
   *
   * @example
   * ```
   * const localAudioStream  = await Calling.createMicrophoneStream({audio: true});
   * call.answer(localAudioStream);
   * ```
   */
  answer(localAudioStream: LocalMicrophoneStream): void;

  /**
   * Completes a call transfer.
   *
   * @param transferType - The type of transfer to perform. Eg. BLIND or CONSULT.
   * @param transferCallId - The call identifier for the transfer incase of Consult transfer (optional).
   * @param transferTarget - The target for the transfer incase of Blind transfer(optional).
   * @example
   * ```
   * // blind transfer
   * call.completeTransfer('BLIND', undefined, '5998');
   *
   * // consult transfer
   * call.completeTransfer('CONSULT', secondCall.getCallId(), undefined);
   * ```
   */
  completeTransfer(
    transferType: TransferType,
    transferCallId?: CallId,
    transferTarget?: string
  ): void;

  /**
   * Change the audio stream of the call.
   *
   * @param newAudioStream - The new audio stream to be used in the call.
   */
  updateMedia(newAudioStream: LocalMicrophoneStream): void;

  /**
   * Fetches the information related to the call's Broadworks correlationId.
   *
   */
  getBroadworksCorrelationInfo(): string | undefined;

  /**
   * Sets the Broadworks correlation information for the call.
   *
   * @param broadworksCorrelationInfo - The Broadworks correlation information.
   */
  setBroadworksCorrelationInfo(broadworksCorrelationInfo: string): void;

  /**
   * Fetches the RTP (Real-time Transport Protocol) statistics for the call.
   *
   */
  getCallRtpStats(): Promise<CallRtpStats>;
}

export type DeleteRecordCallBack = (callId: CallId) => void;
export type CallEmitterCallBack = (callerInfo: DisplayInformation) => void;
export type CallErrorEmitterCallBack = (error: CallError) => void;
export type RetryCallBack = (interval: number) => void;

/**
 * Represents an interface for managing calls within a call manager.
 */
export interface ICallManager extends Eventing<CallEventTypes> {
  /**
   * Creates a call with the specified details.
   *
   * @param destination - The call details including destination information.
   * @param direction - The direction of the call (e.g., incoming or outgoing).
   * @param deviceId - The unique identifier of the device associated with the call.
   * @param lineId - The identifier of the line to which the call belongs.
   */
  createCall(
    direction: CallDirection,
    deviceId: string,
    lineId: string,
    destination?: CallDetails
  ): ICall;

  /**
   * Retrieves a call based on its unique call identifier.
   *
   * @param correlationId - The unique identifier for the call at client
   */
  getCall(correlationId: CorrelationId): ICall;

  /**
   * Updates the active Mobius server URL.
   *
   * @param url - The new Mobius server URL to set.
   */
  updateActiveMobius(url: string): void;

  /**
   * Retrieves a dictionary of active calls, where each key is a call identifier
   * and the corresponding value is the call object.
   *
   */
  getActiveCalls(): Record<string, ICall>;

  /**
   * Updates a line associated with a specific device.
   *
   * @param deviceId - The unique identifier of the device.
   * @param line - The updated line object as {@link ILine}.
   */
  updateLine(deviceId: string, line: ILine): void;
}
