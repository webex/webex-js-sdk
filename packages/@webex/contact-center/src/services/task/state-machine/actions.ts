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
import {
  TaskContext,
  TaskEventPayload,
  isEventOfType,
  TaskEvent,
  UIControlConfig,
  TaskState,
} from './types';
import {TaskData} from '../types';
import {computeUIControls, getDefaultUIControls} from './uiControlsComputer';

/**
 * Create initial context for a new task
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
    if (isEventOfType(event, TaskEvent.OFFER) || isEventOfType(event, TaskEvent.OFFER_CONSULT)) {
      return deriveTaskDataUpdates(context, event.taskData);
    }

    return {};
  }),

  /**
   * Update task data from ASSIGN event
   */
  updateTaskData: assign((context: TaskContext, event: TaskEventPayload) => {
    if (isEventOfType(event, TaskEvent.ASSIGN)) {
      return deriveTaskDataUpdates(context, event.taskData);
    }
    if (isEventOfType(event, TaskEvent.CONSULT_CREATED)) {
      return deriveTaskDataUpdates(context, event.taskData);
    }

    return {};
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
    if (isEventOfType(event, TaskEvent.CONSULT)) {
      return {
        consultDestination: event.destination,
      };
    }

    return {};
  }),

  /**
   * Mark that consult destination agent has joined
   */
  setConsultAgentJoined: assign((context: TaskContext, event: TaskEventPayload) => {
    if (isEventOfType(event, TaskEvent.CONSULTING_ACTIVE)) {
      return {
        consultDestinationAgentJoined: event.consultDestinationAgentJoined,
      };
    }

    return {};
  }),

  /**
   * Set recording state
   */
  setRecordingState: assign((context: TaskContext, event: TaskEventPayload) => {
    if (isEventOfType(event, TaskEvent.PAUSE_RECORDING)) {
      return {
        recordingControlsAvailable: true,
        recordingInProgress: false,
      };
    }
    if (isEventOfType(event, TaskEvent.RESUME_RECORDING)) {
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
    if (
      isEventOfType(event, TaskEvent.HOLD_SUCCESS) ||
      isEventOfType(event, TaskEvent.UNHOLD_SUCCESS)
    ) {
      const mediaResourceId = event.mediaResourceId;
      const interaction = context.taskData?.interaction;
      const mediaEntry = interaction?.media?.[mediaResourceId];

      if (!interaction || !mediaEntry) {
        return {};
      }

      const updatedMedia = {
        ...interaction.media,
        [mediaResourceId]: {
          ...mediaEntry,
          isHold: isEventOfType(event, TaskEvent.HOLD_SUCCESS),
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
    }

    return {};
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

const deriveTaskDataUpdates = (_context: TaskContext, taskData: TaskData) => ({
  taskData,
  ...deriveRecordingState(taskData),
});

/**
 * Helper to create action implementations that will be used by Task/Voice classes
 * These factories allow the Task/Voice class to inject their own logic while keeping
 * the state machine pure and testable.
 */
export interface ActionCallbacks {
  onTaskIncoming?: (taskData: any) => void;
  onTaskAssigned?: (taskData: any) => void;
  onTaskHold?: (taskData: any) => void;
  onTaskResume?: (taskData: any) => void;
  onTaskConsultCreated?: (taskData: any) => void;
  onTaskConsulting?: (taskData: any) => void;
  onTaskConsultEnd?: (taskData: any) => void;
  onTaskEnd?: (taskData: any) => void;
  onTaskWrappedup?: (taskData: any) => void;
  onCleanupResources?: () => void;
}

/**
 * Create action implementations with callbacks
 * This allows the Task/Voice class to provide implementation for side effects
 */
export function createActionsWithCallbacks(callbacks: ActionCallbacks) {
  return {
    // Event emission actions
    emitTaskIncoming: (context: TaskContext) => {
      callbacks.onTaskIncoming?.(context.taskData);
    },
    emitTaskAssigned: (context: TaskContext) => {
      callbacks.onTaskAssigned?.(context.taskData);
    },
    emitTaskHold: (context: TaskContext) => {
      callbacks.onTaskHold?.(context.taskData);
    },
    emitTaskResume: (context: TaskContext) => {
      callbacks.onTaskResume?.(context.taskData);
    },
    emitTaskConsultCreated: (context: TaskContext) => {
      callbacks.onTaskConsultCreated?.(context.taskData);
    },
    emitTaskConsulting: (context: TaskContext) => {
      callbacks.onTaskConsulting?.(context.taskData);
    },
    emitTaskConsultEnd: (context: TaskContext) => {
      callbacks.onTaskConsultEnd?.(context.taskData);
    },
    emitTaskEnd: (context: TaskContext) => {
      callbacks.onTaskEnd?.(context.taskData);
    },
    emitTaskWrappedup: (context: TaskContext) => {
      callbacks.onTaskWrappedup?.(context.taskData);
    },

    // Cleanup action
    cleanupResources: () => {
      callbacks.onCleanupResources?.();
    },
  };
}
