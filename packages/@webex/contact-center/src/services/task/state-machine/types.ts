/**
 * Task State Machine Types
 *
 * Type definitions for the XState-based task state machine.
 * These types define states, events, context, and schemas for task lifecycle management.
 */

import {TaskData} from '../types';

/**
 * All possible states in the task state machine
 */
export enum TaskState {
  IDLE = 'IDLE',
  OFFERED = 'OFFERED',
  OFFERED_CONSULT = 'OFFERED_CONSULT',
  CONNECTED = 'CONNECTED',
  HELD = 'HELD',
  CONSULTING = 'CONSULTING',
  CONFERENCING = 'CONFERENCING',
  WRAPPING_UP = 'WRAPPING_UP',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
  // NOT IMPLEMENTED: MPC (Multi-Party Conference) states
  CONSULT_INITIATED = 'CONSULT_INITIATED',
  CONSULT_COMPLETED = 'CONSULT_COMPLETED',
  // NOT IMPLEMENTED: Post-call state (isWxccPostCallEnabled feature flag)
  POST_CALL = 'POST_CALL',
  // NOT IMPLEMENTED: Parked state
  PARKED = 'PARKED',
  // NOT IMPLEMENTED: Monitoring/Supervisory states
  MONITORING = 'MONITORING',
}

/**
 * All possible events that can trigger state transitions
 */
export enum TaskEvent {
  // Offer events
  OFFER = 'OFFER',
  OFFER_CONSULT = 'OFFER_CONSULT',

  // Assignment events
  ACCEPT = 'ACCEPT',
  DECLINE = 'DECLINE',
  ASSIGN = 'ASSIGN',

  // Hold/Resume events
  HOLD = 'HOLD',
  UNHOLD = 'UNHOLD',

  // Consult events
  CONSULT = 'CONSULT',
  CONSULT_CREATED = 'CONSULT_CREATED',
  CONSULTING_ACTIVE = 'CONSULTING_ACTIVE',
  CONSULT_END = 'CONSULT_END',
  CONSULT_TRANSFER = 'CONSULT_TRANSFER',
  CONSULT_FAILED = 'CONSULT_FAILED',

  // Conference events
  START_CONFERENCE = 'START_CONFERENCE',
  MERGE_TO_CONFERENCE = 'MERGE_TO_CONFERENCE',
  CONFERENCE_START = 'CONFERENCE_START',
  CONFERENCE_END = 'CONFERENCE_END',
  TRANSFER_CONFERENCE = 'TRANSFER_CONFERENCE',
  PARTICIPANT_JOIN = 'PARTICIPANT_JOIN',
  PARTICIPANT_LEAVE = 'PARTICIPANT_LEAVE',
  EXIT_CONFERENCE = 'EXIT_CONFERENCE',

  // Recording events
  PAUSE_RECORDING = 'PAUSE_RECORDING',
  RESUME_RECORDING = 'RESUME_RECORDING',

  // Transfer events
  TRANSFER = 'TRANSFER',

  // Wrapup events
  WRAPUP_START = 'WRAPUP_START',
  WRAPUP = 'WRAPUP',
  WRAPUP_COMPLETE = 'WRAPUP_COMPLETE',

  // End events
  END = 'END',
  RONA = 'RONA', // Ring On No Answer
  CONTACT_ENDED = 'CONTACT_ENDED',
  AUTO_WRAPUP = 'AUTO_WRAPUP',

  // Failure events
  ASSIGN_FAILED = 'ASSIGN_FAILED',
  INVITE_FAILED = 'INVITE_FAILED',

  // Queue events
  CTQ_CANCEL = 'CTQ_CANCEL', // Cancel To Queue
}

/**
 * Represents a participant in a conference call
 */
export interface ConferenceParticipant {
  /** Unique identifier for the participant */
  id: string;
  /** Type of participant (agent, customer, or external party) */
  type: 'AGENT' | 'CUSTOMER' | 'EXTERNAL';
  /** Display name of the participant */
  name?: string;
  /** Timestamp when participant joined the conference */
  joinedAt: Date;
  /** Whether this participant initiated the conference */
  isInitiator: boolean;
  /** Whether this participant can be removed from the conference */
  canBeRemoved: boolean;
}

/**
 * Context data maintained by the state machine
 *
 * IMPORTANT: This context should only store data that CANNOT be derived from the state machine's current state.
 *
 * STATE-DERIVED PROPERTIES (NOT stored in context, derived from state machine state):
 * - isHold: Derived from state === TaskState.HELD
 * - isConsulted: Derived from state === TaskState.CONSULTING or state === TaskState.OFFERED_CONSULT
 * - isConferencing: Derived from state === TaskState.CONFERENCING
 * - isConnected: Derived from state === TaskState.CONNECTED
 * - isWrappingUp: Derived from state === TaskState.WRAPPING_UP
 * - isOffered: Derived from state === TaskState.OFFERED or state === TaskState.OFFERED_CONSULT
 *
 * These boolean flags were removed because they duplicate information already available
 * in the state machine's current state, violating the single source of truth principle.
 * Use state.matches(TaskState.XXX) instead to check these conditions.
 */
export interface TaskContext {
  // Task data
  taskData: TaskData | null;

  // State tracking
  previousState: TaskState | null;

  // Consult tracking
  consultInitiator: boolean;
  consultDestination: string | null;
  consultDestinationAgentJoined: boolean;

  // Conference tracking
  conferenceInitiatorId: string | null;
  conferenceParticipants: ConferenceParticipant[];
  maxConferenceParticipants: number;
  participants: string[]; // DEPRECATED: Use conferenceParticipants instead

  // Recording tracking
  recordingActive: boolean;
  recordingPaused: boolean;

  // Wrapup tracking
  wrapUpRequired: boolean;
  autoWrapupTimer: number | null;

  // RONA tracking
  ronaTimer: number | null;
}

/**
 * Event payload types for each event
 */
export type TaskEventPayload =
  | {type: TaskEvent.OFFER; taskData: TaskData}
  | {type: TaskEvent.OFFER_CONSULT; taskData: TaskData}
  | {type: TaskEvent.ACCEPT}
  | {type: TaskEvent.DECLINE}
  | {type: TaskEvent.ASSIGN; taskData: TaskData}
  | {type: TaskEvent.HOLD; mediaResourceId: string}
  | {type: TaskEvent.UNHOLD; mediaResourceId: string}
  | {
      type: TaskEvent.CONSULT;
      destination: string;
      destinationType: 'agent' | 'queue' | 'entryPoint';
    }
  | {type: TaskEvent.CONSULT_CREATED; taskData: TaskData}
  | {type: TaskEvent.CONSULTING_ACTIVE; consultDestinationAgentJoined: boolean}
  | {type: TaskEvent.CONSULT_END}
  | {type: TaskEvent.CONSULT_TRANSFER}
  | {type: TaskEvent.CONSULT_FAILED; reason?: string}
  | {type: TaskEvent.START_CONFERENCE}
  | {type: TaskEvent.MERGE_TO_CONFERENCE}
  | {type: TaskEvent.CONFERENCE_START; participants?: ConferenceParticipant[]}
  | {type: TaskEvent.CONFERENCE_END}
  | {type: TaskEvent.TRANSFER_CONFERENCE; agentId?: string}
  | {type: TaskEvent.PARTICIPANT_JOIN; participant: ConferenceParticipant}
  | {type: TaskEvent.PARTICIPANT_LEAVE; participantId: string}
  | {type: TaskEvent.EXIT_CONFERENCE; agentId?: string}
  | {type: TaskEvent.PAUSE_RECORDING}
  | {type: TaskEvent.RESUME_RECORDING}
  | {type: TaskEvent.TRANSFER}
  | {type: TaskEvent.WRAPUP_START}
  | {type: TaskEvent.WRAPUP; wrapupData?: any}
  | {type: TaskEvent.WRAPUP_COMPLETE}
  | {type: TaskEvent.END}
  | {type: TaskEvent.RONA}
  | {type: TaskEvent.CONTACT_ENDED}
  | {type: TaskEvent.AUTO_WRAPUP}
  | {type: TaskEvent.ASSIGN_FAILED; reason?: string}
  | {type: TaskEvent.INVITE_FAILED; reason?: string}
  | {type: TaskEvent.CTQ_CANCEL};

/**
 * Type guard to check event type
 */
export function isEventOfType<T extends TaskEvent>(
  event: TaskEventPayload,
  type: T
): event is Extract<TaskEventPayload, {type: T}> {
  return event.type === type;
}

/**
 * UI Control states derived from state machine
 */
export interface UIControls {
  accept: {visible: boolean; enabled: boolean};
  decline: {visible: boolean; enabled: boolean};
  hold: {visible: boolean; enabled: boolean; label: 'Hold' | 'Resume'};
  transfer: {visible: boolean; enabled: boolean};
  consult: {visible: boolean; enabled: boolean};
  end: {visible: boolean; enabled: boolean};
  recording: {visible: boolean; enabled: boolean};
  mute: {visible: boolean; enabled: boolean};
  consultTransfer: {visible: boolean; enabled: boolean};
  endConsult: {visible: boolean; enabled: boolean};
  conference: {visible: boolean; enabled: boolean};
  exitConference: {visible: boolean; enabled: boolean};
  transferConference: {visible: boolean; enabled: boolean};
  wrapup: {visible: boolean; enabled: boolean};
}

/**
 * State machine configuration type
 */
export interface TaskStateMachineConfig {
  id: string;
  initial: TaskState;
  context: TaskContext;
  states: Record<string, any>;
}

/**
 * Action types for state machine
 */
export enum TaskAction {
  // Entry/Exit actions
  INITIALIZE_TASK = 'initializeTask',
  START_RONA_TIMER = 'startRonaTimer',
  STOP_RONA_TIMER = 'stopRonaTimer',
  EMIT_TASK_INCOMING = 'emitTaskIncoming',
  EMIT_TASK_ASSIGNED = 'emitTaskAssigned',
  EMIT_TASK_HOLD = 'emitTaskHold',
  EMIT_TASK_RESUME = 'emitTaskResume',
  EMIT_TASK_CONSULT_CREATED = 'emitTaskConsultCreated',
  EMIT_TASK_CONSULTING = 'emitTaskConsulting',
  EMIT_TASK_CONSULT_END = 'emitTaskConsultEnd',
  EMIT_TASK_CONFERENCE_STARTED = 'emitTaskConferenceStarted',
  EMIT_TASK_CONFERENCE_ENDED = 'emitTaskConferenceEnded',
  EMIT_TASK_END = 'emitTaskEnd',
  EMIT_TASK_WRAPPEDUP = 'emitTaskWrappedup',
  START_AUTO_WRAPUP_TIMER = 'startAutoWrapupTimer',
  STOP_AUTO_WRAPUP_TIMER = 'stopAutoWrapupTimer',
  CLEANUP_RESOURCES = 'cleanupResources',

  // Context updates
  UPDATE_TASK_DATA = 'updateTaskData',
  SET_CONSULT_INITIATOR = 'setConsultInitiator',
  SET_CONSULT_DESTINATION = 'setConsultDestination',
  SET_CONSULT_AGENT_JOINED = 'setConsultAgentJoined',
  SET_CONFERENCING = 'setConferencing',
  UPDATE_PARTICIPANTS = 'updateParticipants',
  SET_HOLD_STATE = 'setHoldState',
  SET_RECORDING_STATE = 'setRecordingState',
  UPDATE_TIMESTAMP = 'updateTimestamp',
}

/**
 * Guard condition types
 */
export enum TaskGuard {
  CAN_ACCEPT = 'canAccept',
  CAN_HOLD = 'canHold',
  CAN_RESUME = 'canResume',
  CAN_CONSULT = 'canConsult',
  CAN_START_CONFERENCE = 'canStartConference',
  CAN_MERGE_TO_CONFERENCE = 'canMergeConsultToConference',
  CAN_ADD_TO_CONFERENCE = 'canAddToConference',
  CAN_TRANSFER = 'canTransfer',
  CAN_EXIT_CONFERENCE = 'canExitConference',
  CAN_TRANSFER_CONFERENCE = 'canTransferConference',
  SHOULD_END_CONFERENCE = 'shouldEndConference',
  CAN_WRAPUP = 'canWrapup',
  IS_CONSULTED = 'isConsulted',
  IS_CONFERENCE_ENDING = 'isConferenceEnding',
  RECORDING_ACTIVE = 'recordingActive',
  RECORDING_PAUSED = 'recordingPaused',
}
