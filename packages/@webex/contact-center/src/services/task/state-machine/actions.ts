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
import {TaskEvent, TaskState} from './constants';
import {DestinationType, TaskData} from '../types';
import {getIsConsultInProgressForConferenceControls} from '../TaskUtils';
import {computeUIControls, getDefaultUIControls} from './uiControlsComputer';

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

/**
 * Derives recording UI / guard flags from {@link TaskData.interaction.callProcessingDetails}.
 * Exported so {@link Task} can merge fresh task payloads into UI when no state machine event ran.
 */
export function deriveRecordingContextPatch(taskData?: TaskData | null): RecordingStateUpdate {
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
    const paused = isPaused === true || String(isPaused).toLowerCase() === 'true';
    update.recordingInProgress = !paused;
  }

  // Match {@link TaskFactory} default: pause/resume is allowed when pauseResumeEnabled is omitted.
  // Many payloads include queue/CAD fields but omit recordingStarted/recordInProgress until later;
  // without this, recording stays hidden and {@link Voice.pauseRecording} keeps failing prechecks.
  const pauseResumeAllowed =
    (callProcessingDetails as {pauseResumeEnabled?: boolean}).pauseResumeEnabled ?? true;

  if (update.recordingControlsAvailable === undefined && pauseResumeAllowed) {
    update.recordingControlsAvailable = true;
    if (update.recordingInProgress === undefined) {
      update.recordingInProgress = true;
    }
  }

  if (
    update.recordingControlsAvailable === true &&
    update.recordingInProgress === undefined &&
    pauseResumeAllowed
  ) {
    update.recordingInProgress = true;
  }

  return update;
}

const deriveTaskDataUpdates = (context: TaskContext, taskData: TaskData | undefined) =>
  taskData
    ? (() => {
        const updates: Partial<TaskContext> = {
          taskData,
          ...deriveRecordingContextPatch(taskData),
        };

        if (taskData.destAgentId) {
          updates.consultDestinationAgentId = taskData.destAgentId;
        }
        if (taskData.interaction?.state === 'consulting' && taskData.destinationType) {
          updates.consultDestinationType = taskData.destinationType as DestinationType;
        }

        if (!context.consultInitiator) {
          const selfAgentId = context.uiControlConfig.agentId ?? taskData?.agentId;
          const consultInitiator = determineConsultInitiator(taskData, selfAgentId);
          if (consultInitiator !== undefined) {
            updates.consultInitiator = consultInitiator;
          } else if (
            taskData.interaction?.state === 'consulting' &&
            taskData.isConsulted === false
          ) {
            updates.consultInitiator = true;
          }
        }

        if (taskData.interaction?.state === 'consulting') {
          if (!context.consultDestinationAgentJoined) {
            const selfAgentId = context.uiControlConfig.agentId ?? taskData?.agentId;
            const participants = taskData.interaction.participants;
            const hasJoinedConsulteeFromFlags = Boolean(
              participants &&
                Object.values(participants).some((p: any) => p?.isConsulted === true && !p?.hasLeft)
            );
            // EP-DN / telephony consult: consulted party may not carry isConsulted on participants
            const hasRemotePartyOnConsultMedia = Boolean(
              selfAgentId &&
                taskData.interaction.media &&
                Object.values(taskData.interaction.media).some((m: any) => {
                  if (m?.mType !== 'consult' || !Array.isArray(m.participants)) return false;

                  return m.participants.some((participantId: string) => {
                    if (participantId === selfAgentId) return false;
                    const p: any = participants?.[participantId];

                    return Boolean(p && !p.hasLeft);
                  });
                })
            );
            const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;
            const hasJoinedPerConferenceHeuristic = Boolean(
              selfAgentId &&
                getIsConsultInProgressForConferenceControls(
                  taskData.interaction,
                  mainCallId,
                  selfAgentId
                )
            );
            if (
              hasJoinedConsulteeFromFlags ||
              hasRemotePartyOnConsultMedia ||
              hasJoinedPerConferenceHeuristic
            ) {
              updates.consultDestinationAgentJoined = true;
            }
          }

          const effectiveConsultInitiator = updates.consultInitiator ?? context.consultInitiator;
          if (effectiveConsultInitiator) {
            const consultMediaId = taskData.consultMediaResourceId;
            const consultMedia: any = consultMediaId
              ? taskData.interaction.media?.[consultMediaId]
              : Object.values(taskData.interaction.media ?? {}).find(
                  (m: any) => m?.mType === 'consult'
                );
            if (consultMedia) {
              updates.consultCallHeld = Boolean(consultMedia.isHold);
            }
          }
        }

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
    uiControls: computeUIControls(currentState, context),
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

  handleConsultFailed: assign({consultDestinationAgentJoined: false, consultInitiator: false}),
  handleConferenceStarted: assign({consultInitiator: false}),

  setConsultDestination: assign(({event}: TaskActionArgs) => {
    if (!event || event.type !== TaskEvent.CONSULT) {
      return {};
    }

    const taskData = getTaskDataFromEvent(event);
    const consultDestinationType =
      'destinationType' in event ? event.destinationType ?? null : null;
    const consultDestinationAgentId = 'destAgentId' in event ? event.destAgentId ?? null : null;

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

  clearConsultState: assign({
    consultDestinationType: null,
    consultDestinationAgentId: null,
    consultDestinationAgentJoined: false,
    consultInitiator: false,
    exitingConference: false,
    consultCallHeld: false,
    consultFromConference: false,
    transferConferenceRequested: false,
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
