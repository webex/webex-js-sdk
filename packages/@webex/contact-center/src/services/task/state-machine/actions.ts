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

        if (!context.consultInitiator) {
          const selfAgentId = context.uiControlConfig.agentId ?? taskData?.agentId;
          const consultInitiator = determineConsultInitiator(taskData, selfAgentId);
          if (consultInitiator !== undefined) updates.consultInitiator = consultInitiator;
        }

        // Force recording state for voice tasks to handle unreliable backend data
        const isVoiceTask = taskData?.interaction?.mediaType === 'telephony';
        if (isVoiceTask) {
          updates.recordingControlsAvailable = true;
          updates.recordingInProgress = true;
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
    transferRequested: false,
    consultDestinationType: null,
    consultDestinationAgentJoined: false,
    consultCallHeld: false,
    pendingEndConsult: false,
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

  forceConsultInitiator: assign({consultInitiator: true}),

  setConsultAgentJoined: assign(
    ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
      const updates: Partial<TaskContext> = {};

      if (!context.consultDestinationAgentJoined) {
        if (
          event &&
          event.type === TaskEvent.CONSULTING_ACTIVE &&
          'consultDestinationAgentJoined' in event
        ) {
          const eventValue = (event as {consultDestinationAgentJoined: boolean})
            .consultDestinationAgentJoined;
          if (eventValue) {
            updates.consultDestinationAgentJoined = true;
          }
        }
      }

      // Also initialize consultCallHeld from actual media state when consulting becomes active
      // This ensures sync even if no HOLD/UNHOLD event was processed yet
      const taskData = getTaskDataFromEvent(event);
      const consultMediaResourceId = taskData?.consultMediaResourceId;
      if (consultMediaResourceId && taskData?.interaction?.media) {
        const consultMedia = taskData.interaction.media[consultMediaResourceId];
        if (consultMedia) {
          // Derive consultCallHeld from whether consult media is held
          updates.consultCallHeld = consultMedia.isHold === true;
        }
      }

      return Object.keys(updates).length > 0 ? updates : {};
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

  enableRecordingControls: assign(() => ({
    recordingControlsAvailable: true,
  })),

  clearConsultState: assign(() => {
    return {
      consultDestinationType: null as DestinationType | null,
      consultDestinationAgentJoined: false,
      consultInitiator: false,
      exitingConference: false,
      consultCallHeld: false,
      consultFromConference: false,
      transferConferenceRequested: false,
      pendingEndConsult: false,
    };
  }),

  /**
   * Clear consult state but preserve consultFromConference flag.
   * Used when CONFERENCE_START arrives while in CONFERENCING state with an active
   * consult-from-conference. We need to preserve the flag so the agent can properly
   * transition to wrapup after transferring that consult.
   */
  clearConsultStatePreservingConferenceFlag: assign(({context}: TaskActionArgs) => {
    const preserveFlag = context.consultFromConference === true;
    return {
      consultDestinationType: context.consultFromConference ? context.consultDestinationType : null,
      consultDestinationAgentJoined: false,
      consultInitiator: preserveFlag ? context.consultInitiator : false,
      exitingConference: false,
      consultCallHeld: false,
      consultFromConference: preserveFlag,
      transferConferenceRequested: false,
      pendingEndConsult: false,
    };
  }),

  /**
   * Clear consult state but conditionally preserve consultInitiator and consultFromConference.
   * Used when CONSULT_END arrives but we expect TRANSFER_SUCCESS to follow.
   * For dial numbers, backend sends AgentConsultEnded before AgentConsultTransferred,
   * so we need to preserve consultInitiator for the wrapup transition.
   * For conference consult transfers, we also preserve consultFromConference to ensure
   * the agent transitions to wrapup even if the backend doesn't send wrapUpRequired=true.
   * Only preserves if transferRequested is true (transfer in progress).
   */
  clearConsultStatePreservingInitiator: assign(({context}: TaskActionArgs) => {
    const preserveInitiator = context.transferRequested === true;
    const currentInitiator = context.consultInitiator;
    const currentFromConference = context.consultFromConference;

    const newInitiator = preserveInitiator ? currentInitiator : false;
    const newFromConference = preserveInitiator ? currentFromConference : false;

    // Always explicitly set consultInitiator and consultFromConference to avoid XState ambiguity
    return {
      consultDestinationType: null as DestinationType | null,
      consultDestinationAgentJoined: false,
      consultInitiator: newInitiator,
      exitingConference: false,
      consultCallHeld: false,
      consultFromConference: newFromConference,
      transferConferenceRequested: false,
      pendingEndConsult: false,
    };
  }),

  setTransferRequested: assign(() => {
    return {transferRequested: true};
  }),
  clearTransferRequested: assign(() => {
    return {transferRequested: false};
  }),

  setTransferConferenceRequested: assign({transferConferenceRequested: true}),
  clearTransferConferenceRequested: assign({transferConferenceRequested: false}),

  setPendingEndConsult: assign({pendingEndConsult: true}),
  clearPendingEndConsult: assign({pendingEndConsult: false}),

  setConsultCallHeld: assign({consultCallHeld: true}),
  clearConsultCallHeld: assign({consultCallHeld: false}),
  handleSwitchToMainCall: assign(() => ({consultCallHeld: true})),
  handleSwitchToConsult: assign(() => ({consultCallHeld: false})),
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

    // Get taskData from event - this is the UPDATED data from backend
    // Don't use context.taskData because updateTaskData runs in parallel
    const eventTaskData = getTaskDataFromEvent(event);
    const interaction = eventTaskData?.interaction || context.taskData?.interaction;
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

    // During consulting: Derive consultCallHeld from actual media hold states
    // This ensures sessions stay in sync regardless of which build initiated the switch
    // Use consultMediaResourceId from EVENT taskData (the updated one)
    const consultMediaResourceId = eventTaskData?.consultMediaResourceId || context.taskData?.consultMediaResourceId;
    let updatedConsultCallHeld = context.consultCallHeld;

    // If we have a consult media, derive the state from whether it's held
    if (consultMediaResourceId) {
      // After updating media, check if consult media is held
      const consultMediaState = updatedMedia[consultMediaResourceId];
      if (consultMediaState) {
        // If consult media is held → we're on main call → consultCallHeld = true
        // If consult media is not held → we're on consult call → consultCallHeld = false
        updatedConsultCallHeld = consultMediaState.isHold === true;
      }
    }

    return {
      taskData: {
        ...(eventTaskData || context.taskData as TaskData),
        interaction: {
          ...interaction,
          media: updatedMedia,
        },
      },
      consultCallHeld: updatedConsultCallHeld,
    };
  }),

  markEnded: assign(() => ({
    recordingControlsAvailable: false,
    recordingInProgress: false,
  })),

  logStateTransition: () => {
    // State transition logging removed
  },

  requestAutoAnswer: () => undefined,
  requestCleanup: () => undefined,
  cleanupResources: () => undefined,
  requestEndConsultRetry: () => undefined,

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
  updateUIControlsAfterSwitch: () => undefined,
};
