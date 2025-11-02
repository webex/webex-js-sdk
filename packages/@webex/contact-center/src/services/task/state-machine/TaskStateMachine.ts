/**
 * Task State Machine Configuration
 *
 * This file defines the XState state machine configuration for contact center tasks.
 * It orchestrates state transitions, guards, and actions for task lifecycle management.
 */

import {createMachine, StateMachine} from 'xstate';
import {TaskContext, TaskState, TaskEvent, TaskEventPayload} from './types';
import {guards} from './guards';
import {actions, createInitialContext} from './actions';

/**
 * Task State Machine Configuration
 * Defines all states, transitions, guards, and actions for task management
 */
export const taskStateMachineConfig = {
  id: 'taskStateMachine',
  initial: TaskState.IDLE,
  context: createInitialContext(),
  states: {
    [TaskState.IDLE]: {
      on: {
        [TaskEvent.OFFER]: {
          target: TaskState.OFFERED,
          actions: ['initializeTask', 'updateState'],
        },
        [TaskEvent.OFFER_CONSULT]: {
          target: TaskState.OFFERED_CONSULT,
          actions: ['initializeTask', 'updateState'],
        },
      },
    },

    [TaskState.OFFERED]: {
      entry: ['startRonaTimer'],
      exit: ['stopRonaTimer'],
      on: {
        [TaskEvent.ACCEPT]: {
          target: TaskState.CONNECTED,
          actions: ['updateState'],
        },
        [TaskEvent.ASSIGN]: {
          target: TaskState.CONNECTED,
          actions: ['updateTaskData', 'updateState'],
        },
        [TaskEvent.RONA]: {
          target: TaskState.TERMINATED,
          actions: ['markEnded', 'updateState'],
        },
        [TaskEvent.END]: {
          target: TaskState.TERMINATED,
          actions: ['markEnded', 'updateState'],
        },
      },
    },

    [TaskState.OFFERED_CONSULT]: {
      entry: ['startRonaTimer'],
      exit: ['stopRonaTimer'],
      on: {
        [TaskEvent.ACCEPT]: {
          target: TaskState.CONSULTING,
          actions: ['updateState'],
        },
        [TaskEvent.RONA]: {
          target: TaskState.TERMINATED,
          actions: ['markEnded', 'updateState'],
        },
        [TaskEvent.END]: {
          target: TaskState.TERMINATED,
          actions: ['markEnded', 'updateState'],
        },
      },
    },

    [TaskState.CONNECTED]: {
      on: {
        [TaskEvent.HOLD]: {
          target: TaskState.HELD,
          cond: 'canHold',
          actions: ['setHoldState', 'updateState'],
        },
        [TaskEvent.CONSULT]: {
          target: TaskState.CONSULTING,
          cond: 'canConsult',
          actions: ['setConsultInitiator', 'setConsultDestination', 'updateState'],
        },
        [TaskEvent.CONSULT_CREATED]: {
          target: TaskState.CONSULTING,
          actions: ['updateTaskData', 'setConsultInitiator', 'updateState'],
        },
        [TaskEvent.TRANSFER]: {
          target: TaskState.WRAPPING_UP,
          cond: 'canTransfer',
          actions: ['updateState'],
        },
        [TaskEvent.END]: {
          target: TaskState.WRAPPING_UP,
          actions: ['markEnded', 'updateState'],
        },
        [TaskEvent.CONTACT_ENDED]: [
          {
            target: TaskState.WRAPPING_UP,
            cond: 'wrapupRequired',
            actions: ['markEnded', 'updateState'],
          },
          {
            target: TaskState.COMPLETED,
            actions: ['markEnded', 'updateState'],
          },
        ],
        [TaskEvent.PAUSE_RECORDING]: {
          actions: ['setRecordingState'],
        },
        [TaskEvent.RESUME_RECORDING]: {
          actions: ['setRecordingState'],
        },
      },
    },

    [TaskState.HELD]: {
      on: {
        [TaskEvent.UNHOLD]: {
          target: TaskState.CONNECTED,
          cond: 'canResume',
          actions: ['setHoldState', 'updateState'],
        },
        [TaskEvent.CONSULT]: {
          target: TaskState.CONSULTING,
          cond: 'canConsult',
          actions: ['setConsultInitiator', 'setConsultDestination', 'updateState'],
        },
        [TaskEvent.TRANSFER]: {
          target: TaskState.WRAPPING_UP,
          cond: 'canTransfer',
          actions: ['updateState'],
        },
        [TaskEvent.END]: {
          target: TaskState.WRAPPING_UP,
          actions: ['markEnded', 'updateState'],
        },
      },
    },

    [TaskState.CONSULTING]: {
      on: {
        [TaskEvent.CONSULTING_ACTIVE]: {
          actions: ['setConsultAgentJoined'],
        },
        [TaskEvent.START_CONFERENCE]: {
          target: TaskState.CONFERENCING,
          cond: 'canStartConference',
          actions: ['initializeConference', 'updateState'],
        },
        [TaskEvent.MERGE_TO_CONFERENCE]: {
          target: TaskState.CONFERENCING,
          cond: 'canMergeConsultToConference',
          actions: ['initializeConference', 'updateState'],
        },
        [TaskEvent.CONFERENCE_START]: {
          target: TaskState.CONFERENCING,
          cond: 'canStartConference',
          actions: ['setConferencing', 'updateState'],
        },
        [TaskEvent.CONSULT_END]: {
          target: TaskState.CONNECTED,
          actions: ['clearConsultState', 'updateState'],
        },
        [TaskEvent.CONSULT_TRANSFER]: {
          target: TaskState.WRAPPING_UP,
          actions: ['clearConsultState', 'updateState'],
        },
        [TaskEvent.TRANSFER]: {
          target: TaskState.WRAPPING_UP,
          cond: 'canTransfer',
          actions: ['updateState'],
        },
        [TaskEvent.END]: {
          target: TaskState.WRAPPING_UP,
          actions: ['markEnded', 'clearConsultState', 'updateState'],
        },
        [TaskEvent.CONTACT_ENDED]: [
          {
            target: TaskState.WRAPPING_UP,
            cond: 'wrapupRequired',
            actions: ['markEnded', 'clearConsultState', 'updateState'],
          },
          {
            target: TaskState.COMPLETED,
            actions: ['markEnded', 'clearConsultState', 'updateState'],
          },
        ],
      },
    },

    [TaskState.CONFERENCING]: {
      on: {
        [TaskEvent.PARTICIPANT_JOIN]: {
          cond: 'canAddToConference',
          actions: ['addParticipant'],
        },
        [TaskEvent.PARTICIPANT_LEAVE]: {
          actions: ['removeParticipant'],
        },
        [TaskEvent.EXIT_CONFERENCE]: {
          target: TaskState.WRAPPING_UP,
          cond: 'canExitConference',
          actions: ['clearConferencing', 'markEnded', 'updateState'],
        },
        [TaskEvent.TRANSFER_CONFERENCE]: {
          target: TaskState.WRAPPING_UP,
          cond: 'canTransferConference',
          actions: ['clearConferencing', 'updateState'],
        },
        [TaskEvent.CONFERENCE_END]: [
          {
            target: TaskState.CONNECTED,
            cond: 'shouldEndConference',
            actions: ['clearConferencing', 'updateState'],
          },
          {
            target: TaskState.WRAPPING_UP,
            actions: ['clearConferencing', 'markEnded', 'updateState'],
          },
        ],
        [TaskEvent.END]: {
          target: TaskState.WRAPPING_UP,
          actions: ['markEnded', 'clearConferencing', 'updateState'],
        },
        [TaskEvent.CONTACT_ENDED]: [
          {
            target: TaskState.WRAPPING_UP,
            cond: 'wrapupRequired',
            actions: ['markEnded', 'clearConferencing', 'updateState'],
          },
          {
            target: TaskState.COMPLETED,
            actions: ['markEnded', 'clearConferencing', 'updateState'],
          },
        ],
      },
    },

    [TaskState.WRAPPING_UP]: {
      entry: ['startAutoWrapupTimer'],
      exit: ['stopAutoWrapupTimer'],
      on: {
        [TaskEvent.WRAPUP]: {
          target: TaskState.COMPLETED,
          cond: 'canWrapup',
          actions: ['updateState'],
        },
        [TaskEvent.AUTO_WRAPUP]: {
          target: TaskState.COMPLETED,
          actions: ['updateState'],
        },
      },
    },

    [TaskState.COMPLETED]: {
      type: 'final' as const,
      entry: ['cleanupResources'],
    },

    [TaskState.TERMINATED]: {
      type: 'final' as const,
      entry: ['cleanupResources'],
    },
  },
};

/**
 * Create a task state machine instance
 * @returns StateMachine instance for task management
 */
export function createTaskStateMachine(): StateMachine<
  TaskContext,
  any,
  TaskEventPayload,
  any,
  any,
  any,
  any
> {
  return createMachine(taskStateMachineConfig, {
    guards,
    actions,
  });
}

/**
 * Create a task state machine with custom actions
 * This allows the Task/Voice class to inject their own event emission and side effects
 * @param customActions - Custom action implementations
 * @returns StateMachine instance with custom actions
 */
export function createTaskStateMachineWithActions(
  customActions: Record<string, any>
): StateMachine<TaskContext, any, TaskEventPayload, any, any, any, any> {
  return createMachine(taskStateMachineConfig, {
    guards,
    actions: {
      ...actions,
      ...customActions,
    },
  });
}
