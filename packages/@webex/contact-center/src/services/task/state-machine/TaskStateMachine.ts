/**
 * Task State Machine Configuration
 *
 * This file defines the XState state machine configuration for contact center tasks.
 * It orchestrates state transitions, guards, and actions for task lifecycle management.
 */

import {setup} from 'xstate';
import {TaskContext, TaskEventPayload, UIControlConfig} from './types';
import {TaskState, TaskEvent} from './constants';
import {actions, createInitialContext, TaskActionsMap} from './actions';

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
        actions: ['updateTaskData', 'emitTaskRecordingStarted'],
      },
      [TaskEvent.HYDRATE]: {
        actions: ['updateTaskData', 'emitTaskHydrate'],
      },
      [TaskEvent.CTQ_CANCEL]: {
        actions: ['updateTaskData', 'emitTaskConsultQueueCancelled'],
      },
      [TaskEvent.CTQ_CANCEL_FAILED]: {
        actions: ['updateTaskData', 'emitTaskConsultQueueFailed'],
      },
    },
    states: {
      [TaskState.IDLE]: {
        on: {
          [TaskEvent.TASK_INCOMING]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask'],
          },
          [TaskEvent.OFFER]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask'],
          },
          [TaskEvent.OFFER_CONTACT]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask', 'emitTaskOfferContact'],
          },
          [TaskEvent.OFFER_CONSULT]: {
            target: TaskState.OFFERED_CONSULT,
            actions: ['initializeTask'],
          },
        },
      },

      [TaskState.OFFERED]: {
        on: {
          [TaskEvent.TASK_OFFERED]: {
            actions: ['updateTaskData', 'emitTaskOfferContact'],
          },
          [TaskEvent.ACCEPT_INITIATED]: {
            actions: ['setAcceptInitiated'],
          },
          [TaskEvent.ACCEPT]: {
            target: TaskState.CONNECTED,
          },
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
          [TaskEvent.DECLINE]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          [TaskEvent.RONA]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          [TaskEvent.END]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.ASSIGN_FAILED]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          [TaskEvent.INVITE_FAILED]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          [TaskEvent.OUTBOUND_FAILED]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          [TaskEvent.CONSULT_ACCEPTED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
          },
        },
      },

      [TaskState.OFFERED_CONSULT]: {
        entry: ['emitTaskOfferConsult'],
        on: {
          [TaskEvent.ACCEPT_INITIATED]: {
            actions: ['setAcceptInitiated'],
          },
          [TaskEvent.ACCEPT]: {
            target: TaskState.CONSULTING,
            actions: ['emitTaskConsultAccepted'],
          },
          [TaskEvent.CONSULT_ACCEPTED]: {
            target: TaskState.CONSULTING,
            actions: ['emitTaskConsultAccepted'],
          },
          [TaskEvent.RONA]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          [TaskEvent.END]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.DECLINE]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
        },
      },

      [TaskState.CONNECTED]: {
        on: {
          [TaskEvent.HOLD_INITIATED]: {
            target: TaskState.HOLD_INITIATING,
            actions: ['setHoldInitiated'],
          },
          [TaskEvent.HOLD]: {
            target: TaskState.HOLD_INITIATING,
          },
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          [TaskEvent.CONSULT_CREATED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'setConsultInitiator', 'emitTaskConsultCreated'],
          },
          [TaskEvent.CONSULT_ACCEPTED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
          },
          [TaskEvent.TRANSFER]: {
            target: TaskState.WRAPPING_UP,
            actions: ['handleTransferInit'],
          },
          [TaskEvent.TRANSFER_SUCCESS]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
          },
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.PAUSE_RECORDING]: {
            actions: ['updateTaskData', 'setRecordingState', 'emitTaskRecordingPaused'],
          },
          [TaskEvent.RESUME_RECORDING]: {
            actions: ['updateTaskData', 'setRecordingState', 'emitTaskRecordingResumed'],
          },
        },
      },

      [TaskState.HOLD_INITIATING]: {
        on: {
          [TaskEvent.HOLD_SUCCESS]: {
            target: TaskState.HELD,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
          },
          [TaskEvent.HOLD_FAILED]: {
            target: TaskState.CONNECTED,
          },
        },
      },

      [TaskState.HELD]: {
        on: {
          [TaskEvent.UNHOLD_INITIATED]: {
            target: TaskState.RESUME_INITIATING,
          },
          [TaskEvent.UNHOLD]: {
            target: TaskState.RESUME_INITIATING,
          },
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          [TaskEvent.TRANSFER]: {
            target: TaskState.WRAPPING_UP,
            actions: ['handleTransferInit'],
          },
          [TaskEvent.TRANSFER_SUCCESS]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
          },
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
        },
      },

      [TaskState.RESUME_INITIATING]: {
        on: {
          [TaskEvent.UNHOLD_SUCCESS]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskResume'],
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
            actions: ['handleConsultCompletion'],
          },
          [TaskEvent.CONSULT_FAILED]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'handleConsultFailed'],
          },
        },
      },

      [TaskState.CONSULTING]: {
        on: {
          [TaskEvent.CONSULTING_ACTIVE]: {
            actions: ['updateTaskData', 'setConsultAgentJoined', 'emitTaskConsulting'],
          },
          [TaskEvent.START_CONFERENCE]: {
            target: TaskState.CONFERENCING,
            actions: ['handleConferenceInit'],
          },
          [TaskEvent.MERGE_TO_CONFERENCE]: {
            target: TaskState.CONFERENCING,
            actions: ['handleConferenceInit'],
          },
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: ['handleConferenceStarted'],
          },
          [TaskEvent.CONSULT_END]: {
            target: TaskState.CONNECTED,
            actions: ['clearConsultState', 'emitTaskConsultEnd'],
          },
          [TaskEvent.CONSULT_TRANSFER]: {
            target: TaskState.WRAPPING_UP,
            actions: ['clearConsultState'],
          },
          [TaskEvent.TRANSFER]: {
            target: TaskState.WRAPPING_UP,
            actions: ['handleTransferInit'],
          },
          [TaskEvent.TRANSFER_SUCCESS]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
          },
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
          },
        },
      },

      [TaskState.CONFERENCING]: {
        on: {
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          [TaskEvent.EXIT_CONFERENCE]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.TRANSFER_CONFERENCE]: {
            target: TaskState.WRAPPING_UP,
          },
          [TaskEvent.CONFERENCE_END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'handleConferenceFailed', 'emitTaskEnd'],
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'handleConferenceFailed', 'emitTaskEnd'],
          },
        },
      },

      [TaskState.WRAPPING_UP]: {
        entry: ['emitTaskEnd'],
        on: {
          [TaskEvent.WRAPUP]: {
            target: TaskState.COMPLETED,
          },
          [TaskEvent.AUTO_WRAPUP]: {
            target: TaskState.COMPLETED,
          },
          [TaskEvent.WRAPUP_COMPLETE]: {
            target: TaskState.COMPLETED,
            actions: ['updateTaskData'],
          },
        },
      },

      [TaskState.COMPLETED]: {
        type: 'final' as const,
        entry: ['cleanupResources', 'emitTaskWrappedup'],
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
export function createTaskStateMachine(
  uiControlConfig: UIControlConfig,
  options?: {actions?: Partial<TaskActionsMap>}
) {
  return taskStateMachineSetup.createMachine(getTaskStateMachineConfig(uiControlConfig)).provide({
    actions: {
      ...actions,
      ...(options?.actions ?? {}),
    },
  });
}

export type TaskStateMachine = ReturnType<typeof createTaskStateMachine>;
