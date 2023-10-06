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
   * Gets the identifier of the line associated with this call.
   *
   * @returns The line identifier.
   */
  lineId: string;

  /**
   * Gets the unique call identifier.
   *
   * @returns The call identifier.
   */
  getCallId(): string;

  /**
   * Gets the correlation identifier for this call.
   *
   * @returns The correlation identifier.
   */
  getCorrelationId(): string;

  /**
   * Gets the direction of the call (e.g., inbound or outbound).
   *
   * @returns The {@link CallDirection}.
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
   * Gets the reason for disconnecting the call.
   *
   * @returns The disconnect reason.
   */
  getDisconnectReason(): DisconnectReason;

  /**
   * Ends the call.
   */
  end(): void;

  /**
   * Checks if the call is muted.
   *
   * @returns True if the call is muted; otherwise, false.
   */
  isMuted(): boolean;

  /**
   * Checks if the call is connected.
   *
   * @returns True if the call is connected; otherwise, false.
   */
  isConnected(): boolean;

  /**
   * Checks if the call is on hold.
   *
   * @returns True if the call is on hold; otherwise, false.
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
   */
  mute(localAudioStream: LocalMicrophoneStream): void;

  /**
   * Gets caller information associated with the call.
   *
   * @returns The caller's information as {@link DisplayInformation}.
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
   * Gets information related to the call's Broadworks correlationId.
   *
   * @returns The Broadworks correlation information or undefined if not available.
   */
  getBroadworksCorrelationInfo(): string | undefined;

  /**
   * Sets the Broadworks correlation information for the call.
   *
   * @param broadworksCorrelationInfo - The Broadworks correlation information.
   */
  setBroadworksCorrelationInfo(broadworksCorrelationInfo: string): void;

  /**
   * Gets RTP (Real-time Transport Protocol) statistics for the call.
   *
   * @returns A promise that resolves to the RTP statistics for the call.
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
   * @returns The created call object as {@link ICall}.
   */
  createCall(
    destination: CallDetails,
    direction: CallDirection,
    deviceId: string,
    lineId: string
  ): ICall;

  /**
   * Retrieves a call based on its unique call identifier.
   *
   * @param correlationId - The unique identifier for the call at client
   * @returns The call object as {@link ICall}, or `undefined` if the call is not found.
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
   * @returns A dictionary of active calls as {@link Record<string, ICall>}.
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
