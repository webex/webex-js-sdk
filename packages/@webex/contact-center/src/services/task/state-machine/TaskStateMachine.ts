/**
 * Task State Machine Configuration
 *
 * This file defines the XState state machine configuration for contact center tasks.
 * It orchestrates state transitions, guards, and actions for task lifecycle management.
 *
 * GUARD FUNCTIONS: All guard logic is centralized in guards.ts for reusability and testing.
 * This file imports and uses those guards via the `guards` object.
 */

import {setup} from 'xstate';
import {TaskContext, TaskEventPayload, UIControlConfig} from './types';
import {TaskState, TaskEvent} from './constants';
import {actions, createInitialContext, TaskActionsMap} from './actions';
import {guards} from './guards';

type TaskActionConfigMap = {[K in keyof typeof actions]: undefined};

const taskStateMachineSetup = setup<
  TaskContext,
  TaskEventPayload,
  Record<string, never>,
  Record<string, never>,
  TaskActionConfigMap
>({
  actors: {},
  types: {
    context: {} as TaskContext,
    events: {} as TaskEventPayload,
  },
});

/**
 * Get task state machine configuration with UI control config
 * Defines all states, transitions, guards, and actions for task management
 *
 * @param uiControlConfig - UI control configuration
 * @returns State machine configuration object
 */
export function getTaskStateMachineConfig(uiControlConfig: UIControlConfig) {
  /**
   * Event mapping reference (CC WebSocket -> TaskEvent)
   *
   * AgentContactReserved      -> TaskEvent.TASK_INCOMING
   * AgentOfferContact         -> TaskEvent.TASK_OFFERED
   * AgentOfferConsult         -> TaskEvent.OFFER_CONSULT
   * AgentConsulting           -> TaskEvent.CONSULTING_ACTIVE
   * AgentConsultCreated       -> TaskEvent.CONSULT_CREATED
   * AgentConsultTransferred   -> TaskEvent.TRANSFER_SUCCESS
   * AgentContactAssigned      -> TaskEvent.ASSIGN
   * AgentContactHeld          -> TaskEvent.HOLD_SUCCESS
   * AgentContactUnheld        -> TaskEvent.UNHOLD_SUCCESS
   * AgentConsultEnded         -> TaskEvent.CONSULT_END
   * AgentContactEnded         -> TaskEvent.CONTACT_ENDED
   * AgentWrapup               -> TaskEvent.TASK_WRAPUP (wrapUpRequired)
   * AgentWrappedup            -> TaskEvent.WRAPUP_COMPLETE
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
      [TaskEvent.CONTACT_UPDATED]: {
        actions: ['updateTaskData', 'syncTaskDataFromEvent'],
      },
      [TaskEvent.CONTACT_OWNER_CHANGED]: {
        actions: ['updateTaskData', 'syncTaskDataFromEvent'],
      },
      // HYDRATE: Update task data from AgentContact event
      // Note: State restoration with transitions is handled in IDLE state.
      // This root-level handler is for when task is already in another state (just updates data).
      [TaskEvent.HYDRATE]: {
        actions: ['updateTaskData', 'emitTaskHydrate'],
      },
    },
    states: {
      [TaskState.IDLE]: {
        on: {
          // HYDRATE: Restore state machine to correct state based on hydrated task data
          // This handles page refresh/reconnection scenarios where task needs to be restored
          // IMPORTANT: This MUST be in IDLE state (not root) because root-level events cannot
          // transition to child states in XState
          [TaskEvent.HYDRATE]: [
            {
              guard: guards.isInteractionTerminated,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskHydrate'],
            },
            {
              guard: guards.isInteractionConsulting,
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              guard: guards.isInteractionHeld,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              guard: guards.isInteractionConnected,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              guard: guards.isConferencingByParticipants,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              // Default: just update data, stay in IDLE
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
          ],
          // AgentContactReserved (applicable for direct incoming/consult/transfer/outdial)
          [TaskEvent.TASK_INCOMING]: {
            target: TaskState.OFFERED,
            actions: ['initializeTask', 'emitTaskIncoming'],
          },
        },
      },

      [TaskState.OFFERED]: {
        on: {
          // AgentContactOffer
          [TaskEvent.TASK_OFFERED]: {
            actions: ['updateTaskData', 'emitTaskOfferContact'],
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
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
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
          // AgentConsulting comes for received after the initial consult is accepted
          [TaskEvent.CONSULTING_ACTIVE]: [
            {
              target: TaskState.CONSULTING,
              actions: [
                'updateTaskData',
                'setConsultAgentJoined',
                'emitTaskConsultAccepted',
                'emitTaskConsulting',
              ],
            },
          ],
          // agentOfferConsult happens only on the receiver side of consult
          [TaskEvent.OFFER_CONSULT]: {
            actions: ['updateTaskData', 'emitTaskOfferConsult'],
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
          // Click of the consult button
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // AgentConsultTransferred / AgentVTeamTransferred / AgentBlindTransferred
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'finalizeTransfer'],
            },
            {
              // Receiver goes to connected as he receives transferSuccess event
              actions: ['updateTaskData', 'clearConsultState', 'finalizeTransfer'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          // AgentContactEnded Event
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Conference still active → CONFERENCING
              guard: guards.conferenceInProgressFromEvent,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStarted'],
            },
            {
              // Agent should wrap up → WRAPPING_UP
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup'],
            },
            {
              // Consulted agent → TERMINATED
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
            },
          ],
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup'],
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
          // Click of the consult button
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // AgentConsultTransferred / AgentVTeamTransferred / AgentBlindTransferred
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'finalizeTransfer'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'finalizeTransfer'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: guards.conferenceInProgressFromEvent,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStarted'],
            },
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
            },
          ],
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup'],
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
          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData'],
          },
          [TaskEvent.HOLD_FAILED]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'handleConsultFailed'],
          },
          [TaskEvent.CONSULT_CREATED]: [
            {
              guard: guards.isConsultingAgentOrBeingConsulted,
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'setConsultInitiator', 'emitTaskConsultCreated'],
            },
            {
              actions: ['updateTaskData'],
            },
          ],
          // AgentConsulting
          // NOTE: Don't set consultDestinationAgentJoined here - wait for CONSULTING_ACTIVE
          [TaskEvent.CONSULT_SUCCESS]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'setConsultInitiator'],
          },
          // AgentConsultFailed, API Failures, AgentCtqFailed
          [TaskEvent.CONSULT_FAILED]: [
            {
              guard: guards.isConsultQueueFlow,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              // If this consult originated from conference, always return to CONFERENCING.
              guard: ({context}) => context.consultFromConference === true,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              // If backend still reports conference, always return to CONFERENCING.
              guard: guards.backendReportsConference,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              guard: guards.conferenceActiveInEventOrContext,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              guard: guards.serverReportsHeld,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              guard: guards.serverReportsConsulting,
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
              guard: guards.isConsultQueueFlow,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState'],
            },
            {
              guard: guards.serverReportsHeld,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState'],
            },
            {
              guard: guards.serverReportsConsulting,
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
          // AgentConsulting updates consulted agent arrival
          [TaskEvent.CONSULTING_ACTIVE]: {
            actions: ['updateTaskData', 'setConsultAgentJoined', 'emitTaskConsulting'],
          },

          // AgentConsultEnded
          // If consult initiator AND was in conference, go back to CONFERENCING
          // Otherwise, initiator goes to HELD, consulted agent goes to TERMINATED
          [TaskEvent.CONSULT_END]: [
            {
              // Initiator in conference → back to CONFERENCING
              guard: (params) =>
                guards.isConsultInitiator(params) &&
                (guards.backendReportsConference(params) ||
                  params.context.consultFromConference === true ||
                  guards.isInitiatorAndConferenceActive(params)),
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Initiator (no conference) → HELD
              guard: guards.isConsultInitiator,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Consulted agent → TERMINATED
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'clearResources'],
            },
          ],

          // Hold/Unhold while consulting (switches between legs)
          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'setConsultCallHeld'],
          },
          [TaskEvent.UNHOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'clearConsultCallHeld'],
          },

          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'finalizeTransfer'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'finalizeTransfer'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'finalizeTransfer'],
          },

          // Transfer conference while consulting
          [TaskEvent.TRANSFER_CONFERENCE]: {
            actions: [
              'setTransferConferenceRequested',
              'handleTransferInit',
              'emitTaskTransferConference',
            ],
          },
          [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: [
            {
              guard: ({context}) => context.transferConferenceRequested !== true,
              actions: ['updateTaskData', 'handleTransferConferenceSuccess'],
            },
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: [
                'updateTaskData',
                'markEnded',
                'clearConsultState',
                'handleTransferConferenceSuccess',
                'emitTaskWrapup',
              ],
            },
            {
              guard: guards.isNotConsultInitiator,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'clearConsultState', 'handleTransferConferenceSuccess'],
            },
            {
              target: TaskState.TERMINATED,
              actions: [
                'updateTaskData',
                'markEnded',
                'clearConsultState',
                'handleTransferConferenceSuccess',
                'emitTaskEnd',
              ],
            },
          ],
          [TaskEvent.TRANSFER_CONFERENCE_FAILED]: {
            actions: ['clearTransferConferenceRequested', 'handleTransferConferenceFailed'],
          },

          // AgentContactAssigned - receiver side becomes connected to customer
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
          // AgentContactEnded
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
          },
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
          },
          [TaskEvent.MERGE_TO_CONFERENCE]: {
            target: TaskState.CONF_INITIATING,
            actions: ['handleConferenceInit'],
          },
          // AgentConsultConferenced, ParticipantJoinedConference
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: ['handleConferenceStarted', 'clearConsultState'],
          },
          // AgentConsultConferenceFailed
          [TaskEvent.CONFERENCE_FAILED]: {
            target: TaskState.CONSULTING,
            actions: ['handleConferenceFailed'],
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
          [TaskEvent.CONFERENCE_START]: {
            actions: ['updateTaskData', 'clearConsultState', 'emitTaskConferenceStarted'],
          },

          [TaskEvent.CONSULT_END]: {
            actions: ['updateTaskData', 'clearConsultState'],
          },

          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
          },
          [TaskEvent.UNHOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'emitTaskResume'],
          },

          // Start a new consult from within an active conference
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination', 'setConsultFromConference'],
          },

          // AgentConsultCreated - only initiator transitions to CONSULTING
          [TaskEvent.CONSULT_CREATED]: [
            {
              guard: guards.didInitiateConsult,
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'setConsultInitiator', 'emitTaskConsultCreated'],
            },
            {actions: ['updateTaskData']},
          ],

          // Participant leaves - downgrade to CONNECTED if < 2 agents remain
          [TaskEvent.PARTICIPANT_LEAVE]: [
            {
              guard: guards.shouldDowngradeConference,
              target: TaskState.CONNECTED,
              actions: [
                'updateTaskData',
                'handleParticipantLeft',
                'clearConsultState',
                'emitTaskParticipantLeft',
                'emitTaskConferenceEnded',
              ],
            },
            {actions: ['updateTaskData', 'handleParticipantLeft', 'emitTaskParticipantLeft']},
          ],
          [TaskEvent.EXIT_CONFERENCE]: {
            actions: ['setExitingConference', 'emitTaskExitConference'],
          },
          [TaskEvent.EXIT_CONFERENCE_SUCCESS]: [
            {
              // Other agents stay in CONFERENCING
              guard: guards.conferenceActiveAndNotWrappingAndNotExiting,
              actions: ['updateTaskData', 'handleExitConferenceSuccess'],
            },
            {
              // Agent should wrap → WRAPPING_UP
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: [
                'updateTaskData',
                'markEnded',
                'clearConsultState',
                'handleExitConferenceSuccess',
                'emitTaskWrapup',
              ],
            },
            {
              // Agent exited → TERMINATED
              guard: guards.isExitingConference,
              target: TaskState.TERMINATED,
              actions: [
                'updateTaskData',
                'markEnded',
                'clearConsultState',
                'handleExitConferenceSuccess',
                'emitTaskEnd',
              ],
            },
            {
              // Conference downgraded → CONNECTED
              guard: guards.shouldDowngradeConference,
              target: TaskState.CONNECTED,
              actions: [
                'updateTaskData',
                'clearConsultState',
                'handleExitConferenceSuccess',
                'emitTaskConferenceEnded',
              ],
            },
            {
              // Fallback
              actions: ['updateTaskData', 'handleExitConferenceSuccess'],
            },
          ],
          [TaskEvent.EXIT_CONFERENCE_FAILED]: {
            actions: ['handleExitConferenceFailed'],
          },

          [TaskEvent.TRANSFER_CONFERENCE]: {
            actions: ['handleTransferInit', 'emitTaskTransferConference'],
          },
          [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: {
            // For agents already in CONFERENCING, a conference transfer does not change their
            // lifecycle state. They remain in conference; only backend taskData is refreshed.
            actions: ['updateTaskData', 'handleTransferConferenceSuccess'],
          },
          [TaskEvent.TRANSFER_CONFERENCE_FAILED]: {
            actions: ['handleTransferConferenceFailed'],
          },

          // Conference ends explicitly
          [TaskEvent.CONFERENCE_END]: [
            {
              // Owner/primary who should wrap up → WRAPPING_UP (must be first!)
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              // Non-owner who triggered exit → TERMINATED
              guard: guards.isExitingConference,
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              guard: guards.customerInCallFromEventOrContext,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConferenceEnded'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              // Default: stay in CONFERENCING (conference still active)
              actions: ['updateTaskData'],
            },
          ],

          // CONTACT_ENDED in conference
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Owner/primary who should wrap up → WRAPPING_UP (must be first!)
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              // Non-owner who triggered exit → TERMINATED
              guard: guards.isExitingConference,
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              // Conference downgraded + customer present → CONNECTED (remaining agent continues)
              guard: (params) =>
                guards.shouldDowngradeConference(params) &&
                guards.customerInCallFromEventOrContext(params),
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConferenceEnded'],
            },
            {
              // Conference downgraded + no customer → TERMINATED
              guard: guards.shouldDowngradeConference,
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
            {
              // Conference still active → stay
              actions: ['updateTaskData'],
            },
          ],

          // End call - terminates entire conference for all participants
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
          },
        },
      },

      [TaskState.WRAPPING_UP]: {
        // Only emit wrapup event on entry - task:end should only be emitted when COMPLETED
        entry: ['emitTaskWrapup'],
        on: {
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
