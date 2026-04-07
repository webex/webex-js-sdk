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
import {TaskContext, TaskEventPayload, UIControlConfig, TaskActionsMap} from './types';
import {TaskState, TaskEvent} from './constants';
import {actions, createInitialContext} from './actions';
import {guards, GuardParams} from './guards';
import {getIsCustomerInCall} from '../TaskUtils';

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
              actions: ['updateTaskData', 'enableRecordingControls', 'emitTaskHydrate'],
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

          // EP-DN split-leg ordering can deliver AgentConsulting before HYDRATE/TASK_INCOMING.
          // Do not drop it in IDLE; bootstrap to CONSULTING using event taskData.
          [TaskEvent.CONSULTING_ACTIVE]: {
            target: TaskState.CONSULTING,
            actions: [
              'updateTaskData',
              'setConsultInitiator',
              'setConsultAgentJoined',
              'emitTaskConsultAccepted',
              'emitTaskConsulting',
            ],
          },
        },
      },

      [TaskState.OFFERED]: {
        on: {
          // AgentContactOffer
          [TaskEvent.TASK_OFFERED]: {
            actions: ['updateTaskData', 'emitTaskOfferContact', 'requestAutoAnswer'],
          },
          // AgentContactAssigned
          [TaskEvent.ASSIGN]: [
            {
              guard: guards.isConsultingAssignment,
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'emitTaskConsultAccepted', 'emitTaskConsulting'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'enableRecordingControls', 'emitTaskAssigned'],
            },
          ],
          // AgentOfferContactRONA
          [TaskEvent.RONA]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          // Agent declines incoming task
          [TaskEvent.DECLINE]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          // ContactEnded - backend event when customer/contact ends before agent connects
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
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
          [TaskEvent.OUTBOUND_FAILED]: [
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskOutdialFailed', 'emitTaskWrapup'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskOutdialFailed', 'emitTaskReject'],
            },
          ],
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
            actions: ['updateTaskData', 'emitTaskOfferConsult', 'requestAutoAnswer'],
          },
        },
      },

      [TaskState.CONNECTED]: {
        on: {
          // AgentConsulting may arrive while machine is CONNECTED (EP-DN/event ordering).
          // Derive consultInitiator from payload so controls are set correctly.
          [TaskEvent.CONSULTING_ACTIVE]: {
            target: TaskState.CONSULTING,
            actions: [
              'updateTaskData',
              'setConsultInitiator',
              'setConsultAgentJoined',
              'emitTaskConsultAccepted',
              'emitTaskConsulting',
            ],
          },
          // AgentContactAssigned can be resent after consult transfers; keep context in sync
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'enableRecordingControls', 'emitTaskAssigned'],
          },
          // Click of hold button
          [TaskEvent.HOLD_INITIATED]: {
            target: TaskState.HOLD_INITIATING,
          },
          // Multi-login: another session held the call (AgentContactHeld without local HOLD_INITIATED)
          [TaskEvent.HOLD_SUCCESS]: {
            target: TaskState.HELD,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
          },
          // Backend consult end event (after already transitioned to CONNECTED from CONSULTING)
          // Clears consult state to hide consult UI controls
          [TaskEvent.CONSULT_END]: {
            actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
          },
          // Backend consult failed event (after already transitioned to CONNECTED from CONSULTING)
          // Clears consult state to hide consult UI controls
          [TaskEvent.CONSULT_FAILED]: {
            actions: ['updateTaskData', 'clearConsultState'],
          },
          // Click of the consult button
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // User initiates transfer (UI action)
          [TaskEvent.TRANSFER]: {
            actions: ['setTransferRequested'],
          },
          // AgentConsultTransferred / AgentVTeamTransferred / AgentBlindTransferred
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'clearTransferRequested'],
            },
            {
              // Receiver goes to connected as he receives transferSuccess event
              actions: ['updateTaskData', 'clearConsultState', 'clearTransferRequested'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'clearTransferRequested'],
          },
          // AgentContactEnded Event
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Conference still active → CONFERENCING
              guard: guards.conferenceInProgressFromEvent,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStarted', 'requestCleanup'],
            },
            {
              // Agent should wrap up → WRAPPING_UP
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'requestCleanup'],
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
            actions: ['updateTaskData', 'enableRecordingControls'],
          },
          // Customer ends call while hold is in progress
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: guards.conferenceInProgressFromEvent,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStarted', 'requestCleanup'],
            },
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'requestCleanup'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
            },
          ],
        },
      },

      [TaskState.HELD]: {
        on: {
          // Click of the unhold button
          [TaskEvent.UNHOLD_INITIATED]: {
            target: TaskState.RESUME_INITIATING,
          },
          // Multi-login: another session resumed the call (AgentContactUnheld without local UNHOLD_INITIATED)
          [TaskEvent.UNHOLD_SUCCESS]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'setHoldState', 'enableRecordingControls', 'emitTaskResume'],
          },
          // Backend consult end event (after already transitioned to HELD from CONSULTING)
          // Clears consult state to hide consult UI controls
          [TaskEvent.CONSULT_END]: {
            actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
          },
          // Backend consult failed event (after already transitioned to HELD from CONSULTING)
          // Clears consult state to hide consult UI controls
          [TaskEvent.CONSULT_FAILED]: {
            actions: ['updateTaskData', 'clearConsultState'],
          },
          // Click of the consult button
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // User initiates transfer (UI action)
          [TaskEvent.TRANSFER]: {
            actions: ['setTransferRequested'],
          },
          // TODO: This may not be a valid transition, need to be removed
          // AgentConsultTransferred / AgentVTeamTransferred / AgentBlindTransferred
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'clearTransferRequested'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'clearTransferRequested'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'clearTransferRequested'],
          },
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: guards.conferenceInProgressFromEvent,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStarted', 'requestCleanup'],
            },
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'requestCleanup'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
            },
          ],
          // TODO: This may not be a valid transition, this needs to be checked as well
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
            actions: ['updateTaskData', 'setHoldState', 'enableRecordingControls', 'emitTaskResume'],
          },
          [TaskEvent.UNHOLD_FAILED]: {
            target: TaskState.HELD,
          },
          // Customer ends call while resume is in progress
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: guards.conferenceInProgressFromEvent,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStarted', 'requestCleanup'],
            },
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup', 'requestCleanup'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
            },
          ],
        },
      },

      [TaskState.CONSULT_INITIATING]: {
        on: {
          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData'],
          },
          [TaskEvent.HOLD_FAILED]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'enableRecordingControls', 'handleConsultFailed'],
          },
          // AgentConsulting
          // NOTE: Don't set consultDestinationAgentJoined here - wait for CONSULTING_ACTIVE
          [TaskEvent.CONSULT_SUCCESS]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'setConsultInitiator'],
          },
          // AgentConsultEnded during CONSULT_INITIATING (cancel before consult establishes)
          [TaskEvent.CONSULT_END]: [
            {
              // Cancel during initiation with main call on hold
              guard: (args: GuardParams) => args.context.transferRequested !== true && guards.isPrimaryMediaOnHold(args),
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Transfer in progress with main call on hold
              guard: (args: GuardParams) => args.context.transferRequested === true && guards.isPrimaryMediaOnHold(args),
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultStatePreservingInitiator', 'emitTaskConsultEnd'],
            },
            {
              // Cancel during initiation with main call connected
              guard: ({context}) => context.transferRequested !== true,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'enableRecordingControls', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Transfer in progress with main call connected
              guard: ({context}) => context.transferRequested === true,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'enableRecordingControls', 'clearConsultStatePreservingInitiator', 'emitTaskConsultEnd'],
            },
          ],
          // AgentConsultFailed, API Failures, AgentCtqFailed
          [TaskEvent.CONSULT_FAILED]: [
            {
              // Consult from conference → back to CONFERENCING
              guard: ({context}) => context.consultFromConference === true,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              // Initiator: always return to HELD (main call was on hold during consult initiation)
              // Remove isPrimaryMediaOnHold guard - it's unreliable, main call is always held during consult
              target: TaskState.HELD,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
          ],
          // AgentCtqCancelled Event
          [TaskEvent.CTQ_CANCEL]: [
            {
              guard: guards.isPrimaryMediaOnHold,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'enableRecordingControls', 'clearConsultState'],
            },
          ],
          // Customer ends call while consult is being initiated
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Conference still active → CONFERENCING
              guard: guards.conferenceInProgressFromEvent,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStarted', 'requestCleanup'],
            },
            {
              // Default: go to WRAPPING_UP (matching CONSULTING state behavior)
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup', 'requestCleanup'],
            },
          ],
          // Backend explicitly requests wrapup during consult initiation
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup'],
          },
        },
      },

      [TaskState.CONSULTING]: {
        on: {
          // AgentConsulting updates consulted agent arrival
          [TaskEvent.CONSULTING_ACTIVE]: {
            actions: ['updateTaskData', 'setConsultAgentJoined', 'requestEndConsultRetry', 'clearPendingEndConsult', 'emitTaskConsulting'],
          },

          // AgentConsultEnded
          [TaskEvent.CONSULT_END]: [
            {
              // Initiator returning to conference (flag set OR backend still shows conference)
              guard: ({context, event}) =>
                context.consultInitiator === true &&
                (context.consultFromConference === true ||
                  guards.conferenceInProgressFromEvent({context, event})),
              target: TaskState.CONFERENCING,
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultStatePreservingInitiator', 'emitTaskConsultEnd'],
            },
            {
              // Initiator canceling consult (no transfer) → HELD
              // Fully clear all consult state since no transfer is expected
              guard: ({context}) => context.consultInitiator === true && context.transferRequested !== true,
              target: TaskState.HELD,
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Initiator with transfer in progress → HELD
              // Use clearConsultStatePreservingInitiator to keep consultInitiator for dial number transfers
              // where backend sends AgentConsultEnded before AgentConsultTransferred
              guard: ({context}) => context.consultInitiator === true && context.transferRequested === true,
              target: TaskState.HELD,
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultStatePreservingInitiator', 'emitTaskConsultEnd'],
            },
            {
              // Consulted agent → TERMINATED
              target: TaskState.TERMINATED,
              actions: ['logStateTransition', 'updateTaskData'],
            },
          ],

          // Switch between consult and main call (UI-driven toggle)
          [TaskEvent.SWITCH_TO_MAIN_CALL]: {
            actions: ['handleSwitchToMainCall', 'emitTaskSwitchCall', 'updateUIControlsAfterSwitch'],
          },
          [TaskEvent.SWITCH_TO_CONSULT]: {
            actions: ['handleSwitchToConsult', 'emitTaskSwitchCall', 'updateUIControlsAfterSwitch'],
          },
          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'updateUIControlsAfterSwitch'],
          },
          [TaskEvent.UNHOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'updateUIControlsAfterSwitch'],
          },

          // AgentConsultFailed - endConsult API failure during CONSULTING
          // Mirror the CONSULT_END pattern for failure path
          [TaskEvent.CONSULT_FAILED]: [
            {
              // Initiator returning to conference (flag set OR backend still shows conference)
              guard: ({context, event}) =>
                context.consultInitiator === true &&
                (context.consultFromConference === true ||
                  guards.conferenceInProgressFromEvent({context, event})),
              target: TaskState.CONFERENCING,
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultStatePreservingInitiator', 'clearPendingEndConsult'],
            },
            {
              // Initiator ending consult without transfer → HELD
              // Always return to HELD (main call is on hold during active consult)
              guard: ({context}) => context.consultInitiator === true && context.transferRequested !== true,
              target: TaskState.HELD,
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultState', 'clearPendingEndConsult'],
            },
            {
              // Initiator with transfer in progress → HELD
              // Preserve consultInitiator for dial number transfers
              guard: ({context}) => context.consultInitiator === true && context.transferRequested === true,
              target: TaskState.HELD,
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultStatePreservingInitiator', 'clearPendingEndConsult'],
            },
            {
              // Consulted agent or fallback - stay in CONSULTING for retry
              // (Consulted agents shouldn't trigger failures, but handle defensively)
              actions: ['updateTaskData', 'setPendingEndConsult'],
            },
          ],

          // User initiates transfer (UI action)
          [TaskEvent.TRANSFER]: {
            actions: ['logStateTransition', 'setTransferRequested'],
          },
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['logStateTransition', 'updateTaskData', 'markEnded', 'emitTaskWrapup', 'clearTransferRequested'],
            },
            {
              target: TaskState.CONNECTED,
              // Use preserving variant to keep consultFromConference flag for conference-based transfers
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultStatePreservingConferenceFlag', 'clearTransferRequested'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'clearTransferRequested'],
          },
          [TaskEvent.TRANSFER_CONFERENCE]: {
            // Track that this agent initiated the conference transfer so we can
            // apply the correct lifecycle transition when success arrives.
            actions: ['setTransferConferenceRequested', 'emitTaskTransferConference'],
          },
          [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: [
            {
              guard: ({context}) => context.transferConferenceRequested !== true,
              actions: [
                'updateTaskData',
                'handleTransferConferenceSuccess',
                'clearTransferConferenceRequested',
              ],
            },
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: [
                'updateTaskData',
                'markEnded',
                'clearConsultState',
                'handleTransferConferenceSuccess',
                'clearTransferConferenceRequested',
                'emitTaskWrapup',
              ],
            },
            {
              // Non-initiator (consulted agent) stays in CONFERENCING
              guard: ({context}) => !context.consultInitiator,
              target: TaskState.CONFERENCING,
              actions: [
                'updateTaskData',
                'clearConsultState',
                'handleTransferConferenceSuccess',
                'clearTransferConferenceRequested',
              ],
            },
            {
              target: TaskState.TERMINATED,
              actions: [
                'updateTaskData',
                'markEnded',
                'clearConsultState',
                'handleTransferConferenceSuccess',
                'clearTransferConferenceRequested',
                'emitTaskEnd',
              ],
            },
          ],
          [TaskEvent.TRANSFER_CONFERENCE_FAILED]: {
            actions: ['clearTransferConferenceRequested', 'emitTaskTransferConferenceFailed'],
          },

          // AgentContactAssigned - receiver side becomes connected to customer
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'enableRecordingControls', 'emitTaskAssigned'],
          },
          // AgentContactEnded
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.WRAPPING_UP,
            actions: [
              'updateTaskData',
              'markEnded',
              'clearConsultState',
              'emitTaskWrapup',
              'requestCleanup',
            ],
          },
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.WRAPPING_UP,
            actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
          },
          [TaskEvent.MERGE_TO_CONFERENCE]: {
            target: TaskState.CONF_INITIATING,
          },
          // AgentConsultConferenced, ParticipantJoinedConference
          // Use preserving variant to keep consultFromConference flag if this agent
          // consulted from within a conference (needed for proper wrapup after transfer)
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: ['updateTaskData', 'clearConsultStatePreservingConferenceFlag', 'emitTaskConferenceStarted'],
          },
        },
      },

      [TaskState.CONF_INITIATING]: {
        on: {
          // AgentConsultConferenced, ParticipantJoinedConference
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: ['updateTaskData', 'clearConsultStatePreservingConferenceFlag', 'emitTaskConferenceStarted'],
          },
          // AgentConsultConferenceFailed
          [TaskEvent.CONFERENCE_FAILED]: {
            target: TaskState.CONSULTING,
            actions: ['handleConferenceFailed', 'emitTaskConferenceFailed'],
          },
        },
      },

      [TaskState.CONFERENCING]: {
        on: {
          [TaskEvent.CONFERENCE_START]: {
            actions: ['updateTaskData', 'clearConsultStatePreservingConferenceFlag', 'emitTaskConferenceStarted'],
          },
          [TaskEvent.EXIT_CONFERENCE_SUCCESS]: [
            {
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
          ],

          // Needed as all agents in conference get this event, hence we need to clear the consult state
          // Use preserving variant to avoid clearing consultFromConference if this agent initiated
          // a consult-from-conference and is waiting for TRANSFER_SUCCESS
          [TaskEvent.CONSULT_END]: {
            actions: ['logStateTransition', 'updateTaskData', 'clearConsultStatePreservingConferenceFlag'],
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
            actions: ['logStateTransition', 'setConsultInitiator', 'setConsultDestination', 'setConsultFromConference'],
          },

          // Consult transfer from within conference
          // This handles the case where agent transfers a consult while in a conference.
          // The initiating agent should wrap up even though the conference continues.
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              // If wrapUpRequired or agent was consult initiator → WRAPPING_UP
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['logStateTransition', 'updateTaskData', 'markEnded', 'emitTaskWrapup', 'clearTransferRequested'],
            },
            {
              // Otherwise stay in conference (for other agents who didn't initiate)
              // Use preserving variant to avoid clearing flags for agents who may need them
              actions: ['logStateTransition', 'updateTaskData', 'clearConsultStatePreservingConferenceFlag', 'clearTransferRequested'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData', 'clearTransferRequested'],
          },

          // Participant leaves - handle conference downgrade scenarios
          [TaskEvent.PARTICIPANT_LEAVE]: [
            {
              // Only the leaving agent should wrap up → WRAPPING_UP
              guard: (params) =>
                guards.didCurrentAgentLeaveConference(params) && guards.shouldWrapUp(params),
              target: TaskState.WRAPPING_UP,
              actions: [
                'updateTaskData',
                'handleParticipantLeft',
                'markEnded',
                'clearConsultState',
                'emitTaskParticipantLeft',
                'emitTaskWrapup',
              ],
            },
            {
              // Only the leaving agent (no wrapup) → TERMINATED
              guard: guards.didCurrentAgentLeaveConference,
              target: TaskState.TERMINATED,
              actions: [
                'updateTaskData',
                'handleParticipantLeft',
                'markEnded',
                'clearConsultState',
                'emitTaskParticipantLeft',
                'emitTaskEnd',
              ],
            },
            {
              // Conference downgraded, customer present → CONNECTED
              guard: (params) =>
                !guards.didCurrentAgentLeaveConference(params) &&
                guards.shouldDowngradeConferenceToConnected(params),
              target: TaskState.CONNECTED,
              actions: [
                'updateTaskData',
                'enableRecordingControls',
                'handleParticipantLeft',
                'clearConsultState',
                'emitTaskParticipantLeft',
                'emitTaskConferenceEnded',
              ],
            },
            {actions: ['updateTaskData', 'handleParticipantLeft', 'emitTaskParticipantLeft']},
          ],

          [TaskEvent.TRANSFER_CONFERENCE]: {
            actions: ['setTransferConferenceRequested', 'emitTaskTransferConference'],
          },
          [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: [
            {
              // Not initiated by this agent → just refresh backend state.
              guard: ({context}) => context.transferConferenceRequested !== true,
              actions: [
                'updateTaskData',
                'handleTransferConferenceSuccess',
                'clearTransferConferenceRequested',
              ],
            },
          ],
          [TaskEvent.TRANSFER_CONFERENCE_FAILED]: {
            actions: ['clearTransferConferenceRequested', 'emitTaskTransferConferenceFailed'],
          },

          // Conference ends explicitly
          [TaskEvent.CONFERENCE_END]: [
            {
              // Agent who should wrap up → WRAPPING_UP
              guard: guards.shouldWrapUp,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              // Customer still in call → CONNECTED
              guard: ({context, event}) => {
                if (context.exitingConference === true) return false;
                const taskData = (event as any)?.taskData ?? context.taskData;
                if (!taskData?.interaction) return false;
                const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;
                if (!mainCallId) return false;

                return getIsCustomerInCall(taskData.interaction, mainCallId);
              },
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'enableRecordingControls', 'clearConsultState', 'emitTaskConferenceEnded'],
            },
            {
              // Otherwise → TERMINATED
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskEnd'],
            },
          ],

          // CONTACT_ENDED in conference
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Conference still active → stay
              actions: ['updateTaskData', 'requestCleanup'],
            },
          ],
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
        entry: ['emitTaskWrappedup', 'cleanupResources'],
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
