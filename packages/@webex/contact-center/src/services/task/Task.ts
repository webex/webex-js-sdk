import {EventEmitter} from 'events';
import {CallId} from '@webex/calling/dist/types/common/types';
import {
  ITask,
  TaskData,
  TaskResponse,
  WrapupPayLoad,
  TaskId,
  TransferPayLoad,
  TaskButtonControl,
  TaskUIControls,
  DESTINATION_TYPE,
  ConsultEndPayload,
  ConsultPayload,
  ConsultTransferPayLoad,
  ResumeRecordingPayload,
} from './types';
import {METHODS} from './constants';
import {CC_FILE, TASK_FILE} from '../../constants';
import {getErrorDetails} from '../core/Utils';
import routingContact from './contact';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import LoggerProxy from '../../logger-proxy';
import AutoWrapup from './AutoWrapup';
import {WrapupData} from '../config/types';

export default abstract class Task extends EventEmitter implements ITask {
  protected contact: ReturnType<typeof routingContact>;
  protected metricsManager: MetricsManager;
  public data: TaskData;
  public webCallMap: Record<TaskId, CallId>;
  public taskUiControls: TaskUIControls;
  protected wrapupData?: WrapupData;
  public autoWrapup?: AutoWrapup;
  protected agentId?: string;

  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    wrapupData?: WrapupData,
    agentId?: string
  ) {
    super();
    this.contact = contact;
    this.data = data;
    this.wrapupData = wrapupData;
    this.agentId = agentId;
    this.metricsManager = MetricsManager.getInstance();
    this.webCallMap = {};
    this.initialiseUIControls();
    this.setupAutoWrapupTimer();
  }

  unregisterWebCallListeners(): void {
    throw new Error('Method not implemented.');
  }

  decline(): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hold(mediaResourceId?: string): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resume(mediaResourceId?: string): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  pauseRecording(): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resumeRecording(resumeRecordingPayload: ResumeRecordingPayload): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  consult(consultPayload: ConsultPayload): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  endConsult(consultEndPayload: ConsultEndPayload): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  consultTransfer(consultTransferPayload?: ConsultTransferPayLoad): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  consultConference(): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  exitConference(): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  transferConference(): Promise<TaskResponse> {
    throw new Error('Method not implemented.');
  }

  toggleMute(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Sets up the automatic wrap-up timer if wrap-up is required
   */
  protected setupAutoWrapupTimer(): void {
    if (
      this.data.wrapUpRequired &&
      !this.autoWrapup &&
      this.wrapupData &&
      this.wrapupData.wrapUpProps
    ) {
      const wrapUpProps = this.wrapupData.wrapUpProps;
      if (!wrapUpProps || wrapUpProps.autoWrapup === false) {
        LoggerProxy.info(`Auto wrap-up is not required for this task`, {
          module: TASK_FILE,
          method: METHODS.SETUP_AUTO_WRAPUP_TIMER,
          interactionId: this.data.interactionId,
        });

        return;
      }
      const defaultWrapupReason =
        wrapUpProps.wrapUpReasonList?.find((r) => r.isDefault) ?? wrapUpProps.wrapUpReasonList?.[0];
      if (!defaultWrapupReason) {
        LoggerProxy.error('No wrap-up reason configured', {
          module: TASK_FILE,
          method: METHODS.SETUP_AUTO_WRAPUP_TIMER,
        });

        return;
      }
      const intervalMs = wrapUpProps.autoWrapupInterval;
      if (!intervalMs || intervalMs <= 0) {
        LoggerProxy.error(`Invalid auto wrap-up interval: ${intervalMs}`, {
          module: TASK_FILE,
          method: METHODS.SETUP_AUTO_WRAPUP_TIMER,
        });

        return;
      }
      this.autoWrapup = new AutoWrapup(intervalMs, wrapUpProps.allowCancelAutoWrapup);
      this.autoWrapup.start(async () => {
        LoggerProxy.info(`Auto wrap-up timer triggered`, {
          module: TASK_FILE,
          method: METHODS.SETUP_AUTO_WRAPUP_TIMER,
          interactionId: this.data.interactionId,
        });
        await this.wrapup({
          wrapUpReason: defaultWrapupReason.name,
          auxCodeId: defaultWrapupReason.id,
        });
      });
    }
  }

  /**
   * Cancels the automatic wrap-up timer if it's running
   */
  public cancelAutoWrapupTimer(): void {
    this.autoWrapup?.clear();
    this.autoWrapup = undefined;
    LoggerProxy.info(`Auto wrap-up timer cancelled`, {
      module: TASK_FILE,
      method: METHODS.CANCEL_AUTO_WRAPUP_TIMER,
      interactionId: this.data?.interactionId,
    });
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
   * This method is used to update the task data.
   * @param updatedData - TaskData
   * @param shouldOverwrite - boolean
   * @example
   * ```typescript
   * task.updateTaskData(updatedData, true);
   * ```
   */
  public updateTaskData(updatedData: TaskData, shouldOverwrite = false): void {
    this.data = shouldOverwrite ? updatedData : this.reconcileData(this.data, updatedData);
    this.setUIControls();
    this.setupAutoWrapupTimer();
  }

  public abstract accept(): Promise<TaskResponse>;

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
    this.cancelAutoWrapupTimer();
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
