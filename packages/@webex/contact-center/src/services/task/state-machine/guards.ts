/**
 * Task State Machine Guards
 *
 * Guard functions that determine if a state transition is allowed.
 * These functions validate the current context before allowing transitions.
 *
 * All guards are consolidated here for:
 * - Single source of truth
 * - Easy testing
 * - Reusability across state machine transitions
 *
 * Guards are organized by category:
 * 1. Helper Functions - Extract data from events/context
 * 2. Hydrate Guards - For state restoration on page refresh
 * 3. Conference Guards - Conference state checks
 * 4. Consult Guards - Consult flow checks
 * 5. Wrapup Guards - End-of-call flow checks
 * 6. Server State Guards - Check backend-reported state
 * 7. Composite Guards - Combine multiple conditions
 */

import {TaskContext, TaskEventPayload} from './types';
import {MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE} from './constants';
import {TaskData} from '../types';
import {
  getIsCustomerInCall,
  getIsConsultInProgress,
  getConferenceParticipantsCount,
  getIsConferenceInProgress,
} from '../TaskUtils';

// ============================================
// Helper Functions
// ============================================

/**
 * Extract taskData from event payload
 */
export const getTaskDataFromEvent = (event?: TaskEventPayload): TaskData | undefined =>
  event && typeof event === 'object' && 'taskData' in event
    ? (event as {taskData?: TaskData}).taskData
    : undefined;

/**
 * Get the current agent's ID from context or taskData
 */
export const getSelfAgentId = (context: TaskContext, taskData?: TaskData): string | undefined =>
  context.uiControlConfig?.agentId ?? context.taskData?.agentId ?? taskData?.agentId;

/**
 * Check if the current agent is the one who initiated the consult
 * Uses consultingAgentId from backend as source of truth
 */
export const isSelfConsultingAgent = (context: TaskContext, taskData?: TaskData): boolean => {
  const selfAgentId = getSelfAgentId(context, taskData);
  if (!selfAgentId) return false;

  return taskData?.consultingAgentId === selfAgentId;
};

/**
 * Get hold flag from primary media entry
 */
export const getPrimaryMediaHoldFlag = (taskData?: TaskData | null): boolean | undefined => {
  if (!taskData) return undefined;
  const mediaId = taskData.mediaResourceId;
  if (!mediaId) return undefined;

  return taskData.interaction?.media?.[mediaId]?.isHold;
};

/**
 * Determines if this agent should enter WRAPPING_UP state.
 * Priority: agentsPendingWrapUp > interaction.owner > isConsulted flag
 */
export const shouldWrapUpForThisAgent = (context: TaskContext, taskData?: TaskData): boolean => {
  const selfAgentId = getSelfAgentId(context, taskData);
  if (!selfAgentId) return false;

  // Priority 1: Backend-provided list (most reliable)
  const pending = taskData?.agentsPendingWrapUp;
  if (Array.isArray(pending) && pending.length > 0) {
    return pending.includes(selfAgentId);
  }

  // Priority 2: Current interaction owner should wrap
  const interactionOwner = taskData?.interaction?.owner ?? context.taskData?.interaction?.owner;
  if (interactionOwner) {
    return selfAgentId === interactionOwner;
  }

  // Priority 3: Fallback to isConsulted (primary = !isConsulted should wrap)
  const isConsulted = context.taskData?.isConsulted ?? taskData?.isConsulted;
  if (isConsulted === true) return false;
  if (isConsulted === false) return true;

  // Unknown - safer to not wrap
  return false;
};

// ============================================
// Guard Parameters Type
// ============================================

/**
 * Parameters passed to all guard functions
 * Compatible with XState's guard signature
 */
export interface GuardParams {
  context: TaskContext;
  event?: TaskEventPayload;
}

export type GuardFunction = (params: GuardParams) => boolean;

// ============================================
// Guards Object - All guards in one place
// ============================================

export const guards = {
  // ============================================
  // Hydrate Guards (for state restoration)
  // ============================================

  /**
   * Check if interaction is terminated (for hydrate → WRAPPING_UP)
   */
  isInteractionTerminated: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.isTerminated === true;
  },

  /**
   * Check if interaction state is consulting (for hydrate → CONSULTING)
   */
  isInteractionConsulting: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.state === 'consulting';
  },

  /**
   * Check if interaction state is hold (for hydrate → HELD)
   */
  isInteractionHeld: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.state === 'hold';
  },

  /**
   * Check if interaction state is connected (for hydrate → CONNECTED)
   */
  isInteractionConnected: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.state === 'connected';
  },

  /**
   * Check if conferencing by participant count (for hydrate → CONFERENCING)
   */
  isConferencingByParticipants: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;
    const mainCallId = taskData.interaction?.mainInteractionId || taskData.interactionId;
    const media = taskData.interaction?.media?.[mainCallId];
    const participants = taskData.interaction?.participants;
    if (!media?.participants || !participants) return false;
    let agentCount = 0;
    for (const pId of media.participants) {
      const p = participants[pId];
      if (p && p.pType !== 'Customer' && p.pType !== 'Supervisor' && !p.hasLeft) {
        agentCount += 1;
      }
    }

    return agentCount >= 2;
  },

  // ============================================
  // Conference Guards (from context)
  // ============================================

  /**
   * Check if a conference is currently in progress (from context)
   */
  isConferenceInProgress: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) return false;

    return getIsConferenceInProgress(context.taskData);
  },

  /**
   * Check if conference is in progress (from event taskData)
   */
  conferenceInProgressFromEvent: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData?.interaction) return false;

    return getIsConferenceInProgress(taskData);
  },

  /**
   * Check if NOT in conference (from event taskData)
   * Used to guard consult transitions that shouldn't happen during conference
   */
  notInConferenceFromEvent: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;

    return !getIsConferenceInProgress(taskData);
  },

  /**
   * Check if conference is active in either event or context
   * Used for consult failed fallback to CONFERENCING
   */
  conferenceActiveInEventOrContext: ({context, event}: GuardParams): boolean => {
    const eventTaskData = getTaskDataFromEvent(event);
    const conferenceInEvent = eventTaskData ? getIsConferenceInProgress(eventTaskData) : false;
    const conferenceInContext = context.taskData
      ? getIsConferenceInProgress(context.taskData)
      : false;

    return conferenceInEvent || conferenceInContext;
  },

  /**
   * Check if maximum participants in conference has been reached
   */
  maxParticipantsReached: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return false;
    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;
  },

  /**
   * Check if there's room for more participants
   */
  canAddParticipant: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return true;
    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count < MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;
  },

  /**
   * Check if this is the last WxCC agent in the conference
   */
  isLastWxCCAgent: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return true;
    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count <= 1;
  },

  /**
   * Check if conference should auto-downgrade (< 2 agents)
   */
  shouldDowngradeConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return false;
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
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return false;

    return getIsCustomerInCall(context.taskData.interaction, context.taskData.interactionId);
  },

  /**
   * Check if customer has left the call
   */
  customerNotInCall: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return true;

    return !getIsCustomerInCall(context.taskData.interaction, context.taskData.interactionId);
  },

  /**
   * Check if conference active AND customer still in call (from event)
   */
  conferenceActiveAndCustomerInCall: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData?.interaction) return false;
    const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;

    return (
      getIsConferenceInProgress(taskData) && getIsCustomerInCall(taskData.interaction, mainCallId)
    );
  },

  // ============================================
  // Consult Guards
  // ============================================

  /**
   * Check if a consult is currently in progress
   */
  consultInProgress: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) return false;

    return getIsConsultInProgress(context.taskData.interaction);
  },

  /**
   * Check if no consult is currently in progress
   */
  noConsultInProgress: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) return true;

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
   * Check if the consult call is not held
   */
  consultCallNotHeld: ({context}: GuardParams): boolean => {
    return context.consultCallHeld !== true;
  },

  /**
   * Check if the current agent initiated the consult
   */
  isConsultInitiator: ({context}: GuardParams): boolean => {
    return context.consultInitiator === true;
  },

  /**
   * Check if the current agent is NOT the consult initiator
   */
  isNotConsultInitiator: ({context}: GuardParams): boolean => {
    return !context.consultInitiator;
  },

  /**
   * Check if the current agent was consulted (not the initiator)
   */
  isConsultedAgent: ({context}: GuardParams): boolean => {
    return context.consultInitiator === false;
  },

  /**
   * Check if this agent initiated the consult (using event data)
   * Handles both consultingAgentId and fallback to context flag
   */
  didInitiateConsult: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (taskData?.isConsulted === true) return false;
    const didInitiate = taskData?.consultingAgentId
      ? isSelfConsultingAgent(context, taskData)
      : context.consultInitiator === true;

    return didInitiate;
  },

  /**
   * Check if this is the consulting agent OR being consulted
   * Used for CONSULT_CREATED transition in CONSULT_INITIATING
   */
  isConsultingAgentOrBeingConsulted: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    const selfAgentId = getSelfAgentId(context, taskData);
    const isConsultingAgent = Boolean(selfAgentId) && taskData?.consultingAgentId === selfAgentId;
    const isBeingConsulted = taskData?.isConsulted === true;

    return isConsultingAgent || isBeingConsulted;
  },

  /**
   * Check if consult initiator AND conference is active
   * Used for CONSULT_END → CONFERENCING transition
   */
  isInitiatorAndConferenceActive: ({context, event}: GuardParams): boolean => {
    if (!context.consultInitiator) return false;
    const eventTaskData = getTaskDataFromEvent(event);
    const conferenceInEvent = eventTaskData && getIsConferenceInProgress(eventTaskData);
    const conferenceInContext = context.taskData && getIsConferenceInProgress(context.taskData);

    return conferenceInEvent || conferenceInContext;
  },

  /**
   * Check if consult destination type is queue
   */
  isConsultQueueFlow: ({context}: GuardParams): boolean => {
    return context.consultDestinationType === 'queue';
  },

  // ============================================
  // Wrapup Guards
  // ============================================

  /**
   * Check if this agent should wrap up (from event)
   */
  shouldWrapUp: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return shouldWrapUpForThisAgent(context, taskData);
  },

  /**
   * Check if should NOT wrap up (from event)
   */
  shouldNotWrapUp: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return !shouldWrapUpForThisAgent(context, taskData);
  },

  /**
   * Check if wrapUpRequired in payload OR is consult initiator
   */
  shouldWrapUpOrIsInitiator: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return Boolean(taskData?.wrapUpRequired || context.consultInitiator);
  },

  /**
   * Check if conference active AND should not wrap up AND not exiting
   * Used for EXIT_CONFERENCE_SUCCESS to keep other agents in CONFERENCING
   */
  conferenceActiveAndNotWrappingAndNotExiting: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    const conferenceActive = taskData ? getIsConferenceInProgress(taskData) : false;

    return (
      conferenceActive && !shouldWrapUpForThisAgent(context, taskData) && !context.exitingConference
    );
  },

  /**
   * Check if agent is exiting conference
   */
  isExitingConference: ({context}: GuardParams): boolean => {
    return context.exitingConference === true;
  },

  /**
   * Check if conference active AND should not wrap up
   * Used for TRANSFER_CONFERENCE_SUCCESS to keep other agents in CONFERENCING
   */
  conferenceActiveAndNotWrapping: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    const conferenceActive = taskData ? getIsConferenceInProgress(taskData) : false;

    return conferenceActive && !shouldWrapUpForThisAgent(context, taskData);
  },

  // ============================================
  // Server State Guards
  // ============================================

  /**
   * Check if server reports call is held
   */
  serverReportsHeld: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return getPrimaryMediaHoldFlag(taskData) === true;
  },

  /**
   * Check if server reports consulting state
   */
  serverReportsConsulting: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (taskData?.isConsulted === true) return true;

    return Boolean(context.consultInitiator && !taskData?.wrapUpRequired);
  },

  // ============================================
  // Composite Guards
  // ============================================

  /**
   * Composite: Can agent initiate a consult
   */
  canConsult: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return false;
    const interaction = context.taskData.interaction;
    const interactionId = context.taskData.interactionId;
    const count = getConferenceParticipantsCount(interaction, interactionId);
    if (count >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE) return false;
    if (getIsConsultInProgress(interaction)) return false;
    if (!getIsCustomerInCall(interaction, interactionId)) return false;

    return true;
  },

  /**
   * Composite: Can merge to conference
   */
  canMergeToConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction || !context.taskData?.interactionId) return false;
    if (!context.consultDestinationAgentJoined) return false;
    const count = getConferenceParticipantsCount(
      context.taskData.interaction,
      context.taskData.interactionId
    );

    return count < MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;
  },

  /**
   * Composite: Can exit conference
   */
  canExitConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) return false;
    const isConference = getIsConferenceInProgress(context.taskData);
    if (!isConference) return false;
    const isConsulting = getIsConsultInProgress(context.taskData.interaction);
    if (isConsulting) return false;

    return true;
  },

  /**
   * Composite: Can transfer conference
   */
  canTransferConference: ({context}: GuardParams): boolean => {
    if (!context.taskData?.interaction) return false;
    const isConference = getIsConferenceInProgress(context.taskData);
    if (!isConference) return false;
    const isConsulting = getIsConsultInProgress(context.taskData.interaction);
    if (isConsulting) return false;

    return true;
  },

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
};

// Type for guard names (for state machine string references)
export type GuardName = keyof typeof guards;
