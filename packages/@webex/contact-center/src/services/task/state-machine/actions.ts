/**
 * Task State Machine Actions
 *
 * Action implementations that are executed during state transitions.
 * Actions modify context and can be used by the state machine to trigger side effects.
 *
 * NOTE: These actions are meant to be used within XState assign() or as standalone action functions.
 * Event emission and UI control updates will be handled by the Task/Voice classes that use this state machine.
 *
 * TODO: Timer implementations (startRonaTimer, startAutoWrapupTimer) will be added to Task/Voice classes later.
 * TODO: Event emission logic will be integrated with existing Task EventEmitter pattern.
 * TODO: Resource cleanup logic will be added to handle WebRTC and other resources.
 */

import {assign} from 'xstate';
import {TaskContext, TaskState, TaskEventPayload, isEventOfType, TaskEvent} from './types';

/**
 * Create initial context for a new task
 */
export function createInitialContext(): TaskContext {
  return {
    taskData: null,
    currentState: TaskState.IDLE,
    previousState: null,
    mediaResourceId: null,
    isConsulted: false,
    consultInitiator: false,
    consultDestination: null,
    consultDestinationType: null,
    consultDestinationAgentJoined: false,
    consultMediaResourceId: null,
    isConferencing: false,
    conferenceInitiatorId: null,
    conferenceParticipants: [],
    maxConferenceParticipants: 10,
    participants: [], // DEPRECATED: Use conferenceParticipants instead
    isPrimary: false,
    recordingActive: false,
    recordingPaused: false,
    isHold: false,
    wrapUpRequired: false,
    autoWrapupTimer: null,
    ronaTimer: null,
    offeredAt: null,
    connectedAt: null,
    endedAt: null,
    // Action availability flags
    canHold: false,
    canResume: false,
    canConsult: false,
    canEndConsult: false,
    canTransfer: false,
    canWrapup: false,
  };
}

/**
 * Action implementations
 * These return XState assign actions that update the context
 */
export const actions = {
  /**
   * Initialize task with offer data
   */
  initializeTask: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.OFFER) || isEventOfType(event, TaskEvent.OFFER_CONSULT)) {
      return {
        taskData: event.taskData,
        offeredAt: Date.now(),
        isConsulted: event.type === TaskEvent.OFFER_CONSULT,
      };
    }

    return {};
  }),

  /**
   * Update task data from ASSIGN event
   */
  updateTaskData: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.ASSIGN)) {
      return {
        taskData: event.taskData,
        connectedAt: Date.now(),
      };
    }
    if (isEventOfType(event, TaskEvent.CONSULT_CREATED)) {
      return {
        taskData: event.taskData,
      };
    }

    return {};
  }),

  /**
   * Set consult initiator flag
   */
  setConsultInitiator: assign<TaskContext, TaskEventPayload>({
    consultInitiator: true,
  }),

  /**
   * Set consult destination details
   */
  setConsultDestination: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.CONSULT)) {
      return {
        consultDestination: event.destination,
        consultDestinationType: event.destinationType,
        isConsulted: true,
      };
    }

    return {};
  }),

  /**
   * Mark that consult destination agent has joined
   */
  setConsultAgentJoined: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.CONSULTING_ACTIVE)) {
      return {
        consultDestinationAgentJoined: event.consultDestinationAgentJoined,
      };
    }

    return {};
  }),

  /**
   * Set conferencing state (legacy - kept for backward compatibility)
   */
  setConferencing: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.CONFERENCE_START)) {
      const participantIds = event.participants?.map((p) => p.id) || [];

      return {
        isConferencing: true,
        conferenceParticipants: event.participants || [],
        participants: participantIds,
      };
    }

    return {};
  }),

  /**
   * Initialize conference with participants from consult
   */
  initializeConference: assign<TaskContext, TaskEventPayload>((context) => {
    const agentId = context.taskData?.agentId;
    const consultAgent = context.consultDestination;

    if (!agentId || !consultAgent) {
      return {};
    }

    return {
      isConferencing: true,
      conferenceInitiatorId: agentId,
      conferenceParticipants: [
        {
          id: agentId,
          type: 'AGENT' as const,
          joinedAt: new Date(),
          isInitiator: true,
          canBeRemoved: false,
        },
        {
          id: consultAgent,
          type: 'AGENT' as const,
          joinedAt: new Date(),
          isInitiator: false,
          canBeRemoved: true,
        },
      ],
      consultDestination: null,
      consultDestinationType: null,
      consultDestinationAgentJoined: false,
      consultMediaResourceId: null,
    };
  }),

  /**
   * Add a participant to conference
   */
  addParticipant: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.PARTICIPANT_JOIN)) {
      return {
        conferenceParticipants: [...context.conferenceParticipants, event.participant],
      };
    }

    return {};
  }),

  /**
   * Remove a participant from conference
   */
  removeParticipant: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.PARTICIPANT_LEAVE)) {
      return {
        conferenceParticipants: context.conferenceParticipants.filter(
          (p) => p.id !== event.participantId
        ),
      };
    }

    return {};
  }),

  /**
   * Update conference participants (handles both JOIN and LEAVE)
   */
  updateParticipants: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.PARTICIPANT_JOIN)) {
      return {
        conferenceParticipants: [...context.conferenceParticipants, event.participant],
        participants: [...context.participants, event.participant.id],
      };
    }
    if (isEventOfType(event, TaskEvent.PARTICIPANT_LEAVE)) {
      return {
        conferenceParticipants: context.conferenceParticipants.filter(
          (p) => p.id !== event.participantId
        ),
        participants: context.participants.filter((id) => id !== event.participantId),
      };
    }

    return {};
  }),

  /**
   * Clear conferencing state
   */
  clearConferencing: assign<TaskContext, TaskEventPayload>({
    isConferencing: false,
    conferenceInitiatorId: null,
    conferenceParticipants: [],
    participants: [],
  }),

  /**
   * Set hold state
   */
  setHoldState: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.HOLD)) {
      return {
        isHold: true,
        mediaResourceId: event.mediaResourceId,
      };
    }
    if (isEventOfType(event, TaskEvent.UNHOLD)) {
      return {
        isHold: false,
        mediaResourceId: event.mediaResourceId,
      };
    }

    return {};
  }),

  /**
   * Set recording state
   */
  setRecordingState: assign<TaskContext, TaskEventPayload>((context, event) => {
    if (isEventOfType(event, TaskEvent.PAUSE_RECORDING)) {
      return {
        recordingPaused: true,
      };
    }
    if (isEventOfType(event, TaskEvent.RESUME_RECORDING)) {
      return {
        recordingPaused: false,
      };
    }

    return {};
  }),

  /**
   * Update state tracking
   */
  updateState: assign<TaskContext, TaskEventPayload>((context) => {
    return {
      previousState: context.currentState,
    };
  }),

  /**
   * Mark task as ended
   */
  markEnded: assign<TaskContext, TaskEventPayload>({
    endedAt: Date.now(),
  }),

  /**
   * Clear consult state
   */
  clearConsultState: assign<TaskContext, TaskEventPayload>({
    consultDestination: null,
    consultDestinationType: null,
    consultDestinationAgentJoined: false,
  }),

  /**
   * Stop RONA timer
   */
  stopRonaTimer: assign<TaskContext, TaskEventPayload>({
    ronaTimer: null,
  }),

  /**
   * Stop auto-wrapup timer
   */
  stopAutoWrapupTimer: assign<TaskContext, TaskEventPayload>({
    autoWrapupTimer: null,
  }),
};

/**
 * Side-effect action creators
 * These are functions that will be called by the state machine to perform side effects.
 * They don't modify context directly, but trigger external effects like:
 * - Starting timers
 * - Logging
 * - Emitting events (handled by Task/Voice class)
 * - Cleaning up resources
 */
export const sideEffects = {
  /**
   * Start RONA (Ring On No Answer) timer
   * This should be implemented by the caller to start an actual timer that sends RONA event after timeout
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startRonaTimer: (context: TaskContext, event: TaskEventPayload) => {
    // Implementation will be provided by Task/Voice class
    // The class will start a timer and send RONA event when it expires
  },

  /**
   * Start auto-wrapup timer
   * Implementation provided by Task/Voice class
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startAutoWrapupTimer: (context: TaskContext, event: TaskEventPayload) => {
    // Implementation will be provided by Task/Voice class
  },

  /**
   * Cleanup resources on task end
   * Implementation provided by Task/Voice class to:
   * - Stop timers
   * - Release WebRTC resources
   * - Clean up event listeners
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cleanupResources: (context: TaskContext, event: TaskEventPayload) => {
    // Implementation will be provided by Task/Voice class
  },
};

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
  onTaskConferenceStarted?: (taskData: any) => void;
  onTaskConferenceEnded?: (taskData: any) => void;
  onTaskEnd?: (taskData: any) => void;
  onTaskWrappedup?: (taskData: any) => void;
  onStartRonaTimer?: (timeout: number) => number | null;
  onStopRonaTimer?: (timerId: number | null) => void;
  onStartAutoWrapupTimer?: (timeout: number) => number | null;
  onStopAutoWrapupTimer?: (timerId: number | null) => void;
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
    emitTaskConferenceStarted: (context: TaskContext) => {
      callbacks.onTaskConferenceStarted?.(context.taskData);
    },
    emitTaskConferenceEnded: (context: TaskContext) => {
      callbacks.onTaskConferenceEnded?.(context.taskData);
    },
    emitTaskEnd: (context: TaskContext) => {
      callbacks.onTaskEnd?.(context.taskData);
    },
    emitTaskWrappedup: (context: TaskContext) => {
      callbacks.onTaskWrappedup?.(context.taskData);
    },

    // Timer actions
    startRonaTimer: () => {
      if (callbacks.onStartRonaTimer) {
        const timerId = callbacks.onStartRonaTimer(30000); // 30 seconds default
        if (timerId !== null) {
          // Store timer ID in context via assign action
          return assign<TaskContext>({ronaTimer: timerId});
        }
      }

      return undefined;
    },
    stopRonaTimer: (context: TaskContext) => {
      if (callbacks.onStopRonaTimer && context.ronaTimer) {
        callbacks.onStopRonaTimer(context.ronaTimer);
      }
    },
    startAutoWrapupTimer: () => {
      if (callbacks.onStartAutoWrapupTimer) {
        const timerId = callbacks.onStartAutoWrapupTimer(60000); // 60 seconds default
        if (timerId !== null) {
          return assign<TaskContext>({autoWrapupTimer: timerId});
        }
      }

      return undefined;
    },
    stopAutoWrapupTimer: (context: TaskContext) => {
      if (callbacks.onStopAutoWrapupTimer && context.autoWrapupTimer) {
        callbacks.onStopAutoWrapupTimer(context.autoWrapupTimer);
      }
    },

    // Cleanup action
    cleanupResources: () => {
      callbacks.onCleanupResources?.();
    },
  };
}
