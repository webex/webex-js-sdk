import {LineEventTypes} from '../../Events/types';
import {Eventing} from '../../Events/impl';
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

/**
 * Represents an interface for managing a telephony line.
 */
export interface ILine extends Eventing<LineEventTypes> {
  /**
   * The unique identifier of the user associated with the line.
   */
  userId: string;

  /**
   * The URI of the client device associated with the line.
   */
  clientDeviceUri: string;

  /**
   * The unique identifier of the line.
   */
  lineId: string;

  /**
   * The optional Mobius device identifier associated with the line.
   */
  mobiusDeviceId?: string;

  /**
   * The phone number associated with the line.
   */
  phoneNumber?: string;

  /**
   * The extension number associated with the line.
   */
  extension?: string;

  /**
   * An array of SIP addresses associated with the line.
   */
  sipAddresses?: string[];

  /**
   * The voicemail number associated with the line.
   */
  voicemail?: string;

  /**
   * The timestamp when the line was last seen.
   */
  lastSeen?: string;

  /**
   * The interval for sending keep-alive messages for the line.
   */
  keepaliveInterval?: number;

  /**
   * The interval for sending call keep-alive messages for the line.
   */
  callKeepaliveInterval?: number;

  /**
   * The minimum rehoming interval for the line.
   */
  rehomingIntervalMin?: number;

  /**
   * The maximum rehoming interval for the line.
   */
  rehomingIntervalMax?: number;

  /**
   * The voice portal number associated with the line.
   */
  voicePortalNumber?: number;

  /**
   * The voice portal extension associated with the line.
   */
  voicePortalExtension?: number;

  /**
   * The registration information for the line as {@link IRegistration}.
   */
  registration: IRegistration;

  /**
   * Registers the line.
   */
  register(): void;

  /**
   * Deregisters the line.
   */
  deregister(): void;

  /**
   * Retrieves the active Mobius server URL associated with the line.
   *
   */
  getActiveMobiusUrl(): string;

  /**
   * Retrieves the registration status of the line as {@link MobiusStatus}.
   *
   */
  getStatus(): RegistrationStatus;

  /**
   * Retrieves the device identifier associated with the line as {@link MobiusDeviceId},
   * or `undefined` if no device is associated.
   *
   */
  getDeviceId(): MobiusDeviceId | undefined;

  /**
   * Emits line-related events.
   *
   * @param event - The line event to emit.
   * @param deviceInfo - Additional device information (optional).
   * @param lineError - Information about line-related errors (optional).
   *
   * @example
   * ```typescript
   * line.lineEmitter(LINE_EVENTS.UNREGISTERED);
   * ```
   * @ignore
   */
  lineEmitter: (event: LINE_EVENTS, deviceInfo?: IDeviceInfo, lineError?: LineError) => void;

  /**
   * Initiates a call to the specified destination.
   *
   * @param dest - The call details including destination information.
   *
   * @example
   * ```typescript
   * const callDetails : CallDetails = {type: 'uri', address: 'example@webex.com'};
   * const callObj: ICall = line.makeCall(callDetails);
   * ```
   */
  makeCall(dest: CallDetails): ICall | undefined;

  /**
   * Retrieves a call object based on the provided correlation identifier.
   *
   * @param correlationId - The correlation identifier of the call.
   * @example
   * ```typescript
   * const callObj: ICall = line.getCall(correlationId);
   * ```
   */
  getCall(correlationId: CorrelationId): ICall;
}

export type LineEmitterCallback = (
  event: LINE_EVENTS,
  deviceInfo?: IDeviceInfo,
  clientError?: LineError
) => void;

export type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
