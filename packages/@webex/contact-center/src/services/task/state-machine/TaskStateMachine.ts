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
import {getIsConferenceInProgress, getIsCustomerInCall} from '../TaskUtils';

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

  const getSelfAgentId = (context: TaskContext, taskData?: TaskData): string | undefined =>
    context.uiControlConfig.agentId ?? context.taskData?.agentId ?? taskData?.agentId;

  const isSelfConsultingAgent = (context: TaskContext, taskData?: TaskData): boolean => {
    const selfAgentId = getSelfAgentId(context, taskData);
    if (!selfAgentId) return false;

    return taskData?.consultingAgentId === selfAgentId;
  };

  /**
   * Determines if this agent should enter WRAPPING_UP state.
   * Priority: agentsPendingWrapUp > interaction.owner > isConsulted flag
   */
  const shouldWrapUpForThisAgent = (context: TaskContext, taskData?: TaskData): boolean => {
    const selfAgentId = getSelfAgentId(context, taskData);
    if (!selfAgentId) return false;

    // Priority 1: Backend-provided list (most reliable)
    const pending = taskData?.agentsPendingWrapUp;
    if (Array.isArray(pending) && pending.length > 0) {
      return pending.includes(selfAgentId);
    }

    // Priority 2: Current interaction owner should wrap
    const interactionOwner = taskData?.interaction?.owner ?? context.taskData?.interaction?.owner;
    if (interactionOwner) {
      return selfAgentId === interactionOwner;
    }

    // Priority 3: Fallback to isConsulted (primary = !isConsulted should wrap)
    const isConsulted = context.taskData?.isConsulted ?? taskData?.isConsulted;
    if (isConsulted === true) return false;
    if (isConsulted === false) return true;

    // Unknown - safer to not wrap
    return false;
  };

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
              // If interaction is terminated, transition to WRAPPING_UP
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return taskData?.interaction?.isTerminated === true;
              },
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskHydrate'],
            },
            {
              // If interaction state is consulting, transition to CONSULTING
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return taskData?.interaction?.state === 'consulting';
              },
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              // If interaction state is hold, transition to HELD
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return taskData?.interaction?.state === 'hold';
              },
              target: TaskState.HELD,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              // If interaction state is connected, transition to CONNECTED
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return taskData?.interaction?.state === 'connected';
              },
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              // If conferencing (check participants count >= 2)
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (!taskData) return false;
                // Use the same logic as getIsConferenceInProgress
                const mainCallId =
                  taskData.interaction?.mainInteractionId || taskData.interactionId;
                const media = taskData.interaction?.media?.[mainCallId];
                const participants = taskData.interaction?.participants;
                if (!media?.participants || !participants) return false;
                let agentCount = 0;
                for (const pId of media.participants) {
                  const p = participants[pId];
                  if (p && p.pType !== 'Customer' && p.pType !== 'Supervisor' && !p.hasLeft) {
                    agentCount += 1;
                  }
                }

                return agentCount >= 2;
              },
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskHydrate'],
            },
            {
              // Default: just update data, stay in IDLE (will get proper event later)
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
          [TaskEvent.CONSULT_CREATED]: [
            {
              // Normal (non-conference) consult flow can proceed from CONNECTED.
              // If conference is in progress, do not transition here (conference consult logic lives in CONFERENCING).
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (!taskData) return false;

                return !getIsConferenceInProgress(taskData);
              },
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'setConsultInitiator', 'emitTaskConsultCreated'],
            },
            {
              actions: ['updateTaskData'],
            },
          ],
          // AgentConsultAccepted for instant consult scenarios (direct assign of receiver)
          [TaskEvent.CONSULT_ACCEPTED]: [
            {
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (!taskData) return false;

                return !getIsConferenceInProgress(taskData);
              },
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
          // FIX: Add guards to prevent consulted agents from going to WRAPPING_UP
          // Only primary agent (original call owner) should wrapup
          // Consulted agents should terminate (no wrapup)
          [TaskEvent.CONTACT_ENDED]: [
            {
              // If conference is still active (2+ agents remain), transition back to CONFERENCING
              // This handles the race condition where agent goes to CONNECTED via CONFERENCE_END
              // but conference actually still has participants
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (!taskData?.interaction) return false;

                return getIsConferenceInProgress(taskData);
              },
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStart'],
            },
            {
              // Only agents explicitly listed by backend should wrap.
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) =>
                shouldWrapUpForThisAgent(context, (event as {taskData?: TaskData}).taskData),
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'emitTaskWrapup'],
            },
            {
              // Consulted agent → TERMINATED (no wrapup)
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
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return Boolean(taskData?.wrapUpRequired || context.consultInitiator);
              },
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
          // FIX: Add guards to prevent consulted agents from going to WRAPPING_UP (same as CONNECTED)
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (!taskData?.interaction) return false;

                return getIsConferenceInProgress(taskData);
              },
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'emitTaskConferenceStart'],
            },
            {
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) =>
                shouldWrapUpForThisAgent(context, (event as {taskData?: TaskData}).taskData),
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
          [TaskEvent.CONSULT_CREATED]: [
            {
              // Only transition if this agent is the consulting agent OR is being consulted.
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                const selfAgentId = getSelfAgentId(context, taskData);
                const isConsultingAgent =
                  Boolean(selfAgentId) && taskData?.consultingAgentId === selfAgentId;
                const isBeingConsulted = taskData?.isConsulted === true;

                return isConsultingAgent || isBeingConsulted;
              },
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
          // IMPORTANT: Must check conference state to return to correct state
          [TaskEvent.CONSULT_FAILED]: [
            {
              guard: isConsultQueueFlow,
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'handleConsultFailed'],
            },
            {
              // If conference is still active, go back to CONFERENCING
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const eventTaskData = (event as {taskData?: TaskData}).taskData;
                const conferenceActiveInEvent = eventTaskData
                  ? getIsConferenceInProgress(eventTaskData)
                  : false;
                const conferenceActiveInContext = context.taskData
                  ? getIsConferenceInProgress(context.taskData)
                  : false;

                return conferenceActiveInEvent || conferenceActiveInContext;
              },
              target: TaskState.CONFERENCING,
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
            actions: [
              'updateTaskData',
              'setConsultAgentJoined',
              'setConsultEstablished',
              'emitTaskConsulting',
            ],
          },

          // AgentConsultAccepted - consulted agent accepted the consult
          // This sets consultDestinationAgentJoined to enable merge/transfer buttons
          [TaskEvent.CONSULT_ACCEPTED]: {
            actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
          },

          // AgentConsultEnded
          // If consult initiator AND was in conference, go back to CONFERENCING
          // Otherwise, initiator goes to HELD, consulted agent goes to TERMINATED
          [TaskEvent.CONSULT_END]: [
            {
              // Initiator in conference → back to CONFERENCING
              // Check both event and context taskData (event may not have conference info)
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                if (!context.consultInitiator) return false;
                const eventTaskData = (event as {taskData?: TaskData}).taskData;
                const conferenceInEvent = eventTaskData && getIsConferenceInProgress(eventTaskData);
                const conferenceInContext =
                  context.taskData && getIsConferenceInProgress(context.taskData);

                return conferenceInEvent || conferenceInContext;
              },
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConsultEnd'],
            },
            {
              // Initiator (no conference) → HELD
              guard: ({context}: {context: TaskContext}) => Boolean(context.consultInitiator),
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
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return Boolean(taskData?.wrapUpRequired || context.consultInitiator);
              },
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

          // Transfer conference while consulting (transfers ownership to consulted agent)
          // This is allowed when consulting from an active conference
          [TaskEvent.TRANSFER_CONFERENCE]: {
            actions: ['handleTransferInit', 'emitTaskTransferConference'],
          },
          [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: [
            {
              // Transferring agent goes to WRAPPING_UP
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) =>
                shouldWrapUpForThisAgent(context, (event as {taskData?: TaskData}).taskData),
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
              // Non-transferring agent stays in conference or goes to connected
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return taskData ? getIsConferenceInProgress(taskData) : false;
              },
              target: TaskState.CONFERENCING,
              actions: ['updateTaskData', 'clearConsultState', 'handleTransferConferenceSuccess'],
            },
            {
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'handleTransferConferenceSuccess'],
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
          // AgentContactEnded depending on initiator vs receiver
          [TaskEvent.CONTACT_ENDED]: [
            {
              guard: ({context}: {context: TaskContext}) => Boolean(context.consultInitiator),
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
          // Start a new consult from within an active conference
          // Per task-refactor-state-machine-conference.md: CONFERENCING + CONSULTING composite
          [TaskEvent.CONSULT]: {
            target: TaskState.CONSULT_INITIATING,
            actions: ['setConsultInitiator', 'setConsultDestination'],
          },

          // AgentConsultCreated - new consult started from conference
          // IMPORTANT: The agent who INITIATED the consult transitions via CONSULT_INITIATING state,
          // NOT through this handler. This handler is for OTHER agents in the conference.
          // Flow for initiator: CONFERENCING -> CONSULT -> CONSULT_INITIATING -> (CONSULT_CREATED) -> CONSULTING
          // Only the consult initiator transitions to CONSULTING; others stay in CONFERENCING
          [TaskEvent.CONSULT_CREATED]: [
            {
              // Initiator: use consultingAgentId if available, else local flag
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (taskData?.isConsulted === true) return false;
                const didInitiate = taskData?.consultingAgentId
                  ? isSelfConsultingAgent(context, taskData)
                  : context.consultInitiator === true;

                return didInitiate;
              },
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'emitTaskConsultCreated'],
            },
            {
              actions: ['updateTaskData'],
            },
          ],

          // Only the consult initiator transitions to CONSULTING on accept
          [TaskEvent.CONSULT_ACCEPTED]: [
            {
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (taskData?.isConsulted === true) return false;
                const didInitiate = taskData?.consultingAgentId
                  ? isSelfConsultingAgent(context, taskData)
                  : context.consultInitiator === true;

                return didInitiate;
              },
              target: TaskState.CONSULTING,
              actions: ['updateTaskData', 'handleConsultAccept', 'emitTaskConsultAccepted'],
            },
            {
              actions: ['updateTaskData'],
            },
          ],

          [TaskEvent.PARTICIPANT_JOIN]: {
            actions: ['handleParticipantJoined', 'emitTaskParticipantJoined'],
          },
          // Participant leaves - downgrade to CONNECTED if < 2 agents remain
          [TaskEvent.PARTICIPANT_LEAVE]: [
            {
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return taskData ? !getIsConferenceInProgress(taskData) : false;
              },
              target: TaskState.CONNECTED,
              actions: [
                'updateTaskData',
                'handleParticipantLeft',
                'clearConsultState',
                'emitTaskParticipantLeft',
                'emitTaskConferenceEnded',
              ],
            },
            {
              actions: ['updateTaskData', 'handleParticipantLeft', 'emitTaskParticipantLeft'],
            },
          ],

          // Exit conference - exitingConference flag distinguishes "I exited" vs broadcast
          [TaskEvent.EXIT_CONFERENCE]: {
            actions: ['setExitingConference', 'emitTaskExitConference'],
          },
          [TaskEvent.EXIT_CONFERENCE_SUCCESS]: [
            {
              // Other agents (not exiting, not wrapping) stay in CONFERENCING
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                const conferenceActive = taskData ? getIsConferenceInProgress(taskData) : false;

                return (
                  conferenceActive &&
                  !shouldWrapUpForThisAgent(context, taskData) &&
                  !context.exitingConference
                );
              },
              actions: ['updateTaskData', 'handleExitConferenceSuccess'],
            },
            {
              // The agent who exited AND should wrap → WRAPPING_UP (primary agent)
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) =>
                shouldWrapUpForThisAgent(context, (event as {taskData?: TaskData}).taskData),
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
              // Non-primary agent who exited → TERMINATED (call cleared, no wrapup)
              guard: ({context}: {context: TaskContext}) => context.exitingConference,
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
              // Conference ended (< 2 agents) and agent shouldn't wrap → CONNECTED
              // This is for when the last agent exits and conference downgrades
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return !getIsConferenceInProgress(taskData);
              },
              target: TaskState.CONNECTED,
              actions: [
                'updateTaskData',
                'clearConsultState',
                'handleExitConferenceSuccess',
                'emitTaskConferenceEnded',
              ],
            },
            {
              // Fallback: Stay in CONFERENCING (safety net)
              actions: ['updateTaskData', 'handleExitConferenceSuccess'],
            },
          ],
          [TaskEvent.EXIT_CONFERENCE_FAILED]: {
            actions: ['handleExitConferenceFailed'],
          },

          // Transfer conference - transfer ownership to another agent
          // Per conference-spec.md: Only primary agent can transfer
          // IMPORTANT: TRANSFER_CONFERENCE_SUCCESS may be broadcast to all agents.
          // Remaining agents should STAY in CONFERENCING if conference is still active.
          [TaskEvent.TRANSFER_CONFERENCE]: {
            actions: ['handleTransferInit', 'emitTaskTransferConference'],
          },
          [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: [
            {
              // Non-transferring agents stay in CONFERENCING
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                const conferenceActive = taskData ? getIsConferenceInProgress(taskData) : false;

                return conferenceActive && !shouldWrapUpForThisAgent(context, taskData);
              },
              actions: ['updateTaskData', 'handleTransferConferenceSuccess'],
            },
            {
              // The agent who transferred AND should wrap → WRAPPING_UP
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) =>
                shouldWrapUpForThisAgent(context, (event as {taskData?: TaskData}).taskData),
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
              // Conference ended (< 2 agents) and agent shouldn't wrap → CONNECTED
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;

                return !getIsConferenceInProgress(taskData);
              },
              target: TaskState.CONNECTED,
              actions: [
                'updateTaskData',
                'clearConsultState',
                'handleTransferConferenceSuccess',
                'emitTaskConferenceEnded',
              ],
            },
            {
              // Fallback: Stay in CONFERENCING (safety net)
              actions: ['updateTaskData', 'handleTransferConferenceSuccess'],
            },
          ],
          [TaskEvent.TRANSFER_CONFERENCE_FAILED]: {
            actions: ['handleTransferConferenceFailed'],
          },

          // Conference ends explicitly (AGENT_CONSULT_CONFERENCE_ENDED event)
          // Per task-refactor-state-machine-conference.md: auto-downgrade when < 2 agents
          // FIX: Add guard to stay in CONFERENCING if conference is still active (2+ agents)
          [TaskEvent.CONFERENCE_END]: [
            {
              // If conference still has 2+ agents, stay in CONFERENCING (just update data)
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (!taskData) return false;

                return getIsConferenceInProgress(taskData);
              },
              actions: ['updateTaskData'],
            },
            {
              // Conference truly ended (< 2 agents) - transition to CONNECTED
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConferenceEnded'],
            },
          ],

          // CONTACT_ENDED in conference: stay if conference active + customer present
          [TaskEvent.CONTACT_ENDED]: [
            {
              // Stay if conference active AND customer still in call
              guard: ({event}: {event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                if (!taskData?.interaction) return false;
                const mainCallId = taskData.interaction.mainInteractionId || taskData.interactionId;

                return (
                  getIsConferenceInProgress(taskData) &&
                  getIsCustomerInCall(taskData.interaction, mainCallId)
                );
              },
              actions: ['updateTaskData'],
            },
            {
              // Stay if conference active and agent shouldn't wrap (edge case fallback)
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) => {
                const taskData = (event as {taskData?: TaskData}).taskData;
                const conferenceActive = taskData ? getIsConferenceInProgress(taskData) : false;

                return conferenceActive && !shouldWrapUpForThisAgent(context, taskData);
              },
              actions: ['updateTaskData'],
            },
            {
              // Owner should wrap
              guard: ({context, event}: {context: TaskContext; event: TaskEventPayload}) =>
                shouldWrapUpForThisAgent(context, (event as {taskData?: TaskData}).taskData),
              target: TaskState.WRAPPING_UP,
              actions: ['updateTaskData', 'markEnded', 'clearConsultState', 'emitTaskWrapup'],
            },
            {
              // Non-owner → CONNECTED (can continue call)
              target: TaskState.CONNECTED,
              actions: ['updateTaskData', 'clearConsultState', 'emitTaskConferenceEnded'],
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
