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
 * 4. Customer Guards - Customer presence checks
 * 5. Consult Guards - Consult flow checks
 * 6. Wrapup Guards - End-of-call flow checks
 * 7. Server State Guards - Check backend-reported state
 * 8. Recording Guards - Recording state checks
 */

import {TaskContext, TaskEventPayload} from './types';
import {TaskData} from '../types';
import {
  getIsCustomerInCall,
  getConferenceParticipantsCount,
  getIsConferenceInProgress,
} from '../TaskUtils';
import {TaskEvent, INTERACTION_STATE, CONSULT_STATE, MEDIA_TYPE_CONSULT} from './constants';

export const getTaskDataFromEvent = (event?: TaskEventPayload): TaskData | undefined =>
  event && typeof event === 'object' && 'taskData' in event
    ? (event as {taskData?: TaskData}).taskData
    : undefined;

export const getSelfAgentId = (context: TaskContext, taskData?: TaskData): string | undefined =>
  context.uiControlConfig?.agentId ?? context.taskData?.agentId ?? taskData?.agentId;

export const isSelfConsultingAgent = (context: TaskContext, taskData?: TaskData): boolean => {
  const selfAgentId = getSelfAgentId(context, taskData);
  if (!selfAgentId) return false;

  return taskData?.consultingAgentId === selfAgentId;
};

/**
 * Detects an active consult during post_call state (customer left but agents still consulting).
 * Shared by hydration guard (isInteractionConsulting) and action (deriveTaskDataUpdates).
 */
export const hasActiveConsultInPostCall = (
  taskData: TaskData | undefined,
  selfAgentId?: string
): boolean => {
  if (taskData?.interaction?.state !== INTERACTION_STATE.POST_CALL || !selfAgentId) return false;

  const selfParticipant = taskData.interaction?.participants?.[selfAgentId];
  const hasConsultMedia = Object.values(taskData.interaction?.media ?? {}).some(
    (media) => (media as {mType?: string})?.mType === MEDIA_TYPE_CONSULT
  );

  return selfParticipant?.consultState === CONSULT_STATE.CONSULTING && hasConsultMedia;
};

/**
 * Determines if this agent should enter WRAPPING_UP state.
 * Priority: agentsPendingWrapUp > wrapUpRequired / participant.isWrapUp > ownership > !isConsulted
 */
export const shouldWrapUpForThisAgent = (
  context: TaskContext,
  taskData: TaskData,
  options?: {requireCustomerLeft?: boolean}
): boolean => {
  const selfAgentId = getSelfAgentId(context, taskData);
  if (!selfAgentId) return false;

  if (options?.requireCustomerLeft) {
    const cpd = taskData?.interaction?.callProcessingDetails;
    if (cpd?.hasCustomerLeft !== 'true') return false;
  }

  const pending = taskData?.agentsPendingWrapUp;
  if (Array.isArray(pending) && pending.length > 0) {
    return pending.includes(selfAgentId);
  }

  const participantWrapUp = taskData?.interaction?.participants?.[selfAgentId]?.isWrapUp === true;
  const wrapUpRequired = taskData?.wrapUpRequired === true;
  if (wrapUpRequired || participantWrapUp) {
    return true;
  }

  const owner = taskData?.interaction?.owner;
  if (owner && owner === selfAgentId) {
    return true;
  }

  if (taskData?.isConsulted === false) {
    return true;
  }

  return false;
};

export interface GuardParams {
  context: TaskContext;
  event?: TaskEventPayload;
}

export type GuardFunction = (params: GuardParams) => boolean;

export const guards = {
  // Hydrate Guards
  isInteractionTerminated: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    if (taskData?.interaction?.isTerminated === true) return true;

    const selfAgentId = getSelfAgentId(context, taskData);
    if (selfAgentId && taskData?.interaction?.participants?.[selfAgentId]?.isWrapUp === true) {
      return true;
    }

    return false;
  },

  isInteractionConsulting: ({event, context}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    if (taskData?.interaction?.state === INTERACTION_STATE.CONSULTING) return true;

    // EP_DN consulted agent: backend reports state as 'connected' but CPD indicates consult
    const cpd = taskData?.interaction?.callProcessingDetails;
    if (
      cpd?.relationshipType === 'consult' &&
      taskData?.interaction?.state === INTERACTION_STATE.CONNECTED
    ) {
      return true;
    }

    // Customer left during consult: interaction state is "post_call" but consult
    // between agents is still active. Detect via agent's consultState + consult media.
    if (hasActiveConsultInPostCall(taskData, getSelfAgentId(context, taskData))) {
      return true;
    }

    return false;
  },

  isInteractionHeld: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    if (taskData?.interaction?.state === 'hold') return true;

    const mainMediaId = taskData?.interaction?.mainInteractionId || taskData?.interactionId;
    if (mainMediaId && taskData?.interaction?.media?.[mainMediaId]?.isHold === true) {
      return true;
    }

    return false;
  },

  isInteractionConnected: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return taskData?.interaction?.state === INTERACTION_STATE.CONNECTED;
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

  // Conference Guards
  conferenceInProgressFromEvent: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData?.interaction) return false;

    return getIsConferenceInProgress(taskData);
  },

  /**
   * Conference downgrade check specifically for transitioning back to CONNECTED.
   *
   * Returns true only when:
   * - conference has downgraded (fewer than 2 active agent participants in main call)
   * - customer is still in the call
   * - current agent is still in the main call
   */
  shouldDowngradeConferenceToConnected: ({context, event}: GuardParams): boolean => {
    const eventTaskData = getTaskDataFromEvent(event);
    const taskData = eventTaskData ?? context.taskData;
    if (!taskData?.interaction) return false;

    const selfAgentId = getSelfAgentId(context, taskData);
    if (!selfAgentId) return false;

    const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;
    if (!mainCallId) return false;

    // Don't downgrade while backend still reports conference.
    if (taskData.interaction.state === INTERACTION_STATE.CONFERENCE) return false;

    const agentParticipantsCount = getConferenceParticipantsCount(taskData.interaction, mainCallId);
    if (agentParticipantsCount >= 2) return false;

    const customerInCall = getIsCustomerInCall(taskData.interaction, mainCallId);
    if (!customerInCall) return false;

    const selfInMainCall = Boolean(
      taskData.interaction.media?.[mainCallId]?.participants?.includes(selfAgentId)
    );

    return selfInMainCall;
  },

  // Consult Guards
  /**
   * Check if this agent initiated the consult (using event data)
   * Handles both consultingAgentId and fallback to context flag
   */
  didInitiateConsult: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (taskData?.isConsulted === true) return false;

    return taskData?.consultingAgentId
      ? isSelfConsultingAgent(context, taskData)
      : context.consultInitiator === true;
  },

  /**
   * EP-DN / consulted consult legs can arrive as AGENT_CONTACT_ASSIGNED without a preceding
   * AgentConsulting event. When that happens, we should enter CONSULTING (not CONNECTED).
   */
  isConsultingAssignment: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;

    const relationshipType = taskData.interaction?.callProcessingDetails?.relationshipType;

    return (
      taskData.isConsulted === true ||
      relationshipType === 'consult' ||
      taskData.interaction?.state === INTERACTION_STATE.CONSULTING
    );
  },

  // Wrapup Guards
  shouldWrapUp: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;

    if (event?.type === TaskEvent.CONFERENCE_END) {
      const selfAgentId = getSelfAgentId(context, taskData);
      if (!selfAgentId) return false;

      const pending = taskData?.agentsPendingWrapUp;
      if (Array.isArray(pending) && pending.length > 0) {
        return pending.includes(selfAgentId);
      }

      const participantWrapUp =
        taskData?.interaction?.participants?.[selfAgentId]?.isWrapUp === true;
      const wrapUpRequired = taskData?.wrapUpRequired === true;

      return wrapUpRequired || participantWrapUp;
    }

    return shouldWrapUpForThisAgent(context, taskData);
  },

  /**
   * Check if wrapUpRequired in payload OR is consult initiator
   */
  shouldWrapUpOrIsInitiator: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return Boolean(taskData?.wrapUpRequired || context.consultInitiator);
  },

  /**
   * True if PARTICIPANT_LEAVE indicates that *this* agent left the conference.
   *
   * Important: PARTICIPANT_LEAVE is broadcast to all agents in the conference.
   * Only the agent whose id matches the leaving participant should transition to
   * TERMINATED / WRAPPING_UP based on wrapup rules.
   */
  didCurrentAgentLeaveConference: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    const selfAgentId = getSelfAgentId(context, taskData);
    if (!selfAgentId) return false;

    const participantIdFromEvent =
      event && typeof event === 'object' && 'participantId' in event
        ? (event as {participantId?: string}).participantId
        : undefined;
    const participantId = participantIdFromEvent ?? taskData?.participantId;

    if (Boolean(participantId) && participantId === selfAgentId) {
      return true;
    }

    //    For EP-DN agents the backend removes the leaving participant entirely
    //    from the participants map (rather than setting hasLeft). If this task
    //    is in CONFERENCING (implied by the guard being evaluated here) but the
    //    agent is absent from the updated participants, they have left.
    const participants = taskData?.interaction?.participants;
    if (participants && !(selfAgentId in participants)) {
      return true;
    }

    return false;
  },

  // Server State Guards
  isPrimaryMediaOnHold: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData) return false;
    const mediaId = taskData.mediaResourceId;
    if (!mediaId) return false;

    return taskData.interaction?.media?.[mediaId]?.isHold === true;
  },
};

export type GuardName = keyof typeof guards;
