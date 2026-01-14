/**
 * Task State Machine Guards - Functions that determine if state transitions are allowed
 */

import {TaskContext, TaskEventPayload} from './types';
import {TaskData} from '../types';
import {
  getIsCustomerInCall,
  getConferenceParticipantsCount,
  getIsConferenceInProgress,
} from '../TaskUtils';
import {TaskEvent} from './constants';

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

export const getPrimaryMediaHoldFlag = (taskData?: TaskData | null): boolean | undefined => {
  if (!taskData) return undefined;
  const mediaId = taskData.mediaResourceId;
  if (!mediaId) return undefined;

  return taskData.interaction?.media?.[mediaId]?.isHold;
};

/**
 * Determines if this agent should enter WRAPPING_UP state.
 * Priority: agentsPendingWrapUp > wrapUpRequired / participant.isWrapUp > ownership > !isConsulted
 */
export const shouldWrapUpForThisAgent = (context: TaskContext, taskData: TaskData): boolean => {
  const selfAgentId = getSelfAgentId(context, taskData);
  if (!selfAgentId) return false;

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
  selfInMainCallFromEventOrContext: ({context, event}: GuardParams): boolean => {
    const eventTaskData = getTaskDataFromEvent(event);
    const taskData = eventTaskData ?? context.taskData;
    if (!taskData?.interaction) return false;

    const selfAgentId = getSelfAgentId(context, taskData);
    if (!selfAgentId) return false;

    const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;
    if (!mainCallId) return false;

    const mainCall = taskData.interaction.media?.[mainCallId];

    return Boolean(mainCall?.participants?.includes(selfAgentId));
  },

  backendReportsConference: ({context, event}: GuardParams): boolean => {
    const eventTaskData = getTaskDataFromEvent(event);
    const taskData = eventTaskData ?? context.taskData;

    return taskData?.interaction?.state === 'conference';
  },

  // Hydrate Guards
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

  // Conference Guards
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
    const eventTaskData = getTaskDataFromEvent(event);
    const taskData = eventTaskData ?? context.taskData;
    if (!taskData?.interaction || !taskData?.interactionId) return false;

    if (taskData.interaction.state === 'conference') return false;

    const count = getConferenceParticipantsCount(taskData.interaction, taskData.interactionId);

    return count < 2;
  },

  customerInCallFromEventOrContext: ({context, event}: GuardParams): boolean => {
    const eventTaskData = getTaskDataFromEvent(event);
    const taskData = eventTaskData ?? context.taskData;
    if (!taskData?.interaction) return false;
    const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;
    if (!mainCallId) return false;

    return getIsCustomerInCall(taskData.interaction, mainCallId);
  },
  isOwner: ({context, event}: GuardParams): boolean => {
    const eventTaskData = getTaskDataFromEvent(event);
    const taskData = eventTaskData ?? context.taskData;
    const selfAgentId = getSelfAgentId(context, taskData);
    if (!selfAgentId) return false;
    const owner = taskData?.interaction?.owner;

    return owner === selfAgentId;
  },

  conferenceActiveAndCustomerInCall: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (!taskData?.interaction) return false;
    const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;

    return (
      getIsConferenceInProgress(taskData) && getIsCustomerInCall(taskData.interaction, mainCallId)
    );
  },

  // Consult Guards
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

    return getIsConferenceInProgress(taskData) && !shouldWrapUpForThisAgent(context, taskData);
  },

  // Server State Guards
  serverReportsHeld: ({event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);

    return getPrimaryMediaHoldFlag(taskData) === true;
  },

  serverReportsConsulting: ({context, event}: GuardParams): boolean => {
    const taskData = getTaskDataFromEvent(event);
    if (taskData?.isConsulted === true) return true;

    return Boolean(context.consultInitiator && !taskData?.wrapUpRequired);
  },

  // Recording Guards
  recordingActive: ({context}: GuardParams): boolean => {
    return context.recordingControlsAvailable && context.recordingInProgress;
  },

  recordingPaused: ({context}: GuardParams): boolean => {
    return context.recordingControlsAvailable && !context.recordingInProgress;
  },
};

export type GuardName = keyof typeof guards;
