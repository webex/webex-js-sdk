import {CallId} from '@webex/calling/dist/types/common/types';
import EventEmitter from 'events';
import {Msg} from '../core/GlobalTypes';

export type TaskId = string;

type Enum<T extends Record<string, unknown>> = T[keyof T];

export const DESTINATION_TYPE = {
  QUEUE: 'queue',
  DIALNUMBER: 'dialNumber',
  AGENT: 'agent',
  ENTRYPOINT: 'entryPoint', // Entrypoint is only supported for consult and not for transfer
};

export type DestinationType = Enum<typeof DESTINATION_TYPE>;

export const CONSULT_TRANSFER_DESTINATION_TYPE = {
  AGENT: 'agent',
  ENTRYPOINT: 'entryPoint',
  DIALNUMBER: 'dialNumber',
};

export type ConsultTransferDestinationType = Enum<typeof CONSULT_TRANSFER_DESTINATION_TYPE>;

type MEDIA_CHANNEL =
  | 'email'
  | 'chat'
  | 'telephony'
  | 'social'
  | 'sms'
  | 'facebook'
  | 'whatsapp'
  | string;

export const TASK_EVENTS = {
  TASK_INCOMING: 'task:incoming',
  TASK_ASSIGNED: 'task:assigned',
  TASK_MEDIA: 'task:media',
  TASK_UNASSIGNED: 'task:unassigned',
  TASK_HOLD: 'task:hold',
  TASK_UNHOLD: 'task:unhold',
  TASK_CONSULT_END: 'task:consultEnd',
  TASK_CONSULT_QUEUE_CANCELLED: 'task:consultQueueCancelled',
  TASK_CONSULT_QUEUE_FAILED: 'task:consultQueueFailed',
  TASK_CONSULT_ACCEPTED: 'task:consultAccepted',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',
  TASK_END: 'task:end',
  TASK_WRAPUP: 'task:wrapup',
  TASK_REJECT: 'task:rejected',
  TASK_HYDRATE: 'task:hydrate',
} as const;

export type TASK_EVENTS = Enum<typeof TASK_EVENTS>;

export type Interaction = {
  isFcManaged: boolean;
  isTerminated: boolean;
  mediaType: MEDIA_CHANNEL;
  previousVTeams: string[];
  state: string;
  currentVTeam: string;
  participants: any; // todo
  interactionId: string;
  orgId: string;
  createdTimestamp?: number;
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
 * Task payload type
 */
export type TaskData = {
  mediaResourceId: string;
  eventType: string;
  eventTime?: number;
  agentId: string;
  destAgentId: string;
  trackingId: string;
  consultMediaResourceId: string;
  interaction: Interaction;
  participantId?: string;
  fromOwner?: boolean;
  toOwner?: boolean;
  childInteractionId?: string;
  interactionId: string;
  orgId: string;
  owner: string;
  queueMgr: string;
  queueName?: string;
  type: string;
  ronaTimeout?: number;
  isConsulted?: boolean;
  isConferencing: boolean;
  updatedBy?: string;
  destinationType?: string;
  autoResumed?: boolean;
  reasonCode?: string | number;
  reason?: string;
  consultingAgentId?: string;
  taskId?: string;
  task?: Interaction;
  id?: string; // unique id in monitoring offered event
  isWebCallMute?: boolean;
  reservationInteractionId?: string;
};

export type AgentContact = Msg<{
  mediaResourceId: string;
  eventType: string;
  eventTime?: number;
  agentId: string;
  destAgentId: string;
  trackingId: string;
  consultMediaResourceId: string;
  interaction: Interaction;
  participantId?: string;
  fromOwner?: boolean;
  toOwner?: boolean;
  childInteractionId?: string;
  interactionId: string;
  orgId: string;
  owner: string;
  queueMgr: string;
  queueName?: string;
  type: string;
  ronaTimeout?: number;
  isConsulted?: boolean;
  isConferencing: boolean;
  updatedBy?: string;
  destinationType?: string;
  autoResumed?: boolean;
  reasonCode?: string | number;
  reason?: string;
  consultingAgentId?: string;
  taskId?: string;
  task?: Interaction;
  supervisorId?: string;
  monitorType?: string;
  supervisorDN?: string;
  id?: string; // unique id in monitoring offered event
  isWebCallMute?: boolean;
  reservationInteractionId?: string;
  reservedAgentChannelId?: string;
  monitoringState?: {
    type: string;
  };
  supervisorName?: string;
}>;

export type VTeam = {
  agentProfileId: string;
  agentSessionId: string;
  channelType: string;
  type: string;
  trackingId?: string;
};

export type VteamDetails = {
  name: string;
  channelType: string;
  id: string;
  type: string;
  analyzerId: string;
};

export type VTeamSuccess = Msg<{
  data: {
    vteamList: Array<VteamDetails>;
    allowConsultToQueue: boolean;
  };
  jsMethod: string;
  callData: string;
  agentSessionId: string;
}>;

/**
 * Parameters to be passed for pause recording task
 */
export type HoldResumePayload = {
  mediaResourceId: string;
};

/**
 * Parameters to be passed for resume recording task
 */
export type ResumeRecordingPayload = {
  autoResumed: boolean;
};

/**
 * Parameters to be passed for transfer task
 */
export type TransferPayLoad = {
  to: string;
  destinationType: DestinationType;
};

/**
 * Parameters to be passed for transfer task
 */
export type ConsultTransferPayLoad = {
  to: string;
  destinationType: ConsultTransferDestinationType;
};

/**
 * Parameters to be passed for consult task
 */
export type ConsultPayload = {
  to: string | undefined;
  destinationType: DestinationType;
  holdParticipants?: boolean; // This value is assumed to be always true irrespective of the value passed in the API
};

/**
 * Parameters to be passed for consult end task
 */
export type ConsultEndPayload = {
  isConsult: boolean;
  isSecondaryEpDnAgent?: boolean;
  queueId?: string; // Dev portal API docs state that it requires queueId, but it's optional in Desktop usage
  taskId: string;
};

/**
 * Parameters to be passed for transfer task
 */
export type TransferPayload = {
  to: string | undefined;
  destinationType: DestinationType;
};

/**
 * Parameters to be passed for consult end task
 * This is the actual payload that is sent to the developer API
 */
export type ConsultEndAPIPayload = {
  queueId?: string;
};

export type ConsultConferenceData = {
  agentId?: string;
  to: string | undefined;
  destinationType: string;
};

export type cancelCtq = {
  agentId: string;
  queueId: string;
};

export type declinePayload = {
  mediaResourceId: string;
};

/**
 * Parameters to be passed for wrapup task
 */
export type WrapupPayLoad = {
  wrapUpReason: string;
  auxCodeId: string;
};

/**
 * Parameters to be passed for outbound dialer task
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

export type ContactCleanupData = {
  type: string;
  orgId: string;
  agentId: string;
  data: {
    eventType: string;
    interactionId: string;
    orgId: string;
    mediaMgr: string;
    trackingId: string;
    mediaType: string;
    destination?: string;
    broadcast: boolean;
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
