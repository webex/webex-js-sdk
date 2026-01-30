import {CC_FILE, METHODS} from '../../../constants';
import {buildConsultConferenceParamData, getErrorDetails} from '../../core/Utils';
import routingContact from '../contact';
import {
  ConsultPayload,
  ConsultEndPayload,
  ResumeRecordingPayload,
  TaskData,
  TaskResponse,
  IVoice,
  VoiceUIControlOptions,
  TransferPayLoad,
  ConsultTransferPayLoad,
  consultConferencePayloadData,
  CONSULT_TRANSFER_DESTINATION_TYPE,
  TASK_EVENTS,
  VOICE_VARIANT,
} from '../types';
import Task from '../Task';
import LoggerProxy from '../../../logger-proxy';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import {TaskState, TaskEvent} from '../state-machine';
import {WrapupData} from '../../config/types';
import {getIsConferenceInProgress} from '../TaskUtils';

export default class Voice extends Task implements IVoice {
  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    callOptions?: VoiceUIControlOptions,
    wrapupData?: WrapupData,
    agentId?: string
  ) {
    const resolvedOptions = {
      isEndTaskEnabled: callOptions?.isEndTaskEnabled ?? true,
      isEndConsultEnabled: callOptions?.isEndConsultEnabled ?? true,
      voiceVariant: callOptions?.voiceVariant ?? VOICE_VARIANT.PSTN,
      isRecordingEnabled: callOptions?.isRecordingEnabled ?? true,
    };

    super(
      contact,
      data,
      {
        ...resolvedOptions,
      },
      wrapupData,
      agentId
    );
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
      const initiatingEvent = shouldHold ? TaskEvent.HOLD_INITIATED : TaskEvent.UNHOLD_INITIATED;
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
        const mainId = this.data.interaction?.mainInteractionId;
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
      const failureEvent = shouldHold ? TaskEvent.HOLD_FAILED : TaskEvent.UNHOLD_FAILED;
      this.stateMachineService.send({
        type: failureEvent,
        reason: error.toString(),
        mediaResourceId: this.data.mediaResourceId,
      });

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
    if (state) {
      const {recordingControlsAvailable, recordingInProgress} = state.context as {
        recordingControlsAvailable?: boolean;
        recordingInProgress?: boolean;
      };
      const recordingActive = Boolean(recordingControlsAvailable && recordingInProgress);
      if (!recordingActive) {
        const error = new Error('Recording is not active or already paused');
        LoggerProxy.error('Pause recording operation not allowed', {
          module: CC_FILE,
          method: 'pauseRecording',
          interactionId: this.data.interactionId,
        });
        throw error;
      }
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
    if (state) {
      const {recordingControlsAvailable, recordingInProgress} = state.context as {
        recordingControlsAvailable?: boolean;
        recordingInProgress?: boolean;
      };
      const recordingPaused = Boolean(recordingControlsAvailable && !recordingInProgress);
      if (!recordingPaused) {
        const error = new Error('Recording is not paused');
        LoggerProxy.error('Resume recording operation not allowed', {
          module: CC_FILE,
          method: 'resumeRecording',
          interactionId: this.data.interactionId,
        });
        throw error;
      }
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
      state &&
      (state.matches(TaskState.CONNECTED) ||
        state.matches(TaskState.HELD) ||
        state.matches(TaskState.CONFERENCING));

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
        destinationType: consultPayload.destinationType,
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
      this.stateMachineService.send({
        type: TaskEvent.CONSULT_FAILED,
        reason: error.toString(),
      });

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

  /**
   * Start a consult conference, merging main and consult calls.
   */
  public async consultConference(): Promise<TaskResponse> {
    const consultationData: consultConferencePayloadData = {
      agentId: this.data.agentId,
      destinationType: this.data.destinationType || 'agent',
      destAgentId: this.data.destAgentId,
    };

    // Send state machine event to transition to CONF_INITIATING
    if (this.stateMachineService) {
      this.stateMachineService.send({
        type: TaskEvent.MERGE_TO_CONFERENCE,
      });
    }

    try {
      LoggerProxy.info(`Initiating consult conference to ${consultationData.destAgentId}`, {
        module: CC_FILE,
        method: METHODS.CONSULT_CONFERENCE,
        interactionId: this.data.interactionId,
      });

      const paramsDataForConferenceV2 = buildConsultConferenceParamData(
        consultationData,
        this.data.interactionId
      );

      const response = await this.contact.consultConference({
        interactionId: paramsDataForConferenceV2.interactionId,
        data: paramsDataForConferenceV2.data,
      });

      // Send success event to transition to CONFERENCING
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.CONFERENCE_START,
        });
      }

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_START_SUCCESS,
        {
          taskId: this.data.interactionId,
          destination: paramsDataForConferenceV2.data.to,
          destinationType: paramsDataForConferenceV2.data.destinationType,
          agentId: paramsDataForConferenceV2.data.agentId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Consult conference started successfully`, {
        module: CC_FILE,
        method: METHODS.CONSULT_CONFERENCE,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      // Send failure event to revert state
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.CONFERENCE_FAILED,
          reason: error.toString(),
        });
      }

      const {error: detailedError} = getErrorDetails(error, METHODS.CONSULT_CONFERENCE, CC_FILE);

      const failedParamsData = buildConsultConferenceParamData(
        consultationData,
        this.data.interactionId
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_START_FAILED,
        {
          taskId: this.data.interactionId,
          destination: failedParamsData.data.to,
          destinationType: failedParamsData.data.destinationType,
          agentId: failedParamsData.data.agentId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.error(`Failed to start consult conference`, {
        module: CC_FILE,
        method: METHODS.CONSULT_CONFERENCE,
        interactionId: this.data.interactionId,
      });

      throw detailedError;
    }
  }

  /**
   * Exit from a conference call.
   * Per conference-spec.md:
   * - Primary agent exits to wrapup
   * - Non-primary agent exits to available/connected
   * - Other participants continue the call
   *
   * @returns Promise<TaskResponse>
   * @throws Error if not in conference or exit fails
   * @example
   * ```typescript
   * task.exitConference().then(() => {}).catch(() => {});
   * ```
   */
  public async exitConference(): Promise<TaskResponse> {
    // Validate we're in conference state OR conference is in progress per task data
    // This handles cases where:
    // 1. State machine is in CONFERENCING state
    // 2. State machine is in CONNECTED but conference is active (e.g., ownership transferred)
    const state = this.stateMachineService?.getSnapshot?.();
    const isConferencingState = state?.matches(TaskState.CONFERENCING);

    const isConferenceInProgressFromData = this.data ? getIsConferenceInProgress(this.data) : false;

    if (!state || (!isConferencingState && !isConferenceInProgressFromData)) {
      const currentState = state?.value as TaskState;
      const error = new Error(`Cannot exit conference in ${currentState} state`);
      LoggerProxy.error('Exit conference operation not allowed', {
        module: CC_FILE,
        method: 'exitConference',
        interactionId: this.data.interactionId,
      });
      throw error;
    }

    // Send state machine event
    if (this.stateMachineService) {
      this.stateMachineService.send({
        type: TaskEvent.EXIT_CONFERENCE,
        agentId: this.data.agentId,
      });
    }

    try {
      LoggerProxy.info(`Exiting conference`, {
        module: CC_FILE,
        method: 'exitConference',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONFERENCE_EXIT_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONFERENCE_EXIT_FAILED,
      ]);

      const response = await this.contact.exitConference({
        interactionId: this.data.interactionId,
      });

      // Send success event to transition state
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.EXIT_CONFERENCE_SUCCESS,
          taskData: response.data,
        });
      }

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_EXIT_SUCCESS,
        {
          taskId: this.data.interactionId,
          agentId: this.data.agentId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Successfully exited conference`, {
        module: CC_FILE,
        method: 'exitConference',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      // Send failure event
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.EXIT_CONFERENCE_FAILED,
          reason: error.toString(),
        });
      }

      const {error: detailedError} = getErrorDetails(error, 'exitConference', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_EXIT_FAILED,
        {
          taskId: this.data.interactionId,
          agentId: this.data.agentId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.error(`Failed to exit conference`, {
        module: CC_FILE,
        method: 'exitConference',
        interactionId: this.data.interactionId,
      });

      throw detailedError;
    }
  }

  /**
   * Transfer the conference to another participant.
   * Per conference-spec.md: Only primary agent can transfer conference.
   * After transfer, the transferring agent exits to wrapup.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if not in conference or transfer fails
   * @example
   * ```typescript
   * task.transferConference().then(() => {}).catch(() => {});
   * ```
   */
  public async transferConference(): Promise<TaskResponse> {
    // Validate we're in conference or consulting state
    // CONSULTING is allowed because agent can transfer conference while consulting
    // (transfers ownership to the consulted agent)
    const state = this.stateMachineService?.getSnapshot?.();
    const isValidState =
      state && (state.matches(TaskState.CONFERENCING) || state.matches(TaskState.CONSULTING));
    if (!isValidState) {
      const currentState = state?.value as TaskState;
      const error = new Error(`Cannot transfer conference in ${currentState} state`);
      LoggerProxy.error('Transfer conference operation not allowed', {
        module: CC_FILE,
        method: 'transferConference',
        interactionId: this.data.interactionId,
      });
      throw error;
    }

    // Send state machine event
    if (this.stateMachineService) {
      this.stateMachineService.send({
        type: TaskEvent.TRANSFER_CONFERENCE,
        agentId: this.data.agentId,
      });
    }

    try {
      LoggerProxy.info(`Transferring conference`, {
        module: CC_FILE,
        method: 'transferConference',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_FAILED,
      ]);

      const response = await this.contact.conferenceTransfer({
        interactionId: this.data.interactionId,
      });

      // Send success event to transition state
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.TRANSFER_CONFERENCE_SUCCESS,
          taskData: response.data,
        });
      }

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_SUCCESS,
        {
          taskId: this.data.interactionId,
          agentId: this.data.agentId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Successfully transferred conference`, {
        module: CC_FILE,
        method: 'transferConference',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      // Send failure event
      if (this.stateMachineService) {
        this.stateMachineService.send({
          type: TaskEvent.TRANSFER_CONFERENCE_FAILED,
          reason: error.toString(),
        });
      }

      const {error: detailedError} = getErrorDetails(error, 'transferConference', CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_FAILED,
        {
          taskId: this.data.interactionId,
          agentId: this.data.agentId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.error(`Failed to transfer conference`, {
        module: CC_FILE,
        method: 'transferConference',
        interactionId: this.data.interactionId,
      });

      throw detailedError;
    }
  }

  protected override getChannelSpecificActionOverrides() {
    const baseOverrides = super.getChannelSpecificActionOverrides();

    return {
      ...baseOverrides,
      emitTaskHold: this.createEmitSelfAction(TASK_EVENTS.TASK_HOLD, {updateTaskData: true}),
      emitTaskResume: this.createEmitSelfAction(TASK_EVENTS.TASK_RESUME, {updateTaskData: true}),
      emitTaskRecordingStarted: this.createEmitSelfAction(TASK_EVENTS.TASK_RECORDING_STARTED, {
        updateTaskData: true,
      }),
      emitTaskRecordingPaused: this.createEmitSelfAction(TASK_EVENTS.TASK_RECORDING_PAUSED, {
        updateTaskData: true,
      }),
      emitTaskRecordingPauseFailed: this.createEmitSelfAction(
        TASK_EVENTS.TASK_RECORDING_PAUSE_FAILED,
        {updateTaskData: true}
      ),
      emitTaskRecordingResumed: this.createEmitSelfAction(TASK_EVENTS.TASK_RECORDING_RESUMED, {
        updateTaskData: true,
      }),
      emitTaskRecordingResumeFailed: this.createEmitSelfAction(
        TASK_EVENTS.TASK_RECORDING_RESUME_FAILED,
        {updateTaskData: true}
      ),
      // Conference event emitters
      emitTaskParticipantJoined: this.createEmitSelfAction(TASK_EVENTS.TASK_PARTICIPANT_JOINED, {
        updateTaskData: true,
      }),
      emitTaskParticipantLeft: this.createEmitSelfAction(TASK_EVENTS.TASK_PARTICIPANT_LEFT, {
        updateTaskData: true,
      }),
      emitTaskConferenceStarted: this.createEmitSelfAction(TASK_EVENTS.TASK_CONFERENCE_STARTED, {
        updateTaskData: true,
      }),
      emitTaskConferenceEnded: this.createEmitSelfAction(TASK_EVENTS.TASK_CONFERENCE_ENDED, {
        updateTaskData: true,
      }),
      emitTaskExitConference: this.createEmitSelfAction(TASK_EVENTS.TASK_EXIT_CONFERENCE, {
        updateTaskData: false,
      }),
      emitTaskTransferConference: this.createEmitSelfAction(TASK_EVENTS.TASK_TRANSFER_CONFERENCE, {
        updateTaskData: false,
      }),
    };
  }
}
