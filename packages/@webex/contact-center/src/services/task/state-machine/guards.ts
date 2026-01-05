/**
 * Task State Machine Guards
 *
 * Guard functions that determine if a state transition is allowed.
 * These functions validate the current context before allowing transitions.
 *
 * All guards now use a consistent object-based parameter structure for better
 * maintainability, type safety, and extensibility.
 */

import {StateValue} from 'xstate';
import {TaskContext, TaskEventPayload} from './types';
import {MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE} from './constants';
import {
  getIsCustomerInCall,
  getIsConsultInProgress,
  getConferenceParticipantsCount,
  getIsConferenceInProgress,
} from '../TaskUtils';

/**
 * Parameters passed to all guard functions
 */
export interface GuardParams {
  /** Task context containing all task-related data */
  context: TaskContext;
  /** Current state information */
  state?: {value: StateValue};
  /** Event that triggered the guard check (optional, for future use) */
  event?: TaskEventPayload;
}

/**
 * Guard function type - all guards follow this signature
 */
export type GuardFunction = (params: GuardParams) => boolean;

/**
 * Guard functions for state machine transitions
 * Includes guards for recording, conference, and consult scenarios
 */
export const guards = {
  // ============================================
  // Recording Guards
  // ============================================

  /**
   * Check if recording is active
   */
  recordingActive: ({context}: GuardParams): boolean => {
    return context.recordingControlsAvailable && context.recordingInProgress;
  },

  /**
   * Check if recording is paused
   */
  recordingPaused: ({context}: GuardParams): boolean => {
    return context.recordingControlsAvailable && !context.recordingInProgress;
  },

  // ============================================
  // Conference Guards
  // ============================================

  /**
   * Check if a conference is currently in progress
   */
  isConferenceInProgress: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) {
      return false;
    }

    return getIsConferenceInProgress(context.taskData);
  },

  /**
   * Check if maximum participants in conference has been reached
   * Per conference-spec.md: Max 7 agents + 1 customer
   */
  maxParticipantsReached: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return false;
    }

    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;
  },

  /**
   * Check if there's room for more participants in the conference
   */
  canAddParticipant: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return true; // Allow if we can't determine
    }

    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count < MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;
  },

  /**
   * Check if this is the last WxCC agent in the conference
   * Used to determine if exiting would end the call
   */
  isLastWxCCAgent: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return true;
    }

    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count <= 1;
  },

  /**
   * Check if conference should auto-downgrade to connected state
   */
  shouldDowngradeConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return false;
    }

    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count < 2;
  },

  // ============================================
  // Customer Guards
  // ============================================

  /**
   * Check if customer is currently in the call
   */
  customerInCall: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return false;
    }

    return getIsCustomerInCall(context.taskData.interaction, context.taskData.interactionId);
  },

  /**
   * Check if customer has left the call
   */
  customerNotInCall: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return true;
    }

    return !getIsCustomerInCall(context.taskData.interaction, context.taskData.interactionId);
  },

  // ============================================
  // Consult Guards
  // ============================================

  /**
   * Check if a consult is currently in progress
   */
  consultInProgress: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) {
      return false;
    }

    return getIsConsultInProgress(context.taskData.interaction);
  },

  /**
   * Check if no consult is currently in progress
   */
  noConsultInProgress: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) {
      return true;
    }

    return !getIsConsultInProgress(context.taskData.interaction);
  },

  /**
   * Check if the consulted destination agent has joined
   */
  consultDestinationAgentJoined: ({context}: GuardParams): boolean => {
    return context.consultDestinationAgentJoined === true;
  },

  /**
   * Check if the consult call is currently held
   */
  consultCallHeld: ({context}: GuardParams): boolean => {
    return context.consultCallHeld === true;
  },

  /**
   * Check if the consult call is not held (agent is on consult)
   */
  consultCallNotHeld: ({context}: GuardParams): boolean => {
    return context.consultCallHeld !== true;
  },

  /**
   * Check if the consult has been fully established
   */
  consultEstablished: ({context}: GuardParams): boolean => {
    return context.consultEstablished === true;
  },

  /**
   * Check if the current agent initiated the consult
   */
  isConsultInitiator: ({context}: GuardParams): boolean => {
    return context.consultInitiator === true;
  },

  /**
   * Check if the current agent was consulted (not the initiator)
   */
  isConsultedAgent: ({context}: GuardParams): boolean => {
    return context.consultInitiator === false;
  },

  // ============================================
  // Composite Guards (combine multiple conditions)
  // ============================================

  /**
   * Composite guard: Can agent initiate a consult
   */
  canConsult: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return false;
    }

    const interaction = context.taskData.interaction;
    const interactionId = context.taskData.interactionId;

    // 1. Must not be at max participants
    const count = getConferenceParticipantsCount(interaction, interactionId);
    if (count >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE) {
      return false;
    }

    // 2. Must not have consult already in progress
    if (getIsConsultInProgress(interaction)) {
      return false;
    }

    // 3. Customer must be in call
    if (!getIsCustomerInCall(interaction, interactionId)) {
      return false;
    }

    return true;
  },

  /**
   * Composite guard: Consult must be established and under max participants
   */
  canMergeToConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) {
      return false;
    }

    // Must have a consult destination agent joined
    if (!context.consultDestinationAgentJoined) {
      return false;
    }

    // Must not be at max participants
    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );
    if (count >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE) {
      return false;
    }

    return true;
  },

  /**
   * Composite guard: Can agent exit conference?
   * Per conference-spec.md: Must be in conference, and if consulting, certain restrictions apply
   */
  canExitConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) {
      return false;
    }

    // Check if we're in conference state
    const isConference = getIsConferenceInProgress(context.taskData);
    if (!isConference) {
      return false;
    }

    const isConsulting = getIsConsultInProgress(context.taskData.interaction);
    if (isConsulting) {
      return false;
    }

    return true;
  },

  /**
   * Composite guard: Primary agent can transfer when in conference
   */
  canTransferConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) {
      return false;
    }

    // Must be in conference
    const isConference = getIsConferenceInProgress(context.taskData);
    if (!isConference) {
      return false;
    }

    const isConsulting = getIsConsultInProgress(context.taskData.interaction);
    if (isConsulting) {
      return false;
    }

    return true;
  },
};
