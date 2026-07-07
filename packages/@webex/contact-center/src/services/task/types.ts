/* eslint-disable import/no-cycle */
import type {AnyActorRef} from 'xstate';
import {TaskEventPayload} from './state-machine';
import {Msg} from '../core/GlobalTypes';
import AutoWrapup from './AutoWrapup';

/**
 * Unique identifier for a task in the contact center system
 * @public
 */
export type TaskId = string;

/**
 * Unique identifier for a call in the Webex calling system
 */
export type CallId = string;

/**
 * Helper type for creating enum-like objects with type safety
 * @internal
 */
type Enum<T extends Record<string, unknown>> = T[keyof T];

/**
 * Defines the valid destination types for routing tasks within the contact center
 * Used to specify where a task should be directed
 * @public
 */
export const DESTINATION_TYPE = {
  /** Route task to a specific queue */
  QUEUE: 'queue',
  /** Route task to a specific dial number */
  DIALNUMBER: 'dialNumber',
  /** Route task to a specific agent */
  AGENT: 'agent',
  /** Route task to an entry point (supported only for consult operations) */
  ENTRYPOINT: 'entryPoint',
};

/**
 * Type representing valid destination types for task routing
 * Derived from the DESTINATION_TYPE constant
 * @public
 */
export type DestinationType = Enum<typeof DESTINATION_TYPE>;

/**
 * Defines the valid destination types for consult transfer operations
 * Used when transferring a task after consultation
 * @public
 */
export const CONSULT_TRANSFER_DESTINATION_TYPE = {
  /** Transfer to a specific agent */
  AGENT: 'agent',
  /** Transfer to an entry point */
  ENTRYPOINT: 'entryPoint',
  /** Transfer to a dial number */
  DIALNUMBER: 'dialNumber',
  /** Transfer to a queue */
  QUEUE: 'queue',
};

/**
 * Type representing valid destination types for consult transfers
 * Derived from the CONSULT_TRANSFER_DESTINATION_TYPE constant
 * @public
 */
export type ConsultTransferDestinationType = Enum<typeof CONSULT_TRANSFER_DESTINATION_TYPE>;

/**
 * Defines all supported media channel types for customer interactions
 * These represent the different ways customers can communicate with agents
 * @public
 */
export const MEDIA_CHANNEL = {
  /** Email-based communication channel */
  EMAIL: 'email',
  /** Web-based chat communication channel */
  CHAT: 'chat',
  /** Voice/phone communication channel */
  TELEPHONY: 'telephony',
  /** Social media platform communication channel */
  SOCIAL: 'social',
  /** SMS text messaging communication channel */
  SMS: 'sms',
  /** Facebook Messenger communication channel */
  FACEBOOK: 'facebook',
  /** WhatsApp messaging communication channel */
  WHATSAPP: 'whatsapp',
} as const;

/**
 * Type representing valid media channels
 * Derived from the MEDIA_CHANNEL constant
 * @public
 */
export type MEDIA_CHANNEL = Enum<typeof MEDIA_CHANNEL>;

/**
 * Supported task channel types for UI control configuration
 */
export const TASK_CHANNEL_TYPE = {
  VOICE: 'voice',
  DIGITAL: 'digital',
} as const;

export type TaskChannelType = Enum<typeof TASK_CHANNEL_TYPE>;

/**
 * Voice channel variants that toggle PSTN/WebRTC specific behaviors
 */
export const VOICE_VARIANT = {
  PSTN: 'pstn',
  WEBRTC: 'webrtc',
} as const;

export type VoiceVariant = Enum<typeof VOICE_VARIANT>;

/**
 * Enumeration of all task-related events that can occur in the contact center system
 * These events represent different states and actions in the task lifecycle
 * @public
 */
export enum TASK_EVENTS {
  /**
   * Triggered when a new task is received by the system
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_INCOMING, (task: ITask) => {
   *   console.log('New task received:', task.data.interactionId);
   *   // Handle incoming task
   * });
   * ```
   */
  TASK_INCOMING = 'task:incoming',

  /**
   * Triggered when a task is successfully assigned to an agent
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_ASSIGNED, (task: ITask) => {
   *   console.log('Task assigned:', task.data.interactionId);
   *   // Begin handling the assigned task
   * });
   * ```
   */
  TASK_ASSIGNED = 'task:assigned',

  /**
   * Triggered when the media state of a task changes
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_MEDIA, (track: MediaStreamTrack) => {
   *   // Handle media track updates
   * });
   * ```
   */
  TASK_MEDIA = 'task:media',

  /**
   * Triggered when a task is removed from an agent
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_UNASSIGNED, (task: ITask) => {
   *   console.log('Task unassigned:', task.data.interactionId);
   *   // Clean up task resources
   * });
   * ```
   */
  TASK_UNASSIGNED = 'task:unassigned',

  /**
   * Triggered when a task is placed on hold
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_HOLD, (task: ITask) => {
   *   console.log('Task placed on hold:', task.data.interactionId);
   *   // Update UI to show hold state
   * });
   * ```
   */
  TASK_HOLD = 'task:hold',

  /**
   * Triggered when a task is resumed from hold
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_RESUME, (task: ITask) => {
   *   console.log('Task resumed from hold:', task.data.interactionId);
   *   // Update UI to show active state
   * });
   * ```
   */
  TASK_RESUME = 'task:resume',

  /**
   * Triggered when a consultation session ends
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONSULT_END, (task: ITask) => {
   *   console.log('Consultation ended:', task.data.interactionId);
   *   // Clean up consultation resources
   * });
   * ```
   */
  TASK_CONSULT_END = 'task:consultEnd',

  /**
   * Triggered when a queue consultation is cancelled
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED, (task: ITask) => {
   *   console.log('Queue consultation cancelled:', task.data.interactionId);
   *   // Handle consultation cancellation
   * });
   * ```
   */
  TASK_CONSULT_QUEUE_CANCELLED = 'task:consultQueueCancelled',

  /**
   * Triggered when a queue consultation fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED, (task: ITask) => {
   *   console.log('Queue consultation failed:', task.data.interactionId);
   *   // Handle consultation failure
   * });
   * ```
   */
  TASK_CONSULT_QUEUE_FAILED = 'task:consultQueueFailed',

  /**
   * Triggered whenever task UI controls are recalculated
   */
  TASK_UI_CONTROLS_UPDATED = 'task:ui-controls-updated',

  /**
   * Triggered when a consultation request is accepted
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONSULT_ACCEPTED, (task: ITask) => {
   *   console.log('Consultation accepted:', task.data.interactionId);
   *   // Begin consultation
   * });
   * ```
   */
  TASK_CONSULT_ACCEPTED = 'task:consultAccepted',

  /**
   * Triggered when consultation is in progress
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONSULTING, (task: ITask) => {
   *   console.log('Consulting in progress:', task.data.interactionId);
   *   // Handle ongoing consultation
   * });
   * ```
   */
  TASK_CONSULTING = 'task:consulting',

  /**
   * Triggered when a new consultation is created
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONSULT_CREATED, (task: ITask) => {
   *   console.log('Consultation created:', task.data.interactionId);
   *   // Initialize consultation
   * });
   * ```
   */
  TASK_CONSULT_CREATED = 'task:consultCreated',

  /**
   * Triggered when a consultation is offered
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_OFFER_CONSULT, (task: ITask) => {
   *   console.log('Consultation offered:', task.data.interactionId);
   *   // Handle consultation offer
   * });
   * ```
   */
  TASK_OFFER_CONSULT = 'task:offerConsult',

  /**
   * Triggered when a task is completed/terminated
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_END, (task: ITask) => {
   *   console.log('Task ended:', task.data.interactionId);
   *   // Clean up and finalize task
   * });
   * ```
   */
  TASK_END = 'task:end',

  /**
   * Triggered when a task enters wrap-up state
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_WRAPUP, (task: ITask) => {
   *   console.log('Task in wrap-up:', task.data.interactionId);
   *   // Begin wrap-up process
   * });
   * ```
   */
  TASK_WRAPUP = 'task:wrapup',

  /**
   * Triggered when task wrap-up is completed
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_WRAPPEDUP, (task: ITask) => {
   *   console.log('Task wrapped up:', task.data.interactionId);
   *   // Finalize task completion
   * });
   * ```
   */
  TASK_WRAPPEDUP = 'task:wrappedup',

  /**
   * Triggered when the task state machine reaches a final state and resources should be cleaned up.
   * Used internally by TaskManager to perform collection/call cleanup.
   * @internal
   */
  TASK_CLEANUP = 'task:cleanup',

  /**
   * Triggered when recording is started
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_RECORDING_STARTED, (task: ITask) => {
   *   console.log('Recording started:', task.data.interactionId);
   * });
   * ```
   */
  TASK_RECORDING_STARTED = 'task:recordingStarted',

  /**
   * Triggered when recording is paused
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_RECORDING_PAUSED, (task: ITask) => {
   *   console.log('Recording paused:', task.data.interactionId);
   *   // Update recording state
   * });
   * ```
   */
  TASK_RECORDING_PAUSED = 'task:recordingPaused',

  /**
   * Triggered when recording pause attempt fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_RECORDING_PAUSE_FAILED, (task: ITask) => {
   *   console.log('Recording pause failed:', task.data.interactionId);
   *   // Handle pause failure
   * });
   * ```
   */
  TASK_RECORDING_PAUSE_FAILED = 'task:recordingPauseFailed',

  /**
   * Triggered when recording is resumed
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_RECORDING_RESUMED, (task: ITask) => {
   *   console.log('Recording resumed:', task.data.interactionId);
   *   // Update recording state
   * });
   * ```
   */
  TASK_RECORDING_RESUMED = 'task:recordingResumed',

  /**
   * Triggered when recording resume attempt fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_RECORDING_RESUME_FAILED, (task: ITask) => {
   *   console.log('Recording resume failed:', task.data.interactionId);
   *   // Handle resume failure
   * });
   * ```
   */
  TASK_RECORDING_RESUME_FAILED = 'task:recordingResumeFailed',

  /**
   * Triggered when a task is rejected/unanswered
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_REJECT, (task: ITask) => {
   *   console.log('Task rejected:', task.data.interactionId);
   *   // Handle task rejection
   * });
   * ```
   */
  TASK_REJECT = 'task:rejected',

  /**
   * Triggered when an outdial call fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, (reason: string) => {
   *   console.log('Outdial failed:', reason);
   *   // Handle outdial failure
   * });
   * ```
   */
  TASK_OUTDIAL_FAILED = 'task:outdialFailed',

  /**
   * Triggered when a task is populated with data
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_HYDRATE, (task: ITask) => {
   *   console.log('Task hydrated:', task.data.interactionId);
   *   // Process task data
   * });
   * ```
   */
  TASK_HYDRATE = 'task:hydrate',

  /**
   * Triggered when a new contact is offered
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_OFFER_CONTACT, (task: ITask) => {
   *   console.log('Contact offered:', task.data.interactionId);
   *   // Handle contact offer
   * });
   * ```
   */
  TASK_OFFER_CONTACT = 'task:offerContact',

  /**
   * Triggered when a task has been successfully auto-answered
   * This event is emitted after the SDK automatically accepts a task due to:
   * - WebRTC calls with auto-answer enabled
   * - Agent-initiated outdial calls
   * - Other auto-answer scenarios
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_AUTO_ANSWERED, (task: ITask) => {
   *   console.log('Task auto-answered:', task.data.interactionId);
   *   // Update UI - enable cancel button, etc.
   * });
   * ```
   */
  TASK_AUTO_ANSWERED = 'task:autoAnswered',

  /**
   * Triggered when a conference is being established
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONFERENCE_ESTABLISHING, (task: ITask) => {
   *   console.log('Conference establishing:', task.data.interactionId);
   *   // Handle conference setup in progress
   * });
   * ```
   */
  TASK_CONFERENCE_ESTABLISHING = 'task:conferenceEstablishing',

  /**
   * Triggered when a conference is started successfully
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONFERENCE_STARTED, (task: ITask) => {
   *   console.log('Conference started:', task.data.interactionId);
   *   // Handle conference start
   * });
   * ```
   */
  TASK_CONFERENCE_STARTED = 'task:conferenceStarted',

  /**
   * Triggered when a conference fails to start
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONFERENCE_FAILED, (task: ITask) => {
   *   console.log('Conference failed:', task.data.interactionId);
   *   // Handle conference failure
   * });
   * ```
   */
  TASK_CONFERENCE_FAILED = 'task:conferenceFailed',

  /**
   * Triggered when a conference is ended successfully
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONFERENCE_ENDED, (task: ITask) => {
   *   console.log('Conference ended:', task.data.interactionId);
   *   // Handle conference end
   * });
   * ```
   */
  TASK_CONFERENCE_ENDED = 'task:conferenceEnded',

  /**
   * Triggered when a participant joins the conference
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_PARTICIPANT_JOINED, (task: ITask) => {
   *   console.log('Participant joined conference:', task.data.interactionId);
   *   // Handle participant joining
   * });
   * ```
   */
  TASK_PARTICIPANT_JOINED = 'task:participantJoined',

  /**
   * Triggered when a participant leaves the conference
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_PARTICIPANT_LEFT, (task: ITask) => {
   *   console.log('Participant left conference:', task.data.interactionId);
   *   // Handle participant leaving
   * });
   * ```
   */
  TASK_PARTICIPANT_LEFT = 'task:participantLeft',

  /**
   * Triggered when conference transfer is successful
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONFERENCE_TRANSFERRED, (task: ITask) => {
   *   console.log('Conference transferred:', task.data.interactionId);
   *   // Handle successful conference transfer
   * });
   * ```
   */
  TASK_CONFERENCE_TRANSFERRED = 'task:conferenceTransferred',

  /**
   * Triggered when conference transfer fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONFERENCE_TRANSFER_FAILED, (task: ITask) => {
   *   console.log('Conference transfer failed:', task.data.interactionId);
   *   // Handle failed conference transfer
   * });
   * ```
   */
  TASK_CONFERENCE_TRANSFER_FAILED = 'task:conferenceTransferFailed',

  /**
   * Triggered when ending a conference fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CONFERENCE_END_FAILED, (task: ITask) => {
   *   console.log('Conference end failed:', task.data.interactionId);
   *   // Handle failed conference end
   * });
   * ```
   */
  TASK_CONFERENCE_END_FAILED = 'task:conferenceEndFailed',

  /**
   * Triggered when participant exit from conference fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_PARTICIPANT_LEFT_FAILED, (task: ITask) => {
   *   console.log('Participant failed to leave conference:', task.data.interactionId);
   *   // Handle failed participant exit
   * });
   * ```
   */
  TASK_PARTICIPANT_LEFT_FAILED = 'task:participantLeftFailed',

  /**
   * Triggered when agent initiates exit from conference
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_EXIT_CONFERENCE, (task: ITask) => {
   *   console.log('Exiting conference:', task.data.interactionId);
   *   // Handle conference exit initiation
   * });
   * ```
   */
  TASK_EXIT_CONFERENCE = 'task:exitConference',

  /**
   * Triggered when agent initiates conference transfer
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_TRANSFER_CONFERENCE, (task: ITask) => {
   *   console.log('Transferring conference:', task.data.interactionId);
   *   // Handle conference transfer initiation
   * });
   * ```
   */
  TASK_TRANSFER_CONFERENCE = 'task:transferConference',

  /**
   * Triggered when agent switches between consult call and main call.
   * Use task.uiControls to determine current state and button visibility.
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_SWITCH_CALL, (task: ITask) => {
   *   console.log('Call switched:', task.data.interactionId);
   *   // Update UI based on task.uiControls.main.switch / task.uiControls.consult.switch
   * });
   * ```
   */
  TASK_SWITCH_CALL = 'task:switchCall',

  /**
   * Triggered when a contact is merged
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_MERGED, (task: ITask) => {
   *   console.log('Contact merged:', task.data.interactionId);
   *   // Handle contact merge
   * });
   * ```
   */
  TASK_MERGED = 'task:merged',

  /**
   * Triggered when a participant enters post-call activity state
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_POST_CALL_ACTIVITY, (task: ITask) => {
   *   console.log('Participant in post-call activity:', task.data.interactionId);
   *   // Handle post-call activity
   * });
   * ```
   */
  TASK_POST_CALL_ACTIVITY = 'task:postCallActivity',

  /**
   * Triggered when a multi-login task update should hydrate SDK instances without Mobius registration.
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, (task: ITask) => {
   *   console.log('Multi-login hydrate:', task.data.interactionId);
   * });
   * ```
   */
  TASK_MULTI_LOGIN_HYDRATE = 'task:multiLoginHydrate',

  /**
   * Triggered when a campaign preview contact is offered to the agent
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION, (data: AgentContact) => {
   *   console.log('Campaign preview contact received:', data.interactionId);
   *   // Handle campaign preview reservation
   * });
   * ```
   */
  TASK_CAMPAIGN_PREVIEW_RESERVATION = 'task:campaignPreviewReservation',

  /**
   * Triggered when accepting a campaign preview contact fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_ACCEPT_FAILED, (task: ITask) => {
   *   console.log('Campaign preview accept failed:', task.data.interactionId);
   *   // Handle accept failure
   * });
   * ```
   */
  TASK_CAMPAIGN_PREVIEW_ACCEPT_FAILED = 'task:campaignPreviewAcceptFailed',

  /**
   * Triggered when skipping a campaign preview contact fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_SKIP_FAILED, (task: ITask) => {
   *   console.log('Campaign preview skip failed:', task.data.interactionId);
   *   // Handle skip failure
   * });
   * ```
   */
  TASK_CAMPAIGN_PREVIEW_SKIP_FAILED = 'task:campaignPreviewSkipFailed',

  /**
   * Triggered when removing a campaign preview contact fails
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_REMOVE_FAILED, (task: ITask) => {
   *   console.log('Campaign preview remove failed:', task.data.interactionId);
   *   // Handle remove failure
   * });
   * ```
   */
  TASK_CAMPAIGN_PREVIEW_REMOVE_FAILED = 'task:campaignPreviewRemoveFailed',

  /**
   * Triggered when a campaign contact is updated (e.g., after skip or remove, when the next contact is offered)
   * @example
   * ```typescript
   * task.on(TASK_EVENTS.TASK_CAMPAIGN_CONTACT_UPDATED, (task: ITask) => {
   *   console.log('Campaign contact updated:', task.data.interactionId);
   *   // Handle updated campaign contact (e.g., display next contact)
   * });
   * ```
   */
  TASK_CAMPAIGN_CONTACT_UPDATED = 'task:campaignContactUpdated',
}

/**
 * Represents a customer interaction within the contact center system
 * Contains comprehensive details about an ongoing customer interaction
 * @public
 */
export interface CallAssociatedDatum {
  /** Whether the field can be edited by the agent */
  agentEditable: boolean;
  /** Whether the field is visible to the agent */
  agentViewable: boolean;
  /** Display name for the field */
  displayName: string;
  /** Whether the field is global */
  global: boolean;
  /** Whether the field is secure */
  isSecure: boolean;
  /** Internal field name */
  name: string;
  /** Whether the field is reportable */
  reportable: boolean;
  /** Secure key identifier */
  secureKeyId: string;
  /** Secure key version */
  secureKeyVersion: number;
  /** Data type of the field */
  type: string;
  /** Field value */
  value: string;
}

export type CallAssociatedData = Record<string, CallAssociatedDatum>;

export type CallAssociatedDetails = Record<string, string>;

export interface FlowParameter {
  /** Parameter name */
  name?: string;
  /** Additional qualifier */
  qualifier?: string;
  /** Description of the parameter */
  description?: string;
  /** Data type of the value */
  valueDataType?: string;
  /** Value associated with the parameter */
  value?: string;
}

export interface InteractionParticipant {
  /** Unique participant identifier */
  id: string;
  /** Participant type label used by backend */
  pType: string;
  /** Friendly participant type */
  type: string;
  /** Whether the participant has joined */
  hasJoined: boolean;
  /** Whether the participant has left */
  hasLeft: boolean;
  /** Whether the participant is still in pre-dial */
  isInPredial: boolean;
  /** Optional caller identifier */
  callerId?: string | null;
  /** Whether auto-answer is enabled */
  autoAnswerEnabled?: boolean;
  /** Backchannel/bnr details */
  bnrDetails?: unknown;
  /** Channel identifier for the participant */
  channelId?: string;
  /** Current consult state */
  consultState?: string | null;
  /** Timestamp when consult started */
  consultTimestamp?: number | null;
  /** Current participant state */
  currentState?: string | null;
  /** Timestamp of the current state */
  currentStateTimestamp?: number | null;
  /** Device call identifier */
  deviceCallId?: string | null;
  /** Device identifier */
  deviceId?: string | null;
  /** Device type (AGENT_DN, BROWSER, etc.) */
  deviceType?: string | null;
  /** Dial number associated with participant */
  dn?: string | null;
  /** Whether participant is currently consulted */
  isConsulted?: boolean;
  /** Whether participant offer is active */
  isOffered?: boolean;
  /** Whether participant is in wrap-up */
  isWrapUp?: boolean;
  /** Whether participant completed wrap-up */
  isWrappedUp?: boolean;
  /** Timestamp of when participant joined */
  joinTimestamp?: number | null;
  /** Last updated timestamp */
  lastUpdated?: number | null;
  /** Friendly name of participant */
  name?: string | null;
  /** Queue identifier associated with participant */
  queueId?: string;
  /** Queue manager identifier */
  queueMgrId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Site identifier */
  siteId?: string;
  /** Skill identifier */
  skillId?: string | null;
  /** Skill name */
  skillName?: string | null;
  /** Skill list for participant */
  skills?: string[];
  /** Team identifier */
  teamId?: string;
  /** Team name */
  teamName?: string;
  /** Timestamp for wrap-up */
  wrapUpTimestamp?: number | null;
  /** Additional metadata */
  [key: string]: unknown;
}

export type InteractionParticipants = Record<string, InteractionParticipant>;

/**
 * Media entry type from interaction.media
 * Used for media state tracking in consult and conference scenarios
 */
export type MediaEntry = {
  /** Unique identifier for the media resource */
  mediaResourceId: string;
  /** Type of media channel */
  mediaType: MEDIA_CHANNEL;
  /** Media manager handling this media */
  mediaMgr: string;
  /** List of participant identifiers */
  participants: string[];
  /** Type of media (e.g., 'mainCall', 'consult') */
  mType: string;
  /** Indicates if media is on hold */
  isHold: boolean;
  /** Timestamp when media was put on hold */
  holdTimestamp: number | null;
};

export type Interaction = {
  /** Indicates if the interaction is managed by Flow Control */
  isFcManaged: boolean;
  /** Indicates if the interaction has been terminated */
  isTerminated: boolean;
  /** The type of media channel for this interaction */
  mediaType: MEDIA_CHANNEL;
  /** List of previous virtual teams that handled this interaction */
  previousVTeams: string[];
  /** Current state of the interaction */
  state: string;
  /** Current virtual team handling the interaction */
  currentVTeam: string;
  /** List of participants in the interaction */
  participants: InteractionParticipants;
  /** Detailed call associated data */
  callAssociatedData?: CallAssociatedData;
  /** Simplified call associated key/value pairs */
  callAssociatedDetails?: CallAssociatedDetails;
  /** Unique identifier for the interaction */
  interactionId: string;
  /** Organization identifier */
  orgId: string;
  /** Timestamp when the interaction was created */
  createdTimestamp?: number;
  /** Indicates if wrap-up assistance is enabled */
  isWrapUpAssist?: boolean;
  /** Identifier of parent interaction if applicable */
  parentInteractionId?: string;
  /** Indicates if media is forked for this interaction */
  isMediaForked?: boolean;
  /** Retroactive flow properties returned by backend */
  flowProperties?: Record<string, unknown> | null;
  /** Media specific properties returned by backend */
  mediaProperties?: Record<string, unknown> | null;
  /**
   * Detailed call processing information and metadata.
   * Mirrors the callProcessingDetails section described in Webex Contact Center Agent Contact payloads.
   */
  callProcessingDetails: {
    /** Name of the Queue Manager handling this interaction */
    QMgrName: string;
    /** Indicates if the task should be self-serviced */
    taskToBeSelfServiced: string;
    /** Automatic Number Identification (caller's number) */
    ani: string;
    /** Display version of the ANI */
    displayAni: string;
    /** Dialed Number Identification Service number */
    dnis: string;
    /** Tenant identifier */
    tenantId: string;
    /** Queue identifier */
    QueueId: string;
    /** Virtual team identifier */
    vteamId: string;
    /** Agent capability for pause/resume on this interaction */
    pauseResumeEnabled?: boolean;
    /** Duration of pause in seconds */
    pauseDuration?: string;
    /** Legacy pause indicator (recordInProgress=false is the active pause signal) */
    isPaused?: boolean;
    /** Recording is actively capturing audio right now */
    recordInProgress?: boolean;
    /** Recording was started for this interaction (may be paused) */
    recordingStarted?: boolean;
    /** Customer geographic region */
    customerRegion?: string;
    /** Flow tag identifier */
    flowTagId?: string;
    /** Indicates if Consult to Queue is in progress */
    ctqInProgress?: boolean;
    /** Indicates if outdial transfer to queue is enabled */
    outdialTransferToQueueEnabled?: boolean;
    /** IVR conversation transcript */
    convIvrTranscript?: string;
    /** Customer's name */
    customerName: string;
    /** Name of the virtual team */
    virtualTeamName: string;
    /** RONA (Redirection on No Answer) timeout in seconds */
    ronaTimeout: string;
    /** Category of the interaction */
    category: string;
    /** Reason for the interaction */
    reason: string;
    /** Source number for the interaction */
    sourceNumber: string;
    /** Source page that initiated the interaction */
    sourcePage: string;
    /** Application user identifier */
    appUser: string;
    /** Customer's contact number */
    customerNumber: string;
    /** Code indicating the reason for interaction */
    reasonCode: string;
    /** Path taken through the IVR system */
    IvrPath: string;
    /** Identifier for the IVR path */
    pathId: string;
    /** Email address or contact point that initiated the interaction */
    fromAddress: string;
    /** Identifier of the parent interaction for related interactions */
    parentInteractionId?: string;
    /** Identifier of the child interaction for related interactions */
    childInteractionId?: string;
    /** Type of relationship between parent and child interactions */
    relationshipType?: string;
    /** ANI of the parent interaction */
    parent_ANI?: string;
    /** DNIS of the parent interaction */
    parent_DNIS?: string;
    /** Indicates if the consulted destination agent has joined */
    consultDestinationAgentJoined?: boolean | string;
    /** Name of the destination agent for consultation */
    consultDestinationAgentName?: string;
    /** DN of the parent interaction's agent */
    parent_Agent_DN?: string;
    /** Name of the parent interaction's agent */
    parent_Agent_Name?: string;
    /** Team name of the parent interaction's agent */
    parent_Agent_TeamName?: string;
    /** Indicates if the interaction is in conference mode */
    isConferencing?: string;
    /** Type of monitoring being performed */
    monitorType?: string;
    /** Name of the workflow being executed */
    workflowName?: string;
    /** Identifier of the workflow */
    workflowId?: string;
    /** Indicates if monitoring is in invisible mode */
    monitoringInvisibleMode?: string;
    /** Identifier for the monitoring request */
    monitoringRequestId?: string;
    /** Timeout for participant invitation */
    participantInviteTimeout?: string;
    /** Filename for music on hold */
    mohFileName?: string;
    /** Flag for continuing recording during transfer */
    CONTINUE_RECORDING_ON_TRANSFER?: string;
    /** Entry point identifier */
    EP_ID?: string;
    /** Type of routing being used */
    ROUTING_TYPE?: string;
    /** Events registered with Flow Control Engine */
    fceRegisteredEvents?: string;
    /** Indicates if the interaction is parked */
    isParked?: string;
    /** Priority level of the interaction */
    priority?: string;
    /** Identifier for the routing strategy */
    routingStrategyId?: string;
    /** Current state of monitoring */
    monitoringState?: string;
    /** Indicates if blind transfer is in progress */
    BLIND_TRANSFER_IN_PROGRESS?: boolean;
    /** Desktop view configuration for Flow Control */
    fcDesktopView?: string;
    /** Agent ID who initiated the outdial call */
    outdialAgentId?: string;
    /** Indicates if the customer has left the call during an active consult */
    hasCustomerLeft?: string;
    /** Indicates if the skip action is disabled for campaign preview contacts */
    campaignPreviewSkipDisabled?: string;
    /** Indicates if the remove action is disabled for campaign preview contacts */
    campaignPreviewRemoveDisabled?: string;
    /** Auto-action to perform when campaign preview offer times out (ACCEPT, SKIP, REMOVE) */
    campaignPreviewAutoAction?: string;
    /** Timestamp (ms) when the campaign preview offer expires */
    campaignPreviewOfferTimeout?: string;
  };
  /** Main interaction identifier for related interactions */
  mainInteractionId?: string;
  /** Timestamp when interaction entered queue */
  queuedTimestamp?: number | null;
  /** Media-specific information for the interaction */
  media: Record<string, MediaEntry>;
  /** Owner of the interaction */
  owner: string;
  /** Primary media channel for the interaction */
  mediaChannel: string;
  /** Direction information for the contact */
  contactDirection: {type: string};
  /** Type of outbound interaction */
  outboundType?: string;
  /** Optional workflow manager identifier */
  workflowManager?: string | null;
  /** Parameters passed through the call flow */
  callFlowParams?: Record<string, FlowParameter>;
};

/**
 * Task payload mirroring the Agent Contact event payload from Webex Contact Center
 * (developer.webex.com). Arrives on AGENT_* websocket events and is the source of truth
 * for UI/state machine updates.
 * @public
 */
export type RealtimeTranscription = {
  agentId: string;
  orgId: string;
  notifType: string;
  notifDetails: {
    actionEvent: string;
  };
  data: {
    role: 'AGENT' | 'CALLER';
    utteranceId: string;
    conversationId: string;
    publishTimestamp: number;
    messageId: string;
    isFinal: boolean;
    languageCode: string;
    orgId: string;
    content: string;
  };
};

export type TaskData = {
  /** Primary media resource identifier for the active leg (matches interaction.media[].mediaResourceId) */
  mediaResourceId: string;
  /** Agent event name from the websocket stream (e.g., AGENT_CONTACT_ASSIGNED) */
  eventType: string;
  /** Timestamp when the event occurred */
  eventTime?: number;
  /** Identifier of the agent handling the task */
  agentId: string;
  /** Identifier of the destination agent for transfers/consults */
  destAgentId: string;
  /** Unique tracking identifier for the task */
  trackingId: string;
  /** Media resource identifier for consultation leg when present */
  consultMediaResourceId: string;
  /** Detailed interaction information */
  interaction: Interaction;
  /** Unique identifier for the participant */
  participantId?: string;
  /** Indicates if the task is from the owner */
  fromOwner?: boolean;
  /** Indicates if the task is to the owner */
  toOwner?: boolean;
  /** Identifier for child interaction in consult/transfer scenarios */
  childInteractionId?: string;
  /** Interaction/contact identifier from backend (same as interaction.interactionId) */
  interactionId: string;
  /** Organization identifier */
  orgId: string;
  /** Current owner of the task */
  owner: string;
  /** Queue manager handling the task */
  queueMgr: string;
  /** Name of the queue where task is queued */
  queueName?: string;
  /** Task/interaction type returned by the platform (routing/monitoring/etc.) */
  type: string;
  /** Timeout value for RONA (Redirection on No Answer) in seconds */
  ronaTimeout?: number;
  /** Indicates if the task is in consultation state */
  isConsulted?: boolean;
  /** Indicates if the task is in conference state */
  isConferencing: boolean;
  /** Indicates if a conference is currently in progress (2+ active agents) */
  isConferenceInProgress?: boolean;
  /** Identifier of agent who last updated the task */
  updatedBy?: string;
  /** Type of destination for transfer/consult */
  destinationType?: string;
  /** Indicates if the task was automatically resumed */
  autoResumed?: boolean;
  /** Code indicating the reason for an action */
  reasonCode?: string | number;
  /** Description of the reason for an action */
  reason?: string;
  /** Identifier of the consulting agent */
  consultingAgentId?: string;
  /** Unique identifier for the task */
  taskId?: string;
  /** Task details including state and media information */
  task?: Interaction;
  /** Unique identifier for monitoring offered events */
  id?: string;
  /** Indicates if the web call is muted */
  isWebCallMute?: boolean;
  /** Identifier for reservation interaction */
  reservationInteractionId?: string;
  /** Identifier for the reserved agent channel (used for campaign tasks) */
  reservedAgentChannelId?: string;
  /** Indicates if wrap-up is required for this task */
  wrapUpRequired?: boolean;

  /**
   * Current consultation status derived from state machine
   * Values: CONSULT_INITIATED, CONSULT_ACCEPTED, BEING_CONSULTED,
   *         BEING_CONSULTED_ACCEPTED, CONNECTED, CONFERENCE, CONSULT_COMPLETED
   */
  consultStatus?: string;

  /**
   * Indicates if consultation is in progress (state machine: CONSULTING)
   */
  isConsultInProgress?: boolean;

  /**
   * Indicates if the task is incoming for the active agent
   */
  isIncomingTask?: boolean;

  /**
   * Indicates if the task is on hold (state machine: HELD)
   */
  isOnHold?: boolean;

  /**
   * Indicates if customer is currently in the call
   * Derived from participants in main media
   */
  isCustomerInCall?: boolean;

  /**
   * Count of conference participants (agents only)
   * Used for determining if max participants reached
   */
  conferenceParticipantsCount?: number;

  /**
   * Indicates if this is a secondary agent (consulted party)
   */
  isSecondaryAgent?: boolean;

  /**
   * Indicates if this is a secondary EP-DN agent (telephony consult to external)
   */
  isSecondaryEpDnAgent?: boolean;

  /**
   * Task state for MPC (Multi-Party Conference) scenarios
   * Maps participant consultState to task state
   */
  mpcState?: string;
  /** Indicates if auto-answer is in progress for this task */
  isAutoAnswering?: boolean;
  /** Indicates if wrap-up is required for this task */
  agentsPendingWrapUp?: string[];
};

export type TaskUIControlState = {
  isVisible: boolean;
  isEnabled: boolean;
};

/**
 * UI control representation for a single interaction leg.
 */
export type InteractionUIControls = {
  accept: TaskUIControlState;
  decline: TaskUIControlState;
  hold: TaskUIControlState;
  transfer: TaskUIControlState;
  consult: TaskUIControlState;
  end: TaskUIControlState;
  recording: TaskUIControlState;
  mute: TaskUIControlState;
  consultTransfer: TaskUIControlState;
  endConsult: TaskUIControlState;
  conference: TaskUIControlState;
  exitConference: TaskUIControlState;
  transferConference: TaskUIControlState;
  mergeToConference: TaskUIControlState;
  wrapup: TaskUIControlState;
  switch: TaskUIControlState;
};

export type TaskUILeg = 'main' | 'consult';

/**
 * UI controls surfaced to task consumers.
 * Consumers should read controls from the per-leg surfaces and use `activeLeg`
 * to determine which one is currently interactive.
 */
export type TaskUIControls = {
  main: InteractionUIControls;
  consult: InteractionUIControls;
  activeLeg: TaskUILeg;
};

/**
 * Helper class for managing task action control state
 * Tracks visibility and enabled state for task actions that can be executed
 * @public
 */
/**
 * Type representing an agent contact message within the contact center system
 * Contains comprehensive interaction and task related details for agent operations
 * @public
 */
export type AgentContact = Msg<{
  /** Unique identifier for the media resource */
  mediaResourceId: string;
  /** Type of the event (e.g., 'AgentDesktopMessage') */
  eventType: string;
  /** Timestamp when the event occurred */
  eventTime?: number;
  /** Unique identifier of the agent handling the contact */
  agentId: string;
  /** Identifier of the destination agent for transfers/consults */
  destAgentId: string;
  /** Unique tracking identifier for the contact */
  trackingId: string;
  /** Media resource identifier for consult operations */
  consultMediaResourceId: string;
  /** Detailed interaction information including media and participant data */
  interaction: Interaction;
  /** Unique identifier for the participant */
  participantId?: string;
  /** Indicates if the message is from the owner of the interaction */
  fromOwner?: boolean;
  /** Indicates if the message is to the owner of the interaction */
  toOwner?: boolean;
  /** Identifier for child interaction in case of consult/transfer */
  childInteractionId?: string;
  /** Unique identifier for the interaction */
  interactionId: string;
  /** Organization identifier */
  orgId: string;
  /** Current owner of the interaction */
  owner: string;
  /** Queue manager handling the interaction */
  queueMgr: string;
  /** Name of the queue where interaction is queued */
  queueName?: string;
  /** Type of the contact/interaction */
  type: string;
  /** Timeout value for RONA (Redirection on No Answer) in seconds */
  ronaTimeout?: number;
  /** Indicates if the interaction is in consult state */
  isConsulted?: boolean;
  /** Indicates if the interaction is in conference state */
  isConferencing: boolean;
  /** Identifier of the agent who last updated the interaction */
  updatedBy?: string;
  /** Type of destination for transfer/consult */
  destinationType?: string;
  /** Indicates if the interaction was automatically resumed */
  autoResumed?: boolean;
  /** Code indicating the reason for an action */
  reasonCode?: string | number;
  /** Description of the reason for an action */
  reason?: string;
  /** Identifier of the consulting agent */
  consultingAgentId?: string;
  /** Unique identifier for the task */
  taskId?: string;
  /** Task details including media and state information */
  task?: Interaction;
  /** Identifier of the supervisor monitoring the interaction */
  supervisorId?: string;
  /** Type of monitoring (e.g., 'SILENT', 'BARGE_IN') */
  monitorType?: string;
  /** Dial number of the supervisor */
  supervisorDN?: string;
  /** Unique identifier for monitoring offered events */
  id?: string;
  /** Indicates if the web call is muted */
  isWebCallMute?: boolean;
  /** Identifier for reservation interaction */
  reservationInteractionId?: string;
  /** Identifier for the reserved agent channel */
  reservedAgentChannelId?: string;
  /** Current monitoring state information */
  monitoringState?: {
    /** Type of monitoring state */
    type: string;
  };
  /** Name of the supervisor monitoring the interaction */
  supervisorName?: string;
}>;

/**
 * Information about a virtual team in the contact center
 * @ignore
 */
export type VTeam = {
  /** Profile ID of the agent in the virtual team */
  agentProfileId: string;
  /** Session ID of the agent in the virtual team */
  agentSessionId: string;
  /** Type of channel handled by the virtual team */
  channelType: string;
  /** Type of the virtual team */
  type: string;
  /** Optional tracking identifier */
  trackingId?: string;
};

/**
 * Detailed information about a virtual team configuration
 * @ignore
 */
export type VteamDetails = {
  /** Name of the virtual team */
  name: string;
  /** Type of channel handled by the virtual team */
  channelType: string;
  /** Unique identifier for the virtual team */
  id: string;
  /** Type of the virtual team */
  type: string;
  /** ID of the analyzer associated with the team */
  analyzerId: string;
};

/**
 * Response type for successful virtual team operations
 * Contains details about virtual teams and their capabilities
 * @ignore
 */
export type VTeamSuccess = Msg<{
  /** Response data containing team information */
  data: {
    /** List of virtual team details */
    vteamList: Array<VteamDetails>;
    /** Whether queue consultation is allowed */
    allowConsultToQueue: boolean;
  };
  /** Method name from JavaScript */
  jsMethod: string;
  /** Data related to the call */
  callData: string;
  /** Session ID of the agent */
  agentSessionId: string;
}>;

/**
 * Parameters for putting a task on hold or resuming from hold
 * @public
 */
export type HoldResumePayload = {
  /** Unique identifier for the media resource to hold/resume */
  mediaResourceId: string;
};

/**
 * Parameters for resuming a task's recording
 * @public
 */
export type ResumeRecordingPayload = {
  /** Indicates if the recording was automatically resumed */
  autoResumed: boolean;
};

/**
 * Parameters for transferring a task to another destination
 * @public
 */
export type TransferPayLoad = {
  /** Destination identifier where the task will be transferred to */
  to: string;
  /** Type of the destination (queue, agent, etc.) */
  destinationType: DestinationType;
};

/**
 * Parameters for initiating a consultative transfer
 * @public
 */
export type ConsultTransferPayLoad = {
  /** Destination identifier for the consultation transfer */
  to: string;
  /** Type of the consultation transfer destination */
  destinationType: ConsultTransferDestinationType;
};

/**
 * Parameters for initiating a consultation with another agent or queue
 * @public
 */
export type ConsultPayload = {
  /** Destination identifier for the consultation */
  to: string | undefined;
  /** Type of the consultation destination (agent, queue, etc.) */
  destinationType: DestinationType;
  /** Whether to hold other participants during consultation (always true) */
  holdParticipants?: boolean;
};

/**
 * Parameters for ending a consultation task
 * @public
 */
export type ConsultEndPayload = {
  /** Indicates if this is a consultation operation */
  isConsult: boolean;
  /** Indicates if this involves a secondary entry point or DN agent */
  isSecondaryEpDnAgent?: boolean;
  /** Optional queue identifier for the consultation */
  queueId?: string;
  /** Identifier of the task being consulted */
  taskId: string;
};

/**
 * Parameters for transferring a task to another destination
 * @public
 */
export type TransferPayload = {
  /** Destination identifier where the task will be transferred */
  to: string | undefined;
  /** Type of the transfer destination */
  destinationType: DestinationType;
};

/**
 * Options for configuring transfer behavior
 * @public
 */
export type TransferOptions = {
  /** Additional transfer configuration options */
  [key: string]: unknown;
};

/**
 * API payload for ending a consultation
 * This is the actual payload that is sent to the developer API
 * @public
 */
export type ConsultEndAPIPayload = {
  /** Optional identifier of the queue involved in the consultation */
  queueId?: string;
};

/**
 * Data required for consulting and conferencing operations
 * @public
 */
export type ConsultConferenceData = {
  /** Identifier of the agent initiating consult/conference */
  agentId?: string;
  /** Target destination for the consult/conference */
  to: string | undefined;
  /** Type of destination (e.g., 'agent', 'queue') */
  destinationType: string;
};

/**
 * Parameters required for cancelling a consult to queue operation
 * @public
 */
export type cancelCtq = {
  /** Identifier of the agent cancelling the CTQ */
  agentId: string;
  /** Identifier of the queue where consult was initiated */
  queueId: string;
};

/**
 * Parameters required for declining a task
 * @public
 */
export type declinePayload = {
  /** Identifier of the media resource to decline */
  mediaResourceId: string;
};

/**
 * Parameters for wrapping up a task with relevant completion details
 * @public
 */
export type WrapupPayLoad = {
  /** The reason provided for wrapping up the task */
  wrapUpReason: string;
  /** Auxiliary code identifier associated with the wrap-up state */
  auxCodeId: string;
};

/**
 * Configuration parameters for initiating outbound dialer tasks
 * @public
 */
export type DialerPayload = {
  /** An entryPointId for respective task */
  entryPointId: string;
  /** A valid customer DN, on which the response is expected, maximum length 36 characters */
  destination: string;
  /** The direction of the call */
  direction: 'OUTBOUND';
  /** Schema-free data tuples to pass specific data based on outboundType (max 30 tuples) */
  attributes: {[key: string]: string};
  /** The media type for the request */
  mediaType: 'telephony' | 'chat' | 'social' | 'email';
  /** The outbound type for the task */
  outboundType: 'OUTDIAL' | 'CALLBACK' | 'EXECUTE_FLOW';
  /** The Outdial ANI number that will be used while making a call to the customer.  */
  origin: string;
};

/**
 * Payload for campaign preview contact operations (accept, skip, remove)
 * @public
 */
export type PreviewContactPayload = {
  /** The interaction ID from the campaign reservation */
  interactionId: string;
  /** The campaign name (not a UUID). Available from the reservation event at
   *  `task.data.interaction.callProcessingDetails.campaignId` or `task.data.campaignId`. */
  campaignId: string;
};

/**
 * Data structure for cleaning up contact resources
 * @public
 */
export type ContactCleanupData = {
  /** Type of cleanup operation being performed */
  type: string;
  /** Organization identifier where cleanup is occurring */
  orgId: string;
  /** Identifier of the agent associated with the contacts */
  agentId: string;
  /** Detailed data about the cleanup operation */
  data: {
    /** Type of event that triggered the cleanup */
    eventType: string;
    /** Identifier of the interaction being cleaned up */
    interactionId: string;
    /** Organization identifier */
    orgId: string;
    /** Media manager handling the cleanup */
    mediaMgr: string;
    /** Tracking identifier for the cleanup operation */
    trackingId: string;
    /** Type of media being cleaned up */
    mediaType: string;
    /** Optional destination information */
    destination?: string;
    /** Whether this is a broadcast cleanup */
    broadcast: boolean;
    /** Type of cleanup being performed */
    type: string;
  };
};

/**
 * Boolean-like fields in callProcessingDetails that may arrive as strings.
 * Used by taskDataNormalizer to coerce payloads to actual booleans.
 */
export type CallProcessingBooleanKey =
  | 'recordingStarted'
  | 'recordInProgress'
  | 'isPaused'
  | 'pauseResumeEnabled'
  | 'ctqInProgress'
  | 'outdialTransferToQueueEnabled'
  | 'taskToBeSelfServiced'
  | 'CONTINUE_RECORDING_ON_TRANSFER'
  | 'isParked'
  | 'participantInviteTimeout'
  | 'checkAgentAvailability';

/**
 * Interaction-level boolean fields that may arrive as strings from backend payloads.
 */
export type InteractionBooleanKey = 'isFcManaged' | 'isMediaForked' | 'isTerminated';

/**
 * Participant boolean fields that may arrive as strings and need normalization.
 */
export type ParticipantBooleanKey =
  | 'autoAnswerEnabled'
  | 'hasJoined'
  | 'hasLeft'
  | 'isConsulted'
  | 'isInPredial'
  | 'isOffered'
  | 'isWrapUp'
  | 'isWrappedUp';

/**
 * Response type for task public methods
 * Can be an {@link AgentContact} object containing updated task state,
 * an Error in case of failure, or void for operations that don't return data
 * @public
 */
export type TaskResponse = AgentContact | Error | void;

/**
 * Payload shape used by consult conference helper utilities.
 */
export type consultConferencePayloadData = {
  agentId?: string;
  destinationType?: string;
  destAgentId?: string;
};

/**
 * Minimal event-emitter contract exposed to SDK consumers.
 * Defined here so that consumers do NOT need `@types/node` in their tsconfig.
 * The runtime Task class still extends Node's EventEmitter (via ampersand-events),
 * which satisfies this interface at runtime.
 * @public
 */
export interface IEventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, listener: (...args: any[]) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, listener: (...args: any[]) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, ...args: any[]): boolean;
}

/**
 * Interface for managing task-related operations in the contact center
 * Extends IEventEmitter to support event-driven task updates
 */
export interface ITask extends IEventEmitter {
  /**
   * Event data received in the Contact Center events.
   * Contains detailed task information including interaction details, media resources,
   * and participant data as defined in {@link TaskData}
   */
  data: TaskData;

  /**
   * Map associating tasks with their corresponding call identifiers.
   */
  webCallMap: Record<TaskId, CallId>;

  /**
   * Auto-wrapup timer for the task
   * This is used to automatically wrap up tasks after a specified duration
   * as defined in {@link AutoWrapup}
   */
  autoWrapup?: AutoWrapup;

  /**
   * Latest UI controls derived from the state machine.
   * Each control has `isVisible` and `isEnabled` flags computed from current task state.
   * Subscribe to {@link TASK_EVENTS.TASK_UI_CONTROLS_UPDATED} for change notifications.
   */
  readonly uiControls: TaskUIControls;

  /**
   * State machine instance for managing task state transitions and derived properties.
   * The state machine handles:
   * - State transitions (IDLE → OFFERED → CONNECTED → HELD, etc.)
   * - Derived properties (canHold, canResume, isConsulted, etc.)
   * - Action availability based on current state
   *
   * This is part of the migration from manual state management to centralized state machine.
   * During the transition period, both the old setUIControls() and state machine coexist.
   *
   * @see createTaskStateMachine
   * @internal
   */
  stateMachineService?: AnyActorRef;
  state?: any;

  /**
   * Helper method to send events to the state machine.
   * This is part of the migration to XState.
   * @internal
   */
  sendStateMachineEvent: (event: TaskEventPayload) => void;

  /**
   * Cancels the auto-wrapup timer for the task.
   * This method stops the auto-wrapup process if it is currently active.
   * Note: This is supported only in single session mode. Not supported in multi-session mode.
   * @returns void
   */
  cancelAutoWrapupTimer(): void;

  /**
   * Deregisters all web call event listeners.
   * Used when cleaning up task resources.
   * @ignore
   */
  unregisterWebCallListeners(): void;

  /**
   * Updates the task data with new information
   * @param newData - Updated task data to apply, must conform to {@link TaskData} structure
   * @returns Updated task instance
   * @ignore
   */
  updateTaskData(newData: TaskData): void;

  /**
   * Answers or accepts an incoming task.
   * Once accepted, the task will be assigned to the agent and trigger a {@link TASK_EVENTS.TASK_ASSIGNED} event.
   * The response will contain updated agent contact information as defined in {@link AgentContact}.
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.accept();
   * ```
   */
  accept(): Promise<TaskResponse>;

  /**
   * Declines an incoming task for Browser Login
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.decline();
   * ```
   */
  decline(): Promise<TaskResponse>;

  /**
   * Places the current task on hold.
   * @param mediaResourceId - Optional media resource ID to use for the hold operation. If not provided, uses the task's current mediaResourceId
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * // Hold with default mediaResourceId
   * await task.hold();
   *
   * // Hold with custom mediaResourceId
   * await task.hold('custom-media-resource-id');
   * ```
   */
  hold(mediaResourceId?: string): Promise<TaskResponse>;

  /**
   * Resumes a task that was previously on hold.
   * @param mediaResourceId - Optional media resource ID to use for the resume operation. If not provided, uses the task's current mediaResourceId from interaction media
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * // Resume with default mediaResourceId
   * await task.resume();
   *
   * // Resume with custom mediaResourceId
   * await task.resume('custom-media-resource-id');
   * ```
   */
  resume(mediaResourceId?: string): Promise<TaskResponse>;

  /**
   * Ends/terminates the current task.
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.end();
   * ```
   */
  end(): Promise<TaskResponse>;

  /**
   * Initiates wrap-up process for the task with specified details.
   * @param wrapupPayload - Wrap-up details including reason and auxiliary code
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.wrapup({
   *   wrapUpReason: "Customer issue resolved",
   *   auxCodeId: "RESOLVED"
   * });
   * ```
   */
  wrapup(wrapupPayload: WrapupPayLoad): Promise<TaskResponse>;

  /**
   * Pauses the recording for current task.
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.pauseRecording();
   * ```
   */
  pauseRecording(): Promise<TaskResponse>;

  /**
   * Resumes a previously paused recording.
   * @param resumeRecordingPayload - Parameters for resuming the recording
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.resumeRecording({
   *   autoResumed: false
   * });
   * ```
   */
  resumeRecording(resumeRecordingPayload: ResumeRecordingPayload): Promise<TaskResponse>;

  /**
   * Initiates a consultation with another agent or queue.
   * @param consultPayload - Consultation details including destination and type
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.consult({ to: "agentId", destinationType: "agent" });
   * ```
   */
  consult(consultPayload: ConsultPayload): Promise<TaskResponse>;

  /**
   * Ends an ongoing consultation.
   * @param consultEndPayload - Details for ending the consultation
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.endConsult({ isConsult: true, taskId: "taskId" });
   * ```
   */
  endConsult(consultEndPayload: ConsultEndPayload): Promise<TaskResponse>;

  /**
   * Transfers the task to another agent or queue.
   * @param transferPayload - Transfer details including destination and type
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.transfer({ to: "queueId", destinationType: "queue" });
   * ```
   */
  transfer(transferPayload: TransferPayLoad, options?: TransferOptions): Promise<TaskResponse>;

  /**
   * Initiates a consult conference (merge consult call with main call).
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.consultConference();
   * ```
   */
  consultConference(): Promise<TaskResponse>;

  /**
   * Exits from an ongoing conference.
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.exitConference();
   * ```
   */
  exitConference(): Promise<TaskResponse>;

  /**
   * Transfers the conference to another participant.
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.transferConference();
   * ```
   */
  transferConference(): Promise<TaskResponse>;

  /**
   * Toggles between consult call and main call during consulting.
   * If on consult leg, switches to main call (holds consult).
   * If on main call, switches to consult (resumes consult).
   * Only available when in CONSULTING state.
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await task.switchCall();
   * ```
   */
  switchCall(): Promise<TaskResponse>;

  /**
   * Toggles mute/unmute for the local audio stream during a WebRTC task.
   * @returns Promise<void>
   * @example
   * ```typescript
   * await task.toggleMute();
   * ```
   */
  toggleMute(): Promise<void>;
}

/**
 * Interface for managing digital channel task operations in the contact center
 * Digital channels (chat, email, social, SMS) have a simpler interface than voice
 * Extends ITask but overrides updateTaskData to return IDigital
 * @public
 */
export interface IDigital extends Omit<ITask, 'updateTaskData'> {
  /**
   * Updates the task data
   * @param newData - Updated task data
   * @param shouldOverwrite - Whether to completely replace existing data
   * @returns Updated Digital task instance
   */
  updateTaskData(newData: TaskData, shouldOverwrite?: boolean): IDigital;
}

/**
 * Interface for managing voice/telephony task operations in the contact center
 * Extends ITask with voice-specific functionality for hold/resume operations
 * @public
 */
export interface IVoice extends ITask {
  /**
   * Toggles hold/resume state for a voice task.
   * If the task is currently on hold, it will be resumed.
   * If the task is active, it will be placed on hold.
   * @returns Promise<TaskResponse>
   * @example
   * ```typescript
   * await voiceTask.holdResume();
   * ```
   */
  holdResume(): Promise<TaskResponse>;
}

/**
 * Configuration options for voice task UI controls
 */
export type VoiceUIControlOptions = {
  isEndTaskEnabled?: boolean;
  isEndConsultEnabled?: boolean;
  voiceVariant?: VoiceVariant;
  isRecordingEnabled?: boolean;
};

/**
 * Participant information for UI display
 */
export type Participant = {
  id: string;
  name?: string;
  pType?: string;
};

/**
 * @deprecated Use Participant instead
 */
export type TaskAccessorParticipant = Participant;

export interface IWebRTC extends IVoice {
  /**
   * This method is used to mute/unmute the call.
   * @returns Promise<void>
   * @example
   * ```typescript
   * task.toggleMute();
   * ```
   */
  toggleMute(): Promise<void>;
  /**
   * Decline the incoming task for Browser Login
   *
   * @example
   * ```
   * task.decline();
   * ```
   */
  decline(): Promise<TaskResponse>;
  /**
   * This method is used to unregister the web call listeners.
   * @returns void
   * @example
   * ```typescript
   * task.unregisterWebCallListeners();
   * ```
   */
  unregisterWebCallListeners(): void;
}

export type WebSocketPayload = TaskData & {
  type: string;
  mediaResourceId?: string;
  reason?: string;
  /**
   * Optional real-time transcript chunk payload.
   * Present on REAL_TIME_TRANSCRIPTION notifications.
   */
  data?: RealtimeTranscription['data'];
};

export type WebSocketMessage = {
  keepalive?: 'true' | 'false' | boolean;
  type?: string;
  data: WebSocketPayload;
};

/**
 * Actions to be performed after handling an event
 *
 * These actions represent TaskManager-level concerns (task collection lifecycle,
 * resource cleanup) rather than task-level state machine concerns. The separation
 * ensures proper responsibility:
 * - TaskManager: Collection management, metrics, cleanup
 * - State Machine: Task state transitions, event emissions, UI controls
 */
export interface TaskEventActions {
  task?: ITask;
}

/**
 * Context for processing an event
 *
 * Contains all information needed to process a WebSocket event:
 * - Event type and payload from the backend
 * - Task instance (if exists)
 * - Pre-mapped state machine event (if applicable)
 */
export interface EventContext {
  eventType: string;
  payload: WebSocketPayload;
  task?: ITask;
  stateMachineEvent?: TaskEventPayload | null;
}
