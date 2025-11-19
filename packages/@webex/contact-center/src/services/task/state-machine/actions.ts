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
import {TaskContext, TaskEventPayload, isEventOfType, TaskEvent} from './types';

/**
 * Create initial context for a new task
 */
export function createInitialContext(): TaskContext {
  return {
    taskData: null,
    previousState: null,
    consultInitiator: false,
    consultDestination: null,
    consultDestinationAgentJoined: false,
    conferenceInitiatorId: null,
    conferenceParticipants: [],
    maxConferenceParticipants: 10,
    participants: [], // DEPRECATED: Use conferenceParticipants instead
    recordingActive: false,
    recordingPaused: false,
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
      consultDestinationAgentJoined: false,
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
    conferenceInitiatorId: null,
    conferenceParticipants: [],
    participants: [],
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
   * Clear consult state
   */
  clearConsultState: assign<TaskContext, TaskEventPayload>({
    consultDestination: null,
    consultDestinationAgentJoined: false,
  }),
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

    // Cleanup action
    cleanupResources: () => {
      callbacks.onCleanupResources?.();
    },
  };
}
