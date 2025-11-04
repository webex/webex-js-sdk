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
import {TaskState, guards} from '../state-machine';

export default class Voice extends Task implements IVoice {
  private isEndCallEnabled: boolean;
  private isEndConsultEnabled: boolean;

  /**
   * UI Control state constants for better readability.
   * These represent [visibility, enabled] tuples used by updateTaskUiControls().
   *
   * @example
   * // Button is shown and clickable
   * this.updateTaskUiControls({ accept: Voice.VISIBLE_ENABLED });
   *
   * // Button is shown but grayed out/disabled
   * this.updateTaskUiControls({ transfer: Voice.VISIBLE_DISABLED });
   *
   * // Button is not displayed at all
   * this.updateTaskUiControls({ consult: Voice.HIDDEN });
   */

  /** Button is visible and enabled (clickable) - [true, true] */
  private static readonly VISIBLE_ENABLED = [true, true] as [boolean, boolean];

  /** Button is visible but disabled (grayed out) - [true, false] */
  private static readonly VISIBLE_DISABLED = [true, false] as [boolean, boolean];

  /** Button is hidden (not displayed) - [false, false] */
  private static readonly HIDDEN = [false, false] as [boolean, boolean];

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

  /**
   * Helper method to create UI control state based on visibility and enabled status.
   * Returns [visibility, enabled] tuple for use with updateTaskUiControls().
   *
   * @param visible - Whether the button should be displayed
   * @param enabled - Whether the button should be clickable (only applies if visible)
   * @returns Tuple of [visibility, enabled] booleans
   *
   * @example
   * // Dynamic control based on state
   * this.updateTaskUiControls({
   *   hold: this.uiControl(true, this.canPerformOperation('hold')),
   *   end: this.uiControl(this.isEndCallEnabled, this.isEndCallEnabled)
   * });
   */
  private uiControl(visible: boolean, enabled: boolean): [boolean, boolean] {
    if (!visible) return Voice.HIDDEN;

    return enabled ? Voice.VISIBLE_ENABLED : Voice.VISIBLE_DISABLED;
  }

  /**
   * Helper method to check if an operation is allowed in the current state
   */
  private canPerformOperation(operation: string): boolean {
    const state = this.stateMachineService?.state;
    if (!state) {
      return false;
    }

    switch (operation) {
      case 'hold':
        return state.matches(TaskState.CONNECTED) && !state.context.isHold;
      case 'resume':
        return state.matches(TaskState.HELD) && state.context.isHold;
      case 'consult':
        return (
          (state.matches(TaskState.CONNECTED) || state.matches(TaskState.HELD)) &&
          !state.context.isConsulted &&
          !state.context.isConferencing
        );
      case 'conference':
        return state.matches(TaskState.CONSULTING) && state.context.consultDestinationAgentJoined;
      case 'transfer':
        return (
          state.matches(TaskState.CONNECTED) ||
          state.matches(TaskState.HELD) ||
          state.matches(TaskState.CONSULTING)
        );
      case 'exitConference':
        return state.matches(TaskState.CONFERENCING);
      default:
        return false;
    }
  }

  /**
   * Helper to check if consult destination agent has joined
   */
  private isConsultAgentJoined(): boolean {
    const context = this.stateMachineService?.state?.context;

    return context?.consultDestinationAgentJoined || false;
  }

  /**
   * Legacy helper for consulting controls
   */
  private applyConsultingControls(): void {
    this.updateTaskUiControls({
      hold: [false, false],
      transfer: [false, false],
      consult: [false, false],
      recording: [true, false],
    });

    if (!this.data.isConsulted) {
      this.updateTaskUiControls({
        consultTransfer: [true, true],
        endConsult: [true, true],
        end: [this.isEndCallEnabled, false],
      });
    } else {
      this.updateTaskUiControls({endConsult: [this.isEndConsultEnabled, this.isEndConsultEnabled]});
    }
  }

  /**
   * State-based UI control logic, driven by state machine context.
   * This method derives UI control states directly from the `can*` flags
   * in the state machine's context, ensuring a single source of truth.
   */
  protected updateUIControlsFromState(): void {
    const state = this.stateMachineService?.state;
    if (!state) {
      // Fallback to legacy logic if state machine is not yet initialized
      this.setUIControls();

      return;
    }

    const {context} = state;
    const {canHold, canResume, canConsult, canEndConsult, canTransfer, canWrapup, isHold} = context;

    const isOffered = state.matches(TaskState.OFFERED) || state.matches(TaskState.OFFERED_CONSULT);

    this.updateTaskUiControls({
      accept: this.uiControl(isOffered, true),
      decline: this.uiControl(isOffered, true),
      hold: this.uiControl(canHold || canResume, canHold || canResume),
      transfer: this.uiControl(canTransfer, canTransfer),
      consult: this.uiControl(canConsult, canConsult),
      endConsult: this.uiControl(canEndConsult, canEndConsult),
      wrapup: this.uiControl(canWrapup, canWrapup),
      end: this.uiControl(this.isEndCallEnabled, !isHold),
      // Recording and conference controls can be added here as well
    });
  }

  /**
   * @deprecated Legacy event-based UI control logic. Kept for backward compatibility.
   * This will be removed once the state machine is fully adopted.
   */
  protected setUIControls(): void {
    // This method is now a fallback and will be removed.
    // The logic has been migrated to `updateUIControlsFromState`.
    LoggerProxy.warn('Legacy setUIControls() called. This method is deprecated.', {
      module: CC_FILE,
      method: 'setUIControls',
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
    const state = this.stateMachineService?.state;
    if (state) {
      const currentState = state.value as TaskState;
      if (shouldHold) {
        if (!state.matches(TaskState.CONNECTED) || state.context.isHold) {
          const error = new Error(`Cannot hold call in current state: ${currentState}`);
          LoggerProxy.error('Hold operation not allowed', {
            module: CC_FILE,
            method: METHODS.HOLD_RESUME,
            interactionId: this.data.interactionId,
          });
          throw error;
        }
      } else if (!state.matches(TaskState.HELD) || !state.context.isHold) {
        const error = new Error(`Cannot resume call in current state: ${currentState}`);
        LoggerProxy.error('Resume operation not allowed', {
          module: CC_FILE,
          method: METHODS.HOLD_RESUME,
          interactionId: this.data.interactionId,
        });
        throw error;
      }
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
    const context = this.stateMachineService?.state?.context;
    if (context && !guards.recordingActive(context)) {
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
    const context = this.stateMachineService?.state?.context;
    if (context && !guards.recordingPaused(context)) {
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
    const state = this.stateMachineService?.state;
    const canConsult =
      state &&
      (state.matches(TaskState.CONNECTED) || state.matches(TaskState.HELD)) &&
      !state.context.isConsulted &&
      !state.context.isConferencing;

    if (!canConsult) {
      const currentState = state?.value as TaskState;
      const error = new Error(
        `Cannot initiate consult in ${currentState} state${
          state?.context.isConferencing ? ' (already in conference)' : ''
        }`
      );
      LoggerProxy.error('Consult operation not allowed', {
        module: CC_FILE,
        method: 'consult',
        interactionId: this.data.interactionId,
      });
      throw error;
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
   * Performs a consult transfer
   * @param consultTransferPayload - Optional payload for consult transfer
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async consultTransfer(
    consultTransferPayload?: ConsultTransferPayLoad
  ): Promise<TaskResponse> {
    try {
      LoggerProxy.info('Performing consult transfer', {
        module: CC_FILE,
        method: METHODS.CONSULT_TRANSFER,
        interactionId: this.data.interactionId,
      });

      let payload: ConsultTransferPayLoad;
      if (consultTransferPayload) {
        payload = consultTransferPayload;
      } else if (this.data.destAgentId) {
        payload = {
          to: this.data.destAgentId,
          destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        };
      } else {
        throw new Error('No destination specified for consult transfer');
      }

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      ]);

      const result = await this.contact.consultTransfer({
        interactionId: this.data.interactionId,
        data: payload,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        {
          taskId: this.data.interactionId,
          destination: payload.to,
          destinationType: payload.destinationType,
          isConsultTransfer: true,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.CONSULT_TRANSFER, CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
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
   * Initiates a consult conference (merge consult call with main call)
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async consultConference(): Promise<TaskResponse> {
    // Validate conference can start
    const state = this.stateMachineService?.state;
    if (!state || !state.matches(TaskState.CONSULTING)) {
      const error = new Error('Must be in consulting state to start conference');
      LoggerProxy.error('Conference operation not allowed', {
        module: CC_FILE,
        method: METHODS.CONSULT_CONFERENCE,
        interactionId: this.data.interactionId,
      });
      throw error;
    }

    if (!state.context.consultDestinationAgentJoined) {
      const error = new Error('Consult agent has not joined yet');
      LoggerProxy.error('Conference operation not allowed', {
        module: CC_FILE,
        method: METHODS.CONSULT_CONFERENCE,
        interactionId: this.data.interactionId,
      });
      throw error;
    }

    super.unsupportedMethodError(METHODS.CONSULT_CONFERENCE);
  }

  /**
   * Exits from an ongoing conference
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async exitConference(): Promise<TaskResponse> {
    super.unsupportedMethodError(METHODS.EXIT_CONFERENCE);
  }

  /**
   * Transfers the conference to another participant
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async transferConference(): Promise<TaskResponse> {
    super.unsupportedMethodError(METHODS.TRANSFER_CONFERENCE);
  }

  /**
   * Toggles mute/unmute for the local audio stream during a WebRTC task
   * @returns Promise<void>
   * @throws Error
   */
  public async toggleMute(): Promise<void> {
    super.unsupportedMethodError(METHODS.TOGGLE_MUTE);
  }
}
