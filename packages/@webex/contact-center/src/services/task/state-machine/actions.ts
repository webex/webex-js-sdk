/**
 * Task State Machine Actions - Action implementations executed during state transitions
 */

import {assign} from 'xstate';
import {
  TaskContext,
  TaskEventPayload,
  UIControlConfig,
  TaskActionsMap,
  TaskActionArgs,
  RecordingStateUpdate,
} from './types';
import {
  TaskEvent,
  TaskState,
  INTERACTION_STATE,
  CONSULT_STATE,
  MEDIA_TYPE_CONSULT,
} from './constants';
import {DestinationType, TaskData} from '../types';
import {computeUIControls, getDefaultUIControls} from './uiControlsComputer';
import {getIsConferenceInProgress} from '../TaskUtils';
import {hasActiveConsultInPostCall} from './guards';

const determineConsultInitiator = (
  taskData: TaskData | undefined,
  selfAgentId: string | undefined
): boolean | undefined => {
  if (!selfAgentId) return undefined;

  if (taskData?.consultingAgentId) {
    return taskData.consultingAgentId === selfAgentId;
  }

  if (taskData?.isConsulted === true) return false;

  return undefined;
};

const deriveRecordingState = (taskData?: TaskData | null): RecordingStateUpdate => {
  const callProcessingDetails = taskData?.interaction?.callProcessingDetails;

  if (!callProcessingDetails) {
    return {};
  }

  const update: RecordingStateUpdate = {};
  const {recordingStarted, recordInProgress, isPaused} = callProcessingDetails as {
    recordingStarted?: boolean;
    recordInProgress?: boolean;
    isPaused?: boolean;
  };

  if (recordingStarted !== undefined) {
    update.recordingControlsAvailable = recordingStarted;
    if (!recordingStarted) {
      update.recordingInProgress = false;
    }
  }

  if (recordInProgress !== undefined) {
    update.recordingControlsAvailable = recordInProgress || recordingStarted || false;
    update.recordingInProgress = recordInProgress;
  }

  if (
    update.recordingControlsAvailable === undefined &&
    update.recordingInProgress === undefined &&
    recordingStarted
  ) {
    update.recordingControlsAvailable = true;
    update.recordingInProgress = true;
  }

  if (isPaused !== undefined) {
    update.recordingControlsAvailable = true;
    update.recordingInProgress = !isPaused;
  }

  return update;
};

const isActiveConsultState = (taskData: TaskData | undefined, selfAgentId?: string): boolean => {
  if (taskData?.interaction?.state === INTERACTION_STATE.CONSULTING) return true;
  if (selfAgentId) {
    const selfParticipant = taskData?.interaction?.participants?.[selfAgentId] as any;
    const hasConsultMedia = Object.values(taskData?.interaction?.media ?? {}).some(
      (media: any) => media?.mType === MEDIA_TYPE_CONSULT
    );
    // Pending consult before destination joins stays HELD, not CONSULTING.
    if (
      selfParticipant?.consultState === 'consultInitiated' &&
      !hasJoinedConsultDestination(taskData, selfAgentId) &&
      hasConsultMedia &&
      taskData?.isConsulted === false
    ) {
      return false;
    }
    if (
      selfParticipant?.consultState === CONSULT_STATE.CONSULTING &&
      hasConsultMedia &&
      taskData?.isConsulted === false
    ) {
      return true;
    }
  }
  if (taskData?.interaction?.state === INTERACTION_STATE.POST_CALL && selfAgentId) {
    const selfParticipant = taskData.interaction?.participants?.[selfAgentId] as any;
    const hasConsultMedia = Object.values(taskData.interaction?.media ?? {}).some(
      (media: any) => media?.mType === MEDIA_TYPE_CONSULT
    );
    if (selfParticipant?.consultState === CONSULT_STATE.CONSULTING && hasConsultMedia) return true;
  }

  return false;
};

const isSelfConsultingOrPending = (
  taskData: TaskData | undefined,
  selfAgentId?: string
): boolean => {
  if (!taskData || !selfAgentId) return false;
  const selfParticipant = taskData?.interaction?.participants?.[selfAgentId] as any;

  return (
    selfParticipant?.consultState === CONSULT_STATE.CONSULTING ||
    selfParticipant?.consultState === 'consultInitiated'
  );
};

const isDnOnConsultMedia = (taskData: TaskData | undefined, selfAgentId?: string): boolean => {
  if (!taskData?.interaction?.participants) return false;

  const consultMedia: any = taskData.consultMediaResourceId
    ? taskData.interaction.media?.[taskData.consultMediaResourceId]
    : Object.values(taskData.interaction.media ?? {}).find(
        (m: any) => m?.mType === MEDIA_TYPE_CONSULT
      );
  const consultParticipantIds = new Set(consultMedia?.participants ?? []);
  if (consultParticipantIds.size === 0) return false;

  return Object.values(taskData.interaction.participants).some((p: any) => {
    if (!p || p.hasLeft || p.id === selfAgentId) return false;
    if (!consultParticipantIds.has(p.id)) return false;
    const pType = String(p.pType ?? '').toUpperCase();

    return pType === 'DN' || pType === 'EP-DN' || pType === 'EP_DN';
  });
};

const mapConsultDestinationType = (
  destinationType: string | undefined
): DestinationType | undefined => {
  if (!destinationType) return undefined;
  const normalized = String(destinationType).toUpperCase();
  if (normalized === 'DN' || normalized === 'EP-DN' || normalized === 'EP_DN') {
    return 'entryPoint' as DestinationType;
  }

  return destinationType as DestinationType;
};

const hasJoinedConsultDestination = (
  taskData: TaskData | undefined,
  selfAgentId?: string
): boolean => {
  if (!taskData?.interaction) return false;
  const participants = taskData.interaction.participants as any;
  const cpd = taskData.interaction.callProcessingDetails as any;
  const backendSaysJoined = cpd?.consultDestinationAgentJoined === 'true';
  if (backendSaysJoined) return true;
  if (!participants) return false;

  const effectiveSelfAgentId = selfAgentId ?? taskData.agentId;
  const selfParticipant = effectiveSelfAgentId
    ? (participants[effectiveSelfAgentId] as {consultState?: string} | undefined)
    : undefined;

  if (
    taskData.type === 'AgentConsulting' &&
    selfParticipant?.consultState === CONSULT_STATE.CONSULTING &&
    taskData.isConsulted === false &&
    isDnOnConsultMedia(taskData, effectiveSelfAgentId)
  ) {
    return true;
  }

  return Object.values(participants).some((p: any) => {
    if (!p || p.isConsulted !== true || p.hasLeft) return false;

    return p.hasJoined === true || p.consultState === CONSULT_STATE.CONSULTING;
  });
};

const deriveConsultCallHeldFromTaskData = (taskData: TaskData | undefined): boolean | undefined => {
  if (!taskData?.interaction) return undefined;

  const eventType = taskData.type;
  if (eventType === 'AgentContactHeld') return true;
  if (eventType === 'AgentContactUnheld') return false;

  const consultMediaId = taskData.consultMediaResourceId;

  const consultMedia: any = consultMediaId
    ? taskData.interaction.media?.[consultMediaId]
    : Object.values(taskData.interaction.media ?? {}).find(
        (m: any) => m?.mType === MEDIA_TYPE_CONSULT
      );

  if (!consultMedia) return undefined;

  return Boolean(consultMedia.isHold);
};

export const getTaskStateForUiControls = (
  taskData: TaskData | undefined,
  selfAgentId: string | undefined
): TaskState => {
  if (!taskData?.interaction) {
    return TaskState.IDLE;
  }

  if (taskData.interaction.isTerminated === true) {
    return TaskState.WRAPPING_UP;
  }

  if (isActiveConsultState(taskData, selfAgentId)) {
    return TaskState.CONSULTING;
  }

  if (
    taskData.interaction.state === INTERACTION_STATE.CONFERENCE ||
    getIsConferenceInProgress(taskData)
  ) {
    return TaskState.CONFERENCING;
  }

  const mainMediaId = taskData.interaction.mainInteractionId || taskData.interactionId;
  const isMainHeld = Boolean(
    mainMediaId && taskData.interaction.media?.[mainMediaId]?.isHold === true
  );
  if (taskData.interaction.state === 'hold' || isMainHeld) {
    return TaskState.HELD;
  }

  return TaskState.CONNECTED;
};

const deriveTaskDataUpdates = (context: TaskContext, taskData: TaskData | undefined) =>
  taskData
    ? (() => {
        const updates: Partial<TaskContext> = {
          taskData,
          ...deriveRecordingState(taskData),
        };

        const selfAgentId = context.uiControlConfig.agentId ?? taskData?.agentId;
        const consultingActive =
          isActiveConsultState(taskData, selfAgentId) ||
          hasActiveConsultInPostCall(taskData, selfAgentId);
        const conferenceFromPayload =
          taskData?.interaction?.state === INTERACTION_STATE.CONFERENCE ||
          getIsConferenceInProgress(taskData);
        const selfConsultingOrPending = isSelfConsultingOrPending(taskData, selfAgentId);
        const inferredConsultingInitiator =
          selfConsultingOrPending && taskData?.isConsulted === false;

        if (taskData.destAgentId) {
          const isEpDnWithStoredId =
            context.consultDestinationType === 'entryPoint' && context.consultDestinationAgentId;
          if (!isEpDnWithStoredId) {
            updates.consultDestinationAgentId = taskData.destAgentId;
          }
        }

        const isConsultTerminalEvent =
          taskData.type === 'AgentConsultEnded' || taskData.type === 'AgentConsultFailed';

        if (isConsultTerminalEvent) {
          updates.consultInitiator = false;
          updates.consultFromConference = false;
          updates.consultDestinationAgentJoined = false;
          updates.consultCallHeld = false;
          updates.consultDestinationType = null;
          updates.consultDestinationAgentId = null;
          updates.transferConferenceRequested = false;
        }

        if (consultingActive && taskData.destinationType) {
          updates.consultDestinationType = mapConsultDestinationType(taskData.destinationType);
        }

        if (!isConsultTerminalEvent && !context.consultInitiator) {
          const consultInitiator = determineConsultInitiator(taskData, selfAgentId);
          if (consultInitiator !== undefined) {
            updates.consultInitiator = consultInitiator;
          } else if (
            inferredConsultingInitiator ||
            (consultingActive && taskData.isConsulted === false)
          ) {
            updates.consultInitiator = true;
          }
        }

        const effectiveConsultInitiator = updates.consultInitiator ?? context.consultInitiator;
        if (
          !isConsultTerminalEvent &&
          effectiveConsultInitiator &&
          conferenceFromPayload &&
          (consultingActive || selfConsultingOrPending || Boolean(taskData?.consultMediaResourceId))
        ) {
          updates.consultFromConference = true;
        }

        if (
          !isConsultTerminalEvent &&
          (consultingActive || selfConsultingOrPending) &&
          taskData.interaction
        ) {
          const joinedConsultee = hasJoinedConsultDestination(taskData, selfAgentId);
          const selfParticipant = selfAgentId
            ? (taskData.interaction.participants?.[selfAgentId] as
                | {consultState?: string}
                | undefined)
            : undefined;
          const agentConsultingSelfJoined =
            taskData.type === 'AgentConsulting' &&
            effectiveConsultInitiator &&
            selfParticipant?.consultState === CONSULT_STATE.CONSULTING;

          if (joinedConsultee || agentConsultingSelfJoined) {
            updates.consultDestinationAgentJoined = true;
          } else if (selfParticipant?.consultState === 'consultInitiated') {
            updates.consultDestinationAgentJoined = false;
          }

          if (!context.consultDestinationType && !updates.consultDestinationType) {
            const hasEpDnParticipant = Boolean(
              taskData.interaction.participants &&
                Object.values(taskData.interaction.participants).some((p: any) => {
                  if (p?.hasLeft) return false;
                  const pType = String(p?.pType ?? '').toUpperCase();

                  return pType === 'EP-DN' || pType === 'EP_DN' || pType === 'DN';
                })
            );
            if (hasEpDnParticipant) updates.consultDestinationType = 'entryPoint' as any;
          }

          if (effectiveConsultInitiator) {
            const consultCallHeld = deriveConsultCallHeldFromTaskData(taskData);
            if (consultCallHeld !== undefined) {
              updates.consultCallHeld = consultCallHeld;
            }
          }
        }

        const nextContext = {
          ...context,
          ...updates,
        } as TaskContext;
        const inferredState = getTaskStateForUiControls(taskData, selfAgentId);

        updates.uiControls = computeUIControls(inferredState, nextContext, taskData);

        return updates;
      })()
    : {};

const getTaskDataFromEvent = (event?: TaskEventPayload): TaskData | undefined =>
  event && typeof event === 'object' ? (event as any).taskData : undefined;

export function createInitialContext(
  uiControlConfig: UIControlConfig,
  initialState: TaskState = TaskState.IDLE
): TaskContext {
  const baseContext: TaskContext = {
    taskData: null,
    consultInitiator: false,
    exitingConference: false,
    consultFromConference: false,
    transferConferenceRequested: false,
    consultDestinationType: null,
    consultDestinationAgentId: null,
    consultDestinationAgentJoined: false,
    consultCallHeld: false,
    recordingControlsAvailable: false,
    recordingInProgress: false,
    uiControlConfig,
    uiControls: getDefaultUIControls(),
  };

  baseContext.uiControls = computeUIControls(initialState, baseContext);

  return baseContext;
}

export function updateUIControls(currentState: TaskState) {
  return assign(({context}: TaskActionArgs) => ({
    uiControls: computeUIControls(currentState, context, context.taskData ?? undefined),
  }));
}

export const actions: TaskActionsMap = {
  initializeTask: assign(({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
    return {
      consultInitiator: false,
      exitingConference: false,
      consultDestinationType: null,
      consultDestinationAgentJoined: false,
      ...deriveTaskDataUpdates(context, getTaskDataFromEvent(event)),
    };
  }),

  /**
   * Update task data from ASSIGN event
   */
  updateTaskData: assign(({context, event}: TaskActionArgs) => {
    return deriveTaskDataUpdates(context, getTaskDataFromEvent(event));
  }),

  /**
   * Set consult initiator flag
   *
   * IMPORTANT: This action is called for CONSULT (user action) and CONSULT_CREATED (backend event).
   * For CONSULT (user action): The user explicitly clicked Consult, so they ARE the initiator.
   * For CONSULT_CREATED (backend event): Check taskData.isConsulted to determine if this agent
   * is the initiator. If isConsulted === true, this is Agent B (the consulted party), NOT the initiator.
   *
   * This prevents all agents in a conference from becoming consultInitiator when one agent
   * starts a new consult.
   */
  setConsultInitiator: assign(({event}: TaskActionArgs) => {
    const taskData = getTaskDataFromEvent(event);

    if (event.type === TaskEvent.CONSULT) return {consultInitiator: true};

    const selfAgentId = taskData?.agentId;
    const consultInitiator = determineConsultInitiator(taskData, selfAgentId);
    if (consultInitiator === true) return {consultInitiator: true};
    if (consultInitiator === false) return {consultInitiator: false};

    return {};
  }),

  handleConsultFailed: assign(({context, event}: TaskActionArgs) => {
    const taskData = getTaskDataFromEvent(event) ?? context.taskData;
    const cleared = {
      consultDestinationType: null,
      consultDestinationAgentId: null,
      consultDestinationAgentJoined: false,
      consultInitiator: false,
      exitingConference: false,
      consultCallHeld: false,
      consultFromConference: false,
      transferConferenceRequested: false,
    };
    const selfAgentId = context.uiControlConfig.agentId ?? taskData?.agentId;
    const nextContext = {...context, ...cleared, taskData} as TaskContext;
    const inferredState = getTaskStateForUiControls(taskData, selfAgentId);

    return {
      ...cleared,
      uiControls: computeUIControls(inferredState, nextContext, taskData),
    };
  }),
  handleConferenceStarted: assign({consultInitiator: false}),

  setConsultDestination: assign(({event}: TaskActionArgs) => {
    if (!event || event.type !== TaskEvent.CONSULT) {
      return {};
    }

    const taskData = getTaskDataFromEvent(event);
    const consultDestinationType =
      'destinationType' in event ? event.destinationType ?? null : null;
    const consultDestinationAgentId =
      ('destAgentId' in event ? event.destAgentId : null) ??
      ('destination' in event ? (event as any).destination : null) ??
      null;

    return {
      consultDestinationType,
      consultDestinationAgentId,
      consultDestinationAgentJoined: false,
      consultFromConference: false,
      taskData: {
        ...taskData,
        destAgentId: consultDestinationAgentId,
      },
    };
  }),

  setConsultFromConference: assign({consultFromConference: true}),

  forceConsultInitiator: assign({consultInitiator: true}),

  setConsultAgentJoined: assign(
    ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
      if (context.consultDestinationAgentJoined) {
        return {};
      }

      if (
        !event ||
        event.type !== TaskEvent.CONSULTING_ACTIVE ||
        !('consultDestinationAgentJoined' in event)
      ) {
        return {};
      }

      const eventValue = (event as {consultDestinationAgentJoined: boolean})
        .consultDestinationAgentJoined;

      return eventValue ? {consultDestinationAgentJoined: true} : {};
    }
  ),

  setRecordingState: assign(({event}: TaskActionArgs) => {
    if (!event || !('type' in event)) {
      return {};
    }

    if (event.type === TaskEvent.PAUSE_RECORDING) {
      return {
        recordingControlsAvailable: true,
        recordingInProgress: false,
      };
    }
    if (event.type === TaskEvent.RESUME_RECORDING) {
      return {
        recordingControlsAvailable: true,
        recordingInProgress: true,
      };
    }

    return {};
  }),

  clearConsultState: assign(({context, event}: TaskActionArgs) => {
    const cleared = {
      consultDestinationType: null,
      consultDestinationAgentId: null,
      consultDestinationAgentJoined: false,
      consultInitiator: false,
      exitingConference: false,
      consultCallHeld: false,
      consultFromConference: false,
      transferConferenceRequested: false,
    };
    const taskData = context.taskData ?? getTaskDataFromEvent(event);
    const selfAgentId = context.uiControlConfig.agentId ?? taskData?.agentId;
    const nextContext = {...context, ...cleared, taskData} as TaskContext;
    const inferredState = getTaskStateForUiControls(taskData, selfAgentId);

    return {
      ...cleared,
      uiControls: computeUIControls(inferredState, nextContext, taskData),
    };
  }),

  setTransferConferenceRequested: assign({transferConferenceRequested: true}),
  clearTransferConferenceRequested: assign({transferConferenceRequested: false}),

  setConsultCallHeld: assign({consultCallHeld: true}),
  clearConsultCallHeld: assign({consultCallHeld: false}),
  handleSwitchToMainCall: assign({consultCallHeld: true}),
  handleSwitchToConsult: assign({consultCallHeld: false}),

  handleConferenceFailed: assign(({event}: TaskActionArgs) => {
    const taskData = getTaskDataFromEvent(event);

    return taskData ? {taskData} : {};
  }),
  handleParticipantLeft: assign(({event}: TaskActionArgs) => {
    const taskData = getTaskDataFromEvent(event);

    return taskData ? {taskData} : {};
  }),

  setExitingConference: assign({exitingConference: true}),

  handleTransferConferenceSuccess: assign(({event}: TaskActionArgs) => {
    const taskData = getTaskDataFromEvent(event);

    return taskData ? {taskData} : {};
  }),

  setHoldState: assign(({context, event}: TaskActionArgs) => {
    if (
      !event ||
      (event.type !== TaskEvent.HOLD_SUCCESS && event.type !== TaskEvent.UNHOLD_SUCCESS)
    ) {
      return {};
    }

    const mediaResourceId =
      'mediaResourceId' in event
        ? (event as {mediaResourceId?: string}).mediaResourceId
        : undefined;

    if (!mediaResourceId) {
      return {};
    }

    const interaction = context.taskData?.interaction;
    const mediaEntry = interaction?.media?.[mediaResourceId];

    if (!interaction || !mediaEntry) {
      return {};
    }

    const updatedMedia = {
      ...interaction.media,
      [mediaResourceId]: {
        ...mediaEntry,
        isHold: event.type === TaskEvent.HOLD_SUCCESS,
      },
    };

    const updates: Partial<TaskContext> = {
      taskData: {
        ...(context.taskData as TaskData),
        interaction: {
          ...interaction,
          media: updatedMedia,
        },
      },
    };

    const consultMediaId = context.taskData?.consultMediaResourceId;
    const isConsultMedia = consultMediaId
      ? mediaResourceId === consultMediaId
      : mediaEntry?.mType === 'consult';

    if (isConsultMedia && context.consultInitiator) {
      updates.consultCallHeld = event.type === TaskEvent.HOLD_SUCCESS;
    }

    return updates;
  }),

  markEnded: assign(() => ({
    recordingControlsAvailable: false,
    recordingInProgress: false,
  })),

  requestAutoAnswer: () => undefined,
  requestCleanup: () => undefined,
  cleanupResources: () => undefined,

  // Event emitters - placeholders overridden by consumers
  emitTaskCampaignPreviewReservation: () => undefined,
  emitTaskCampaignPreviewAcceptFailed: () => undefined,
  emitTaskCampaignPreviewSkipFailed: () => undefined,
  emitTaskCampaignPreviewRemoveFailed: () => undefined,
  emitTaskIncoming: () => undefined,
  emitTaskHydrate: () => undefined,
  emitTaskOfferContact: () => undefined,
  emitTaskAssigned: () => undefined,
  emitTaskHold: () => undefined,
  emitTaskResume: () => undefined,
  emitTaskEnd: () => undefined,
  emitTaskOfferConsult: () => undefined,
  emitTaskConsultCreated: () => undefined,
  emitTaskConsulting: () => undefined,
  emitTaskConsultAccepted: () => undefined,
  emitTaskConsultEnd: () => undefined,
  emitTaskReject: () => undefined,
  emitTaskWrapup: () => undefined,
  emitTaskRecordingStarted: () => undefined,
  emitTaskRecordingPaused: () => undefined,
  emitTaskRecordingResumed: () => undefined,
  emitTaskWrappedup: () => undefined,
  emitTaskParticipantLeft: () => undefined,
  emitTaskConferenceStarted: () => undefined,
  emitTaskConferenceEnded: () => undefined,
  emitTaskExitConference: () => undefined,
  emitTaskTransferConference: () => undefined,
  emitTaskSwitchCall: () => undefined,
  emitTaskConferenceFailed: () => undefined,
  emitTaskTransferConferenceFailed: () => undefined,
  emitTaskOutdialFailed: () => undefined,
};
