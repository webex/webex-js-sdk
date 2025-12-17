/**
 * Task State Machine Actions
 *
 * Action implementations that are executed during state transitions.
 * Actions modify context and can be used by the state machine to trigger side effects.
 *
 * NOTE: These actions are meant to be used within XState assign() or as standalone action functions.
 * Event emission and UI control updates will be handled by the Task/Voice classes that use this state machine.
 *
 * Side effects such as emitting Task events or cleaning up WebRTC resources should stay in the
 * consumer classes (Task/Voice) by extending the action map passed into the machine. Keeping these
 * core actions pure makes the state machine predictable and easy to reason about.
 */

import {assign} from 'xstate';
import type {ActionFunctionMap, EventObject} from 'xstate';
import {TaskContext, TaskEventPayload, UIControlConfig} from './types';
import {TaskEvent, TaskState} from './constants';
import {TaskData} from '../types';
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

const determineConsultInitiator = (taskData?: TaskData): boolean | undefined => {
  if (taskData?.isConsulted === true) {
    return false;
  }

  if (taskData?.isConsulted === false) {
    // Avoid overriding initiator flag when backend simply repeats `false`
    return undefined;
  }

  const participants = taskData?.interaction?.participants;
  const destAgentId = taskData?.destAgentId;

  if (!participants || !destAgentId) {
    return undefined;
  }

  const participant = participants[destAgentId];
  if (!participant || participant.isConsulted === undefined) {
    return undefined;
  }

  return !participant.isConsulted;
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

  // Recording availability toggles when backend explicitly tells if the feature is on
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

/**
 * Copy latest backend payload into context.
 *
 * We intentionally replace the entire taskData reference instead of
 * merging individual fields so that the context always mirrors the
 * most recent socket payload (offer, assign, consult, recording, etc.).
 * Every downstream consumer can therefore rely on taskData being the
 * single source of truth, while derived values (like recording flags)
 * are recalculated here via deriveRecordingState.
 */
const deriveTaskDataUpdates = (_context: TaskContext, taskData: TaskData | undefined) =>
  taskData
    ? (() => {
        const updates: Partial<TaskContext> = {
          taskData,
          ...deriveRecordingState(taskData),
        };

        const consultInitiator = determineConsultInitiator(taskData);
        if (consultInitiator !== undefined) {
          updates.consultInitiator = consultInitiator;
        }

        return updates;
      })()
    : {};

const getTaskDataFromEvent = (event?: TaskEventPayload): TaskData | undefined =>
  event && typeof event === 'object' ? (event as any).taskData : undefined;

/**
 * Create initial context for a new task.
 *
 * Only include data here that CANNOT be derived from the state value itself.
 * Examples:
 *   - Latest backend payload (`taskData`) so actions/guards can read raw fields.
 *   - Flags that track who initiated the consult, destination info, or recording
 *     availability – these depend on payloads, not just the state enum.
 *   - The immutable UI control configuration and the last computed UI controls.
 *
 * Avoid storing duplicates of the current state (e.g. `isHeld`, `isConnected`),
 * because the state node already encodes that truth. Treat this context shape as
 * the contract new states/actions should follow when they need extra data.
 *
 * @param uiControlConfig - UI control configuration
 * @param initialState - Initial state for computing UI controls
 * @returns Initial context with UI controls
 */
export function createInitialContext(
  uiControlConfig: UIControlConfig,
  initialState: TaskState = TaskState.IDLE
): TaskContext {
  const baseContext: TaskContext = {
    taskData: null,
    acceptInitiated: false,
    holdInitiated: false,
    transferInitiated: false,
    conferenceInitiated: false,
    consultInitiator: false,
    consultDestination: null,
    consultDestinationAgentJoined: false,
    recordingControlsAvailable: false,
    recordingInProgress: false,
    uiControlConfig,
    uiControls: getDefaultUIControls(),
  };

  // Compute initial UI controls
  baseContext.uiControls = computeUIControls(initialState, baseContext);

  return baseContext;
}

/**
 * Helper to update UI controls after context changes
 * This should be called after any action that modifies context
 *
 * @param currentState - Current state machine state
 * @returns Assign action that updates UI controls
 */
export function updateUIControls(currentState: TaskState) {
  return assign(({context}: {context: TaskContext}) => ({
    uiControls: computeUIControls(currentState, context),
  }));
}

/**
 * Action implementations
 * These return XState assign actions that update the context
 */
export const actions: TaskActionsMap = {
  /**
   * Initialize task with offer data
   */
  initializeTask: assign(({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
    return {
      acceptInitiated: false,
      holdInitiated: false,
      transferInitiated: false,
      conferenceInitiated: false,
      ...deriveTaskDataUpdates(context, getTaskDataFromEvent(event)),
    };
  }),

  /**
   * Update task data from ASSIGN event
   */
  updateTaskData: assign(({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
    return deriveTaskDataUpdates(context, getTaskDataFromEvent(event));
  }),

  /**
   * Set consult initiator flag
   */
  setConsultInitiator: assign({
    consultInitiator: true,
  }),

  /**
   * Track accept flow state
   */
  setAcceptInitiated: assign({
    acceptInitiated: true,
  }),

  /**
   * Track hold flow state
   */
  setHoldInitiated: assign({
    holdInitiated: true,
  }),

  /**
   * Track transfer flow state
   */
  handleTransferInit: assign({
    transferInitiated: true,
  }),

  finalizeTransfer: assign({
    transferInitiated: false,
  }),

  /**
   * Handle consult-phase callbacks
   */
  handleConsultAccept: assign({
    consultDestinationAgentJoined: true,
  }),

  handleConsultCompletion: assign({
    consultDestinationAgentJoined: true,
  }),

  handleConsultFailed: assign({
    consultDestination: null,
    consultDestinationAgentJoined: false,
  }),

  handleConferenceInit: assign({
    conferenceInitiated: true,
  }),

  handleConferenceStarted: assign({
    conferenceInitiated: false,
  }),

  handleConferenceFailed: assign({
    conferenceInitiated: false,
  }),

  /**
   * Set consult destination details
   */
  setConsultDestination: assign(({event}: {event: TaskEventPayload}) => {
    if (!event || event.type !== TaskEvent.CONSULT || !('destination' in event)) {
      return {};
    }

    return {
      consultDestination: (event as {destination: string}).destination,
    };
  }),

  /**
   * Mark that consult destination agent has joined
   */
  setConsultAgentJoined: assign(({event}: {event: TaskEventPayload}) => {
    if (
      !event ||
      event.type !== TaskEvent.CONSULTING_ACTIVE ||
      !('consultDestinationAgentJoined' in event)
    ) {
      return {};
    }

    return {
      consultDestinationAgentJoined: (event as {consultDestinationAgentJoined: boolean})
        .consultDestinationAgentJoined,
    };
  }),

  /**
   * Set recording state
   */
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

  /**
   * Clear consult state
   */
  clearConsultState: assign({
    consultDestination: null,
    consultDestinationAgentJoined: false,
    conferenceInitiated: false,
  }),

  /**
   * Track hold state updates (currently no-op placeholder)
   */
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
      holdInitiated: false,
    };
  }),

  /**
   * Mark task as ended (currently no-op placeholder)
   */
  markEnded: assign(() => ({
    recordingControlsAvailable: false,
    recordingInProgress: false,
  })),

  /**
   * Cleanup resources on task completion (placeholder)
   */
  cleanupResources: () => {
    return undefined;
  },

  /**
   * Placeholder emitters that get overridden by consumers when needed
   * These are invoked by the state machine to trigger task events
   */
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
};

/**
 * NOTE FOR FUTURE ACTION HOOKS:
 * Once we emit Task events from the state machine instead of `TaskManager`,
 * provide custom actions when creating the machine (e.g. wrap
 * `createTaskStateMachineConfig` yourself). For example:
 *
 * ```ts
 * const customActions = {
 *   emitTaskAssigned: (context: TaskContext) => {
 *     task.emit(TASK_EVENTS.TASK_ASSIGNED, {
 *       interactionId: context.taskData?.interactionId,
 *       taskData: context.taskData,
 *     });
 *   },
 * };
 *
 * const machine = createMachine(getTaskStateMachineConfig(config), {
 *   actions: {...actions, ...customActions},
 * });
 * ```
 *
 * Only add such callbacks when the event payload has to be derived from the
 * latest state-machine context (e.g. wrap-up metadata, derived flags, etc.).
 * If the payload is ready as soon as the websocket message arrives, continue
 * emitting from `TaskManager` to avoid duplicating work inside the machine.
 * Keeping the hooks outside this file ensures the core actions stay pure while
 * still making it obvious where to place future side effects.
 */
