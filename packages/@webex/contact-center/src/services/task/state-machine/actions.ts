/**
 * Task State Machine Actions - Action implementations executed during state transitions
 */

import {assign} from 'xstate';
import type {ActionFunctionMap, EventObject} from 'xstate';
import {TaskContext, TaskEventPayload, UIControlConfig} from './types';
import {TaskEvent, TaskState} from './constants';
import {DestinationType, TaskData} from '../types';
import {computeUIControls, getDefaultUIControls} from './uiControlsComputer';

export type TaskActionsMap = ActionFunctionMap<
  TaskContext,
  TaskEventPayload,
  never,
  {type: string; params: undefined},
  never,
  never,
  EventObject
>;

type RecordingStateUpdate = Partial<
  Pick<TaskContext, 'recordingControlsAvailable' | 'recordingInProgress'>
>;

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

        if (!context.consultInitiator) {
          const selfAgentId = context.uiControlConfig.agentId ?? taskData?.agentId;
          const consultInitiator = determineConsultInitiator(taskData, selfAgentId);
          if (consultInitiator !== undefined) updates.consultInitiator = consultInitiator;
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
  return assign(({context}: {context: TaskContext}) => ({
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

  updateTaskData: assign(({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
    return deriveTaskDataUpdates(context, getTaskDataFromEvent(event));
  }),

  syncTaskDataFromEvent: () => undefined,

  setConsultInitiator: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    if (event.type === TaskEvent.CONSULT) return {consultInitiator: true};

    const selfAgentId = taskData?.agentId;
    const consultInitiator = determineConsultInitiator(taskData, selfAgentId);
    if (consultInitiator === true) return {consultInitiator: true};
    if (consultInitiator === false) return {consultInitiator: false};

    return {};
  }),

  setHoldInitiated: assign({}),
  handleTransferInit: assign({}),
  finalizeTransfer: assign({}),
  handleConferenceInit: assign({}),
  handleConferenceFailed: assign({}),

  handleConsultAccept: assign({consultDestinationAgentJoined: true}),
  handleConsultCompletion: assign({consultDestinationAgentJoined: true}),
  handleConsultFailed: assign({consultDestinationAgentJoined: false, consultInitiator: false}),
  handleConferenceStarted: assign({consultInitiator: false}),

  setConsultDestination: assign(({event}: {event: TaskEventPayload}) => {
    if (!event || event.type !== TaskEvent.CONSULT) {
      return {};
    }

    const destinationType =
      'destinationType' in event
        ? (event as {destinationType?: DestinationType}).destinationType ?? null
        : null;

    return {
      consultDestinationType: destinationType,
      consultDestinationAgentJoined: false,
      consultFromConference: false,
    };
  }),

  setConsultFromConference: assign({consultFromConference: true}),

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

  setRecordingState: assign(({event}: {event: TaskEventPayload}) => {
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

  handleParticipantJoined: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    return taskData ? {taskData} : {};
  }),

  handleParticipantLeft: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    return taskData ? {taskData} : {};
  }),

  setExitingConference: assign({exitingConference: true}),

  handleExitConferenceSuccess: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    return {
      ...(taskData ? {taskData} : {}),
      exitingConference: false,
    };
  }),

  handleExitConferenceFailed: assign({exitingConference: false}),

  handleTransferConferenceSuccess: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    return taskData ? {taskData} : {};
  }),

  handleTransferConferenceFailed: assign({}),

  setHoldState: assign(({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
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

    return {
      taskData: {
        ...(context.taskData as TaskData),
        interaction: {
          ...interaction,
          media: updatedMedia,
        },
      },
    };
  }),

  markEnded: assign(() => ({
    recordingControlsAvailable: false,
    recordingInProgress: false,
  })),

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
  emitTaskConsultQueueCancelled: () => undefined,
  emitTaskConsultQueueFailed: () => undefined,
  emitTaskReject: () => undefined,
  emitTaskWrapup: () => undefined,
  emitTaskRecordingStarted: () => undefined,
  emitTaskRecordingPaused: () => undefined,
  emitTaskRecordingPauseFailed: () => undefined,
  emitTaskRecordingResumed: () => undefined,
  emitTaskRecordingResumeFailed: () => undefined,
  emitTaskWrappedup: () => undefined,
  emitTaskParticipantJoined: () => undefined,
  emitTaskParticipantLeft: () => undefined,
  emitTaskConferenceStarted: () => undefined,
  emitTaskConferenceEnded: () => undefined,
  emitTaskExitConference: () => undefined,
  emitTaskTransferConference: () => undefined,
};
