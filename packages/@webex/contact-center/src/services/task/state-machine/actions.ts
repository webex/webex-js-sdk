/**
 * Task State Machine Actions
 *
 * Action implementations that are executed during state transitions.
 * Actions modify context and can be used by the state machine to trigger side effects.
 *
 * NOTE: These actions are meant to be used within XState assign() or as standalone action functions.
 * Event emission and UI control updates will be handled by the Task/Voice classes that use this state machine.
 *
 * TODO: Event emission logic will be integrated with existing Task EventEmitter pattern.
 * TODO: Resource cleanup logic will be added to handle WebRTC and other resources.
 */

import {assign} from 'xstate';
import {TaskContext, TaskEventPayload, TaskEvent, UIControlConfig, TaskState} from './types';
import {TaskData} from '../types';
import {computeUIControls, getDefaultUIControls} from './uiControlsComputer';

type RecordingStateUpdate = Partial<
  Pick<TaskContext, 'recordingControlsAvailable' | 'recordingInProgress'>
>;

const deriveRecordingState = (taskData?: TaskData | null): RecordingStateUpdate => {
  const callProcessingDetails = taskData?.interaction?.callProcessingDetails;

  if (!callProcessingDetails) {
    return {};
  }

  const update: RecordingStateUpdate = {};
  const {recordingStarted, recordInProgress} = callProcessingDetails;

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
const deriveTaskDataUpdates = (_context: TaskContext, taskData: TaskData) => ({
  taskData,
  ...deriveRecordingState(taskData),
});

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
  return assign((context: TaskContext) => ({
    uiControls: computeUIControls(currentState, context),
  }));
}

/**
 * Action implementations
 * These return XState assign actions that update the context
 */
export const actions = {
  /**
   * Initialize task with offer data
   */
  initializeTask: assign((context: TaskContext, event: TaskEventPayload) => {
    // Guard not needed in this action because the state machine only references
    // initializeTask from OFFER/OFFER_CONSULT transitions, both of which carry taskData.
    const {taskData} = event as Extract<TaskEventPayload, {taskData: TaskData}>;

    return deriveTaskDataUpdates(context, taskData);
  }),

  /**
   * Update task data from ASSIGN event
   */
  updateTaskData: assign((context: TaskContext, event: TaskEventPayload) => {
    const {taskData} = event as Extract<TaskEventPayload, {taskData: TaskData}>;

    return deriveTaskDataUpdates(context, taskData);
  }),

  /**
   * Set consult initiator flag
   */
  setConsultInitiator: assign({
    consultInitiator: true,
  }),

  /**
   * Set consult destination details
   */
  setConsultDestination: assign((context: TaskContext, event: TaskEventPayload) => {
    const consultEvent = event as Extract<
      TaskEventPayload,
      {type: TaskEvent.CONSULT; destination: string}
    >;

    return {
      consultDestination: consultEvent.destination,
    };
  }),

  /**
   * Mark that consult destination agent has joined
   */
  setConsultAgentJoined: assign((context: TaskContext, event: TaskEventPayload) => {
    const consultingActive = event as Extract<
      TaskEventPayload,
      {type: TaskEvent.CONSULTING_ACTIVE; consultDestinationAgentJoined: boolean}
    >;

    return {
      consultDestinationAgentJoined: consultingActive.consultDestinationAgentJoined,
    };
  }),

  /**
   * Set recording state
   */
  setRecordingState: assign((context: TaskContext, event: TaskEventPayload) => {
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
  }),

  /**
   * Track hold state updates (currently no-op placeholder)
   */
  setHoldState: assign((context: TaskContext, event: TaskEventPayload) => {
    const holdEvent = event as Extract<
      TaskEventPayload,
      | {type: TaskEvent.HOLD_SUCCESS; mediaResourceId: string}
      | {type: TaskEvent.UNHOLD_SUCCESS; mediaResourceId: string}
    >;
    const mediaResourceId = holdEvent.mediaResourceId;
    const interaction = context.taskData?.interaction;
    const mediaEntry = interaction?.media?.[mediaResourceId];

    if (!interaction || !mediaEntry) {
      return {};
    }

    const updatedMedia = {
      ...interaction.media,
      [mediaResourceId]: {
        ...mediaEntry,
        isHold: holdEvent.type === TaskEvent.HOLD_SUCCESS,
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
