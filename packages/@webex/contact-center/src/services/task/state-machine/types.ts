/**
 * Task State Machine Types
 *
 * Type definitions for the XState-based task state machine.
 * These types define states, events, context, and schemas for task lifecycle management.
 */

import {TaskData, TaskUIControls} from '../types';

/**
 * All possible states in the task state machine
 */
export enum TaskState {
  IDLE = 'IDLE',
  OFFERED = 'OFFERED',
  OFFERED_CONSULT = 'OFFERED_CONSULT',
  CONNECTED = 'CONNECTED',

  // Intermediate states for async operations
  HOLD_INITIATING = 'HOLD_INITIATING',
  HELD = 'HELD',
  RESUME_INITIATING = 'RESUME_INITIATING',

  CONSULT_INITIATING = 'CONSULT_INITIATING',
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
  HOLD_SUCCESS = 'HOLD_SUCCESS',
  HOLD_FAILED = 'HOLD_FAILED',
  UNHOLD = 'UNHOLD',
  UNHOLD_SUCCESS = 'UNHOLD_SUCCESS',
  UNHOLD_FAILED = 'UNHOLD_FAILED',

  // Consult events
  CONSULT = 'CONSULT',
  CONSULT_SUCCESS = 'CONSULT_SUCCESS',
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
 * UI Control configuration for the task
 */
export interface UIControlConfig {
  /** Whether end call button is enabled (config option) */
  isEndCallEnabled: boolean;
  /** Whether end consult button is enabled (config option) */
  isEndConsultEnabled: boolean;
  /** Channel type determines which controls are available */
  channelType: 'voice' | 'digital';
  /** Optional voice channel variant to toggle WebRTC-specific controls */
  voiceVariant?: 'pstn' | 'webrtc';
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

  // Consult tracking
  consultInitiator: boolean;
  consultDestination: string | null;
  consultDestinationAgentJoined: boolean;

  // Recording tracking
  recordingActive: boolean;
  recordingPaused: boolean;

  // UI Control configuration (set at task creation)
  uiControlConfig: UIControlConfig;

  // Computed UI controls (derived from state + context + config)
  uiControls: TaskUIControls;
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
  | {type: TaskEvent.HOLD_SUCCESS; mediaResourceId: string}
  | {type: TaskEvent.HOLD_FAILED; reason?: string; mediaResourceId: string}
  | {type: TaskEvent.UNHOLD; mediaResourceId: string}
  | {type: TaskEvent.UNHOLD_SUCCESS; mediaResourceId: string}
  | {type: TaskEvent.UNHOLD_FAILED; reason?: string; mediaResourceId: string}
  | {
      type: TaskEvent.CONSULT;
      destination: string;
      destinationType: 'agent' | 'queue' | 'entryPoint';
    }
  | {type: TaskEvent.CONSULT_SUCCESS; taskData?: TaskData}
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
  event: TaskEventPayload | undefined,
  type: T
): event is Extract<TaskEventPayload, {type: T}> {
  return Boolean(event && event.type === type);
}

/**
 * UI Control states derived from state machine
 */
export interface UIControls {
  accept: {isVisible: boolean; isEnabled: boolean};
  decline: {isVisible: boolean; isEnabled: boolean};
  hold: {isVisible: boolean; isEnabled: boolean; label: 'Hold' | 'Resume'};
  transfer: {isVisible: boolean; isEnabled: boolean};
  consult: {isVisible: boolean; isEnabled: boolean};
  end: {isVisible: boolean; isEnabled: boolean};
  recording: {isVisible: boolean; isEnabled: boolean};
  mute: {isVisible: boolean; isEnabled: boolean};
  consultTransfer: {isVisible: boolean; isEnabled: boolean};
  endConsult: {isVisible: boolean; isEnabled: boolean};
  conference: {isVisible: boolean; isEnabled: boolean};
  exitConference: {isVisible: boolean; isEnabled: boolean};
  transferConference: {isVisible: boolean; isEnabled: boolean};
  wrapup: {isVisible: boolean; isEnabled: boolean};
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
  EMIT_TASK_INCOMING = 'emitTaskIncoming',
  EMIT_TASK_ASSIGNED = 'emitTaskAssigned',
  EMIT_TASK_HOLD = 'emitTaskHold',
  EMIT_TASK_RESUME = 'emitTaskResume',
  EMIT_TASK_CONSULT_CREATED = 'emitTaskConsultCreated',
  EMIT_TASK_CONSULTING = 'emitTaskConsulting',
  EMIT_TASK_CONSULT_END = 'emitTaskConsultEnd',
  EMIT_TASK_END = 'emitTaskEnd',
  EMIT_TASK_WRAPPEDUP = 'emitTaskWrappedup',
  CLEANUP_RESOURCES = 'cleanupResources',

  // Context updates
  UPDATE_TASK_DATA = 'updateTaskData',
  SET_CONSULT_INITIATOR = 'setConsultInitiator',
  SET_CONSULT_DESTINATION = 'setConsultDestination',
  SET_CONSULT_AGENT_JOINED = 'setConsultAgentJoined',
  SET_HOLD_STATE = 'setHoldState',
  SET_RECORDING_STATE = 'setRecordingState',
  UPDATE_TIMESTAMP = 'updateTimestamp',
}
