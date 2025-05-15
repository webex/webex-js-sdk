import {CallId} from '@webex/calling/dist/types/common/types';
import EventEmitter from 'events';
import {Msg} from '../core/GlobalTypes';

/**
 * Unique identifier for a task
 * @public
 */
export type TaskId = string;

type Enum<T extends Record<string, unknown>> = T[keyof T];

/**
 * Types of destinations for task routing
 * @public
 */
export const DESTINATION_TYPE = {
  /** Route to a queue */
  QUEUE: 'queue',
  /** Route to a dial number */
  DIALNUMBER: 'dialNumber',
  /** Route to a specific agent */
  AGENT: 'agent',
  /** Route to an entry point (only supported for consult operations) */
  ENTRYPOINT: 'entryPoint',
};

/** Type representing valid destination types for task routing */
export type DestinationType = Enum<typeof DESTINATION_TYPE>;

/**
 * Types of destinations for consult transfer operations
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

/** Type representing valid destination types for consult transfers */
export type ConsultTransferDestinationType = Enum<typeof CONSULT_TRANSFER_DESTINATION_TYPE>;

/**
 * Supported media channel types for interactions
 * @public
 */
export const MEDIA_CHANNEL = {
  /** Email communication channel */
  EMAIL: 'email',
  /** Chat communication channel */
  CHAT: 'chat',
  /** Voice communication channel */
  TELEPHONY: 'telephony',
  /** Social media communication channel */
  SOCIAL: 'social',
  /** SMS text messaging channel */
  SMS: 'sms',
  /** Facebook messenger channel */
  FACEBOOK: 'facebook',
  /** WhatsApp messaging channel */
  WHATSAPP: 'whatsapp',
} as const;

/** Type representing valid media channels */
export type MEDIA_CHANNEL = Enum<typeof MEDIA_CHANNEL>;

/**
 * Enumeration of all task-related events that can occur in the contact center system
 * @public
 */
export enum TASK_EVENTS {
  /** New task has arrived */
  TASK_INCOMING = 'task:incoming',
  /** Task has been assigned to an agent */
  TASK_ASSIGNED = 'task:assigned',
  /** Task media state has changed */
  TASK_MEDIA = 'task:media',
  /** Task has been unassigned from an agent */
  TASK_UNASSIGNED = 'task:unassigned',
  /** Task has been put on hold */
  TASK_HOLD = 'task:hold',
  /** Task has been taken off hold */
  TASK_UNHOLD = 'task:unhold',
  /** Consultation has ended */
  TASK_CONSULT_END = 'task:consultEnd',
  /** Queue consultation has been cancelled */
  TASK_CONSULT_QUEUE_CANCELLED = 'task:consultQueueCancelled',
  /** Queue consultation has failed */
  TASK_CONSULT_QUEUE_FAILED = 'task:consultQueueFailed',
  /** Consultation request has been accepted */
  TASK_CONSULT_ACCEPTED = 'task:consultAccepted',
  /** Consultation is in progress */
  TASK_CONSULTING = 'task:consulting',
  /** New consultation has been created */
  TASK_CONSULT_CREATED = 'task:consultCreated',
  /** Consultation has been offered */
  TASK_OFFER_CONSULT = 'task:offerConsult',
  /** Task has been paused */
  TASK_PAUSE = 'task:pause',
  /** Task has been resumed */
  TASK_RESUME = 'task:resume',
  /** Task has ended */
  TASK_END = 'task:end',
  /** Task has entered wrap-up state */
  TASK_WRAPUP = 'task:wrapup',
  /** Task wrap-up has completed */
  TASK_WRAPPEDUP = 'task:wrappedup',
  /** Recording has been paused */
  TASK_RECORDING_PAUSED = 'task:recordingPaused',
  /** Recording pause attempt failed */
  TASK_RECORDING_PAUSE_FAILED = 'task:recordingPauseFailed',
  /** Recording has been resumed */
  TASK_RECORDING_RESUMED = 'task:recordingResumed',
  /** Recording resume attempt failed */
  TASK_RECORDING_RESUME_FAILED = 'task:recordingResumeFailed',
  /** Task has been rejected */
  TASK_REJECT = 'task:rejected',
  /** Task has been hydrated with data */
  TASK_HYDRATE = 'task:hydrate',
  /** New contact has been offered */
  TASK_OFFER_CONTACT = 'task:offerContact',
}

/**
 * Represents a customer interaction within the contact center
 * @public
 */
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
  participants: any; // todo
  /** Unique identifier for the interaction */
  interactionId: string;
  /** Organization identifier */
  orgId: string;
  /** Timestamp when the interaction was created */
  createdTimestamp?: number;
  /** Indicates if wrap-up assistance is enabled */
  isWrapUpAssist?: boolean;
  callProcessingDetails: {
    QMgrName: string;
    taskToBeSelfServiced: string;
    ani: string;
    displayAni: string;
    dnis: string;
    tenantId: string;
    QueueId: string;
    vteamId: string;
    pauseResumeEnabled?: string;
    pauseDuration?: string;
    isPaused?: string;
    recordInProgress?: string;
    recordingStarted?: string;
    ctqInProgress?: string;
    outdialTransferToQueueEnabled?: string;
    convIvrTranscript?: string;
    customerName: string;
    virtualTeamName: string;
    ronaTimeout: string;
    category: string;
    reason: string;
    sourceNumber: string;
    sourcePage: string;
    appUser: string;
    customerNumber: string;
    reasonCode: string;
    IvrPath: string;
    pathId: string;
    fromAddress: string;
    parentInteractionId?: string;
    childInteractionId?: string;
    relationshipType?: string;
    parent_ANI?: string;
    parent_DNIS?: string;
    consultDestinationAgentJoined?: boolean | string;
    consultDestinationAgentName?: string;
    parent_Agent_DN?: string;
    parent_Agent_Name?: string;
    parent_Agent_TeamName?: string;
    isConferencing?: string;
    monitorType?: string;
    workflowName?: string;
    workflowId?: string;
    monitoringInvisibleMode?: string;
    monitoringRequestId?: string;
    participantInviteTimeout?: string;
    mohFileName?: string;
    CONTINUE_RECORDING_ON_TRANSFER?: string;
    EP_ID?: string;
    ROUTING_TYPE?: string;
    fceRegisteredEvents?: string;
    isParked?: string;
    priority?: string;
    routingStrategyId?: string;
    monitoringState?: string;
    BLIND_TRANSFER_IN_PROGRESS?: boolean;
    fcDesktopView?: string;
  };
  mainInteractionId?: string;
  media: Record<
    string,
    {
      mediaResourceId: string;
      mediaType: MEDIA_CHANNEL;
      mediaMgr: string;
      participants: string[];
      mType: string;
      isHold: boolean;
      holdTimestamp: number | null;
    }
  >;
  owner: string;
  mediaChannel: MEDIA_CHANNEL;
  contactDirection: {type: string};
  outboundType?: string;
  callFlowParams: Record<
    string,
    {
      name: string;
      qualifier: string;
      description: string;
      valueDataType: string;
      value: string;
    }
  >;
};

/**
 * Task payload type containing detailed information about a contact center task
 * @public
 */
export type TaskData = {
  /** Unique identifier for the media resource handling this task */
  mediaResourceId: string;
  /** Type of event that triggered this task data */
  eventType: string;
  /** Timestamp when the event occurred */
  eventTime?: number;
  /** Identifier of the agent handling the task */
  agentId: string;
  /** Identifier of the destination agent for transfers/consults */
  destAgentId: string;
  /** Unique tracking identifier for the task */
  trackingId: string;
  /** Media resource identifier for consultation operations */
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
  /** Unique identifier for the interaction */
  interactionId: string;
  /** Organization identifier */
  orgId: string;
  /** Current owner of the task */
  owner: string;
  /** Queue manager handling the task */
  queueMgr: string;
  /** Name of the queue where task is queued */
  queueName?: string;
  /** Type of the task */
  type: string;
  /** Timeout value for RONA (Redirection on No Answer) in seconds */
  ronaTimeout?: number;
  /** Indicates if the task is in consultation state */
  isConsulted?: boolean;
  /** Indicates if the task is in conference state */
  isConferencing: boolean;
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
  /** Indicates if wrap-up is required for this task */
  wrapUpRequired?: boolean;
};

/**
 * Type representing an agent contact message
 * Contains interaction and task related details for agent operations
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
 * Information about a virtual team
 * @public
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
 * Detailed information about a virtual team
 * @public
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
 * @public
 */
export type VTeamSuccess = Msg<{
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
 * Parameters for putting a task on hold
 * @public
 */
export type HoldResumePayload = {
  /** Unique identifier for the media resource to hold */
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
  /**
   * An entryPointId for respective task.
   */
  entryPointId: string;
  /**
   * A valid customer DN, on which the response is expected, maximum length 36 characters.
   */
  destination: string;

  /**
   * The direction of the call.
   */
  direction: 'OUTBOUND';

  /**
   * This is a schema free data tuple to pass-on specific data, depending on the outboundType. Supports a maximum of 30 tuples.
   */
  attributes: {[key: string]: string};

  /**
   * The media type for the request.
   */
  mediaType: 'telephony' | 'chat' | 'social' | 'email';

  /**
   * The outbound type for the task.
   */
  outboundType: 'OUTDIAL' | 'CALLBACK' | 'EXECUTE_FLOW';
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
 * Response type for the task public methods
 */
export type TaskResponse = AgentContact | Error | void;

/**
 * Represents an interface for managing task related operations.
 */
export interface ITask extends EventEmitter {
  /**
   * Event data received in the CC events
   */
  data: TaskData;
  /**
   * Map of task with call
   */
  webCallMap: Record<TaskId, CallId>;
  /**
   * Switch off the call listeners
   */
  unregisterWebCallListeners(): void;
  /**
   * Used to update the task when the data received on each event
   */
  updateTaskData(newData: TaskData): ITask;
  /**
   * Answers/accepts the incoming task
   *
   * @example
   * ```
   * task.accept();
   * ```
   */
  accept(): Promise<TaskResponse>;
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
   * This is used to hold the task.
   * @returns Promise<TaskResponse>
   * @example
   * ```
   * task.hold();
   * ```
   */
  hold(): Promise<TaskResponse>;
  /**
   * This is used to resume the task.
   * @returns Promise<TaskResponse>
   * @example
   * ```
   * task.resume();
   * ```
   */
  resume(): Promise<TaskResponse>;
  /**
   * This is used to end the task.
   * @returns Promise<TaskResponse>
   * @example
   * ```
   * task.end();
   * ```
   */
  end(): Promise<TaskResponse>;
  /**
   * This is used to wrap up the task.
   * @param wrapupPayload
   * @returns Promise<TaskResponse>
   * @example
   * ```
   * task.wrapup(data);
   * ```
   */
  wrapup(wrapupPayload: WrapupPayLoad): Promise<TaskResponse>;
  /**
   * This is used to pause the call recording.
   * @returns Promise<TaskResponse>
   * @example
   * ```
   * task.wrapup();
   * ```
   */
  pauseRecording(): Promise<TaskResponse>;
  /**
   * This is used to resume the call recording.
   * @param resumeRecordingPayload
   * @returns Promise<TaskResponse>
   * @example
   * ```
   * task.resumeRecording();
   * ```
   */
  resumeRecording(resumeRecordingPayload: ResumeRecordingPayload): Promise<TaskResponse>;
}
