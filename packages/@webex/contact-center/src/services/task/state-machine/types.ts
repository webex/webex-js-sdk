/**
 * Task State Machine Types
 *
 * Type definitions for the XState-based task state machine.
 * These types define states, events, context, and schemas for task lifecycle management.
 */

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
}

/**
 * UI Control states derived from state machine. Reuse the Task UI controls surface shape
 * so computed state can flow directly to Task consumers without additional mapping.
 */
export type UIControls = TaskUIControls;

/**
 * Context data maintained by the state machine
 *
 * IMPORTANT: This context should only store data that CANNOT be derived from the state machine's current state.
 *
 * STATE-DERIVED PROPERTIES (NOT stored in context, derived from state machine state):
 * - isHold: Derived from state === TaskState.HELD
 * - isConsulted: Derived from state === TaskState.CONSULTING or state === TaskState.OFFERED_CONSULT
 * - isConferencing: Derived from state === TaskState.CONFERENCING
 * - isConnected: Derived from state === TaskState.CONNECTED
 * - isWrappingUp: Derived from state === TaskState.WRAPPING_UP
 * - isOffered: Derived from state === TaskState.OFFERED or state === TaskState.OFFERED_CONSULT
 *
 * These boolean flags were removed because they duplicate information already available
 * in the state machine's current state, violating the single source of truth principle.
 * Use state.matches(TaskState.XXX) instead to check these conditions.
 */
export interface TaskContext {
  // Task data
  taskData: TaskData | null;

  // Consult tracking
  acceptInitiated: boolean;
  holdInitiated: boolean;
  transferInitiated: boolean;
  conferenceInitiated: boolean;
  consultInitiator: boolean;
  consultDestination: string | null;
  consultDestinationAgentJoined: boolean;

  // Recording tracking derived from task data
  recordingControlsAvailable: boolean;
  recordingInProgress: boolean;

  // UI Control configuration (set at task creation)
  uiControlConfig: UIControlConfig;

  // Computed UI controls (derived from state + context + config)
  uiControls: UIControls;
}

/**
 * Base event type - all events have a type property
 */
type BaseEvent<T extends TaskEvent> = {type: T};

/**
 * Event payload mapping - defines the payload for each event type
 */
interface TaskEventPayloadMap {
  [TaskEvent.TASK_INCOMING]: BaseEvent<TaskEvent.TASK_INCOMING> & {taskData: TaskData};
  [TaskEvent.TASK_OFFERED]: BaseEvent<TaskEvent.TASK_OFFERED> & {taskData: TaskData};
  [TaskEvent.OFFER]: BaseEvent<TaskEvent.OFFER> & {taskData: TaskData};
  [TaskEvent.OFFER_CONTACT]: BaseEvent<TaskEvent.OFFER_CONTACT> & {taskData: TaskData};
  [TaskEvent.OFFER_CONSULT]: BaseEvent<TaskEvent.OFFER_CONSULT> & {taskData: TaskData};
  [TaskEvent.HYDRATE]: BaseEvent<TaskEvent.HYDRATE> & {taskData: TaskData};
  [TaskEvent.ACCEPT]: BaseEvent<TaskEvent.ACCEPT>;
  [TaskEvent.ACCEPT_INITIATED]: BaseEvent<TaskEvent.ACCEPT_INITIATED>;
  [TaskEvent.DECLINE]: BaseEvent<TaskEvent.DECLINE>;
  [TaskEvent.ASSIGN]: BaseEvent<TaskEvent.ASSIGN> & {taskData: TaskData};
  [TaskEvent.HOLD]: BaseEvent<TaskEvent.HOLD> & {mediaResourceId: string};
  [TaskEvent.HOLD_INITIATED]: BaseEvent<TaskEvent.HOLD_INITIATED> & {mediaResourceId: string};
  [TaskEvent.HOLD_SUCCESS]: BaseEvent<TaskEvent.HOLD_SUCCESS> & {
    mediaResourceId: string;
    taskData?: TaskData;
  };
  [TaskEvent.HOLD_FAILED]: BaseEvent<TaskEvent.HOLD_FAILED> & {
    reason?: string;
    mediaResourceId: string;
  };
  [TaskEvent.UNHOLD]: BaseEvent<TaskEvent.UNHOLD> & {mediaResourceId: string};
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
    destinationType: DestinationType;
  };
  [TaskEvent.CONSULT_SUCCESS]: BaseEvent<TaskEvent.CONSULT_SUCCESS> & {taskData?: TaskData};
  [TaskEvent.CONSULT_CREATED]: BaseEvent<TaskEvent.CONSULT_CREATED> & {taskData: TaskData};
  [TaskEvent.CONSULTING_ACTIVE]: BaseEvent<TaskEvent.CONSULTING_ACTIVE> & {
    consultDestinationAgentJoined: boolean;
    taskData?: TaskData;
  };
  [TaskEvent.CONSULT_END]: BaseEvent<TaskEvent.CONSULT_END> & {taskData?: TaskData};
  [TaskEvent.CONSULT_TRANSFER]: BaseEvent<TaskEvent.CONSULT_TRANSFER>;
  [TaskEvent.CONSULT_FAILED]: BaseEvent<TaskEvent.CONSULT_FAILED> & {
    reason?: string;
    taskData?: TaskData;
  };
  [TaskEvent.CONSULT_ACCEPTED]: BaseEvent<TaskEvent.CONSULT_ACCEPTED> & {taskData?: TaskData};
  [TaskEvent.START_CONFERENCE]: BaseEvent<TaskEvent.START_CONFERENCE>;
  [TaskEvent.MERGE_TO_CONFERENCE]: BaseEvent<TaskEvent.MERGE_TO_CONFERENCE>;
  [TaskEvent.CONFERENCE_START]: BaseEvent<TaskEvent.CONFERENCE_START> & {
    participants?: ConferenceParticipant[];
  };
  [TaskEvent.CONFERENCE_END]: BaseEvent<TaskEvent.CONFERENCE_END>;
  [TaskEvent.TRANSFER_CONFERENCE]: BaseEvent<TaskEvent.TRANSFER_CONFERENCE> & {agentId?: string};
  [TaskEvent.PARTICIPANT_JOIN]: BaseEvent<TaskEvent.PARTICIPANT_JOIN> & {
    participant: ConferenceParticipant;
  };
  [TaskEvent.PARTICIPANT_LEAVE]: BaseEvent<TaskEvent.PARTICIPANT_LEAVE> & {participantId: string};
  [TaskEvent.EXIT_CONFERENCE]: BaseEvent<TaskEvent.EXIT_CONFERENCE> & {agentId?: string};
  [TaskEvent.RECORDING_STARTED]: BaseEvent<TaskEvent.RECORDING_STARTED> & {taskData: TaskData};
  [TaskEvent.PAUSE_RECORDING]: BaseEvent<TaskEvent.PAUSE_RECORDING> & {taskData: TaskData};
  [TaskEvent.RESUME_RECORDING]: BaseEvent<TaskEvent.RESUME_RECORDING> & {taskData: TaskData};
  [TaskEvent.TRANSFER]: BaseEvent<TaskEvent.TRANSFER>;
  [TaskEvent.TRANSFER_SUCCESS]: BaseEvent<TaskEvent.TRANSFER_SUCCESS> & {taskData?: TaskData};
  [TaskEvent.TRANSFER_FAILED]: BaseEvent<TaskEvent.TRANSFER_FAILED> & {
    reason?: string;
    taskData?: TaskData;
  };
  [TaskEvent.WRAPUP_START]: BaseEvent<TaskEvent.WRAPUP_START>;
  [TaskEvent.WRAPUP]: BaseEvent<TaskEvent.WRAPUP> & {wrapupData?: any};
  [TaskEvent.WRAPUP_COMPLETE]: BaseEvent<TaskEvent.WRAPUP_COMPLETE> & {taskData?: TaskData};
  [TaskEvent.END]: BaseEvent<TaskEvent.END> & {taskData?: TaskData};
  [TaskEvent.RONA]: BaseEvent<TaskEvent.RONA> & {taskData?: TaskData; reason?: string};
  [TaskEvent.CONTACT_ENDED]: BaseEvent<TaskEvent.CONTACT_ENDED> & {taskData: TaskData};
  [TaskEvent.AUTO_WRAPUP]: BaseEvent<TaskEvent.AUTO_WRAPUP>;
  [TaskEvent.ASSIGN_FAILED]: BaseEvent<TaskEvent.ASSIGN_FAILED> & {reason?: string};
  [TaskEvent.INVITE_FAILED]: BaseEvent<TaskEvent.INVITE_FAILED> & {reason?: string};
  [TaskEvent.OUTBOUND_FAILED]: BaseEvent<TaskEvent.OUTBOUND_FAILED> & {reason?: string};
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
  states: Record<string, any>;
}
