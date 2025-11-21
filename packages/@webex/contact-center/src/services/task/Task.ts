import {EventEmitter} from 'events';
import {CallId} from '@webex/calling/dist/types/common/types';
import {createActor} from 'xstate';
import type {ActorRefFrom} from 'xstate';
import {
  ITask,
  TaskData,
  TaskResponse,
  WrapupPayLoad,
  TaskId,
  TransferPayLoad,
  DESTINATION_TYPE,
  TASK_EVENTS,
  TaskUIControls,
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
  TaskState,
  TaskEventPayload,
  type TaskStateMachine,
  type ActionCallbacks,
  type UIControlConfig,
  type TaskContext,
} from './state-machine';
import AutoWrapup from './AutoWrapup';
import {
  computeUIControls,
  getDefaultUIControls,
  haveUIControlsChanged,
} from './state-machine/uiControlsComputer';

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

export default abstract class Task extends EventEmitter implements ITask {
  protected contact: ReturnType<typeof routingContact>;
  protected metricsManager: MetricsManager;
  public stateMachineService?: ActorRefFrom<TaskStateMachine>;
  public data: TaskData;
  public webCallMap: Record<TaskId, CallId>;
  public state: any;
  private lastState: TaskState | null = null;
  protected currentUiControls: TaskUIControls;
  protected uiControlConfig: UIControlConfig;

  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    uiControlConfig: UIControlConfig
  ) {
    super();
    this.contact = contact;
    this.data = data;
    this.uiControlConfig = uiControlConfig;
    this.metricsManager = MetricsManager.getInstance();
    this.webCallMap = {};
    this.currentUiControls = getDefaultUIControls();
    this.initializeStateMachine();
  }

  // Properties from ITask interface
  public autoWrapup?: AutoWrapup;

  // Abstract methods that all child classes must implement
  public abstract accept(): Promise<TaskResponse>;

  // Voice-specific methods with default implementations that throw errors
  // Voice class will override these with actual implementations
  public async decline(): Promise<TaskResponse> {
    this.unsupportedMethodError('decline');
  }

  public async pauseRecording(): Promise<TaskResponse> {
    this.unsupportedMethodError('pauseRecording');
  }

  public async resumeRecording(): Promise<TaskResponse> {
    this.unsupportedMethodError('resumeRecording');
  }

  public async consult(): Promise<TaskResponse> {
    this.unsupportedMethodError('consult');
  }

  public async endConsult(): Promise<TaskResponse> {
    this.unsupportedMethodError('endConsult');
  }

  public async consultTransfer(): Promise<TaskResponse> {
    this.unsupportedMethodError('consultTransfer');
  }

  public async consultConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('consultConference');
  }

  public async exitConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('exitConference');
  }

  public async transferConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('transferConference');
  }

  public async toggleMute(): Promise<void> {
    this.unsupportedMethodError('toggleMute');
  }

  public unregisterWebCallListeners(): void {
    // Default implementation - child classes can override
    LoggerProxy.log('unregisterWebCallListeners called', {
      module: CC_FILE,
      method: 'unregisterWebCallListeners',
    });
  }

  /**
   * Cancel any in-progress auto wrap-up timer.
   * Base implementation just clears the timer reference so subclasses inherit the behavior.
   */
  public cancelAutoWrapupTimer(): void {
    if (this.autoWrapup) {
      this.autoWrapup.clear();
      this.autoWrapup = undefined;
      LoggerProxy.log('Auto wrap-up timer cancelled', {
        module: CC_FILE,
        method: 'cancelAutoWrapupTimer',
        interactionId: this.data?.interactionId,
      });
    }
  }

  // Voice tasks use holdResume(), but provide separate methods for interface compliance
  public async hold(): Promise<TaskResponse> {
    this.unsupportedMethodError('hold');
  }

  public async resume(): Promise<TaskResponse> {
    this.unsupportedMethodError('resume');
  }

  public async holdResume(): Promise<TaskResponse> {
    this.unsupportedMethodError('holdResume');
  }

  /**
   * Latest UI controls derived from state machine state and context.
   */
  public get uiControls(): TaskUIControls {
    return this.currentUiControls;
  }

  protected updateUiControls(forceEmit = false): void {
    const nextControls = this.computeUIControls();
    const shouldEmit = forceEmit || haveUIControlsChanged(this.currentUiControls, nextControls);
    this.currentUiControls = nextControls;

    if (shouldEmit) {
      this.emit(TASK_EVENTS.TASK_UI_CONTROLS_UPDATED, this.currentUiControls);
    }
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
      onCleanupResources: () => {},
    };

    // Create custom actions with callbacks for event emission
    const eventActions = createActionsWithCallbacks(callbacks);

    const machine: TaskStateMachine = createTaskStateMachineWithActions(
      this.uiControlConfig,
      eventActions
    );

    this.stateMachineService = createActor(machine);

    this.stateMachineService.subscribe((snapshot) => {
      const previousState = this.lastState;
      const currentState = snapshot.value as TaskState;
      LoggerProxy.log(`State machine transition: ${previousState || 'N/A'} -> ${currentState}`, {
        module: CC_FILE,
        method: 'onTransition',
      });
      this.lastState = currentState;
      this.state = snapshot;

      // Update UI controls based on current state
      this.updateUiControls();
    });

    this.stateMachineService.start();
    this.updateUiControls(true);
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
    return this.stateMachineService?.getSnapshot()?.value as TaskState;
  }

  /**
   * Compute UI controls based on current state machine state.
   *
   * @returns UI control states for all task actions
   */
  protected computeUIControls(): TaskUIControls {
    const snapshot = this.stateMachineService?.getSnapshot?.();

    if (!snapshot) {
      return getDefaultUIControls();
    }

    const currentState = snapshot.value as TaskState;
    const context = snapshot.context as TaskContext;

    return computeUIControls(currentState, context, this.data);
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

    this.updateUiControls();

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
