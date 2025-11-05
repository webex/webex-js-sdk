import {EventEmitter} from 'events';
import {CallId} from '@webex/calling/dist/types/common/types';
import {interpret, Interpreter} from 'xstate';
import {
  ITask,
  TaskData,
  TaskResponse,
  WrapupPayLoad,
  TaskId,
  TransferPayLoad,
  TaskButtonControl,
  TaskUIActions,
  DESTINATION_TYPE,
} from './types';
import {CC_FILE} from '../../constants';
import {getErrorDetails} from '../core/Utils';
import routingContact from './contact';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import LoggerProxy from '../../logger-proxy';
import {
  createTaskStateMachineWithActions,
  createActionsWithCallbacks,
  TaskEvent,
  TaskState,
  TaskContext,
  TaskEventPayload,
  type ActionCallbacks,
} from './state-machine';
import AutoWrapup from './AutoWrapup';

const PARTICIPANT_TYPE_AGENT = 'Agent';
const PARTICIPANT_TYPE_CUSTOMER = 'Customer';
const PARTICIPANT_TYPE_SUPERVISOR = 'Supervisor';
const PARTICIPANT_TYPE_VVA = 'VVA';

const EXCLUDED_PARTICIPANT_TYPES = [
  PARTICIPANT_TYPE_AGENT,
  PARTICIPANT_TYPE_CUSTOMER,
  PARTICIPANT_TYPE_SUPERVISOR,
  PARTICIPANT_TYPE_VVA,
];

const MEDIA_TYPE_CONSULT = 'consult';
const MEDIA_TYPE_TELEPHONY = 'telephony';

const INTERACTION_STATE_NEW = 'new';
const INTERACTION_STATE_CONSULT = 'consult';
const INTERACTION_STATE_CONNECTED = 'connected';
const INTERACTION_STATE_CONFERENCE = 'conference';
const INTERACTION_STATE_WRAPUP = 'wrapup';
const INTERACTION_STATE_POST_CALL = 'post_call';

const CONSULT_STATE_INITIATED = 'INITIATED';
const CONSULT_STATE_COMPLETED = 'COMPLETED';
const CONSULT_STATE_CONFERENCING = 'CONFERENCING';

const RELATIONSHIP_TYPE_CONSULT = 'CONSULT';

const TASK_STATE_CONSULT = 'consult';
const TASK_STATE_CONSULTING = 'consulting';
const TASK_STATE_CONSULT_COMPLETED = 'consult_completed';

/**
 * Participant information for UI display
 */
export type Participant = {
  id: string;
  name?: string;
  pType?: string;
};

/**
 * Immutable task properties computed once at task creation.
 * These properties don't change throughout the task lifecycle.
 */
export interface TaskImmutableProps {
  /** Unique interaction identifier */
  readonly interactionId: string | null;
  /** Media type (telephony, chat, email) */
  readonly mediaType: string | null;
  /** Media channel identifier */
  readonly mediaChannel: string | null;
  /** True if this is a telephony task */
  readonly isCall: boolean;
  /** True if this is a chat task */
  readonly isChat: boolean;
  /** True if this is an email task */
  readonly isEmail: boolean;
  /** True if this is a digital channel (chat or email) */
  readonly isDigitalChannel: boolean;
  /** True if agent is the secondary agent in consult/conference */
  readonly isSecondaryAgent: boolean;
  /** True if agent is secondary EP/DN agent */
  readonly isSecondaryEpDnAgent: boolean;
  /** Timestamp when agent joined the interaction */
  readonly agentJoinTimestamp: number | null;
}

/**
 * Dynamic task properties computed on-demand from current task state.
 * These properties reflect the current state and can change as events occur.
 */
export interface TaskDynamicProps {
  /** Full interaction data object */
  readonly interaction: TaskData['interaction'] | null;
  /** Call-specific details */
  readonly callDetails: Record<string, unknown> | null;
  /** Current consultation status */
  readonly consultStatus: string | null;
  /** True if consultation is in progress */
  readonly isConsultInProgress: boolean;
  /** True if main call is on hold */
  readonly isOnHold: boolean;
  /** Alias for isOnHold */
  readonly isHeld: boolean;
  /** True if consult call is on hold */
  readonly consultCallHeld: boolean;
  /** True if conference is active */
  readonly isConferenceInProgress: boolean;
  /** Number of conference participants */
  readonly conferenceParticipantsCount: number;
  /** List of conference participants */
  readonly conferenceParticipants: Participant[];
  /** True if customer is still in the call */
  readonly isCustomerInCall: boolean;
  /** Current MPC (Multi-Party Conference) state */
  readonly mpcState: string | null;
  /** Information about the consulting agent */
  readonly consultingAgent: Participant | null;
  /** Remaining auto-wrapup time in seconds */
  readonly autoWrapupSeconds: number | null;
  /** True if auto-wrapup can be cancelled */
  readonly canCancelAutoWrapup: boolean;
  /** True if consult has been initiated */
  readonly isConsultInitiated: boolean;
  /** True if consult has been accepted */
  readonly isConsultAccepted: boolean;
  /** True if this agent is being consulted */
  readonly isBeingConsulted: boolean;
  /** True if consult has completed */
  readonly isConsultCompleted: boolean;
  /** True if consult is initiated or accepted */
  readonly isConsultInitiatedOrAccepted: boolean;
  /** True if consult is initiated or accepted (not being consulted) */
  readonly isConsultInitiatedOrAcceptedOnly: boolean;
  /** True if consult is initiated, accepted, or being consulted */
  readonly isConsultInitiatedOrAcceptedOrBeingConsulted: boolean;
  /** True if this agent received a consult request */
  readonly isConsultReceived: boolean;
  /** True if consult is both initiated and accepted */
  readonly isConsultInitiatedAndAccepted: boolean;
  /** True if this is an incoming task for the agent */
  readonly isIncomingTask: boolean;
}

/**
 * UI control state for a single task action button.
 * Represents visibility and enabled state for UI components.
 */
export interface UIControlState {
  /** Whether the button should be displayed */
  visible: boolean;
  /** Whether the button should be clickable (only applies if visible) */
  enabled: boolean;
}

/**
 * UI controls for all task actions.
 * Computed from state machine state and context.
 */
export interface TaskUIControls {
  accept: UIControlState;
  decline: UIControlState;
  hold: UIControlState;
  mute: UIControlState;
  end: UIControlState;
  transfer: UIControlState;
  consult: UIControlState;
  consultTransfer: UIControlState;
  endConsult: UIControlState;
  recording: UIControlState;
  conference: UIControlState;
  wrapup: UIControlState;
  exitConference: UIControlState;
  transferConference: UIControlState;
  mergeToConference: UIControlState;
}

/**
 * Combined task properties for UI components.
 * Provides convenient access to both immutable and dynamic task properties,
 * plus computed UI controls based on state machine state.
 */
export interface TaskDerivedState extends TaskImmutableProps, TaskDynamicProps {
  /** UI controls computed from state machine state */
  uiControls: TaskUIControls;
}

/**
 * @deprecated Use TaskDerivedState instead
 */
export type TaskAccessor = TaskDerivedState;

/**
 * @deprecated Use Participant instead
 */
export type TaskAccessorParticipant = Participant;

export default abstract class Task extends EventEmitter implements ITask {
  protected contact: ReturnType<typeof routingContact>;
  protected metricsManager: MetricsManager;
  public stateMachineService?: Interpreter<TaskContext, any, TaskEventPayload>;
  public data: TaskData;
  public webCallMap: Record<TaskId, CallId>;
  public state: any;
  private ronaTimerId?: NodeJS.Timeout;
  private autoWrapupTimerId?: NodeJS.Timeout;

  /**
   * Immutable task properties computed once at construction.
   * These values don't change throughout the task lifecycle.
   */
  private readonly immutableProps: TaskImmutableProps;

  constructor(contact: ReturnType<typeof routingContact>, data: TaskData) {
    super();
    this.contact = contact;
    this.data = data;
    this.metricsManager = MetricsManager.getInstance();
    this.webCallMap = {};
    if (this.data?.agentId) {
      this.data.isIncomingTask = this.isIncomingTask(this.data.agentId);
    }
    this.immutableProps = this.computeImmutableProps();
    this.initializeStateMachine();
  }

  // Properties from ITask interface
  public autoWrapup?: AutoWrapup;

  // Abstract method that all child classes must implement
  public abstract accept(): Promise<TaskResponse>;

  // Voice-specific methods with default implementations that throw errors
  // Voice class will override these with actual implementations
  public async decline(): Promise<TaskResponse> {
    this.unsupportedMethodError('decline');

    return Promise.reject(new Error('decline not supported for this channel type'));
  }

  public async pauseRecording(): Promise<TaskResponse> {
    this.unsupportedMethodError('pauseRecording');

    return Promise.reject(new Error('pauseRecording not supported for this channel type'));
  }

  public async resumeRecording(): Promise<TaskResponse> {
    this.unsupportedMethodError('resumeRecording');

    return Promise.reject(new Error('resumeRecording not supported for this channel type'));
  }

  public async consult(): Promise<TaskResponse> {
    this.unsupportedMethodError('consult');

    return Promise.reject(new Error('consult not supported for this channel type'));
  }

  public async endConsult(): Promise<TaskResponse> {
    this.unsupportedMethodError('endConsult');

    return Promise.reject(new Error('endConsult not supported for this channel type'));
  }

  public async consultTransfer(): Promise<TaskResponse> {
    this.unsupportedMethodError('consultTransfer');

    return Promise.reject(new Error('consultTransfer not supported for this channel type'));
  }

  public async consultConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('consultConference');

    return Promise.reject(new Error('consultConference not supported for this channel type'));
  }

  public async exitConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('exitConference');

    return Promise.reject(new Error('exitConference not supported for this channel type'));
  }

  public async transferConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('transferConference');

    return Promise.reject(new Error('transferConference not supported for this channel type'));
  }

  public async toggleMute(): Promise<void> {
    this.unsupportedMethodError('toggleMute');

    return Promise.reject(new Error('toggleMute not supported for this channel type'));
  }

  // Utility methods with default implementations
  public cancelAutoWrapupTimer(): void {
    // Default implementation - child classes can override
    if (this.autoWrapupTimerId) {
      clearTimeout(this.autoWrapupTimerId);
      this.autoWrapupTimerId = undefined;
    }
  }

  public unregisterWebCallListeners(): void {
    // Default implementation - child classes can override
    LoggerProxy.log('unregisterWebCallListeners called', {
      module: CC_FILE,
      method: 'unregisterWebCallListeners',
    });
  }

  // Voice tasks use holdResume(), but provide separate methods for interface compliance
  public async hold(): Promise<TaskResponse> {
    this.unsupportedMethodError('hold');

    return Promise.reject(new Error('hold not supported for this channel type'));
  }

  public async resume(): Promise<TaskResponse> {
    this.unsupportedMethodError('resume');

    return Promise.reject(new Error('resume not supported for this channel type'));
  }

  public async holdResume(): Promise<TaskResponse> {
    this.unsupportedMethodError('holdResume');

    return Promise.reject(new Error('holdResume not supported for this channel type'));
  }

  /**
   * Get computed task state for UI components.
   * Combines immutable properties (computed once) with dynamic properties
   * (computed fresh from current state) and UI controls (computed from state machine).
   *
   * @returns Combined immutable and dynamic task properties plus UI controls
   *
   * @example
   * ```typescript
   * // Access immutable properties
   * const mediaType = task.derived.mediaType;
   * const isCall = task.derived.isCall;
   *
   * // Access dynamic properties (always fresh)
   * if (task.derived.isConsultInProgress) {
   *   showConsultUI();
   * }
   *
   * // Access UI controls (computed from state machine)
   * <button
   *   visible={task.derived.uiControls.hold.visible}
   *   enabled={task.derived.uiControls.hold.enabled}
   *   onClick={() => task.hold()}
   * >
   *   Hold
   * </button>
   * ```
   */
  public get derived(): TaskDerivedState {
    return {
      ...this.immutableProps,
      ...this.computeDynamicProps(),
      uiControls: this.computeUIControls(),
    };
  }

  /**
   * Backward compatibility getter for taskUiControls.
   * @deprecated Use task.derived.uiControls instead
   * This provides the same data but computed fresh from state machine state.
   *
   * @example
   * ```typescript
   * // Old way (deprecated)
   * const visible = task.taskUiControls.hold.visible;
   *
   * // New way (recommended)
   * const visible = task.derived.uiControls.hold.visible;
   * ```
   */
  public get taskUiControls(): TaskUIActions {
    // Convert computed UI controls to TaskActionControl objects for backward compatibility
    const controls = this.computeUIControls();
    const result: any = {};

    Object.keys(controls).forEach((key) => {
      const control = controls[key as keyof TaskUIControls];
      result[key] = new TaskButtonControl(control.visible, control.enabled);
    });

    return result as TaskUIActions;
  }

  /**
   * @deprecated Use `derived` instead for better clarity
   */
  public get accessor(): TaskDerivedState {
    return this.derived;
  }

  /**
   * Compute immutable properties once at task creation.
   * These properties are based on initial task data and don't change.
   */
  private computeImmutableProps(): TaskImmutableProps {
    const interaction = this.data?.interaction ?? null;
    const agentId = this.data?.agentId;
    const mediaType = interaction?.mediaType ?? null;
    const isCall = mediaType === MEDIA_TYPE_TELEPHONY;
    const isChat = mediaType === 'chat';
    const isEmail = mediaType === 'email';
    const isDigitalChannel = Boolean(isChat || isEmail);

    return {
      interactionId: this.data?.interactionId ?? null,
      mediaType,
      mediaChannel: interaction?.mediaChannel ?? null,
      isCall,
      isChat,
      isEmail,
      isDigitalChannel,
      isSecondaryAgent: this.isSecondaryAgent(),
      isSecondaryEpDnAgent: this.isSecondaryEpDnAgent(),
      agentJoinTimestamp: agentId ? this.getAgentJoinTimestamp(agentId) : null,
    };
  }

  /**
   * Compute dynamic properties that can change as task state evolves.
   * These are computed fresh on each access to reflect current state.
   *
   * HYBRID APPROACH:
   * - Simple boolean flags (isOnHold, isConsultInProgress, isConferenceInProgress)
   *   are read from state machine context for consistency
   * - Complex computed properties (participants lists, timestamps, etc.)
   *   are computed from this.data as before
   */
  private computeDynamicProps(): TaskDynamicProps {
    const agentId = this.data?.agentId;

    const consultStatus = agentId
      ? this.getConsultStatus(agentId)
      : this.data?.consultStatus ?? null;
    const isConsultInitiated = consultStatus === 'CONSULT_INITIATED';
    const isConsultAccepted = consultStatus === 'CONSULT_ACCEPTED';
    const isBeingConsulted =
      consultStatus === 'BEING_CONSULTED' || consultStatus === 'BEING_CONSULTED_ACCEPTED';
    const isConsultCompleted = consultStatus === 'CONSULT_COMPLETED';
    const isConsultInitiatedOrAccepted =
      isConsultInitiated || isConsultAccepted || isBeingConsulted;
    const isConsultInitiatedOrAcceptedOnly = isConsultInitiated || isConsultAccepted;
    const isConsultInitiatedOrAcceptedOrBeingConsulted =
      isConsultInitiated || isConsultAccepted || isBeingConsulted;
    const isConsultReceived = isBeingConsulted;
    const isConsultInitiatedAndAccepted = isConsultAccepted;

    // Derive state flags from state machine state
    const state = this.stateMachineService?.state;
    const isConsultInProgress =
      state?.matches(TaskState.CONSULTING) ?? this.getIsConsultInProgress();
    const isOnHold = state?.matches(TaskState.HELD) ?? this.isInteractionOnHold();
    const isConferenceInProgress =
      state?.matches(TaskState.CONFERENCING) ?? this.getIsConferenceInProgress();

    return {
      interaction: this.data?.interaction ?? null,
      callDetails: this.getCallAssociatedDetails(),
      consultStatus,
      // Derived from state machine state, fallback to computed
      isConsultInProgress,
      isOnHold,
      isHeld: isOnHold,
      consultCallHeld: agentId ? this.findHoldStatus(MEDIA_TYPE_CONSULT, agentId) : false,
      isConferenceInProgress,
      // Complex properties still computed from this.data
      conferenceParticipantsCount: this.getConferenceParticipantsCount(),
      conferenceParticipants: agentId ? this.getConferenceParticipants(agentId) : [],
      isCustomerInCall: this.getIsCustomerInCall(),
      mpcState: agentId ? this.getConsultMPCState(agentId) : this.data?.interaction?.state ?? null,
      consultingAgent: agentId ? this.getConsultingAgentParticipant(agentId) : null,
      autoWrapupSeconds: this.getAutoWrapupSeconds(),
      canCancelAutoWrapup: this.canCancelAutoWrapup(),
      isConsultInitiated,
      isConsultAccepted,
      isBeingConsulted,
      isConsultCompleted,
      isConsultInitiatedOrAccepted,
      isConsultInitiatedOrAcceptedOnly,
      isConsultInitiatedOrAcceptedOrBeingConsulted,
      isConsultReceived,
      isConsultInitiatedAndAccepted,
      isIncomingTask: agentId ? this.isIncomingTask(agentId) : false,
    };
  }

  /**
   * Initialize the state machine with custom action callbacks
   */
  private initializeStateMachine(): void {
    const callbacks: ActionCallbacks = {
      onTaskIncoming: (taskData) => {
        LoggerProxy.log('State machine: Task incoming', {
          module: CC_FILE,
          method: 'onTaskIncoming',
          interactionId: taskData.interactionId,
        });
      },
      onTaskAssigned: (taskData) => {
        LoggerProxy.log('State machine: Task assigned', {
          module: CC_FILE,
          method: 'onTaskAssigned',
          interactionId: taskData.interactionId,
        });
      },
      onStartRonaTimer: (timeout) => {
        this.startRonaTimer(timeout);

        return null;
      },
      onStopRonaTimer: () => {
        this.stopRonaTimer();
      },
      onStartAutoWrapupTimer: (timeout) => {
        this.startAutoWrapupTimer(timeout);

        return null;
      },
      onStopAutoWrapupTimer: () => {
        this.stopAutoWrapupTimer();
      },
      onCleanupResources: () => {
        this.cleanupResources();
      },
    };

    const customActions = createActionsWithCallbacks(callbacks);
    const machine = createTaskStateMachineWithActions(customActions);

    this.stateMachineService = interpret(machine)
      .onTransition((state) => {
        LoggerProxy.log(
          `State machine transition: ${state.context.previousState || 'N/A'} -> ${state.value}`,
          {
            module: CC_FILE,
            method: 'onTransition',
          }
        );
        this.state = state;

        // Update UI controls based on current state
        this.updateUIControlsFromState();
      })
      .start();
  }

  /**
   * Send an event to the state machine
   */
  protected sendStateMachineEvent(event: TaskEventPayload): void {
    if (this.stateMachineService) {
      this.stateMachineService.send(event);
    }
  }

  /**
   * Get the current state machine state
   */
  protected getCurrentState(): TaskState | undefined {
    return this.stateMachineService?.state?.value as TaskState;
  }

  /**
   * Compute UI controls based on current state machine state.
   * This method should be overridden by child classes (Voice, Digital)
   * to provide channel-specific UI control logic.
   *
   * @returns UI control states for all task actions
   */
  protected computeUIControls(): TaskUIControls {
    // Default implementation - all controls hidden
    // Child classes should override this method
    return {
      accept: {visible: false, enabled: false},
      decline: {visible: false, enabled: false},
      hold: {visible: false, enabled: false},
      mute: {visible: false, enabled: false},
      end: {visible: false, enabled: false},
      transfer: {visible: false, enabled: false},
      consult: {visible: false, enabled: false},
      consultTransfer: {visible: false, enabled: false},
      endConsult: {visible: false, enabled: false},
      recording: {visible: false, enabled: false},
      conference: {visible: false, enabled: false},
      wrapup: {visible: false, enabled: false},
      exitConference: {visible: false, enabled: false},
      transferConference: {visible: false, enabled: false},
      mergeToConference: {visible: false, enabled: false},
    };
  }

  /**
   * @deprecated Legacy method - no longer needed with computed UI controls
   * Child classes no longer need to override this.
   */
  protected updateUIControlsFromState(): void {
    // No-op - UI controls are now computed via derived.uiControls
  }

  /**
   * Start RONA (Ring on No Answer) timer
   */
  private startRonaTimer(timeout: number): void {
    this.stopRonaTimer();
    this.ronaTimerId = setTimeout(() => {
      LoggerProxy.warn('RONA timeout reached', {
        module: CC_FILE,
        method: 'startRonaTimer',
        interactionId: this.data.interactionId,
      });
      this.sendStateMachineEvent({type: TaskEvent.RONA});
    }, timeout);
  }

  /**
   * Stop RONA timer
   */
  private stopRonaTimer(): void {
    if (this.ronaTimerId) {
      clearTimeout(this.ronaTimerId);
      this.ronaTimerId = undefined;
    }
  }

  /**
   * Start auto-wrapup timer
   */
  private startAutoWrapupTimer(timeout: number): void {
    this.stopAutoWrapupTimer();
    this.autoWrapupTimerId = setTimeout(() => {
      LoggerProxy.log('Auto-wrapup timeout reached', {
        module: CC_FILE,
        method: 'startAutoWrapupTimer',
        interactionId: this.data.interactionId,
      });
      this.sendStateMachineEvent({type: TaskEvent.AUTO_WRAPUP});
    }, timeout);
  }

  /**
   * Stop auto-wrapup timer
   */
  private stopAutoWrapupTimer(): void {
    if (this.autoWrapupTimerId) {
      clearTimeout(this.autoWrapupTimerId);
      this.autoWrapupTimerId = undefined;
    }
  }

  /**
   * Cleanup task resources (WebRTC, timers, etc.)
   */
  private cleanupResources(): void {
    this.stopRonaTimer();
    this.stopAutoWrapupTimer();
    LoggerProxy.log('Cleaning up task resources', {
      module: CC_FILE,
      method: 'cleanupResources',
      interactionId: this.data.interactionId,
    });
  }

  /**
   * Stop the state machine service
   */
  protected stopStateMachine(): void {
    if (this.stateMachineService) {
      this.stateMachineService.stop();
      this.stateMachineService = undefined;
    }
  }

  private reconcileData(oldData: TaskData, newData: TaskData): TaskData {
    Object.keys(newData).forEach((key) => {
      if (newData[key] && typeof newData[key] === 'object' && !Array.isArray(newData[key])) {
        oldData[key] = this.reconcileData({...oldData[key]}, newData[key]);
      } else {
        oldData[key] = newData[key];
      }
    });

    return oldData;
  }

  /**
   * @deprecated Legacy method - UI controls are now computed via derived.uiControls
   * This method is kept for backward compatibility but does nothing.
   */
  protected setUIControls() {
    // No-op - UI controls are now computed automatically
  }

  /**
   *
   * @param methodName - The name of the method that is unsupported
   * @throws Error
   */
  protected unsupportedMethodError(methodName: string) {
    LoggerProxy.error(`Unsupported operation`, {
      module: 'TASK',
      method: methodName,
    });
    throw new Error(`Unsupported operation: ${methodName}`);
  }

  /**
   * @deprecated Legacy method - UI controls are now computed via derived.uiControls
   * This method is kept for backward compatibility but does nothing.
   * Child classes no longer need to call this method.
   */
  protected updateTaskUiControls(): void {
    // No-op - UI controls are now computed automatically from state machine
  }

  private getCallAssociatedDetails(): Record<string, unknown> | null {
    const interaction = this.data?.interaction as Record<string, any> | undefined;

    return interaction?.callAssociatedDetails ?? null;
  }

  private getConsultingAgentParticipant(agentId?: string | null): Participant | null {
    if (!agentId || !this.data?.interaction?.participants) {
      return null;
    }

    const participants = Object.values(this.data.interaction.participants) as Array<any>;

    const consultingAgent = participants.find((participant) => {
      if (!participant) {
        return false;
      }
      const participantId = participant.id ?? participant.participantId;
      const participantType =
        typeof participant.pType === 'string' ? participant.pType.toUpperCase() : '';

      if (participantId === agentId) {
        return false;
      }

      if (participant.hasLeft) {
        return false;
      }

      return participantType === 'AGENT';
    });

    if (!consultingAgent) {
      return null;
    }

    return {
      id: consultingAgent.id ?? consultingAgent.participantId ?? '',
      name: consultingAgent.name ?? consultingAgent.id ?? consultingAgent.participantId ?? '',
      pType: consultingAgent.pType,
    };
  }

  private getAgentJoinTimestamp(agentId?: string | null): number | null {
    if (!agentId) {
      return null;
    }

    const participant = this.data?.interaction?.participants?.[agentId];
    const joinTimestamp = participant?.joinTimestamp;

    return typeof joinTimestamp === 'number' ? joinTimestamp : null;
  }

  private getAutoWrapupSeconds(): number | null {
    if (!this.autoWrapup || typeof this.autoWrapup.getTimeLeftSeconds !== 'function') {
      return null;
    }

    try {
      const timeLeft = this.autoWrapup.getTimeLeftSeconds();

      return typeof timeLeft === 'number' && Number.isFinite(timeLeft) ? timeLeft : null;
    } catch (error) {
      LoggerProxy.warn('AutoWrapup getTimeLeftSeconds failed', {
        module: CC_FILE,
        method: 'getAutoWrapupSeconds',
        error: (error as Error).message,
      });

      return null;
    }
  }

  private canCancelAutoWrapup(): boolean {
    return Boolean(
      (this.autoWrapup as {allowCancelAutoWrapup?: boolean} | undefined)?.allowCancelAutoWrapup
    );
  }

  /**
   * Determine if task is incoming for given agent
   */
  public isIncomingTask(agentId: string): boolean {
    const taskData = this.data;
    const taskState = taskData?.interaction?.state;
    const participants = taskData?.interaction?.participants;
    const hasJoined = agentId && participants?.[agentId]?.hasJoined;

    return (
      !taskData?.wrapUpRequired &&
      !hasJoined &&
      (taskState === INTERACTION_STATE_NEW ||
        taskState === INTERACTION_STATE_CONSULT ||
        taskState === INTERACTION_STATE_CONNECTED ||
        taskState === INTERACTION_STATE_CONFERENCE)
    );
  }

  /**
   * Get consultation status derived from interaction state
   */
  private getConsultStatus(agentId: string): string {
    if (!agentId) {
      return 'NO_CONSULTATION_IN_PROGRESS';
    }
    if (!this.data?.interaction) {
      return 'NO_CONSULTATION_IN_PROGRESS';
    }

    const state = this.getTaskStatus(agentId);
    const participants = this.data.interaction.participants || {};
    const participant = participants[agentId];
    const beingConsulted = Boolean(participant?.isConsulted) || this.isSecondaryEpDnAgent();

    if (state === TASK_STATE_CONSULT) {
      return beingConsulted ? 'BEING_CONSULTED' : 'CONSULT_INITIATED';
    }
    if (state === TASK_STATE_CONSULTING) {
      return beingConsulted ? 'BEING_CONSULTED_ACCEPTED' : 'CONSULT_ACCEPTED';
    }
    if (state === INTERACTION_STATE_CONNECTED) {
      return 'CONNECTED';
    }
    if (state === INTERACTION_STATE_CONFERENCE) {
      return 'CONFERENCE';
    }
    if (state === TASK_STATE_CONSULT_COMPLETED) {
      return 'CONSULT_COMPLETED';
    }

    return 'NO_CONSULTATION_IN_PROGRESS';
  }

  private getTaskStatus(agentId: string): string {
    if (!agentId) {
      return 'NO_CONSULTATION_IN_PROGRESS';
    }
    const interaction = this.data.interaction;
    if (!interaction) {
      return 'NO_CONSULTATION_IN_PROGRESS';
    }

    if (this.isSecondaryEpDnAgent()) {
      if (interaction.state === INTERACTION_STATE_CONFERENCE) {
        return INTERACTION_STATE_CONFERENCE;
      }

      return TASK_STATE_CONSULTING;
    }

    if (
      (interaction.state === INTERACTION_STATE_WRAPUP ||
        interaction.state === INTERACTION_STATE_POST_CALL) &&
      interaction.participants?.[agentId]?.consultState === CONSULT_STATE_COMPLETED
    ) {
      return TASK_STATE_CONSULT_COMPLETED;
    }

    return this.getConsultMPCState(agentId);
  }

  private getConsultMPCState(agentId: string): string {
    const interaction = this.data.interaction;
    const consultMediaResourceId = this.findMediaResourceId(MEDIA_TYPE_CONSULT);

    if (
      consultMediaResourceId &&
      interaction.participants?.[agentId]?.consultState &&
      interaction.state !== INTERACTION_STATE_WRAPUP &&
      interaction.state !== INTERACTION_STATE_POST_CALL
    ) {
      const consultState = interaction.participants[agentId]?.consultState;

      switch (consultState) {
        case CONSULT_STATE_INITIATED:
          return TASK_STATE_CONSULT;
        case CONSULT_STATE_COMPLETED:
          return interaction.state === INTERACTION_STATE_CONNECTED
            ? INTERACTION_STATE_CONNECTED
            : TASK_STATE_CONSULT_COMPLETED;
        case CONSULT_STATE_CONFERENCING:
          return INTERACTION_STATE_CONFERENCE;
        default:
          return TASK_STATE_CONSULTING;
      }
    }

    return interaction?.state || 'NO_CONSULTATION_IN_PROGRESS';
  }

  private isSecondaryAgent(): boolean {
    const interaction = this.data.interaction;

    return (
      !!interaction.callProcessingDetails &&
      interaction.callProcessingDetails.relationshipType === RELATIONSHIP_TYPE_CONSULT &&
      !!interaction.callProcessingDetails.parentInteractionId &&
      interaction.callProcessingDetails.parentInteractionId !== interaction.interactionId
    );
  }

  private isSecondaryEpDnAgent(): boolean {
    return this.data.interaction.mediaType === MEDIA_TYPE_TELEPHONY && this.isSecondaryAgent();
  }

  public getIsConferenceInProgress(): boolean {
    const interaction = this.data?.interaction;
    const interactionId = this.data?.interactionId;

    if (!interaction?.media || !interactionId) {
      return false;
    }

    const mediaMainCall = interaction.media[interactionId];
    const participantsInMainCall = new Set(mediaMainCall?.participants);
    const participants = interaction.participants ?? {};

    let agentCount = 0;
    participantsInMainCall.forEach((participantId: string) => {
      const participant = participants[participantId];
      if (
        participant &&
        !EXCLUDED_PARTICIPANT_TYPES.includes(participant.pType) &&
        !participant.hasLeft
      ) {
        agentCount += 1;
      }
    });

    return agentCount >= 2;
  }

  public getConferenceParticipants(agentId?: string): Participant[] {
    const participantsList: Participant[] = [];
    const interaction = this.data?.interaction;
    const interactionId = this.data?.interactionId;

    if (!interaction?.media || !interactionId) {
      return participantsList;
    }

    const mediaMainCall = interaction.media?.[interactionId];
    const participantsInMainCall = new Set(mediaMainCall?.participants ?? []);
    const participants = interaction.participants ?? {};

    participantsInMainCall.forEach((participantId: string) => {
      const participant = participants[participantId];
      if (
        participant &&
        !EXCLUDED_PARTICIPANT_TYPES.includes(participant.pType) &&
        !participant.hasLeft &&
        participant.id !== agentId
      ) {
        participantsList.push({
          id: participant.id,
          pType: participant.pType,
          name: participant.name || participant.id,
        });
      }
    });

    return participantsList;
  }

  public getConferenceParticipantsCount(): number {
    const interaction = this.data?.interaction;
    const interactionId = this.data?.interactionId;

    if (!interaction?.media || !interactionId) {
      return 0;
    }

    const mediaMainCall = interaction.media?.[interactionId];
    const participantsInMainCall = new Set(mediaMainCall?.participants ?? []);
    const participants = interaction.participants ?? {};

    let count = 0;
    participantsInMainCall.forEach((participantId: string) => {
      const participant = participants[participantId];
      if (
        participant &&
        !EXCLUDED_PARTICIPANT_TYPES.includes(participant.pType) &&
        !participant.hasLeft
      ) {
        count += 1;
      }
    });

    return count;
  }

  public getIsCustomerInCall(): boolean {
    const interaction = this.data?.interaction;
    const interactionId = this.data?.interactionId;

    if (!interaction?.media || !interactionId) {
      return false;
    }

    const mediaMainCall = interaction.media[interactionId];
    const participantsInMainCall = new Set(mediaMainCall?.participants);
    const participants = interaction.participants ?? {};

    for (const participantId of participantsInMainCall) {
      const participant = participants[participantId];
      if (participant && participant.pType === PARTICIPANT_TYPE_CUSTOMER && !participant.hasLeft) {
        return true;
      }
    }

    return false;
  }

  public getIsConsultInProgress(): boolean {
    const media = this.data?.interaction?.media;
    if (!media) {
      return false;
    }

    return Object.values(media).some((entry: any) => entry?.mType === MEDIA_TYPE_CONSULT);
  }

  public isInteractionOnHold(): boolean {
    const media = this.data?.interaction?.media;
    if (!media) {
      return false;
    }

    return Object.values(media).some((entry: any) => Boolean(entry?.isHold));
  }

  private setMediaTypeForEpDn(mType: string): string {
    if (this.isSecondaryEpDnAgent()) {
      return 'mainCall';
    }

    return mType;
  }

  public findMediaResourceId(mType: string): string {
    const mediaEntries = this.data?.interaction?.media;
    if (!mediaEntries) {
      return '';
    }

    const normalizedType = this.setMediaTypeForEpDn(mType);

    for (const key of Object.keys(mediaEntries)) {
      const media = (mediaEntries as Record<string, any>)[key];
      if (media?.mType === normalizedType) {
        return media.mediaResourceId ?? key;
      }
    }

    return '';
  }

  private isConsultOnHoldMPC(agentId: string): boolean {
    const currentState = this.getConsultMPCState(agentId);
    const isInConsultState =
      currentState === TASK_STATE_CONSULT || currentState === TASK_STATE_CONSULTING;
    const consultMediaResourceId = this.findMediaResourceId(MEDIA_TYPE_CONSULT);
    let mediaEntry: any;
    if (consultMediaResourceId) {
      mediaEntry = (this.data.interaction.media as Record<string, any>)[consultMediaResourceId];
      if (!mediaEntry) {
        mediaEntry = Object.values(this.data.interaction.media as Record<string, any>).find(
          (entry) => entry?.mediaResourceId === consultMediaResourceId
        );
      }
    }

    const isConsultHold = consultMediaResourceId && mediaEntry?.isHold;

    return isInConsultState && !isConsultHold;
  }

  public findHoldStatus(mType: string, agentId: string): boolean {
    const interaction = this.data.interaction;
    if (!agentId || !interaction?.media) {
      return false;
    }

    const normalizedType = this.setMediaTypeForEpDn(mType);
    const mediaId = this.findMediaResourceId(normalizedType);
    let mediaEntry = (interaction.media as Record<string, any>)[mediaId];
    if (!mediaEntry) {
      mediaEntry = Object.values(interaction.media as Record<string, any>).find(
        (entry) => entry?.mediaResourceId === mediaId
      );
    }

    if (!mediaEntry) {
      return false;
    }

    if (
      normalizedType === 'mainCall' &&
      mediaEntry.participants?.includes(agentId) &&
      (this.isConsultOnHoldMPC(agentId) ||
        this.getConsultMPCState(agentId) === TASK_STATE_CONSULT_COMPLETED)
    ) {
      return true;
    }

    if (normalizedType === MEDIA_TYPE_CONSULT && mediaEntry.participants?.includes(agentId)) {
      return Boolean(mediaEntry.isHold);
    }

    return Boolean(mediaEntry.isHold);
  }

  public findHoldTimestamp(mType = 'mainCall'): number | null {
    const interaction = this.data?.interaction;
    const media = interaction?.media;
    if (!media) {
      return null;
    }

    const normalizedType = this.setMediaTypeForEpDn(mType);

    for (const key of Object.keys(media)) {
      const mediaEntry = (media as Record<string, any>)[key];
      if (mediaEntry?.mType === normalizedType) {
        return mediaEntry.holdTimestamp ?? null;
      }
    }

    return null;
  }

  /**
   * This method is used to update the task data.
   * @param updatedData - TaskData
   * @param shouldOverwrite - boolean
   * @returns Task
   * @example
   * ```typescript
   * task.updateTaskData(updatedData, true);
   * ```
   */
  public updateTaskData(updatedData: TaskData, shouldOverwrite = false): ITask {
    this.data = shouldOverwrite ? updatedData : this.reconcileData(this.data, updatedData);

    this.setUIControls();

    return this;
  }

  /**
   * This is used to blind transfer or vTeam transfer the task
   * @param transferPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const transferPayload = {
   *  to: 'myQueueId',
   *  destinationType: 'queue',
   * }
   * task.transfer(transferPayload).then(()=>{}).catch(()=>{});
   * ```
   */
  public async transfer(transferPayload: TransferPayLoad): Promise<TaskResponse> {
    LoggerProxy.log(`Starting task transfer for taskId:${this.data.interactionId}`, {
      module: 'Task',
      method: 'transfer',
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      ]);
      let result: TaskResponse;
      if (transferPayload.destinationType === DESTINATION_TYPE.QUEUE) {
        result = await this.contact.vteamTransfer({
          interactionId: this.data.interactionId,
          data: transferPayload,
        });
      } else {
        result = await this.contact.blindTransfer({
          interactionId: this.data.interactionId,
          data: transferPayload,
        });
      }

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        {
          taskId: this.data.interactionId,
          destination: transferPayload.to,
          destinationType: transferPayload.destinationType,
          isConsultTransfer: false,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'transfer', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
        {
          taskId: this.data.interactionId,
          destination: transferPayload.to,
          destinationType: transferPayload.destinationType,
          isConsultTransfer: false,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(
            (error as any).details || {}
          ),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }

  /**
   * This is used to end the task.
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.end().then(()=>{}).catch(()=>{})
   *  ```
   */
  public async end(): Promise<TaskResponse> {
    LoggerProxy.log(`Ending task for taskId:${this.data.interactionId}`, {
      module: 'Task',
      method: 'end',
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_END_SUCCESS,
        METRIC_EVENT_NAMES.TASK_END_FAILED,
      ]);
      const response = await this.contact.end({interactionId: this.data.interactionId});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_END_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'end', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_END_FAILED,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(
            (error as any).details || {}
          ),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }

  /**
   * This is used to wrap up the task.
   * @param wrapupPayload - WrapupPayLoad
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.wrapup(wrapupPayload).then(()=>{}).catch(()=>{})
   * ```
   */
  public async wrapup(wrapupPayload: WrapupPayLoad): Promise<TaskResponse> {
    LoggerProxy.log(`Starting task wrapup for taskId:${this.data.interactionId}`, {
      module: 'Task',
      method: 'wrapup',
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_WRAPUP_SUCCESS,
        METRIC_EVENT_NAMES.TASK_WRAPUP_FAILED,
      ]);
      if (!this.data) {
        throw new Error('No task data available');
      }
      if (!wrapupPayload.auxCodeId || wrapupPayload.auxCodeId.length === 0) {
        throw new Error('AuxCodeId is required');
      }
      if (!wrapupPayload.wrapUpReason || wrapupPayload.wrapUpReason.length === 0) {
        throw new Error('WrapUpReason is required');
      }

      const response = await this.contact.wrapup({
        interactionId: this.data.interactionId,
        data: wrapupPayload,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_WRAPUP_SUCCESS,
        {
          taskId: this.data.interactionId,
          wrapUpCode: wrapupPayload.auxCodeId,
          wrapUpReason: wrapupPayload.wrapUpReason,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'wrapup', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_WRAPUP_FAILED,
        {
          taskId: this.data.interactionId,
          wrapUpCode: wrapupPayload.auxCodeId,
          wrapUpReason: wrapupPayload.wrapUpReason,
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(
            (error as any).details || {}
          ),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }
}
