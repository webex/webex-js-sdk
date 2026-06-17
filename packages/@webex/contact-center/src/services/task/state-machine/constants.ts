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
// Backend Interaction State Constants
// ============================================

/** Backend interaction state values (from server payloads) */
export const INTERACTION_STATE = {
  CONSULTING: 'consulting',
  POST_CALL: 'post_call',
  CONFERENCE: 'conference',
  CONNECTED: 'connected',
  NEW: 'new',
} as const;

/** Backend participant consultState values */
export const CONSULT_STATE = {
  CONSULTING: 'consulting',
  CONFERENCING: 'conferencing',
} as const;

// ============================================
// State Machine Enums
// ============================================

export enum TaskState {
  IDLE = 'IDLE',
  OFFERED = 'OFFERED',
  CONNECTED = 'CONNECTED',

  // Intermediate states for async operations
  HOLD_INITIATING = 'HOLD_INITIATING',
  HELD = 'HELD',
  RESUME_INITIATING = 'RESUME_INITIATING',
  CONSULT_INITIATING = 'CONSULT_INITIATING',
  CONSULTING = 'CONSULTING',
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
  OFFER_CONSULT = 'OFFER_CONSULT',
  HYDRATE = 'HYDRATE',

  // Internal "data refresh" events
  CONTACT_UPDATED = 'CONTACT_UPDATED',
  CONTACT_OWNER_CHANGED = 'CONTACT_OWNER_CHANGED',

  // Assignment events
  ASSIGN = 'ASSIGN',

  // Hold/Resume events
  HOLD_SUCCESS = 'HOLD_SUCCESS',
  HOLD_FAILED = 'HOLD_FAILED',
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
  CONSULT_FAILED = 'CONSULT_FAILED',

  // Conference events
  MERGE_TO_CONFERENCE = 'MERGE_TO_CONFERENCE',
  CONFERENCE_START = 'CONFERENCE_START',
  CONFERENCE_FAILED = 'CONFERENCE_FAILED',
  CONFERENCE_END = 'CONFERENCE_END',
  TRANSFER_CONFERENCE = 'TRANSFER_CONFERENCE',
  TRANSFER_CONFERENCE_SUCCESS = 'TRANSFER_CONFERENCE_SUCCESS',
  TRANSFER_CONFERENCE_FAILED = 'TRANSFER_CONFERENCE_FAILED',
  PARTICIPANT_LEAVE = 'PARTICIPANT_LEAVE',
  EXIT_CONFERENCE = 'EXIT_CONFERENCE',
  EXIT_CONFERENCE_SUCCESS = 'EXIT_CONFERENCE_SUCCESS',
  EXIT_CONFERENCE_FAILED = 'EXIT_CONFERENCE_FAILED',

  // Recording events
  RECORDING_STARTED = 'RECORDING_STARTED',
  PAUSE_RECORDING = 'PAUSE_RECORDING',
  RESUME_RECORDING = 'RESUME_RECORDING',

  // Transfer events
  TRANSFER_SUCCESS = 'TRANSFER_SUCCESS',
  TRANSFER_FAILED = 'TRANSFER_FAILED',

  // Wrapup events
  WRAPUP_COMPLETE = 'WRAPUP_COMPLETE',

  // End events
  TASK_WRAPUP = 'TASK_WRAPUP',
  RONA = 'RONA', // Ring On No Answer
  CONTACT_ENDED = 'CONTACT_ENDED',

  // Failure events
  ASSIGN_FAILED = 'ASSIGN_FAILED',
  INVITE_FAILED = 'INVITE_FAILED',
  OUTBOUND_FAILED = 'OUTBOUND_FAILED',
  CAMPAIGN_PREVIEW_ACCEPT_FAILED = 'CAMPAIGN_PREVIEW_ACCEPT_FAILED',
  CAMPAIGN_PREVIEW_SKIP_FAILED = 'CAMPAIGN_PREVIEW_SKIP_FAILED',
  CAMPAIGN_PREVIEW_REMOVE_FAILED = 'CAMPAIGN_PREVIEW_REMOVE_FAILED',

  // Switch events (toggle between consult and main call)
  SWITCH_TO_MAIN_CALL = 'SWITCH_TO_MAIN_CALL',
  SWITCH_TO_CONSULT = 'SWITCH_TO_CONSULT',

  // Accept/Decline (WebRTC)
  ACCEPT = 'ACCEPT',
  DECLINE = 'DECLINE',
  END = 'END',

  // Queue events
  CTQ_CANCEL = 'CTQ_CANCEL', // Cancel To Queue
  CTQ_CANCEL_FAILED = 'CTQ_CANCEL_FAILED',
}
