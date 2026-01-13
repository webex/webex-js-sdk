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
  // All guard helper functions are imported from guards.ts
  // This keeps the state machine config focused on structure, not logic

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
              guard: guards.isNotConsultInitiator,
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
          [TaskEvent.CONSULT_CREATED]: [
            {
              // Normal (non-conference) consult flow - proceed from CONNECTED
              guard: guards.notInConferenceFromEvent,
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'setConsultInitiator', 'emitTaskConsultCreated'],
            },
            {actions: ['updateTaskData']},
          ],
          // AgentConsultAccepted for instant consult scenarios (direct assign of receiver)
          [TaskEvent.CONSULT_ACCEPTED]: [
            {
              guard: guards.notInConferenceFromEvent,
              target: TaskState.CONSULTING,
              actions: [
                'updateTaskData',
                'setConsultInitiator',
                'handleConsultAccept',
                'emitTaskConsultAccepted',
              ],
            },
            {
              actions: ['updateTaskData'],
            },
          ],
          // Click of the transfer button
          [TaskEvent.TRANSFER]: {
            target: TaskState.TRANSFER_INITIATING,
            actions: ['handleTransferInit'],
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
          [TaskEvent.END]: {
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
          [TaskEvent.END]: {
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
          [TaskEvent.CONSULT_ACCEPTED]: {
            target: TaskState.CONSULTING,
            actions: [
              'updateTaskData',
              'setConsultInitiator',
              'handleConsultAccept',
              'emitTaskConsultAccepted',
            ],
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
          // NOTE: Don't set consultDestinationAgentJoined here - wait for CONSULT_ACCEPTED
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
          // AgentConsultingActive updates consulted agent arrival
          [TaskEvent.CONSULTING_ACTIVE]: {
            actions: ['updateTaskData', 'setConsultAgentJoined', 'emitTaskConsulting'],
          },

          // AgentConsultAccepted - consulted agent accepted the consult
          // This sets consultDestinationAgentJoined to enable merge/transfer buttons
          [TaskEvent.CONSULT_ACCEPTED]: {
            actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
          },

          // AgentConsultEnded - determines where to transition after consult ends
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

          // These allow toggling between consult and main call
          [TaskEvent.SWITCH_TO_MAIN_CALL]: {
            actions: ['handleSwitchToMainCall'],
          },
          [TaskEvent.SWITCH_TO_CONSULT]: {
            actions: ['handleSwitchToConsult'],
          },

          // Hold/Unhold while consulting (switches between legs)
          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'setConsultCallHeld'],
          },
          [TaskEvent.UNHOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'clearConsultCallHeld'],
          },

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
            actions: ['handleTransferInit', 'emitTaskTransferConference'],
          },
          [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: [
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
            actions: ['handleTransferConferenceFailed'],
          },

          // AgentContactAssigned - receiver side becomes connected to customer
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
          // AgentContactEnded
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: guards.isConsultInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
          ],
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
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
            actions: ['handleConferenceStarted', 'clearConsultState'],
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
            actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'finalizeTransfer'],
          },
          // AgentBlindTransferFailed, AgentVTeamTransferFailed, AgentConsultTransferFailed
          [TaskEvent.TRANSFER_FAILED]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'finalizeTransfer'],
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

          // Only the consult initiator transitions to CONSULTING on accept
          [TaskEvent.CONSULT_ACCEPTED]: [
            {
              guard: guards.didInitiateConsult,
              target: TaskState.CONSULTING,
              actions: [
                'updateTaskData',
                'setConsultInitiator',
                'handleConsultAccept',
                'emitTaskConsultAccepted',
              ],
            },
            {actions: ['updateTaskData']},
          ],

          [TaskEvent.PARTICIPANT_JOIN]: {
            actions: ['handleParticipantJoined', 'emitTaskParticipantJoined'],
          },
          [TaskEvent.PARTICIPANT_LEAVE]: {
            actions: ['updateTaskData', 'handleParticipantLeft', 'emitTaskParticipantLeft'],
          },

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
          [TaskEvent.END]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
          },
        },
      },

      [TaskState.WRAPPING_UP]: {
        // Only emit wrapup event on entry - task:end should only be emitted when COMPLETED
        entry: ['emitTaskWrapup'],
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
