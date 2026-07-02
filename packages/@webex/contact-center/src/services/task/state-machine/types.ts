/**
 * Task State Machine Types
 *
 * Type definitions for the XState-based task state machine.
 * These types define states, events, context, and schemas for task lifecycle management.
 */

import type {AnyStateNodeConfig, ActionFunctionMap, EventObject, ActionArgs} from 'xstate';
import {DestinationType, TaskChannelType, TaskData, TaskUIControls, VoiceVariant} from '../types';
import {TaskEvent, TaskState} from './constants';

/**
 * Represents a participant in a conference call
 */
export interface ConferenceParticipant {
  /** Unique identifier for the participant */
  id: string;
  /** Type of participant (agent, customer, or external party) */
  type: 'AGENT' | 'CUSTOMER' | 'EXTERNAL';
  /** Display name of the participant */
  name?: string;
  /** Timestamp when participant joined the conference */
  joinedAt: Date;
  /** Whether this participant initiated the conference */
  isInitiator: boolean;
  /** Whether this participant can be removed from the conference */
  canBeRemoved: boolean;
}

/**
 * UI Control configuration for the task
 */
export interface UIControlConfig {
  /** Whether end call button is enabled (config option) */
  isEndTaskEnabled: boolean;
  /** Whether end consult button is enabled (config option) */
  isEndConsultEnabled: boolean;
  /** Channel type determines which controls are available */
  channelType: TaskChannelType;
  /** Optional voice channel variant to toggle WebRTC-specific controls */
  voiceVariant?: VoiceVariant;
  /** Whether recording controls should be shown for this task */
  isRecordingEnabled: boolean;
  /** Current agent ID for ownership checks (transfer conference) */
  agentId?: string;
}

/**
 * Task state machine context.
 * Only stores data that cannot be derived from state machine state.
 */
export interface TaskContext {
  taskData: TaskData | null;

  // Consult tracking
  consultInitiator: boolean;
  exitingConference: boolean;
  consultFromConference: boolean;
  transferConferenceRequested: boolean;
  consultDestinationType: DestinationType | null;
  consultDestinationAgentId: string | null;
  consultDestinationAgentJoined: boolean;
  consultCallHeld: boolean;

  // Recording
  recordingControlsAvailable: boolean;
  recordingInProgress: boolean;

  // UI
  uiControlConfig: UIControlConfig;
  uiControls: TaskUIControls;
}

export type RecordingStateUpdate = Partial<
  Pick<TaskContext, 'recordingControlsAvailable' | 'recordingInProgress'>
>;

/**
 * Base event type - all events have a type property
 */
type BaseEvent<T extends TaskEvent> = {type: T};

/**
 * Event payload mapping - defines the payload for each event type
 */
interface TaskEventPayloadMap {
  [TaskEvent.TASK_INCOMING]: BaseEvent<TaskEvent.TASK_INCOMING> & {
    taskData: TaskData;
    /** Set when campaign preview reservation accept is receieved */
    isCampaignReservationAccept?: boolean;
  };
  [TaskEvent.TASK_OFFERED]: BaseEvent<TaskEvent.TASK_OFFERED> & {taskData: TaskData};
  [TaskEvent.OFFER_CONSULT]: BaseEvent<TaskEvent.OFFER_CONSULT> & {taskData: TaskData};
  [TaskEvent.HYDRATE]: BaseEvent<TaskEvent.HYDRATE> & {taskData: TaskData; agentId?: string};
  [TaskEvent.CONTACT_UPDATED]: BaseEvent<TaskEvent.CONTACT_UPDATED> & {taskData: TaskData};
  [TaskEvent.CONTACT_OWNER_CHANGED]: BaseEvent<TaskEvent.CONTACT_OWNER_CHANGED> & {
    taskData: TaskData;
  };
  [TaskEvent.ASSIGN]: BaseEvent<TaskEvent.ASSIGN> & {taskData: TaskData};
  [TaskEvent.HOLD_INITIATED]: BaseEvent<TaskEvent.HOLD_INITIATED> & {mediaResourceId: string};
  [TaskEvent.HOLD_SUCCESS]: BaseEvent<TaskEvent.HOLD_SUCCESS> & {
    mediaResourceId: string;
    taskData?: TaskData;
  };
  [TaskEvent.HOLD_FAILED]: BaseEvent<TaskEvent.HOLD_FAILED> & {
    reason?: string;
    mediaResourceId: string;
  };
  [TaskEvent.UNHOLD_INITIATED]: BaseEvent<TaskEvent.UNHOLD_INITIATED> & {mediaResourceId: string};
  [TaskEvent.UNHOLD_SUCCESS]: BaseEvent<TaskEvent.UNHOLD_SUCCESS> & {
    mediaResourceId: string;
    taskData?: TaskData;
  };
  [TaskEvent.UNHOLD_FAILED]: BaseEvent<TaskEvent.UNHOLD_FAILED> & {
    reason?: string;
    mediaResourceId: string;
  };
  [TaskEvent.CONSULT]: BaseEvent<TaskEvent.CONSULT> & {
    destination: string;
    destAgentId?: string;
    destinationType: DestinationType;
  };
  [TaskEvent.CONSULT_SUCCESS]: BaseEvent<TaskEvent.CONSULT_SUCCESS> & {taskData?: TaskData};
  [TaskEvent.CONSULT_CREATED]: BaseEvent<TaskEvent.CONSULT_CREATED> & {taskData: TaskData};
  [TaskEvent.CONSULTING_ACTIVE]: BaseEvent<TaskEvent.CONSULTING_ACTIVE> & {
    consultDestinationAgentJoined: boolean;
    taskData?: TaskData;
  };
  [TaskEvent.CONSULT_END]: BaseEvent<TaskEvent.CONSULT_END> & {taskData?: TaskData};
  [TaskEvent.CONSULT_FAILED]: BaseEvent<TaskEvent.CONSULT_FAILED> & {
    reason?: string;
    taskData?: TaskData;
  };
  [TaskEvent.MERGE_TO_CONFERENCE]: BaseEvent<TaskEvent.MERGE_TO_CONFERENCE>;
  [TaskEvent.CONFERENCE_START]: BaseEvent<TaskEvent.CONFERENCE_START> & {
    participants?: ConferenceParticipant[];
    taskData?: TaskData;
  };
  [TaskEvent.CONFERENCE_FAILED]: BaseEvent<TaskEvent.CONFERENCE_FAILED> & {
    reason?: string;
    taskData?: TaskData;
  };
  [TaskEvent.CONFERENCE_END]: BaseEvent<TaskEvent.CONFERENCE_END> & {taskData: TaskData};
  [TaskEvent.TRANSFER_CONFERENCE]: BaseEvent<TaskEvent.TRANSFER_CONFERENCE> & {agentId?: string};
  [TaskEvent.PARTICIPANT_LEAVE]: BaseEvent<TaskEvent.PARTICIPANT_LEAVE> & {
    participantId?: string;
    taskData: TaskData;
  };
  [TaskEvent.EXIT_CONFERENCE]: BaseEvent<TaskEvent.EXIT_CONFERENCE> & {agentId?: string};
  [TaskEvent.EXIT_CONFERENCE_SUCCESS]: BaseEvent<TaskEvent.EXIT_CONFERENCE_SUCCESS> & {
    taskData: TaskData;
  };
  [TaskEvent.EXIT_CONFERENCE_FAILED]: BaseEvent<TaskEvent.EXIT_CONFERENCE_FAILED> & {
    reason?: string;
  };
  [TaskEvent.TRANSFER_CONFERENCE_SUCCESS]: BaseEvent<TaskEvent.TRANSFER_CONFERENCE_SUCCESS> & {
    taskData: TaskData;
  };
  [TaskEvent.TRANSFER_CONFERENCE_FAILED]: BaseEvent<TaskEvent.TRANSFER_CONFERENCE_FAILED> & {
    reason?: string;
  };
  [TaskEvent.RECORDING_STARTED]: BaseEvent<TaskEvent.RECORDING_STARTED> & {taskData: TaskData};
  [TaskEvent.PAUSE_RECORDING]: BaseEvent<TaskEvent.PAUSE_RECORDING> & {taskData: TaskData};
  [TaskEvent.RESUME_RECORDING]: BaseEvent<TaskEvent.RESUME_RECORDING> & {taskData: TaskData};
  [TaskEvent.TRANSFER_SUCCESS]: BaseEvent<TaskEvent.TRANSFER_SUCCESS> & {taskData?: TaskData};
  [TaskEvent.TRANSFER_FAILED]: BaseEvent<TaskEvent.TRANSFER_FAILED> & {
    reason?: string;
    taskData?: TaskData;
  };
  [TaskEvent.WRAPUP_COMPLETE]: BaseEvent<TaskEvent.WRAPUP_COMPLETE> & {taskData?: TaskData};
  [TaskEvent.TASK_WRAPUP]: BaseEvent<TaskEvent.TASK_WRAPUP> & {taskData?: TaskData};
  [TaskEvent.RONA]: BaseEvent<TaskEvent.RONA> & {taskData?: TaskData; reason?: string};
  [TaskEvent.CONTACT_ENDED]: BaseEvent<TaskEvent.CONTACT_ENDED> & {taskData: TaskData};
  [TaskEvent.ASSIGN_FAILED]: BaseEvent<TaskEvent.ASSIGN_FAILED> & {reason?: string};
  [TaskEvent.INVITE_FAILED]: BaseEvent<TaskEvent.INVITE_FAILED> & {reason?: string};
  [TaskEvent.OUTBOUND_FAILED]: BaseEvent<TaskEvent.OUTBOUND_FAILED> & {
    reason?: string;
    taskData?: TaskData;
  };
  [TaskEvent.CAMPAIGN_PREVIEW_ACCEPT_FAILED]: BaseEvent<TaskEvent.CAMPAIGN_PREVIEW_ACCEPT_FAILED> & {
    taskData?: TaskData;
  };
  [TaskEvent.CAMPAIGN_PREVIEW_SKIP_FAILED]: BaseEvent<TaskEvent.CAMPAIGN_PREVIEW_SKIP_FAILED> & {
    taskData?: TaskData;
  };
  [TaskEvent.CAMPAIGN_PREVIEW_REMOVE_FAILED]: BaseEvent<TaskEvent.CAMPAIGN_PREVIEW_REMOVE_FAILED> & {
    taskData?: TaskData;
  };
  [TaskEvent.SWITCH_TO_MAIN_CALL]: BaseEvent<TaskEvent.SWITCH_TO_MAIN_CALL>;
  [TaskEvent.SWITCH_TO_CONSULT]: BaseEvent<TaskEvent.SWITCH_TO_CONSULT>;
  [TaskEvent.ACCEPT]: BaseEvent<TaskEvent.ACCEPT>;
  [TaskEvent.DECLINE]: BaseEvent<TaskEvent.DECLINE>;
  [TaskEvent.END]: BaseEvent<TaskEvent.END> & {taskData?: TaskData};
  [TaskEvent.CTQ_CANCEL]: BaseEvent<TaskEvent.CTQ_CANCEL> & {taskData: TaskData};
  [TaskEvent.CTQ_CANCEL_FAILED]: BaseEvent<TaskEvent.CTQ_CANCEL_FAILED> & {taskData: TaskData};
}

/**
 * Union of all possible event payloads
 */
export type TaskEventPayload = TaskEventPayloadMap[TaskEvent];

/**
 * Type guard to check event type
 */
export function isEventOfType<T extends TaskEvent>(
  event: TaskEventPayload | undefined,
  type: T
): event is TaskEventPayloadMap[T] {
  return Boolean(event && event.type === type);
}

/**
 * Recording control state for UI controls computer
 */
export interface RecordingControlState {
  available: boolean;
  inProgress: boolean;
}

/**
 * State machine configuration type
 */
export interface TaskStateMachineConfig {
  id: string;
  initial: TaskState;
  context: TaskContext;
  states: Record<string, AnyStateNodeConfig>;
}

export type TaskActionsMap = ActionFunctionMap<
  TaskContext,
  TaskEventPayload,
  never,
  {type: string; params: undefined},
  never,
  never,
  EventObject
>;

export type TaskActionArgs = ActionArgs<TaskContext, TaskEventPayload, TaskEventPayload>;
