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
  guards,
} from './state-machine';
import AutoWrapup from './AutoWrapup';

export default abstract class Task extends EventEmitter implements ITask {
  protected contact: ReturnType<typeof routingContact>;
  protected metricsManager: MetricsManager;
  protected stateMachineService?: Interpreter<TaskContext, any, TaskEventPayload>;
  public data: TaskData;
  public webCallMap: Record<TaskId, CallId>;
  public taskUiControls: TaskUIActions;
  private ronaTimerId?: NodeJS.Timeout;
  private autoWrapupTimerId?: NodeJS.Timeout;

  constructor(contact: ReturnType<typeof routingContact>, data: TaskData) {
    super();
    this.contact = contact;
    this.data = data;
    this.metricsManager = MetricsManager.getInstance();
    this.webCallMap = {};
    this.initialiseUIControls();
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
    throw new Error('hold() not implemented. Use holdResume() for voice tasks.');
  }

  public async resume(): Promise<TaskResponse> {
    throw new Error('resume() not implemented. Use holdResume() for voice tasks.');
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
      .onTransition(() => {
        LoggerProxy.log('State machine transition', {
          module: CC_FILE,
          method: 'onTransition',
        });

        // Compute derived properties after state transition
        const agentId = this.data.agentId;
        if (agentId) {
          this.computeDerivedProperties(agentId);
        }

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
   * Update UI controls based on the current state machine state
   * Child classes should override this to provide specific UI control logic
   */
  protected updateUIControlsFromState(): void {
    // Default implementation - child classes should override
    LoggerProxy.log('Updating UI controls from state', {
      module: CC_FILE,
      method: 'updateUIControlsFromState',
    });
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

  private initialiseUIControls() {
    this.taskUiControls = {
      accept: new TaskButtonControl(false, false),
      decline: new TaskButtonControl(false, false),
      hold: new TaskButtonControl(false, false),
      mute: new TaskButtonControl(false, false),
      end: new TaskButtonControl(false, false),
      transfer: new TaskButtonControl(false, false),
      consult: new TaskButtonControl(false, false),
      consultTransfer: new TaskButtonControl(false, false),
      endConsult: new TaskButtonControl(false, false),
      recording: new TaskButtonControl(false, false),
      conference: new TaskButtonControl(false, false),
      wrapup: new TaskButtonControl(false, false),
    };
  }

  /**
   * This method is used to set the UI controls data. Will be implemented in child classes.
   */
  protected setUIControls() {}

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
   * Apply visibility & enabled flags in one go.
   * Usage: updateTaskUiControls({ hold: [true,true], end: [false,true] })
   */
  protected updateTaskUiControls(
    config: Partial<Record<keyof typeof this.taskUiControls, [boolean, boolean]>>
  ): void {
    Object.entries(config).forEach(([k, [vis, en]]) => {
      const ctl = this.taskUiControls[k as keyof typeof this.taskUiControls];
      if (ctl) {
        ctl.setVisiblity(vis);
        ctl.setEnabled(en);
      }
    });
  }

  /**
   * Compute derived properties from state machine context
   * Called whenever task data is updated or state transitions occur
   */
  protected computeDerivedProperties(agentId: string): void {
    const context = this.stateMachineService?.state?.context;
    if (!context) return;

    try {
      // Compute consultStatus
      this.data.consultStatus = this.getConsultStatusFromContext(context, agentId);

      // Compute isConsultInProgress
      this.data.isConsultInProgress = guards.isConsulting(context);

      // Compute isOnHold
      this.data.isOnHold = guards.isHeld(context);

      // Compute isConferenceInProgress (already exists but ensure consistency)
      this.data.isConferenceInProgress =
        guards.isConferencing(context) && context.participants.length >= 2;

      // Compute isCustomerInCall
      this.data.isCustomerInCall = this.checkCustomerInCall();

      // Compute conferenceParticipantsCount
      this.data.conferenceParticipantsCount = context.participants.length;

      // Compute isSecondaryAgent
      this.data.isSecondaryAgent = this.checkIsSecondaryAgent();

      // Compute isSecondaryEpDnAgent
      this.data.isSecondaryEpDnAgent =
        this.data.interaction.mediaType === 'telephony' && this.data.isSecondaryAgent;

      // Compute mpcState
      this.data.mpcState = this.getMPCState(agentId);
    } catch (error) {
      LoggerProxy.error('Error computing derived properties', {
        module: CC_FILE,
        method: 'computeDerivedProperties',
        error: error.message,
      });
    }
  }

  /**
   * Get consultation status from state machine context
   */
  private getConsultStatusFromContext(context: TaskContext, agentId: string): string {
    const state = context.currentState;
    const participants = this.data.interaction?.participants || {};
    const participant: any = Object.values(participants).find(
      (p: any) => p.pType === 'Agent' && p.id === agentId
    );

    if (state === TaskState.CONSULT_INITIATED) {
      return participant?.isConsulted ? 'BEING_CONSULTED' : 'CONSULT_INITIATED';
    }
    if (state === TaskState.CONSULTING) {
      return participant?.isConsulted ? 'BEING_CONSULTED_ACCEPTED' : 'CONSULT_ACCEPTED';
    }
    if (state === TaskState.CONNECTED) {
      return 'CONNECTED';
    }
    if (state === TaskState.CONFERENCING) {
      return 'CONFERENCE';
    }
    if (state === TaskState.CONSULT_COMPLETED) {
      return 'CONSULT_COMPLETED';
    }

    return 'NO_CONSULTATION_IN_PROGRESS';
  }

  /**
   * Check if customer is in call
   */
  private checkCustomerInCall(): boolean {
    if (!this.data?.interaction?.media || !this.data?.interactionId) {
      return false;
    }

    const mediaMainCall = this.data.interaction.media[this.data.interactionId];
    const participantsInMainCall = new Set(mediaMainCall?.participants);
    const participants = this.data.interaction?.participants;

    if (participantsInMainCall.size > 0 && participants) {
      return Array.from(participantsInMainCall).some((participantId: string) => {
        const participant = participants[participantId];

        return participant && participant.pType === 'CUSTOMER' && !participant.hasLeft;
      });
    }

    return false;
  }

  /**
   * Check if this is a secondary agent (consulted party)
   */
  private checkIsSecondaryAgent(): boolean {
    const interaction = this.data.interaction;

    return (
      !!interaction.callProcessingDetails &&
      interaction.callProcessingDetails.relationshipType === 'CONSULT' &&
      !!interaction.callProcessingDetails.parentInteractionId &&
      interaction.callProcessingDetails.parentInteractionId !== interaction.interactionId
    );
  }

  /**
   * Get MPC state based on participant consultState
   */
  private getMPCState(agentId: string): string {
    const interaction = this.data.interaction;
    const currentState = this.getCurrentState();

    if (
      !this.data.consultMediaResourceId ||
      !interaction.participants[agentId]?.consultState ||
      currentState === TaskState.WRAPPING_UP ||
      currentState === TaskState.POST_CALL
    ) {
      return interaction?.state || (currentState as string);
    }

    const consultState = interaction.participants[agentId]?.consultState;

    switch (consultState) {
      case 'INITIATED':
        return TaskState.CONSULT_INITIATED;
      case 'COMPLETED':
        return currentState === TaskState.CONNECTED
          ? TaskState.CONNECTED
          : TaskState.CONSULT_COMPLETED;
      case 'CONFERENCING':
        return TaskState.CONFERENCING;
      default:
        return TaskState.CONSULTING;
    }
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

    // Compute derived properties from state machine
    const agentId = this.data.agentId;
    if (agentId) {
      this.computeDerivedProperties(agentId);
    }

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
