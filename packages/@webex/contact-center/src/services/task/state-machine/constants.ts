/**
 * Constants for the task state machine.
 * These enums define the allowed states, events, and built-in action identifiers.
 */

// ============================================
// Conference Constants
// ============================================

/**
 * Maximum number of participants allowed in a multi-party conference.
 * Max 7 counted agents + 1 customer.
 */
export const MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE = 7;

// ============================================
// Participant Type Constants
// ============================================

/** Participant types for conference filtering */
export const PARTICIPANT_TYPE = {
  CUSTOMER: 'Customer',
  SUPERVISOR: 'Supervisor',
  VVA: 'VVA',
} as const;

export type ParticipantType = (typeof PARTICIPANT_TYPE)[keyof typeof PARTICIPANT_TYPE];

// ============================================
// Media Type Constants
// ============================================

/** Media type for consult calls */
export const MEDIA_TYPE_CONSULT = 'consult';

/** Media type for main calls */
export const MEDIA_TYPE_MAIN_CALL = 'mainCall';

// ============================================
// State Machine Enums
// ============================================

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
  TRANSFER_INITIATING = 'TRANSFER_INITIATING',
  CONF_INITIATING = 'CONF_INITIATING',

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

export enum TaskEvent {
  TASK_INCOMING = 'TASK_INCOMING',
  TASK_OFFERED = 'TASK_OFFERED',

  // Offer events
  OFFER = 'OFFER',
  OFFER_CONTACT = 'OFFER_CONTACT',
  OFFER_CONSULT = 'OFFER_CONSULT',
  HYDRATE = 'HYDRATE',

  // Internal "data refresh" events
  CONTACT_UPDATED = 'CONTACT_UPDATED',
  CONTACT_OWNER_CHANGED = 'CONTACT_OWNER_CHANGED',

  // Assignment events
  ACCEPT = 'ACCEPT',
  ACCEPT_INITIATED = 'ACCEPT_INITIATED',
  DECLINE = 'DECLINE',
  ASSIGN = 'ASSIGN',

  // Hold/Resume events
  HOLD = 'HOLD',
  HOLD_SUCCESS = 'HOLD_SUCCESS',
  HOLD_FAILED = 'HOLD_FAILED',
  UNHOLD = 'UNHOLD',
  UNHOLD_SUCCESS = 'UNHOLD_SUCCESS',
  UNHOLD_FAILED = 'UNHOLD_FAILED',
  HOLD_INITIATED = 'HOLD_INITIATED',
  UNHOLD_INITIATED = 'UNHOLD_INITIATED',

  // Consult events
  CONSULT = 'CONSULT',
  CONSULT_SUCCESS = 'CONSULT_SUCCESS',
  CONSULT_CREATED = 'CONSULT_CREATED',
  CONSULTING_ACTIVE = 'CONSULTING_ACTIVE',
  CONSULT_END = 'CONSULT_END',
  CONSULT_TRANSFER = 'CONSULT_TRANSFER',
  CONSULT_FAILED = 'CONSULT_FAILED',
  CONSULT_ACCEPTED = 'CONSULT_ACCEPTED',

  // Conference events
  START_CONFERENCE = 'START_CONFERENCE',
  MERGE_TO_CONFERENCE = 'MERGE_TO_CONFERENCE',
  CONFERENCE_START = 'CONFERENCE_START',
  CONFERENCE_FAILED = 'CONFERENCE_FAILED',
  CONFERENCE_END = 'CONFERENCE_END',
  TRANSFER_CONFERENCE = 'TRANSFER_CONFERENCE',
  TRANSFER_CONFERENCE_SUCCESS = 'TRANSFER_CONFERENCE_SUCCESS',
  TRANSFER_CONFERENCE_FAILED = 'TRANSFER_CONFERENCE_FAILED',
  PARTICIPANT_JOIN = 'PARTICIPANT_JOIN',
  PARTICIPANT_LEAVE = 'PARTICIPANT_LEAVE',
  EXIT_CONFERENCE = 'EXIT_CONFERENCE',
  EXIT_CONFERENCE_SUCCESS = 'EXIT_CONFERENCE_SUCCESS',
  EXIT_CONFERENCE_FAILED = 'EXIT_CONFERENCE_FAILED',

  // Switch call events (for toggling between consult and main call)
  SWITCH_TO_MAIN_CALL = 'SWITCH_TO_MAIN_CALL',
  SWITCH_TO_CONSULT = 'SWITCH_TO_CONSULT',

  // Recording events
  RECORDING_STARTED = 'RECORDING_STARTED',
  PAUSE_RECORDING = 'PAUSE_RECORDING',
  RESUME_RECORDING = 'RESUME_RECORDING',

  // Transfer events
  TRANSFER = 'TRANSFER',
  TRANSFER_SUCCESS = 'TRANSFER_SUCCESS',
  TRANSFER_FAILED = 'TRANSFER_FAILED',

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
  OUTBOUND_FAILED = 'OUTBOUND_FAILED',

  // Queue events
  CTQ_CANCEL = 'CTQ_CANCEL', // Cancel To Queue
  CTQ_CANCEL_FAILED = 'CTQ_CANCEL_FAILED',
}

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
  EMIT_TASK_WRAPUP = 'emitTaskWrapup',
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
