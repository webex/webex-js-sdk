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
import {guards, shouldWrapUpForThisAgent, getTaskDataFromEvent} from './guards';
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
      // AgentConsultCreated from Stable Prod while already HELD/CONNECTED (external consult).
      // Child states do not handle CONSULT_CREATED; wire here so updateTaskData + setConsultInitiator run.
      [TaskEvent.CONSULT_CREATED]: {
        actions: ['updateTaskData', 'setConsultInitiator'],
      },
      // AgentConsultFailed (RONA) while HELD/CONNECTED without passing through CONSULT_INITIATING.
      [TaskEvent.CONSULT_FAILED]: {
        actions: ['updateTaskData', 'handleConsultFailed'],
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
          // AgentContactReserved (direct incoming/consult/transfer/outdial, or campaign preview accept)
          [TaskEvent.TASK_INCOMING]: [
            {
              guard: guards.isCampaignReservationAccept,
              target: TaskState.OFFERED,
              actions: ['initializeTask', 'emitTaskCampaignPreviewReservation'],
            },
            {
              target: TaskState.OFFERED,
              actions: ['initializeTask', 'emitTaskIncoming'],
            },
          ],

          // AgentOutboundFailed can arrive before TASK_INCOMING due to race conditions
          [TaskEvent.OUTBOUND_FAILED]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskOutdialFailed', 'emitTaskEnd'],
          },

          // EP-DN split-leg ordering can deliver AgentConsulting before HYDRATE/TASK_INCOMING.
          // Do not drop it in IDLE; bootstrap to CONSULTING using event taskData.
          [TaskEvent.CONSULTING_ACTIVE]: {
            target: TaskState.CONSULTING,
            actions: [
              'setConsultInitiator',
              'setConsultDestination',
              'setConsultFromConference',
              'setConsultAgentJoined',
              'updateTaskData',
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
              actions: ['updateTaskData', 'emitTaskAssigned'],
            },
          ],
          // AgentOfferContactRONA
          [TaskEvent.RONA]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskReject'],
          },
          [TaskEvent.TASK_WRAPUP]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          [TaskEvent.CONTACT_ENDED]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
          },
          // This needs to be handled for all assign failed scenarios (contact, buddy)
          // [AgentContactAssignFailed, AgentCtqFailed, AgentBlindTransferFailed,
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
              actions: ['updateTaskData', 'markEnded', 'emitTaskOutdialFailed', 'emitTaskEnd'],
            },
          ],
          [TaskEvent.CAMPAIGN_PREVIEW_ACCEPT_FAILED]: {
            actions: ['updateTaskData', 'emitTaskCampaignPreviewAcceptFailed'],
          },
          [TaskEvent.CAMPAIGN_PREVIEW_SKIP_FAILED]: {
            actions: ['updateTaskData', 'emitTaskCampaignPreviewSkipFailed'],
          },
          [TaskEvent.CAMPAIGN_PREVIEW_REMOVE_FAILED]: {
            actions: ['updateTaskData', 'emitTaskCampaignPreviewRemoveFailed'],
          },
          // AgentConsulting comes for received after the initial consult is accepted
          [TaskEvent.CONSULTING_ACTIVE]: [
            {
              target: TaskState.CONSULTING,
              actions: [
                'setConsultAgentJoined',
                'setConsultDestination',
                'updateTaskData',
                'emitTaskConsultAccepted',
                'emitTaskConsulting',
              ],
            },
          ],
          // agentOfferConsult happens only on the receiver side of consult
          [TaskEvent.OFFER_CONSULT]: {
            actions: ['updateTaskData', 'emitTaskOfferConsult', 'requestAutoAnswer'],
          },
          // AgentConsultFailed - when consulted agent (Agent 2) doesn't answer (RONA or decline)
          // Clears the incoming consult notification by transitioning to TERMINATED
          [TaskEvent.CONSULT_FAILED]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'clearConsultState', 'emitTaskReject'],
          },
          // AgentConsultEnded - when consult initiator (Agent 1) ends the consult before
          // the consulted agent (Agent 2) accepts. Clears the incoming notification.
          [TaskEvent.CONSULT_END]: {
            target: TaskState.TERMINATED,
            actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
          },
        },
      },

      [TaskState.CONNECTED]: {
        on: {
          // AgentConsultConferenced / ParticipantJoinedConference can arrive while connected.
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: [
              'updateTaskData',
              'syncTaskDataFromEvent',
              'clearConsultState',
              'emitTaskConferenceStarted',
            ],
          },
          // AgentConsulting may arrive while machine is CONNECTED (EP-DN/event ordering).
          // Derive consultInitiator from payload so controls are set correctly.
          [TaskEvent.CONSULTING_ACTIVE]: {
            target: TaskState.CONSULTING,
            actions: [
              'setConsultInitiator',
              'setConsultDestination',
              'setConsultAgentJoined',
              'updateTaskData',
              'emitTaskConsultAccepted',
              'emitTaskConsulting',
            ],
          },
          // AgentContactAssigned can be resent after consult transfers; keep context in sync
          /* TODO: This transition needs to be checked if this is even needed as receiver will
           * be in Consult Accept state which can be consulting state and ASSIGNED will be only
           * for the receiver. So receuving ASSIGNED in Connected state is highly unlikely.
           */
          [TaskEvent.ASSIGN]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'emitTaskAssigned'],
          },
          // Click of hold button
          [TaskEvent.HOLD_INITIATED]: {
            target: TaskState.HOLD_INITIATING,
          },
          // Remote hold from another login session (multi-login)
          [TaskEvent.HOLD_SUCCESS]: {
            target: TaskState.HELD,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
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
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              // Receiver goes to connected as he receives transferSuccess event
              actions: ['updateTaskData', 'clearConsultState'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData'],
          },
          // AgentConsultEnded from Stable Prod while on connected leg (external end consult).
          [TaskEvent.CONSULT_END]: [
            {
              guard: ({context, event}) => {
                if (context.consultInitiator !== true) return false;
                const taskData = getTaskDataFromEvent(event);
                const mainId = taskData?.interaction?.mainInteractionId || taskData?.interactionId;

                return Boolean(mainId && taskData?.interaction?.media?.[mainId]?.isHold === true);
              },
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              guard: ({context}) => context.consultInitiator === true,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
          ],
          // AgentContactEnded Event
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Campaign preview ContactEnded is terminal cleanup; never enter wrapup.
              guard: guards.isCampaignPreviewContactEnded,
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
            },
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
            actions: ['updateTaskData'],
          },
        },
      },

      [TaskState.HELD]: {
        on: {
          // Conference can be merged while this agent is in held state after refresh/recovery.
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: [
              'updateTaskData',
              'syncTaskDataFromEvent',
              'clearConsultState',
              'emitTaskConferenceStarted',
            ],
          },
          [TaskEvent.PAUSE_RECORDING]: {
            actions: ['updateTaskData', 'setRecordingState', 'emitTaskRecordingPaused'],
          },
          [TaskEvent.RESUME_RECORDING]: {
            actions: ['updateTaskData', 'setRecordingState', 'emitTaskRecordingResumed'],
          },
          // Click of the unhold button
          [TaskEvent.UNHOLD_INITIATED]: {
            target: TaskState.RESUME_INITIATING,
          },
          // Remote resume from another login session (multi-login)
          [TaskEvent.UNHOLD_SUCCESS]: {
            target: TaskState.CONNECTED,
            actions: ['updateTaskData', 'setHoldState', 'emitTaskResume'],
          },
          // Click of the consult button
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },
          // AgentConsulting while main leg is held (Task Refactor / Stable Prod consult accept).
          [TaskEvent.CONSULTING_ACTIVE]: {
            target: TaskState.CONSULTING,
            actions: [
              'setConsultInitiator',
              'setConsultDestination',
              'setConsultAgentJoined',
              'updateTaskData',
              'emitTaskConsultAccepted',
              'emitTaskConsulting',
            ],
          },
          // TODO: This may not be a valid transition, need to be removed
          // AgentConsultTransferred / AgentVTeamTransferred / AgentBlindTransferred
          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData'],
          },
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Campaign preview ContactEnded is terminal cleanup; never enter wrapup.
              guard: guards.isCampaignPreviewContactEnded,
              target: TaskState.TERMINATED,
              actions: ['updateTaskData', 'markEnded', 'emitTaskEnd'],
            },
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
          // AgentConsultEnded from Stable Prod while main leg is held (external end consult).
          [TaskEvent.CONSULT_END]: {
            actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
          },
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
          // AgentConsulting
          // NOTE: Don't set consultDestinationAgentJoined here - wait for CONSULTING_ACTIVE
          [TaskEvent.CONSULT_SUCCESS]: {
            target: TaskState.CONSULTING,
            actions: ['updateTaskData', 'setConsultInitiator'],
          },
          // AgentConsulting (Task Refactor: AgentConsulting event, not CONSULT_SUCCESS)
          [TaskEvent.CONSULTING_ACTIVE]: {
            target: TaskState.CONSULTING,
            actions: [
              'setConsultInitiator',
              'setConsultDestination',
              'setConsultAgentJoined',
              'updateTaskData',
              'emitTaskConsultAccepted',
              'emitTaskConsulting',
            ],
          },
          // AgentConsultFailed, API Failures, AgentCtqFailed
          [TaskEvent.CONSULT_FAILED]: [
            {
              // Consult from conference → back to CONFERENCING
              guard: ({context}) => context.consultFromConference === true,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              guard: guards.isPrimaryMediaOnHold,
              target: TaskState.HELD,
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
              guard: guards.isPrimaryMediaOnHold,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState'],
            },
          ],
          // AgentConsultEnded from Stable Prod during consult initiation (external end consult).
          [TaskEvent.CONSULT_END]: [
            {
              guard: guards.isPrimaryMediaOnHold,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
          ],
        },
      },

      [TaskState.CONSULTING]: {
        on: {
          // AgentConsulting updates consulted agent arrival
          [TaskEvent.CONSULTING_ACTIVE]: {
            actions: [
              'setConsultAgentJoined',
              'setConsultDestination',
              'updateTaskData',
              'emitTaskConsulting',
            ],
          },

          // AgentConsultFailed (RONA / consultee declined) while the initiator is already in
          // CONSULTING (AgentConsulting arrived during ringing). Mirror CONSULT_INITIATING so the
          // initiator returns to their own leg (HELD when main is on hold, else CONNECTED) instead
          // of staying in CONSULTING. Without this, handleConsultFailed clears consultInitiator but
          // the machine stays in CONSULTING, so the trailing AgentConsultEnded falls through the
          // CONSULT_END "consulted agent" branch to TERMINATED and wrongly clears the task.
          [TaskEvent.CONSULT_FAILED]: [
            {
              guard: ({context}) => context.consultFromConference === true,
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              guard: guards.isPrimaryMediaOnHold,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
          ],

          // AgentConsultEnded
          [TaskEvent.CONSULT_END]: [
            {
              // Initiator returning to conference only while conference is still active.
              guard: ({context, event}) =>
                context.consultInitiator === true &&
                guards.conferenceInProgressFromEvent({context, event}),
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Conference consult ended after conference downgrade while main leg is held.
              guard: ({context, event}) =>
                context.consultInitiator === true &&
                context.consultFromConference === true &&
                !guards.conferenceInProgressFromEvent({context, event}) &&
                guards.isConferenceHoldParticipantFromEvent({context, event}),
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Conference consult ended after conference downgrade while main leg is connected.
              guard: ({context, event}) =>
                context.consultInitiator === true &&
                context.consultFromConference === true &&
                !guards.conferenceInProgressFromEvent({context, event}) &&
                !guards.isConferenceHoldParticipantFromEvent({context, event}),
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Initiator already switched back to the main/customer leg
              guard: ({context}) =>
                context.consultInitiator === true && context.consultCallHeld === true,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Interaction terminated during consult (customer left) → WRAPPING_UP
              guard: ({context, event}) => {
                // if (context.consultInitiator !== true) return false;
                // const taskData = getTaskDataFromEvent(event);
                const taskData = getTaskDataFromEvent(event);
                const cpd = taskData?.interaction?.callProcessingDetails;
                if (cpd?.hasCustomerLeft !== 'true') return false;

                return (
                  taskData?.interaction?.isTerminated === true &&
                  shouldWrapUpForThisAgent(context, taskData)
                );
              },
              target: TaskState.WRAPPING_UP,
              actions: [
                'updateTaskData',
                'markEnded',
                'clearConsultState',
                'emitTaskWrapup',
                'requestCleanup',
              ],
            },
            {
              // Initiator (no conference) → HELD
              guard: ({context}) => context.consultInitiator === true,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Consulted agent → TERMINATED
              target: TaskState.TERMINATED,
              actions: ['updateTaskData'],
            },
          ],

          // Switch between consult and main call (UI-driven toggle)
          [TaskEvent.SWITCH_TO_MAIN_CALL]: {
            actions: ['handleSwitchToMainCall', 'emitTaskSwitchCall'],
          },
          [TaskEvent.SWITCH_TO_CONSULT]: {
            actions: ['handleSwitchToConsult', 'emitTaskSwitchCall'],
          },
          [TaskEvent.HOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
          },
          [TaskEvent.UNHOLD_SUCCESS]: {
            actions: ['updateTaskData', 'setHoldState', 'emitTaskResume'],
          },

          [TaskEvent.TRANSFER_SUCCESS]: [
            {
              guard: guards.shouldWrapUpOrIsInitiator,
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState'],
            },
          ],
          [TaskEvent.TRANSFER_FAILED]: {
            actions: ['updateTaskData'],
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
            actions: ['updateTaskData', 'emitTaskAssigned'],
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
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: [
              'updateTaskData',
              'syncTaskDataFromEvent',
              'handleConferenceStarted',
              'clearConsultState',
            ],
          },
        },
      },

      [TaskState.CONF_INITIATING]: {
        on: {
          // AgentConsultConferenced, AgentConsultConferencing, ParticipantJoinedConference
          [TaskEvent.CONFERENCE_START]: {
            target: TaskState.CONFERENCING,
            actions: [
              'updateTaskData',
              'syncTaskDataFromEvent',
              'handleConferenceStarted',
              'clearConsultState',
            ],
          },
          // AgentConsultConferenceFailed
          [TaskEvent.CONFERENCE_FAILED]: {
            target: TaskState.CONSULTING,
            actions: ['handleConferenceFailed', 'emitTaskConferenceFailed'],
          },
          // AgentConsultEnded while conference is initiating (end call before conference completes)
          [TaskEvent.CONSULT_END]: [
            {
              guard: ({event}) => {
                const taskData = getTaskDataFromEvent(event);

                return taskData?.interaction?.isTerminated === true;
              },
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState'],
            },
          ],
        },
      },

      [TaskState.CONFERENCING]: {
        on: {
          [TaskEvent.CONFERENCE_START]: {
            actions: [
              'updateTaskData',
              'syncTaskDataFromEvent',
              'clearConsultState',
              'emitTaskConferenceStarted',
            ],
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
          [TaskEvent.CONSULT_END]: [
            {
              guard: ({context, event}) => {
                const taskData = getTaskDataFromEvent(event);

                return (
                  taskData?.interaction?.isTerminated === true &&
                  shouldWrapUpForThisAgent(context, taskData)
                );
              },
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              actions: ['updateTaskData', 'clearConsultState'],
            },
          ],

          [TaskEvent.HOLD_SUCCESS]: [
            {
              // Conference already downgraded (no other agents) and backend hold arrives.
              // Move to HELD so the UI renders resume action.
              guard: guards.shouldDowngradeConferenceToConnected,
              target: TaskState.HELD,
              actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
            },
            {
              actions: ['updateTaskData', 'setHoldState', 'emitTaskHold'],
            },
          ],
          [TaskEvent.UNHOLD_SUCCESS]: [
            {
              // Conference already downgraded (no other agents) and backend unhold arrives.
              // Move to CONNECTED so hold action is available again.
              guard: guards.shouldDowngradeConferenceToConnected,
              target: TaskState.CONNECTED,
              actions: [
                'updateTaskData',
                'syncTaskDataFromEvent',
                'setHoldState',
                'emitTaskResume',
              ],
            },
            {
              actions: [
                'updateTaskData',
                'syncTaskDataFromEvent',
                'setHoldState',
                'emitTaskResume',
              ],
            },
          ],

          // Start a new consult from within an active conference
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination', 'setConsultFromConference'],
          },

          // AgentConsulting while still in conference (EP-DN/external ordering).
          [TaskEvent.CONSULTING_ACTIVE]: {
            target: TaskState.CONSULTING,
            actions: [
              'setConsultInitiator',
              'setConsultDestination',
              'setConsultFromConference',
              'setConsultAgentJoined',
              'updateTaskData',
              'emitTaskConsultAccepted',
              'emitTaskConsulting',
            ],
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
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConferenceEnded'],
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
