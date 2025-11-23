import {CC_FILE, METHODS} from '../../../constants';
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
import LoggerProxy from '../../../logger-proxy';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import {TaskState, TaskEvent, guards} from '../state-machine';

export type VoiceUIControlOptions = {
  isEndCallEnabled?: boolean;
  isEndConsultEnabled?: boolean;
  voiceVariant?: 'pstn' | 'webrtc';
  isRecordingEnabled?: boolean;
};

export default class Voice extends Task implements IVoice {
  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    callOptions: VoiceUIControlOptions = {}
  ) {
    super(contact, data, {
      channelType: 'voice',
      isEndCallEnabled: callOptions.isEndCallEnabled ?? true,
      isEndConsultEnabled: callOptions.isEndConsultEnabled ?? true,
      voiceVariant: callOptions.voiceVariant ?? 'pstn',
      isRecordingEnabled: callOptions.isRecordingEnabled ?? true,
    });
  }

  /**
   * This method is used to accept the task.
   * It is expected to be overridden by child classes.
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async accept(): Promise<TaskResponse> {
    super.unsupportedMethodError(METHODS.ACCEPT);
  }

  /**
   * This method is used to decline the task.
   * It is expected to be overridden by child classes.
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async decline(): Promise<TaskResponse> {
    super.unsupportedMethodError(METHODS.REJECT);
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
    return this.holdResume();
  }

  /**
   * This is used to resume the task.
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.resume().then(()=>{}).catch(()=>{})
   * ```
   * */
  public async resume(): Promise<TaskResponse> {
    return this.holdResume();
  }

  /**
   * This is used to hold or resume the task.
   * @param isHeld: boolean - true to hold the task, false to resume it
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.holdResume(isHeld: true).then(()=>{}).catch(()=>{})
   * ```
   * */
  public async holdResume(): Promise<TaskResponse> {
    /* 
    Determine if the task is being held or resumed based on the media resource state
    If the media resource is not found, default to resuming the task
    */
    const shouldHold = !this.data.interaction.media[this.data.mediaResourceId].isHold;

    // Validate operation is allowed in current state
    const state = this.stateMachineService?.getSnapshot?.();
    if (state) {
      const currentState = state.value as TaskState;
      if (shouldHold) {
        if (!state.matches(TaskState.CONNECTED)) {
          const error = new Error(`Cannot hold call in current state: ${currentState}`);
          LoggerProxy.error('Hold operation not allowed', {
            module: CC_FILE,
            method: METHODS.HOLD_RESUME,
            interactionId: this.data.interactionId,
          });
          throw error;
        }
      } else if (!state.matches(TaskState.HELD)) {
        const error = new Error(`Cannot resume call in current state: ${currentState}`);
        LoggerProxy.error('Resume operation not allowed', {
          module: CC_FILE,
          method: METHODS.HOLD_RESUME,
          interactionId: this.data.interactionId,
        });
        throw error;
      }
    }

    // Send initiating event to transition to intermediate state
    if (this.stateMachineService) {
      const initiatingEvent = shouldHold ? TaskEvent.HOLD : TaskEvent.UNHOLD;
      this.stateMachineService.send({
        type: initiatingEvent,
        mediaResourceId: this.data.mediaResourceId,
      });
    }

    LoggerProxy.info(`${shouldHold ? 'Holding' : 'Resuming'} task`, {
      module: CC_FILE,
      method: METHODS.HOLD_RESUME,
      interactionId: this.data.interactionId,
    });
    const [successEvt, failedEvt] = shouldHold
      ? [METRIC_EVENT_NAMES.TASK_HOLD_SUCCESS, METRIC_EVENT_NAMES.TASK_HOLD_FAILED]
      : [METRIC_EVENT_NAMES.TASK_RESUME_SUCCESS, METRIC_EVENT_NAMES.TASK_RESUME_FAILED];

    this.metricsManager.timeEvent([successEvt, failedEvt]);

    try {
      let response: TaskResponse;
      if (shouldHold) {
        response = await this.contact.hold({
          interactionId: this.data.interactionId,
          data: {mediaResourceId: this.data.mediaResourceId},
        });

        // Send success event to complete the transition
        if (this.stateMachineService) {
          this.stateMachineService.send({
            type: TaskEvent.HOLD_SUCCESS,
            mediaResourceId: this.data.mediaResourceId,
          });
        }

        this.metricsManager.trackEvent(
          successEvt,
          {
            taskId: this.data.interactionId,
            mediaResourceId: this.data.mediaResourceId,
            ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
          },
          ['operational', 'behavioral']
        );
        LoggerProxy.log(`Task placed on hold successfully`, {
          module: CC_FILE,
          method: METHODS.HOLD_RESUME,
          trackingId: response.trackingId,
          interactionId: this.data.interactionId,
        });
      } else {
        const mainId = this.data.interaction.mainInteractionId!;
        response = await this.contact.unHold({
          interactionId: this.data.interactionId,
          data: {mediaResourceId: this.data.mediaResourceId},
        });

        // Send success event to complete the transition
        if (this.stateMachineService) {
          this.stateMachineService.send({
            type: TaskEvent.UNHOLD_SUCCESS,
            mediaResourceId: this.data.mediaResourceId,
          });
        }

        this.metricsManager.trackEvent(
          successEvt,
          {
            taskId: this.data.interactionId,
            mainInteractionId: mainId,
            mediaResourceId: this.data.mediaResourceId,
            ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
          },
          ['operational', 'behavioral']
        );
        LoggerProxy.log(`Task resumed successfully`, {
          module: CC_FILE,
          method: METHODS.HOLD_RESUME,
          trackingId: response.trackingId,
          interactionId: this.data.interactionId,
        });
      }

      return response;
    } catch (error) {
      // Send failure event to transition back to previous state
      if (this.stateMachineService) {
        const failureEvent = shouldHold ? TaskEvent.HOLD_FAILED : TaskEvent.UNHOLD_FAILED;
        this.stateMachineService.send({
          type: failureEvent,
          reason: error.toString(),
          mediaResourceId: this.data.mediaResourceId,
        });
      }

      const {error: detailedError} = getErrorDetails(error, 'holdResume', CC_FILE);
      this.metricsManager.trackEvent(
        failedEvt,
        shouldHold
          ? {
              taskId: this.data.interactionId,
              mediaResourceId: this.data.mediaResourceId,
              error: error.toString(),
              ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
            }
          : {
              taskId: this.data.interactionId,
              error: error.toString(),
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
    // Validate recording is active
    const state = this.stateMachineService?.getSnapshot?.();
    if (state && !guards.recordingActive({context: state.context})) {
      const error = new Error('Recording is not active or already paused');
      LoggerProxy.error('Pause recording operation not allowed', {
        module: CC_FILE,
        method: 'pauseRecording',
        interactionId: this.data.interactionId,
      });
      throw error;
    }

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
    resumeRecordingPayload?: ResumeRecordingPayload
  ): Promise<TaskResponse> {
    // Validate recording is paused
    const state = this.stateMachineService?.getSnapshot?.();
    if (state && !guards.recordingPaused({context: state.context})) {
      const error = new Error('Recording is not paused');
      LoggerProxy.error('Resume recording operation not allowed', {
        module: CC_FILE,
        method: 'resumeRecording',
        interactionId: this.data.interactionId,
      });
      throw error;
    }

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
  public async consult(consultPayload?: ConsultPayload): Promise<TaskResponse> {
    // Validate consult is allowed
    const state = this.stateMachineService?.getSnapshot?.();
    const canConsult =
      state && (state.matches(TaskState.CONNECTED) || state.matches(TaskState.HELD));

    if (!canConsult) {
      const currentState = state?.value as TaskState;
      const error = new Error(`Cannot initiate consult in ${currentState} state`);
      LoggerProxy.error('Consult operation not allowed', {
        module: CC_FILE,
        method: 'consult',
        interactionId: this.data.interactionId,
      });
      throw error;
    }

    // Send initiating event to transition to CONSULT_INITIATING state
    if (this.stateMachineService) {
      this.stateMachineService.send({
        type: TaskEvent.CONSULT,
        destination: consultPayload.to,
        destinationType: consultPayload.destinationType as 'queue' | 'agent' | 'entryPoint',
      });
    }

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

      // Send success event to transition to CONSULTING state
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.CONSULT_SUCCESS,
          taskData: result.data,
        });
      }

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
      LoggerProxy.log(`Consult successfully initiated to ${consultPayload.to}`, {
        module: CC_FILE,
        method: 'consult',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      // Send failure event to transition back to previous state
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.CONSULT_FAILED,
          reason: error.toString(),
        });
      }

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
  public async endConsult(consultEndPayload?: ConsultEndPayload): Promise<TaskResponse> {
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
        method: METHODS.TRANSFER_CALL,
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
          method: METHODS.TRANSFER_CALL,
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
      const {error: detailedError} = getErrorDetails(err, METHODS.TRANSFER_CALL, CC_FILE);
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
