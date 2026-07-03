import {CC_FILE, METHODS} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import {IDigital, TaskResponse, TaskData} from '../types';
import {WrapupData} from '../../config/types';
import Task from '../Task';
import routingContact from '../contact';
import LoggerProxy from '../../../logger-proxy';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';

export default class Digital extends Task implements IDigital {
  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    wrapupData?: WrapupData,
    agentId?: string
  ) {
    super(
      contact,
      data,
      {
        isEndTaskEnabled: true,
        isEndConsultEnabled: false,
        isRecordingEnabled: false,
      },
      wrapupData,
      agentId
    );
  }

  /**
   * Refresh the digital task with the latest backend payload and recompute UI controls.
   */
  public updateTaskData(newData: TaskData, shouldOverwrite = false): IDigital {
    super.updateTaskData(newData, shouldOverwrite);

    return this;
  }

  /**
   * This is used for incoming digital task accept by agent.
   *
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.accept().then(()=>{}).catch(()=>{})
   * ```
   */
  public async accept(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Accepting task`, {
        module: CC_FILE,
        method: METHODS.ACCEPT,
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
      ]);

      const response = await this.contact.accept({interactionId: this.data.interactionId});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );
      LoggerProxy.log(`Task accepted successfully`, {
        module: CC_FILE,
        method: METHODS.ACCEPT,
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.ACCEPT, CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }
}
