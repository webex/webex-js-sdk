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
  TaskState,
  TaskContext,
  TaskEventPayload,
  type ActionCallbacks,
} from './state-machine';
import AutoWrapup from './AutoWrapup';

/**
 * Participant information for UI display
 */
export type Participant = {
  id: string;
  name?: string;
  pType?: string;
};

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

  constructor(contact: ReturnType<typeof routingContact>, data: TaskData) {
    super();
    this.contact = contact;
    this.data = data;
    this.metricsManager = MetricsManager.getInstance();
    this.webCallMap = {};
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
   * Get UI controls for task actions.
   * Computed from state machine state and context.
   *
   * @example
   * ```typescript
   * const visible = task.taskUiControls.hold.visible;
   * const enabled = task.taskUiControls.hold.enabled;
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
        this.computeUIControls();
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

    this.computeUIControls();

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
