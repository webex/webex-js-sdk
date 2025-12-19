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
import {DESTINATION_TYPE, TaskData} from '../types';

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
  const getTaskDataFromEvent = (event?: TaskEventPayload): TaskData | undefined =>
    event && typeof event === 'object' && 'taskData' in event
      ? (event as {taskData?: TaskData}).taskData
      : undefined;

  const getPrimaryMediaHoldFlag = (taskData?: TaskData | null): boolean | undefined => {
    if (!taskData) {
      return undefined;
    }

    const mediaId = taskData.mediaResourceId;
    if (!mediaId) {
      return undefined;
    }

    return taskData.interaction?.media?.[mediaId]?.isHold;
  };

  const serverReportsHeld = ({event}: {event: TaskEventPayload}) =>
    getPrimaryMediaHoldFlag(getTaskDataFromEvent(event)) === true;

  const serverReportsConsulting = ({
    event,
    context,
  }: {
    event: TaskEventPayload;
    context: TaskContext;
  }) => {
    const taskData = getTaskDataFromEvent(event);
    if (taskData?.isConsulted === true) {
      return true;
    }

    // When backend hasn't flagged isConsulted yet, fall back to existing context flag
    return Boolean(context.consultInitiator && !taskData?.wrapUpRequired);
  };

  const isConsultQueueFlow = ({context}: {context: TaskContext}) =>
    context.consultDestinationType === DESTINATION_TYPE.QUEUE;

  /**
   * Event mapping reference (CC WebSocket -> TaskEvent)
   *
   * AgentContactReserved      -> TaskEvent.TASK_INCOMING
   * AgentOfferContact         -> TaskEvent.TASK_OFFERED
   * AgentOfferConsult         -> TaskEvent.OFFER_CONSULT
   * AgentConsulting           -> TaskEvent.CONSULTING_ACTIVE
   * AgentConsultCreated       -> TaskEvent.CONSULT_CREATED
   * AgentConsultAccepted      -> TaskEvent.CONSULT_ACCEPTED
   * AgentConsultTransferred   -> TaskEvent.TRANSFER_SUCCESS
   * AgentContactAssigned      -> TaskEvent.ASSIGN
   * AgentContactHeld          -> TaskEvent.HOLD_SUCCESS
   * AgentContactUnheld        -> TaskEvent.UNHOLD_SUCCESS
   * AgentConsultEnded         -> TaskEvent.CONSULT_END
   * AgentContactEnded         -> TaskEvent.CONTACT_ENDED
   * AgentWrapup / AgentWrappedup -> TaskEvent.WRAPUP / WRAPUP_COMPLETE
   *
   * (See TaskManager.mapEventToTaskStateMachineEvent for the full mapping table.)
   */
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
          // AgentContactReserved (applicable for direct incoming/consult/transfer/outdial)
          [TaskEvent.TASK_INCOMING]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask', 'emitTaskIncoming'],
          },
          // Some legacy payloads immediately send an OFFER without the reserved event
          [TaskEvent.OFFER]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask'],
          },
          // AgentContactOffer with enriched payload (WebexCC WebRTC flow)
          [TaskEvent.OFFER_CONTACT]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask', 'emitTaskOfferContact', 'emitTaskIncoming'],
          },
          // AgentConsultOffer for the receiver side of consults
          [TaskEvent.OFFER_CONSULT]: {
            target: TaskState.OFFERED_CONSULT,
            actions: ['initializeTask', 'emitTaskOfferConsult'],
          },
          // Consult receivers can get AgentContactAssigned immediately after consult end
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
        },
      },

      [TaskState.OFFERED]: {
        on: {
          // AgentContactOffer
          [TaskEvent.TASK_OFFERED]: {
            actions: ['updateTaskData', 'emitTaskOfferContact', 'emitTaskIncoming'],
          },
          // Local intermediate state for ACCEPT button click
          [TaskEvent.ACCEPT_INITIATED]: {
            actions: ['setAcceptInitiated'],
          },
          // Local ACCEPT event that keeps the task in offered state until ASSIGN arrives
          [TaskEvent.ACCEPT]: {
            target: TaskState.CONNECTED,
          },
          // AgentContactAssigned
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
          // AgentOfferContactRONA
          [TaskEvent.RONA]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          // ContactEnded (customer can end call before connect or via agent softphone decline)
          [TaskEvent.END]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          // Local intermediate state for DECLINE event -- irrespective of API call, clean up
          [TaskEvent.DECLINE]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          // This needs to be handled for all assign failed scenarios (contact, buddy)
          // [AgentContactAssignFailed, AgentConsultFailed, AgentCtqFailed, AgentBlindTransferFailed,
          //  AgentVTeamTransferFailed, AgentConsultTransferFailed]
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
          // AgentConsultOffer, AgentConsulting
          [TaskEvent.CONSULT_ACCEPTED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
          },
          [TaskEvent.OFFER_CONSULT]: {
            target: TaskState.OFFERED_CONSULT,
            actions: ['updateTaskData', 'emitTaskOfferConsult'],
          },
        },
      },

      [TaskState.OFFERED_CONSULT]: {
        entry: ['emitTaskOfferConsult'],
        on: {
          // Local intermediate state for ACCEPT button click
          [TaskEvent.ACCEPT_INITIATED]: {
            actions: ['setAcceptInitiated'],
          },
          // AgentConsultAccepted from receiver accept button
          [TaskEvent.ACCEPT]: {
            target: TaskState.CONSULTING,
            actions: ['emitTaskConsultAccepted'],
          },
          // AgentConsultAccepted from backend (consulting agent accepted)
          [TaskEvent.CONSULT_ACCEPTED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
          },
          // AgentConsultingActive tells the consulted agent that the initiator is live
          [TaskEvent.CONSULTING_ACTIVE]: [
            {
              guard: ({context}: {context: TaskContext}) => !context.consultInitiator,
              target: TaskState.CONSULTING,
              actions: [
                'updateTaskData',
                'setConsultAgentJoined',
                'emitTaskConsultAccepted',
                'emitTaskConsulting',
              ],
            },
          ],
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
          // AgentContactAssigned can be resent after consult transfers; keep context in sync
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
          // Click of hold button
          [TaskEvent.HOLD_INITIATED]: {
            target: TaskState.HOLD_INITIATING,
            actions: ['setHoldInitiated'],
          },
          // Backend may send hold success without a preceding HOLD_INITIATED (e.g. remote hold)
          [TaskEvent.HOLD_SUCCESS]: {
            target: TaskState.HELD,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
          },
          [TaskEvent.HOLD_FAILED]: {
            actions: ['updateTaskData'],
          },
          // Click of the consult button
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // AgentConsultCreated event confirms the consult request
          [TaskEvent.CONSULT_CREATED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'setConsultInitiator', 'emitTaskConsultCreated'],
          },
          // AgentConsultAccepted for instant consult scenarios (direct assign of receiver)
          [TaskEvent.CONSULT_ACCEPTED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
          },
          // Click of the transfer button
          [TaskEvent.TRANSFER]: {
            target: TaskState.TRANSFER_INITIATING,
            actions: ['handleTransferInit'],
          },
          // AgentConsultTransferred / AgentVTeamTransferred / AgentBlindTransferred
          // Back-end may still send transfer responses even if we did not enter the interim state
          // AgentConsultTransferred: initiator wraps (wrapUpRequired), receiver becomes active owner
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const wrapFromPayload = Boolean(
                  (event as {taskData?: TaskData}).taskData?.wrapUpRequired
                );

                return wrapFromPayload || Boolean(context.consultInitiator);
              },
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'finalizeTransfer'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          // AgentContactEnded Event
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.END]: {
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
          // AgentContactHeld Event
          [TaskEvent.HOLD_SUCCESS]: {
            target: TaskState.HELD,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
          },
          // AgentContactHoldFailed Event
          [TaskEvent.HOLD_FAILED]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData'],
          },
        },
      },

      [TaskState.HELD]: {
        on: {
          // Click of the unhold button
          [TaskEvent.UNHOLD_INITIATED]: {
            target: TaskState.RESUME_INITIATING,
          },
          [TaskEvent.UNHOLD]: {
            target: TaskState.RESUME_INITIATING,
          },
          [TaskEvent.UNHOLD_SUCCESS]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskResume'],
          },
          [TaskEvent.UNHOLD_FAILED]: {
            actions: ['updateTaskData'],
          },
          // Click of the consult button
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // Click of the transfer button
          [TaskEvent.TRANSFER]: {
            target: TaskState.TRANSFER_INITIATING,
            actions: ['handleTransferInit'],
          },
          // AgentConsultTransferred / AgentVTeamTransferred / AgentBlindTransferred
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return Boolean(taskData?.wrapUpRequired || context.consultInitiator);
              },
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'finalizeTransfer'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
        },
      },

      [TaskState.RESUME_INITIATING]: {
        on: {
          // AgentContactUnheld
          [TaskEvent.UNHOLD_SUCCESS]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskResume'],
          },
          // AgentContactUnHoldFailed
          [TaskEvent.UNHOLD_FAILED]: {
            target: TaskState.HELD,
          },
        },
      },

      [TaskState.CONSULT_INITIATING]: {
        on: {
          // AgentContactHeld update while consult is placing the primary leg on hold
          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData'],
          },
          // AgentContactHoldFailed (consult attempt failed to hold main call)
          [TaskEvent.HOLD_FAILED]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'handleConsultFailed'],
          },
          // AgentConsultCreated
          [TaskEvent.CONSULT_CREATED]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'setConsultInitiator', 'emitTaskConsultCreated'],
          },
          // AgentConsulting
          [TaskEvent.CONSULT_SUCCESS]: {
            target: TaskState.CONSULTING,
            actions: ['handleConsultCompletion'],
          },
          // AgentConsultFailed, API Failures, AgentCtqFailed
          [TaskEvent.CONSULT_FAILED]: [
            {
              guard: isConsultQueueFlow,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              guard: serverReportsHeld,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              guard: serverReportsConsulting,
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
          ],
          // AgentCtqCancelled Event
          [TaskEvent.CTQ_CANCEL]: [
            {
              guard: isConsultQueueFlow,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState'],
            },
            {
              guard: serverReportsHeld,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState'],
            },
            {
              guard: serverReportsConsulting,
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'clearConsultState'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState'],
            },
          ],
        },
      },

      [TaskState.CONSULTING]: {
        on: {
          // AgentConsultingActive updates consulted agent arrival
          [TaskEvent.CONSULTING_ACTIVE]: {
            actions: ['updateTaskData', 'setConsultAgentJoined', 'emitTaskConsulting'],
          },
          // AgentConsultEnded
          [TaskEvent.CONSULT_END]: [
            {
              guard: ({context}: {context: TaskContext}) => Boolean(context.consultInitiator),
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'clearResources'],
            },
          ],
          // Transfer buttons while in consulting
          [TaskEvent.TRANSFER]: {
            target: TaskState.TRANSFER_INITIATING,
            actions: ['handleTransferInit'],
          },
          [TaskEvent.CONSULT_TRANSFER]: {
            target: TaskState.TRANSFER_INITIATING,
            actions: ['handleTransferInit'],
          },
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return Boolean(taskData?.wrapUpRequired || context.consultInitiator);
              },
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'finalizeTransfer'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          // AgentContactAssigned - receiver side becomes connected to customer
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
          // AgentContactEnded depending on initiator vs receiver
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: ({context}: {context: TaskContext}) => Boolean(context.consultInitiator),
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
          ],
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
          },
          // Local intermediate state for merge to conference button click
          [TaskEvent.START_CONFERENCE]: {
            target: TaskState.CONF_INITIATING,
            actions: ['handleConferenceInit'],
          },
          [TaskEvent.MERGE_TO_CONFERENCE]: {
            target: TaskState.CONF_INITIATING,
            actions: ['handleConferenceInit'],
          },
          // AgentConsultConferenced, ParticipantJoinedConference
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: ['handleConferenceStarted'],
          },
          // AgentConsultConferenceFailed
          [TaskEvent.CONFERENCE_FAILED]: {
            target: TaskState.CONSULTING,
            actions: ['handleConferenceFailed'],
          },
        },
      },

      [TaskState.TRANSFER_INITIATING]: {
        entry: ['clearConsultState'],
        on: {
          // AgentBlindTransferred, AgentVTeamTransferred, AgentConsultTransferred
          [TaskEvent.TRANSFER_SUCCESS]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
          },
          // AgentBlindTransferFailed, AgentVTeamTransferFailed, AgentConsultTransferFailed
          [TaskEvent.TRANSFER_FAILED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd', 'finalizeTransfer'],
          },
        },
      },

      [TaskState.CONF_INITIATING]: {
        on: {
          // AgentConsultConferenced, ParticipantJoinedConference
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: ['handleConferenceStarted'],
          },
          // AgentConsultConferenceFailed
          [TaskEvent.CONFERENCE_FAILED]: {
            target: TaskState.CONSULTING,
            actions: ['handleConferenceFailed'],
          },
        },
      },

      [TaskState.CONFERENCING]: {
        on: {
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // ParticpantLeftConference (host leaves ends conference)
          [TaskEvent.EXIT_CONFERENCE]: [
            {
              guard: ({context}: {context: TaskContext}) => Boolean(context.consultInitiator),
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['clearConsultState'],
            },
          ],
          // AgentConferenceTransferred
          [TaskEvent.TRANSFER_CONFERENCE]: [
            {
              guard: ({context}: {context: TaskContext}) => Boolean(context.consultInitiator),
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['clearConsultState'],
            },
          ],
          // AgentConferenceEnded
          [TaskEvent.CONFERENCE_END]: {
            target: TaskState.CONNECTED,
            actions: ['clearConsultState'],
          },
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: ({context}: {context: TaskContext}) => Boolean(context.consultInitiator),
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['clearConsultState'],
            },
          ],
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
        },
      },

      [TaskState.WRAPPING_UP]: {
        entry: ['emitTaskEnd', 'emitTaskWrapup'],
        on: {
          // AgentWrapup Event
          [TaskEvent.WRAPUP]: {
            target: TaskState.COMPLETED,
          },
          [TaskEvent.AUTO_WRAPUP]: {
            target: TaskState.COMPLETED,
          },
          // AgentWrappedup Event
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
