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

const deriveTaskDataUpdates = (context: TaskContext, taskData: TaskData | undefined) =>
  taskData
    ? (() => {
        const updates: Partial<TaskContext> = {
          taskData,
          ...deriveRecordingState(taskData),
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
            const hasJoinedConsultee = Boolean(
              taskData.interaction.participants &&
                Object.values(taskData.interaction.participants).some(
                  (p: any) => p?.isConsulted === true && !p?.hasLeft
                )
            );
            if (hasJoinedConsultee) updates.consultDestinationAgentJoined = true;
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
