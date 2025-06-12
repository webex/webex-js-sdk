import {CC_FILE} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import routingContact from '../contact';
import {
  ConsultPayload,
  ConsultEndPayload,
  ResumeRecordingPayload,
  TaskData,
  TaskResponse,
  IVoice,
  TransferPayLoad,
  ConsultTransferPayLoad,
  CONSULT_TRANSFER_DESTINATION_TYPE,
} from '../types';
import Task from '../Task';
import {CC_EVENTS} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';

export default class Voice extends Task implements IVoice {
  private isEndCallEnabled: boolean;
  private isEndConsultEnabled: boolean;

  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    callOptions: {isEndCallEnabled?: boolean; isEndConsultEnabled?: boolean} = {}
  ) {
    super(contact, data);
    // apply defaults when no explicit setting provided
    this.isEndCallEnabled = callOptions.isEndCallEnabled ?? true;
    this.isEndConsultEnabled = callOptions.isEndConsultEnabled ?? true;
  }

  private applyTerminatedControls(): void {
    this.applyControls(
      ['hold', 'transfer', 'consult', 'consultTransfer', 'recording', 'end'],
      ['hide', 'disable']
    );
    this.applyControls(['wrapup'], ['show', 'enable']);
  }

  private applyConnectedControls(): void {
    this.applyControls(['hold', 'transfer', 'consult', 'recording'], ['show', 'enable']);
    if (this.isEndCallEnabled) {
      this.applyControls(['end'], ['show', 'enable']);
    }
  }

  private applyConsultingControls(): void {
    this.applyControls(['hold', 'transfer', 'consult'], ['hide', 'disable']);
    this.applyControls(['recording'], ['show', 'disable']);
    if (!this.data.isConsulted) {
      this.applyControls(['consultTransfer', 'endConsult'], ['show', 'enable']);
      if (this.isEndCallEnabled) {
        this.applyControls(['end'], ['show', 'disable']);
      }
    } else if (this.isEndConsultEnabled) {
      this.applyControls(['endConsult'], ['show', 'enable']);
    }
  }

  protected initialiseUIControls() {
    super.initialiseUIControls();
    // batch‐hide & disable everything we start with
    this.applyControls(['accept', 'decline', 'hold', 'transfer', 'end'], ['hide', 'disable']);
  }

  protected setUIControls(): void {
    const eventType = this.data.type;
    const showMainControls = () =>
      this.applyControls(['hold', 'transfer', 'consult', 'recording'], ['show', 'enable']);

    switch (eventType) {
      case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
        this.applyControls(['accept', 'decline'], ['hide', 'disable']);
        showMainControls();
        this.applyControls(
          ['end'],
          this.isEndCallEnabled ? ['show', 'enable'] : ['hide', 'disable']
        );
        this.applyControls(['endConsult', 'wrapup'], ['hide']);
        break;

      case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
        this.applyControls(
          ['consultTransfer', 'recording', 'end', 'endConsult', 'hold', 'transfer', 'consult'],
          ['hide', 'disable']
        );
        this.applyControls(['wrapup'], ['show', 'enable']);
        break;

      case CC_EVENTS.CONTACT_ENDED:
      case CC_EVENTS.AGENT_INVITE_FAILED:
        this.applyControls(
          ['hold', 'transfer', 'consult', 'consultTransfer', 'recording', 'end', 'endConsult'],
          ['hide', 'disable']
        );
        if (this.data.interaction.state !== 'new') {
          this.applyControls(['wrapup'], ['show', 'enable']);
        }
        break;

      case CC_EVENTS.AGENT_CONTACT_HELD:
        showMainControls();
        if (this.isEndCallEnabled) {
          this.applyControls(['end'], ['show', 'disable']);
        }
        break;

      case CC_EVENTS.AGENT_CONTACT_UNHELD:
        showMainControls();
        if (this.isEndCallEnabled) {
          this.applyControls(['end'], ['show', 'enable']);
        }
        break;

      case CC_EVENTS.AGENT_VTEAM_TRANSFERRED:
        this.applyControls(
          ['hold', 'transfer', 'consult', 'consultTransfer', 'recording', 'end'],
          ['hide', 'disable']
        );
        this.applyControls(['wrapup'], ['show', 'enable']);
        break;

      case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
        showMainControls();
        if (this.isEndCallEnabled) {
          this.applyControls(['end'], ['show', 'enable']);
        }
        break;

      case CC_EVENTS.AGENT_CONSULT_CREATED:
        if (!this.data.isConsulted) {
          this.applyControls(['hold', 'consult', 'transfer', 'end'], ['hide', 'disable']);
          this.applyControls(['consultTransfer', 'recording'], ['show', 'disable']);
          this.applyControls(['endConsult'], ['show', 'enable']);
        }
        break;

      case CC_EVENTS.AGENT_OFFER_CONSULT:
        if (this.isEndConsultEnabled) {
          this.applyControls(['endConsult'], ['show', 'enable']);
        }
        break;

      case CC_EVENTS.AGENT_CONSULTING:
        if (!this.data.isConsulted) {
          this.applyControls(['hold', 'transfer', 'consult'], ['hide', 'disable']);
          this.applyControls(['consultTransfer'], ['show', 'enable']);
          this.applyControls(['recording'], ['show', 'disable']);
          this.applyControls(['endConsult'], ['show', 'enable']);
          if (this.isEndCallEnabled) {
            this.applyControls(['end'], ['show', 'disable']);
          }
        } else if (this.isEndConsultEnabled) {
          this.applyControls(['endConsult'], ['show', 'enable']);
        }
        break;

      case CC_EVENTS.AGENT_CONSULT_FAILED:
      case CC_EVENTS.AGENT_CONSULT_ENDED:
      case CC_EVENTS.AGENT_CTQ_CANCELLED:
        if (!this.data.isConsulted) {
          showMainControls();
          if (this.isEndCallEnabled) {
            this.applyControls(['end'], ['show', 'enable']);
          }
          this.applyControls(['consultTransfer', 'endConsult'], ['hide', 'disable']);
          this.applyControls(['wrapup'], ['hide']);
        }
        break;

      case CC_EVENTS.AGENT_CONTACT:
        if (this.data.interaction.isTerminated) {
          this.applyTerminatedControls();
        } else if (this.data.interaction.state === 'connected' && !this.data.isConsulted) {
          this.applyConnectedControls();
        } else if (this.data.interaction.state === 'consulting') {
          this.applyConsultingControls();
        }
        break;

      default:
        break;
    }
  }

  /**
   * This method is used to accept the task.
   * It is expected to be overridden by child classes.
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async accept(): Promise<TaskResponse> {
    super.unSupportedOperationError('accept');
  }

  /**
   * This method is used to decline the task.
   * It is expected to be overridden by child classes.
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async decline(): Promise<TaskResponse> {
    super.unSupportedOperationError('decline');
  }

  /**
   * This is used to hold the task.
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.hold().then(()=>{}).catch(()=>{})
   * ```
   * */
  public async hold(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Holding task`, {
        module: CC_FILE,
        method: 'hold',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_HOLD_SUCCESS,
        METRIC_EVENT_NAMES.TASK_HOLD_FAILED,
      ]);
      const response = await this.contact.hold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId: this.data.mediaResourceId},
      });
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_HOLD_SUCCESS,
        {
          taskId: this.data.interactionId,
          mediaResourceId: this.data.mediaResourceId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral']
      );
      LoggerProxy.log(`Task placed on hold successfully`, {
        module: CC_FILE,
        method: 'hold',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'hold', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_HOLD_FAILED,
        {
          taskId: this.data.interactionId,
          mediaResourceId: this.data.mediaResourceId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral']
      );
      throw detailedError;
    }
  }

  /**
   * This is used to resume the task.
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.resume().then(()=>{}).catch(()=>{})
   * ```
   */
  public async resume(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Resuming task`, {
        module: CC_FILE,
        method: 'resume',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_RESUME_SUCCESS,
        METRIC_EVENT_NAMES.TASK_RESUME_FAILED,
      ]);
      const {mainInteractionId} = this.data.interaction;
      const {mediaResourceId} = this.data.interaction.media[mainInteractionId];

      const response = await this.contact.unHold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId},
      });
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_SUCCESS,
        {
          taskId: this.data.interactionId,
          mainInteractionId,
          mediaResourceId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral']
      );
      LoggerProxy.log(`Task resumed successfully`, {
        module: CC_FILE,
        method: 'resume',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resume', CC_FILE);
      const mainInteractionId = this.data.interaction?.mainInteractionId;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_FAILED,
        {
          taskId: this.data.interactionId,
          mainInteractionId,
          mediaResourceId: mainInteractionId
            ? this.data.interaction.media[mainInteractionId].mediaResourceId
            : '',
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral']
      );
      throw detailedError;
    }
  }

  /**
   * This is used to pause the call recording
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.pauseRecording().then(()=>{}).catch(()=>{});
   * ```
   */
  public async pauseRecording(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Pausing recording`, {
        module: CC_FILE,
        method: 'pauseRecording',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_SUCCESS,
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_FAILED,
      ]);
      const result = await this.contact.pauseRecording({interactionId: this.data.interactionId});
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );
      LoggerProxy.log(`Recording paused successfully`, {
        module: CC_FILE,
        method: 'pauseRecording',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'pauseRecording', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_FAILED,
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

  /**
   * This is used to pause the call recording
   * @param resumeRecordingPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.resumeRecording(resumeRecordingPayload).then(()=>{}).catch(()=>{});
   * ```
   */
  public async resumeRecording(
    resumeRecordingPayload: ResumeRecordingPayload
  ): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Resuming recording`, {
        module: CC_FILE,
        method: 'resumeRecording',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_SUCCESS,
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_FAILED,
      ]);
      resumeRecordingPayload ??= {autoResumed: false};

      const result = await this.contact.resumeRecording({
        interactionId: this.data.interactionId,
        data: resumeRecordingPayload,
      });
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );
      LoggerProxy.log(`Recording resumed successfully`, {
        module: CC_FILE,
        method: 'resumeRecording',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resumeRecording', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_FAILED,
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

  /**
   * This is used to consult the task
   * @param consultPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const consultPayload = {
   *   destination: 'myBuddyAgentId',
   *   destinationType: DESTINATION_TYPE.AGENT,
   * }
   * task.consult(consultPayload).then(()=>{}).catch(()=>{});
   * ```
   * */
  public async consult(consultPayload: ConsultPayload): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Starting consult`, {
        module: CC_FILE,
        method: 'consult',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONSULT_START_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED,
      ]);
      const result = await this.contact.consult({
        interactionId: this.data.interactionId,
        data: consultPayload,
      });
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_START_SUCCESS,
        {
          taskId: this.data.interactionId,
          destination: consultPayload.to,
          destinationType: consultPayload.destinationType,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );
      LoggerProxy.log(`Consult started successfully to ${consultPayload.to}`, {
        module: CC_FILE,
        method: 'consult',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'consult', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED,
        {
          taskId: this.data.interactionId,
          destination: consultPayload.to,
          destinationType: consultPayload.destinationType,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }

  /**
   * This is used to end the consult session on the task.
   * @param consultEndPayload - Payload indicating consult end flags and identifiers
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.endConsult({
   *   isConsult: true,
   *   queueId: 'myQueueId',
   *   taskId: 'taskId',
   * });
   * ```
   */
  public async endConsult(consultEndPayload: ConsultEndPayload): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Ending consult`, {
        module: CC_FILE,
        method: 'endConsult',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED,
      ]);
      const result = await this.contact.consultEnd({
        interactionId: this.data.interactionId,
        data: consultEndPayload,
      });
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );
      LoggerProxy.log(`Consult ended successfully`, {
        module: CC_FILE,
        method: 'endConsult',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'endConsult', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED,
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

  /**
   * This is used to transfer the task.
   * @param payload - Transfer payload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.transfer({
   *   to: 'destinationId',
   *   destinationType: DESTINATION_TYPE.AGENT,
   *   consult: true, // Optional, if true will perform a consult transfer else blind transfer
   * });
   * ```
   */
  public async transfer(payload: TransferPayLoad): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Transferring task to ${payload.to}`, {
        module: CC_FILE,
        method: 'transfer',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      ]);

      // consult transfer path
      if (this.data.interaction.state === 'consulting') {
        let consultPayload: ConsultTransferPayLoad = {
          to: payload.to,
          destinationType: payload.destinationType,
        };

        if (payload.destinationType === CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE) {
          if (!this.data.destAgentId) {
            throw new Error('No agent has accepted this queue consult yet');
          }
          consultPayload = {
            to: this.data.destAgentId,
            destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
          };
        }

        const result = await this.contact.consultTransfer({
          interactionId: this.data.interactionId,
          data: consultPayload,
        });
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
          {
            taskId: this.data.interactionId,
            destination: consultPayload.to,
            destinationType: consultPayload.destinationType,
            isConsultTransfer: true,
            ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
          },
          ['operational', 'behavioral', 'business']
        );
        LoggerProxy.log(`Consult transfer completed successfully to ${consultPayload.to}`, {
          module: CC_FILE,
          method: 'transfer',
          trackingId: result.trackingId,
          interactionId: this.data.interactionId,
        });

        return result;
      }

      // standard blind transfer
      return await super.transfer({
        to: payload.to,
        destinationType: payload.destinationType,
      });
    } catch (err) {
      const {error: detailedError} = getErrorDetails(err, 'transfer', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
        {
          taskId: this.data.interactionId,
          destination: payload.to,
          destinationType: payload.destinationType,
          isConsultTransfer: this.data.interaction.state === 'consulting',
          error: err.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(err.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }
}
