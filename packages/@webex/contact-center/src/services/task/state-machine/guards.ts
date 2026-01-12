/**
 * Task State Machine Guards
 *
 * Guard functions that determine if a state transition is allowed.
 * These functions validate the current context before allowing transitions.
 *
 * Guards are organized by category:
 * 1. Helper Functions - Extract data from events/context
 * 2. Hydrate Guards - For state restoration on page refresh
 * 3. Conference Guards - Conference state checks
 * 4. Consult Guards - Consult flow checks
 * 5. Wrapup Guards - End-of-call flow checks
 * 6. Server State Guards - Check backend-reported state
 * 7. Recording Guards - Recording state checks
 */

import {TaskContext, TaskEventPayload} from './types';
import {TaskData} from '../types';
import {
  getIsCustomerInCall,
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
 *
 * For simple calls (no ownership data): uses isConsulted flag
 * For conferences (has ownership data): uses owner check
 */
export const shouldWrapUpForThisAgent = (context: TaskContext, taskData: TaskData): boolean => {
  const selfAgentId = getSelfAgentId(context, taskData);
  if (!selfAgentId) return false;

  // Priority 1: Backend-provided explicit list (most reliable)
  const pending = taskData?.agentsPendingWrapUp;
  if (Array.isArray(pending) && pending.length > 0) {
    return pending.includes(selfAgentId);
  }

  const contextOwner = context.taskData?.interaction?.owner;
  const eventOwner = taskData?.interaction?.owner;

  if (context.exitingConference && contextOwner === selfAgentId) {
    return true;
  }

  // If there's ownership data, use it
  const interactionOwner = eventOwner ?? contextOwner;
  if (interactionOwner) {
    return selfAgentId === interactionOwner;
  }

  return !(context.taskData?.isConsulted ?? taskData?.isConsulted);
};

// ============================================
// Guard Parameters Type
// ============================================

export interface GuardParams {
  context: TaskContext;
  event?: TaskEventPayload;
}

export type GuardFunction = (params: GuardParams) => boolean;

// ============================================
// Guards Object
// ============================================

export const guards = {
  // ============================================
  // Hydrate Guards (for state restoration)
  // ============================================

  isInteractionTerminated: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.isTerminated === true;
  },

  isInteractionConsulting: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.state === 'consulting';
  },

  isInteractionHeld: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.state === 'hold';
  },

  isInteractionConnected: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.state === 'connected';
  },

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
  // Conference Guards
  // ============================================

  conferenceInProgressFromEvent: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData?.interaction) return false;

    return getIsConferenceInProgress(taskData);
  },

  notInConferenceFromEvent: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;

    return !getIsConferenceInProgress(taskData);
  },

  conferenceActiveInEventOrContext: ({context, event}: GuardParams): boolean => {
    const eventTaskData = getTaskDataFromEvent(event);
    const conferenceInEvent = eventTaskData ? getIsConferenceInProgress(eventTaskData) : false;
    const conferenceInContext = context.taskData
      ? getIsConferenceInProgress(context.taskData)
      : false;

    return conferenceInEvent || conferenceInContext;
  },

  shouldDowngradeConference: ({context, event}: GuardParams): boolean => {
    // Use EVENT data (new state) to determine if conference should downgrade
    // Context has old data at guard evaluation time
    const eventTaskData = getTaskDataFromEvent(event);
    const taskData = eventTaskData ?? context.taskData;

    if (!taskData?.interaction || !taskData?.interactionId) return false;
    const count = getConferenceParticipantsCount(taskData.interaction, taskData.interactionId);

    return count < 2;
  },

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

  isConsultInitiator: ({context}: GuardParams): boolean => {
    return context.consultInitiator === true;
  },

  isNotConsultInitiator: ({context}: GuardParams): boolean => {
    return !context.consultInitiator;
  },

  didInitiateConsult: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (taskData?.isConsulted === true) return false;

    return taskData?.consultingAgentId
      ? isSelfConsultingAgent(context, taskData)
      : context.consultInitiator === true;
  },

  isConsultingAgentOrBeingConsulted: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    const selfAgentId = getSelfAgentId(context, taskData);
    const isConsultingAgent = Boolean(selfAgentId) && taskData?.consultingAgentId === selfAgentId;
    const isBeingConsulted = taskData?.isConsulted === true;

    return isConsultingAgent || isBeingConsulted;
  },

  isInitiatorAndConferenceActive: ({context, event}: GuardParams): boolean => {
    if (!context.consultInitiator) return false;
    const eventTaskData = getTaskDataFromEvent(event);
    const conferenceInEvent = eventTaskData && getIsConferenceInProgress(eventTaskData);
    const conferenceInContext = context.taskData && getIsConferenceInProgress(context.taskData);

    return conferenceInEvent || conferenceInContext;
  },

  isConsultQueueFlow: ({context}: GuardParams): boolean => {
    return context.consultDestinationType === 'queue';
  },

  // ============================================
  // Wrapup Guards
  // ============================================

  shouldWrapUp: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;

    return shouldWrapUpForThisAgent(context, taskData);
  },

  shouldWrapUpOrIsInitiator: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return Boolean(taskData?.wrapUpRequired || context.consultInitiator);
  },

  conferenceActiveAndNotWrappingAndNotExiting: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;

    const conferenceActive = getIsConferenceInProgress(taskData);

    return (
      conferenceActive && !shouldWrapUpForThisAgent(context, taskData) && !context.exitingConference
    );
  },

  isExitingConference: ({context}: GuardParams): boolean => {
    return context.exitingConference === true;
  },

  conferenceActiveAndNotWrapping: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;

    const conferenceActive = getIsConferenceInProgress(taskData);

    return conferenceActive && !shouldWrapUpForThisAgent(context, taskData);
  },

  // ============================================
  // Server State Guards
  // ============================================

  serverReportsHeld: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return getPrimaryMediaHoldFlag(taskData) === true;
  },

  serverReportsConsulting: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (taskData?.isConsulted === true) return true;

    return Boolean(context.consultInitiator && !taskData?.wrapUpRequired);
  },

  // ============================================
  // Recording Guards
  // ============================================

  recordingActive: ({context}: GuardParams): boolean => {
    return context.recordingControlsAvailable && context.recordingInProgress;
  },

  recordingPaused: ({context}: GuardParams): boolean => {
    return context.recordingControlsAvailable && !context.recordingInProgress;
  },
};

export type GuardName = keyof typeof guards;
