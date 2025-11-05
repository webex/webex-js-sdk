/**
 * Task State Machine Guards
 *
 * Guard functions that determine if a state transition is allowed.
 * These functions validate the current context before allowing transitions.
 *
 * NOTE: Guards currently only use context parameter. TaskEventPayload is imported
 * for future use if guards need to inspect event data for more complex validations.
 * TODO: If guards need event data in the future, add event parameter back to guard signatures.
 */

import {StateValue} from 'xstate';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {TaskContext, TaskState, TaskEventPayload} from './types';

/**
 * Guard functions for state machine transitions
 */
export const guards = {
  /**
   * Can accept if in OFFERED or OFFERED_CONSULT state
   */
  canAccept: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.OFFERED || state === TaskState.OFFERED_CONSULT;
  },

  /**
   * Can only hold if connected and not already on hold
   */
  canHold: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    // Can only hold if in CONNECTED state (not already HELD)
    return state === TaskState.CONNECTED;
  },

  /**
   * Can only resume if currently held
   */
  canResume: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    // Can only resume if in HELD state
    return state === TaskState.HELD;
  },

  /**
   * Can only consult if not already in consult/conference
   */
  canConsult: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    // Can consult if in CONNECTED or HELD state (CONFERENCING is a separate state)
    return state === TaskState.CONNECTED || state === TaskState.HELD;
  },

  /**
   * Can only start conference if consult destination agent has joined
   */
  canStartConference: (
    context: TaskContext,
    event: any,
    meta: {state: {value: StateValue}}
  ): boolean => {
    const state = meta.state.value as TaskState;
    if (state !== TaskState.CONSULTING) {
      return false;
    }

    // Destination agent must have joined
    if (!context.consultDestinationAgentJoined) {
      return false;
    }

    return true;
  },

  /**
   * Can only transfer if not in certain states
   */
  canTransfer: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;
    // Can transfer from CONNECTED, HELD, or CONSULTING

    return (
      state === TaskState.CONNECTED || state === TaskState.HELD || state === TaskState.CONSULTING
    );
  },

  /**
   * Can only exit conference if actually in conference
   */
  canExitConference: (
    context: TaskContext,
    event: any,
    meta: {state: {value: StateValue}}
  ): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.CONFERENCING;
  },

  /**
   * Can only wrapup if in WRAPPING_UP state
   */
  canWrapup: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.WRAPPING_UP;
  },

  /**
   * Check if current task is from a consult offer
   * Now derived from state instead of context flag
   */
  isConsulted: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.CONSULTING;
  },

  /**
   * Check if conference is ending (less than 2 participants)
   */
  isConferenceEnding: (
    context: TaskContext,
    event: any,
    meta: {state: {value: StateValue}}
  ): boolean => {
    const state = meta.state.value as TaskState;
    if (state !== TaskState.CONFERENCING) {
      return false;
    }

    // Conference ends when fewer than 2 participants remain
    return context.participants.length < 2;
  },

  /**
   * Can merge consult to conference if in CONSULTING state and destination agent has joined
   */
  canMergeConsultToConference: (
    context: TaskContext,
    event: any,
    meta: {state: {value: StateValue}}
  ): boolean => {
    const state = meta.state.value as TaskState;

    return (
      state === TaskState.CONSULTING &&
      context.consultDestinationAgentJoined &&
      context.conferenceParticipants.length === 0
    );
  },

  /**
   * Can add participant to conference if in CONFERENCING state and not at max capacity
   */
  canAddToConference: (
    context: TaskContext,
    event: any,
    meta: {state: {value: StateValue}}
  ): boolean => {
    const state = meta.state.value as TaskState;

    return (
      state === TaskState.CONFERENCING &&
      context.conferenceParticipants.length < context.maxConferenceParticipants
    );
  },

  /**
   * Can transfer conference if initiator and in CONFERENCING state
   * Note: event parameter would be needed to check agentId, but keeping signature consistent
   */
  canTransferConference: (
    context: TaskContext,
    event: any,
    meta: {state: {value: StateValue}}
  ): boolean => {
    const state = meta.state.value as TaskState;
    if (state !== TaskState.CONFERENCING) {
      return false;
    }

    // In future, we'd check if the requesting agent is the initiator via event data
    // For now, check if there's an initiator set
    return context.conferenceInitiatorId !== null;
  },

  /**
   * Should end conference if fewer than 2 agents remain
   */
  shouldEndConference: (context: TaskContext): boolean => {
    const agentCount = context.conferenceParticipants.filter((p) => p.type === 'AGENT').length;

    return agentCount < 2;
  },

  /**
   * Check if recording is active
   */
  recordingActive: (context: TaskContext): boolean => {
    return context.recordingActive && !context.recordingPaused;
  },

  /**
   * Check if recording is paused
   */
  recordingPaused: (context: TaskContext): boolean => {
    return context.recordingActive && context.recordingPaused;
  },

  /**
   * Check if wrapup is required
   */
  wrapupRequired: (context: TaskContext): boolean => {
    return context.wrapUpRequired;
  },

  /**
   * Check if in connected state
   */
  isConnected: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.CONNECTED;
  },

  /**
   * Check if in held state
   */
  isHeld: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.HELD;
  },

  /**
   * Check if in consulting state
   */
  isConsulting: (context: TaskContext, event: any, meta: {state: {value: StateValue}}): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.CONSULTING;
  },

  /**
   * Check if in conferencing state
   */
  isConferencing: (
    context: TaskContext,
    event: any,
    meta: {state: {value: StateValue}}
  ): boolean => {
    const state = meta.state.value as TaskState;

    return state === TaskState.CONFERENCING;
  },

  /**
   * Check if user is consult initiator
   */
  isConsultInitiator: (context: TaskContext): boolean => {
    return context.consultInitiator;
  },

  /**
   * Check if interaction state is 'new' (for CONTACT_ENDED event)
   */
  isInteractionStateNew: (context: TaskContext): boolean => {
    if (!context.taskData || !context.taskData.interaction) {
      return false;
    }

    return context.taskData.interaction.state === 'new';
  },
};

/**
 * Helper function to check if operation is allowed in current state
 * This can be used from outside the state machine
 */
export function canPerformOperation(
  context: TaskContext,
  operation: keyof typeof guards,
  state: {value: StateValue}
): boolean {
  const guard = guards[operation];
  if (!guard) {
    return false;
  }

  return guard(context, null, {state});
}

/**
 * Validate state transition
 * Returns true if transition from current state to target state is valid
 */
export function isValidTransition(currentState: TaskState, targetState: TaskState): boolean {
  // Define valid transitions matrix
  const validTransitions: Record<TaskState, TaskState[]> = {
    [TaskState.IDLE]: [TaskState.OFFERED, TaskState.OFFERED_CONSULT],
    [TaskState.OFFERED]: [TaskState.CONNECTED, TaskState.TERMINATED],
    [TaskState.OFFERED_CONSULT]: [TaskState.CONSULTING, TaskState.TERMINATED],
    [TaskState.CONNECTED]: [
      TaskState.HELD,
      TaskState.CONSULTING,
      TaskState.WRAPPING_UP,
      TaskState.TERMINATED,
      TaskState.CONSULT_INITIATED, // NOT IMPLEMENTED: MPC state
    ],
    [TaskState.HELD]: [TaskState.CONNECTED, TaskState.CONSULTING],
    [TaskState.CONSULTING]: [
      TaskState.CONNECTED,
      TaskState.CONFERENCING,
      TaskState.WRAPPING_UP,
      TaskState.TERMINATED,
      TaskState.CONSULT_COMPLETED, // NOT IMPLEMENTED: MPC state
    ],
    [TaskState.CONFERENCING]: [
      TaskState.CONNECTED,
      TaskState.WRAPPING_UP,
      TaskState.TERMINATED,
      TaskState.POST_CALL, // NOT IMPLEMENTED: Post-call state
    ],
    [TaskState.WRAPPING_UP]: [TaskState.COMPLETED],
    [TaskState.COMPLETED]: [],
    [TaskState.TERMINATED]: [],
    // NOT IMPLEMENTED: MPC (Multi-Party Conference) states
    [TaskState.CONSULT_INITIATED]: [
      TaskState.CONSULTING,
      TaskState.CONSULT_COMPLETED,
      TaskState.TERMINATED,
    ],
    [TaskState.CONSULT_COMPLETED]: [TaskState.CONNECTED, TaskState.WRAPPING_UP],
    // NOT IMPLEMENTED: Post-call state
    [TaskState.POST_CALL]: [TaskState.WRAPPING_UP, TaskState.COMPLETED],
    // NOT IMPLEMENTED: Parked state
    [TaskState.PARKED]: [TaskState.CONNECTED, TaskState.TERMINATED],
    // NOT IMPLEMENTED: Monitoring state
    [TaskState.MONITORING]: [TaskState.IDLE, TaskState.TERMINATED],
  };

  const allowedTargets = validTransitions[currentState] || [];

  return allowedTargets.includes(targetState);
}
