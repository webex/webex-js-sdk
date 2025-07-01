import {CC_FILE, METHODS} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import {IDigital, TaskResponse, TaskData} from '../types';
import {CC_EVENTS} from '../../config/types';
import Task from '../Task';
import routingContact from '../contact';
import LoggerProxy from '../../../logger-proxy';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';

export default class Digital extends Task implements IDigital {
  constructor(contact: ReturnType<typeof routingContact>, data: TaskData) {
    super(contact, data);
    this.updateTaskUiControls({accept: [true, true]});
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

  protected setUIControls(): void {
    const eventType = this.data.type;

    switch (eventType) {
      case CC_EVENTS.AGENT_OFFER_CONTACT:
        // for incoming task: enable accept
        this.updateTaskUiControls({
          accept: [true, true],
        });
        break;

      case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
        // once accepted: enable transfer + end
        this.updateTaskUiControls({
          accept: [false, false],
          transfer: [true, true],
          end: [true, true],
        });
        break;

      case CC_EVENTS.AGENT_VTEAM_TRANSFERRED:
      case CC_EVENTS.AGENT_WRAPUP:
        // after transfer or end: enable wrapup
        this.updateTaskUiControls({transfer: [false, false], end: [false, false]});
        this.updateTaskUiControls({wrapup: [true, true]});
        break;

      case CC_EVENTS.AGENT_CONTACT:
        if (this.data.interaction.isTerminated) {
          this.updateTaskUiControls({
            transfer: [false, false],
            end: [false, false],
            wrapup: [true, true],
          });
        } else if (this.data.interaction.state === 'connected') {
          this.updateTaskUiControls({
            accept: [false, false],
            transfer: [true, true],
            end: [true, true],
          });
        } else if (this.data.interaction.state === 'new') {
          this.updateTaskUiControls({
            accept: [true, true],
            transfer: [false, false],
            end: [false, false],
          });
        }
        break;

      default:
        break;
    }
  }
}
