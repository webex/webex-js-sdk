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
  // If we don't know who "self" is, don't guess.
  if (!selfAgentId) return undefined;

  // If backend provides consultingAgentId, use it as the source of truth.
  if (taskData?.consultingAgentId) {
    return taskData.consultingAgentId === selfAgentId;
  }

  // Fall back: if this agent is explicitly marked as consulted, they are not initiator.
  if (taskData?.isConsulted === true) return false;

  // Otherwise, avoid guessing (prevents consult UI leakage).
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
const deriveTaskDataUpdates = (context: TaskContext, taskData: TaskData | undefined) =>
  taskData
    ? (() => {
        const updates: Partial<TaskContext> = {
          taskData,
          ...deriveRecordingState(taskData),
        };

        // IMPORTANT: Only derive consultInitiator if it's not already set to true.
        // Once an agent is the consult initiator, they remain so for the duration
        // of the consult flow. The setConsultInitiator action explicitly sets this
        // to true, and we should not override it with backend-derived values.
        // BUG FIX: Previously, every updateTaskData call would re-derive consultInitiator,
        // potentially overwriting the true value set by setConsultInitiator with false.
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
    exitingConference: false,
    consultDestination: null,
    consultDestinationType: null,
    consultDestinationAgentJoined: false,
    consultCallHeld: false,
    consultEstablished: false,
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
      consultInitiator: false,
      exitingConference: false,
      consultDestination: null,
      consultDestinationType: null,
      consultDestinationAgentJoined: false,
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
   *
   * IMPORTANT: This action is called for CONSULT (user action) and CONSULT_CREATED (backend event).
   * For CONSULT (user action): The user explicitly clicked Consult, so they ARE the initiator.
   * For CONSULT_CREATED (backend event): Check taskData.isConsulted to determine if this agent
   * is the initiator. If isConsulted === true, this is Agent B (the consulted party), NOT the initiator.
   *
   * This prevents all agents in a conference from becoming consultInitiator when one agent
   * starts a new consult.
   */
  setConsultInitiator: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    // User explicitly clicked Consult → initiator
    if (event.type === TaskEvent.CONSULT) return {consultInitiator: true};

    // Backend events: only the consultingAgentId should be the initiator.
    const selfAgentId = taskData?.agentId;
    const consultInitiator = determineConsultInitiator(taskData, selfAgentId);
    if (consultInitiator === true) return {consultInitiator: true};
    if (consultInitiator === false) return {consultInitiator: false};

    return {};
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
    consultInitiator: false,
  }),

  handleConferenceInit: assign({
    conferenceInitiated: true,
  }),

  handleConferenceStarted: assign({
    conferenceInitiated: false,
    // - Primary who merged doesn't incorrectly get consult UI when secondary consults
    // - Fresh consult from conference can set consultInitiator correctly for the actual initiator
    consultInitiator: false,
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

    const destinationType =
      'destinationType' in event
        ? (event as {destinationType?: DestinationType}).destinationType ?? null
        : null;

    return {
      consultDestination: (event as {destination: string}).destination,
      consultDestinationType: destinationType,
      // Reset to false when starting new consult - will be set true when agent accepts
      consultDestinationAgentJoined: false,
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
    consultDestinationType: null,
    consultDestinationAgentJoined: false,
    conferenceInitiated: false,
    consultInitiator: false,
    exitingConference: false,
    consultCallHeld: false,
    consultEstablished: false,
  }),

  // ============================================
  // Conference/Consult Call State Actions
  // ============================================

  /**
   * Set consultCallHeld flag to true
   * Indicates agent has switched from consult to main call
   */
  setConsultCallHeld: assign({
    consultCallHeld: true,
  }),

  /**
   * Clear consultCallHeld flag
   * Indicates agent has switched back to consult call
   */
  clearConsultCallHeld: assign({
    consultCallHeld: false,
  }),

  /**
   * Set consultEstablished flag to true
   * Indicates consult has been fully established (both parties connected)
   */
  setConsultEstablished: assign({
    consultEstablished: true,
  }),

  /**
   * Clear consultEstablished flag
   */
  clearConsultEstablished: assign({
    consultEstablished: false,
  }),

  /**
   * Handle switch to main call event
   * Sets consultCallHeld to true (consult is now held)
   */
  handleSwitchToMainCall: assign({
    consultCallHeld: true,
  }),

  /**
   * Handle switch to consult call event
   * Sets consultCallHeld to false (consult is now active)
   */
  handleSwitchToConsult: assign({
    consultCallHeld: false,
  }),

  /**
   * Handle participant joining conference
   */
  handleParticipantJoined: assign(({event}: {event: TaskEventPayload}) => {
    // Update taskData if provided in event
    const taskData = getTaskDataFromEvent(event);
    if (taskData) {
      return {taskData};
    }

    return {};
  }),

  /**
   * Handle participant leaving conference
   */
  handleParticipantLeft: assign(({event}: {event: TaskEventPayload}) => {
    // Update taskData if provided in event
    const taskData = getTaskDataFromEvent(event);
    if (taskData) {
      return {taskData};
    }

    return {};
  }),

  /**
   * Set exitingConference flag when agent initiates exit
   */
  setExitingConference: assign({
    exitingConference: true,
  }),

  /**
   * Handle successful exit from conference
   */
  handleExitConferenceSuccess: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    return {
      ...(taskData ? {taskData} : {}),
      conferenceInitiated: false,
      exitingConference: false, // Clear the flag after handling
    };
  }),

  /**
   * Handle failed exit from conference
   */
  handleExitConferenceFailed: assign({
    conferenceInitiated: false,
    exitingConference: false, // Clear the flag on failure too
  }),

  /**
   * Handle successful conference transfer
   */
  handleTransferConferenceSuccess: assign(({event}: {event: TaskEventPayload}) => {
    const taskData = getTaskDataFromEvent(event);

    return {
      ...(taskData ? {taskData} : {}),
      transferInitiated: false,
    };
  }),

  /**
   * Handle failed conference transfer
   */
  handleTransferConferenceFailed: assign({
    transferInitiated: false,
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

  // Conference event emitters (placeholders to be overridden by consumers)
  emitTaskParticipantJoined: () => undefined,
  emitTaskParticipantLeft: () => undefined,
  emitTaskConferenceStarted: () => undefined,
  emitTaskConferenceEnded: () => undefined,
  emitTaskExitConference: () => undefined,
  emitTaskTransferConference: () => undefined,
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
