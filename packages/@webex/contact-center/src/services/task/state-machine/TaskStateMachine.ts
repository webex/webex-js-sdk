/**
 * Task State Machine Configuration
 *
 * This file defines the XState state machine configuration for contact center tasks.
 * It orchestrates state transitions, guards, and actions for task lifecycle management.
 */

import {setup} from 'xstate';
import {TaskContext, TaskEventPayload, UIControlConfig} from './types';
import {TaskState, TaskEvent} from './constants';
import {actions, createInitialContext} from './actions';

type TaskActionConfigMap = {[K in keyof typeof actions]: undefined};

const taskStateMachineSetup = setup<
  TaskContext,
  TaskEventPayload,
  Record<string, never>,
  Record<string, never>,
  TaskActionConfigMap
>({
  types: {
    context: {} as TaskContext,
    events: {} as TaskEventPayload,
  },
  actors: {},
});

/**
 * Get task state machine configuration with UI control config
 * Defines all states, transitions, guards, and actions for task management
 *
 * @param uiControlConfig - UI control configuration
 * @returns State machine configuration object
 */
export function getTaskStateMachineConfig(uiControlConfig: UIControlConfig) {
  return {
    id: 'taskStateMachine',
    initial: TaskState.IDLE,
    context: createInitialContext(uiControlConfig, TaskState.IDLE),
    on: {
      [TaskEvent.RECORDING_STARTED]: {
        actions: ['updateTaskData'],
      },
    },
    states: {
      [TaskState.IDLE]: {
        on: {
          [TaskEvent.OFFER]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask'],
          },
          [TaskEvent.OFFER_CONSULT]: {
            target: TaskState.OFFERED_CONSULT,
            actions: ['initializeTask'],
          },
        },
      },

      [TaskState.OFFERED]: {
        on: {
          [TaskEvent.ACCEPT]: {
            target: TaskState.CONNECTED,
          },
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData'],
          },
          [TaskEvent.RONA]: {
            target: TaskState.TERMINATED,
            actions: ['markEnded'],
          },
          [TaskEvent.END]: {
            target: TaskState.TERMINATED,
            actions: ['markEnded'],
          },
        },
      },

      [TaskState.OFFERED_CONSULT]: {
        on: {
          [TaskEvent.ACCEPT]: {
            target: TaskState.CONSULTING,
          },
          [TaskEvent.RONA]: {
            target: TaskState.TERMINATED,
            actions: ['markEnded'],
          },
          [TaskEvent.END]: {
            target: TaskState.TERMINATED,
            actions: ['markEnded'],
          },
        },
      },

      [TaskState.CONNECTED]: {
        on: {
          [TaskEvent.HOLD]: {
            target: TaskState.HOLD_INITIATING,
          },
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          [TaskEvent.CONSULT_CREATED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'setConsultInitiator'],
          },
          [TaskEvent.TRANSFER]: {
            target: TaskState.WRAPPING_UP,
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded'],
          },
          [TaskEvent.PAUSE_RECORDING]: {
            actions: ['setRecordingState'],
          },
          [TaskEvent.RESUME_RECORDING]: {
            actions: ['setRecordingState'],
          },
        },
      },

      [TaskState.HOLD_INITIATING]: {
        on: {
          [TaskEvent.HOLD_SUCCESS]: {
            target: TaskState.HELD,
            actions: ['setHoldState'],
          },
          [TaskEvent.HOLD_FAILED]: {
            target: TaskState.CONNECTED,
          },
        },
      },

      [TaskState.HELD]: {
        on: {
          [TaskEvent.UNHOLD]: {
            target: TaskState.RESUME_INITIATING,
          },
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          [TaskEvent.TRANSFER]: {
            target: TaskState.WRAPPING_UP,
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded'],
          },
        },
      },

      [TaskState.RESUME_INITIATING]: {
        on: {
          [TaskEvent.UNHOLD_SUCCESS]: {
            target: TaskState.CONNECTED,
            actions: ['setHoldState'],
          },
          [TaskEvent.UNHOLD_FAILED]: {
            target: TaskState.HELD,
          },
        },
      },

      [TaskState.CONSULT_INITIATING]: {
        on: {
          [TaskEvent.CONSULT_SUCCESS]: {
            target: TaskState.CONSULTING,
          },
          [TaskEvent.CONSULT_FAILED]: {
            target: TaskState.CONNECTED,
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
          },
          [TaskEvent.MERGE_TO_CONFERENCE]: {
            target: TaskState.CONFERENCING,
          },
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
          },
          [TaskEvent.CONSULT_END]: {
            target: TaskState.CONNECTED,
            actions: ['clearConsultState'],
          },
          [TaskEvent.CONSULT_TRANSFER]: {
            target: TaskState.WRAPPING_UP,
            actions: ['clearConsultState'],
          },
          [TaskEvent.TRANSFER]: {
            target: TaskState.WRAPPING_UP,
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded', 'clearConsultState'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded', 'clearConsultState'],
          },
        },
      },

      [TaskState.CONFERENCING]: {
        on: {
          [TaskEvent.EXIT_CONFERENCE]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded'],
          },
          [TaskEvent.TRANSFER_CONFERENCE]: {
            target: TaskState.WRAPPING_UP,
          },
          [TaskEvent.CONFERENCE_END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded'],
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['markEnded'],
          },
        },
      },

      [TaskState.WRAPPING_UP]: {
        on: {
          [TaskEvent.WRAPUP]: {
            target: TaskState.COMPLETED,
          },
          [TaskEvent.AUTO_WRAPUP]: {
            target: TaskState.COMPLETED,
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
}

/**
 * Create a task state machine instance using only the built-in actions.
 * The resulting machine is ready for most consumers that rely on the default
 * context mutators declared in actions.ts.
 *
 * @param uiControlConfig - UI control configuration
 * @returns StateMachine instance for task management
 */
export function createTaskStateMachine(uiControlConfig: UIControlConfig) {
  return taskStateMachineSetup
    .createMachine(getTaskStateMachineConfig(uiControlConfig))
    .provide({actions});
}

export type TaskStateMachine = ReturnType<typeof createTaskStateMachine>;
