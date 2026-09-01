import {CC_FILE, METHODS} from '../../../constants';
import {
  buildConsultConferenceParamData,
  calculateDestAgentId,
  calculateDestType,
  getErrorDetails,
} from '../../core/Utils';
import routingContact from '../contact';
import {
  ConsultPayload,
  ConsultEndPayload,
  ResumeRecordingPayload,
  TaskData,
  TaskResponse,
  DropConferenceParticipantPayload,
  IVoice,
  VoiceUIControlOptions,
  TaskToggleMuteOptions,
  TaskTransmitDtmfOptions,
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
import {TaskState, TaskEvent, TaskActionArgs} from '../state-machine';
import {WrapupData} from '../../config/types';
import {getConsultMediaResourceId, getIsConferenceInProgress} from '../TaskUtils';
import AnswerCallOnWebexService from '../../AnswerCallOnWebexService';
import {isWxAppCallNotFoundError} from '../../wxAppTelephonyUtils';
import {
  getCallingDeviceDetails,
  getWebexCallingCallId,
  resolveWxAppLineOwnerId,
  isWebexAppCallingOffer as wxIsWebexAppCallingOffer,
  isWebexAppInboundCallingOffer as wxIsWebexAppInboundCallingOffer,
  mapWxAppVoiceError,
  runWxAppAccept,
  runWxAppReject,
  runWxAppToggleMute,
  runWxAppTransmitDtmf,
  WxAppVoiceDependencies,
  WxAppVoiceLifecycle,
} from './wxAppVoiceMethods';
import {
  deriveWxAppAcceptReason,
  logWxAppMercuryMuteSync,
  logWxAppOfferDecision,
  callIdSuffix,
  WxAppAcceptReason,
} from '../../wxAppDiagnosticLogging';

export default class Voice extends Task implements IVoice {
  private static readonly WXAPP_MUTE_SYNC_RETRY_DELAY_MS = 50;
  private static readonly WXAPP_MUTE_SYNC_MAX_RETRIES = 3;

  private answerCallOnWebexService?: AnswerCallOnWebexService;
  private enableWxBetterTogether = false;
  private wxAppMuted = false;
  private wxAppAnswerPending = false;
  private wxAppAcceptInFlight = false;
  private wxAppMuteSyncInFlight?: Promise<boolean | undefined>;
  private wxAppMuteToggleInFlight?: Promise<void>;
  private lastLoggedWxAppAcceptReason?: WxAppAcceptReason;

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
      enableWxBetterTogether: callOptions?.enableWxBetterTogether ?? false,
    };

    super(
      contact,
      data,
      {
        ...resolvedOptions,
        consultTransferConfig: callOptions?.consultTransferConfig,
      },
      wrapupData,
      agentId
    );

    this.enableWxBetterTogether = resolvedOptions.enableWxBetterTogether;
    this.answerCallOnWebexService = callOptions?.answerCallOnWebexService;
  }

  private getWxAppVoiceDependencies(): WxAppVoiceDependencies {
    return {
      enableWxBetterTogether: this.enableWxBetterTogether,
      answerCallOnWebexService: this.answerCallOnWebexService,
      agentId: this.agentId,
      metricsManager: this.metricsManager,
      getTaskData: () => this.data,
      getTaskState: () => this.stateMachineService?.getSnapshot?.()?.value as TaskState | undefined,
      getWxAppMuted: () => this.wxAppMuted,
      setWxAppMuted: (muted: boolean) => {
        this.wxAppMuted = muted;
      },
    };
  }

  /** @deprecated Use {@link Voice.getWxAppVoiceDependencies} */
  private getWxAppVoiceDeps(): WxAppVoiceDependencies {
    return this.getWxAppVoiceDependencies();
  }

  public isWebexAppCallingOffer(): boolean {
    return wxIsWebexAppCallingOffer(this.getWxAppVoiceDeps());
  }

  public isWebexAppInboundCallingOffer(): boolean {
    return wxIsWebexAppInboundCallingOffer(this.getWxAppVoiceDeps());
  }

  private setWxAppAnswerPending(pending: boolean): void {
    this.wxAppAnswerPending = pending;
    this.uiControlConfig = {...this.uiControlConfig, wxAppAnswerPending: pending};
    this.updateUiControls(true);
  }

  private setWxAppAcceptInFlight(inFlight: boolean): void {
    this.wxAppAcceptInFlight = inFlight;
    this.uiControlConfig = {...this.uiControlConfig, wxAppAcceptInFlight: inFlight};
    this.updateUiControls(true);
  }

  public setEnableWxBetterTogether(enabled: boolean): void {
    this.enableWxBetterTogether = enabled;
    this.uiControlConfig = {...this.uiControlConfig, enableWxBetterTogether: enabled};
    this.updateUiControls(true);
  }

  protected updateUiControls(forceEmit = false): void {
    super.updateUiControls(forceEmit);
    this.logWxAppOfferDecisionIfNeeded();
  }

  private logWxAppOfferDecisionIfNeeded(): void {
    if (!this.enableWxBetterTogether) {
      return;
    }

    const state = this.stateMachineService?.getSnapshot?.()?.value as TaskState | undefined;
    if (state !== TaskState.OFFERED) {
      return;
    }

    const accept = this.currentUiControls?.main?.accept;
    if (!accept?.isVisible) {
      return;
    }

    const deps = this.getWxAppVoiceDependencies();
    const isOutdial = this.data?.interaction?.outboundType === 'OUTDIAL';
    const isWxAppInboundOffer = this.isWebexAppInboundCallingOffer();
    const isWxAppOutdialOffer = this.isWebexAppCallingOffer() && isOutdial;
    const deviceDetails = getCallingDeviceDetails(deps);
    const acceptReason = deriveWxAppAcceptReason({
      isWxAppInboundOffer,
      isWxAppOutdialOffer,
      isWebrtc: false,
      isOutdial,
      wxAppAcceptInFlight: this.wxAppAcceptInFlight,
      wxAppAnswerPending: this.wxAppAnswerPending,
      enableWxBetterTogether: this.enableWxBetterTogether,
      hasDeviceCallId: Boolean(deviceDetails?.deviceCallId),
    });

    if (acceptReason === this.lastLoggedWxAppAcceptReason) {
      return;
    }

    this.lastLoggedWxAppAcceptReason = acceptReason;

    logWxAppOfferDecision({
      interactionId: this.data.interactionId,
      acceptVisible: accept.isVisible,
      acceptEnabled: accept.isEnabled,
      acceptReason,
      wxAppParticipantDeviceType: deviceDetails?.deviceType,
      hasDeviceCallId: Boolean(deviceDetails?.deviceCallId),
    });
  }

  public applyWxAppMuteStateFromSync(incomingCallId: string, muted: boolean): void {
    if (!this.enableWxBetterTogether) {
      return;
    }

    const activeCallId = this.getWebexCallingCallId();
    const incomingSuffix = callIdSuffix(incomingCallId);
    const activeSuffix = callIdSuffix(activeCallId);

    if (!activeCallId || !incomingCallId.endsWith(activeCallId)) {
      logWxAppMercuryMuteSync({
        phase: 'dropped',
        muted,
        callIdSuffix: incomingSuffix,
        interactionId: this.data.interactionId,
        dropReason: !activeCallId ? 'no_active_wxApp_call' : 'call_id_mismatch',
      });

      return;
    }

    if (this.wxAppMuted === muted) {
      logWxAppMercuryMuteSync({
        phase: 'dropped',
        muted,
        callIdSuffix: incomingSuffix,
        interactionId: this.data.interactionId,
        dropReason: 'mute_state_unchanged',
      });

      return;
    }

    this.wxAppMuted = muted;
    logWxAppMercuryMuteSync({
      phase: 'applied',
      muted,
      callIdSuffix: activeSuffix,
      interactionId: this.data.interactionId,
    });
    this.emit(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, {muted});
  }

  public getWxAppMuted(): boolean {
    return this.wxAppMuted;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private canRetryWxAppMuteSync(): boolean {
    if (!this.enableWxBetterTogether) {
      return false;
    }

    return (
      Boolean(getCallingDeviceDetails(this.getWxAppVoiceDeps())?.deviceCallId) &&
      !this.getWebexCallingCallId()
    );
  }

  private shouldSkipWxAppMuteSync(): boolean {
    if (this.data?.interaction?.isTerminated) {
      return true;
    }

    return this.isWebexAppCallingOffer() && !this.uiControlConfig?.wxAppAnswerPending;
  }

  private applyWxAppMuteFromBackfill(callId: string, muted: boolean): void {
    if (!this.enableWxBetterTogether || this.wxAppMuted === muted) {
      return;
    }

    const activeCallId = this.getWebexCallingCallId();
    if (activeCallId && !callId.endsWith(activeCallId) && !activeCallId.endsWith(callId)) {
      return;
    }

    this.wxAppMuted = muted;
    this.emit(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, {muted});
  }

  public async syncWxAppMuteFromCallDetails(retryAttempt = 0): Promise<boolean | undefined> {
    if (!this.enableWxBetterTogether || !this.answerCallOnWebexService) {
      return undefined;
    }

    if (retryAttempt === 0 && this.shouldSkipWxAppMuteSync()) {
      return undefined;
    }

    if (retryAttempt === 0 && this.wxAppMuteSyncInFlight) {
      return this.wxAppMuteSyncInFlight;
    }

    const syncPromise = this.performWxAppMuteSync(retryAttempt);

    if (retryAttempt === 0) {
      this.wxAppMuteSyncInFlight = syncPromise;
      syncPromise
        .finally(() => {
          if (this.wxAppMuteSyncInFlight === syncPromise) {
            this.wxAppMuteSyncInFlight = undefined;
          }
        })
        .catch(() => undefined);

      return syncPromise;
    }

    return syncPromise;
  }

  private async performWxAppMuteSync(retryAttempt: number): Promise<boolean | undefined> {
    if (this.shouldSkipWxAppMuteSync()) {
      return undefined;
    }

    let callId = this.getWebexCallingCallId();
    if (!callId) {
      if (retryAttempt < Voice.WXAPP_MUTE_SYNC_MAX_RETRIES && this.canRetryWxAppMuteSync()) {
        await Voice.delay(Voice.WXAPP_MUTE_SYNC_RETRY_DELAY_MS);

        return this.performWxAppMuteSync(retryAttempt + 1);
      }

      callId = getCallingDeviceDetails(this.getWxAppVoiceDeps())?.deviceCallId ?? null;
      if (!callId) {
        return undefined;
      }
    }

    try {
      const lineOwnerId = resolveWxAppLineOwnerId(this.getWxAppVoiceDeps());
      const details = await this.answerCallOnWebexService.getCallDetails({callId, lineOwnerId});
      if (details.muted !== undefined) {
        this.applyWxAppMuteStateFromSync(callId, details.muted);
        if (this.wxAppMuted !== details.muted) {
          this.applyWxAppMuteFromBackfill(callId, details.muted);
        }

        return details.muted;
      }

      return this.wxAppMuted;
    } catch (error) {
      if (!isWxAppCallNotFoundError(error)) {
        LoggerProxy.error(`Failed to sync wxApp mute from call details: ${error}`, {
          module: CC_FILE,
          method: METHODS.GET_CALL_DETAILS_ON_WEBEX,
          interactionId: this.data?.interactionId,
        });
      }

      return undefined;
    }
  }

  protected onTaskAssigned(): void {
    this.setWxAppAnswerPending(false);
    queueMicrotask(() => {
      this.syncWxAppMuteFromCallDetails().catch(() => undefined);
    });
  }

  protected onTaskHydrated(): void {
    const state = this.stateMachineService?.getSnapshot?.()?.value as TaskState | undefined;
    const answerStillPending =
      state === TaskState.OFFERED &&
      (this.uiControlConfig?.wxAppAcceptInFlight || this.uiControlConfig?.wxAppAnswerPending);

    if (!answerStillPending) {
      this.setWxAppAnswerPending(false);
    }

    this.syncWxAppMuteFromCallDetails().catch(() => undefined);
  }

  public getCallingDeviceDetails() {
    return getCallingDeviceDetails(this.getWxAppVoiceDeps());
  }

  public getWebexCallingCallId(): string | null {
    return getWebexCallingCallId(this.getWxAppVoiceDeps());
  }

  private createWxAppLifecycle(): WxAppVoiceLifecycle {
    return {
      setWxAppAcceptInFlight: (inFlight) => this.setWxAppAcceptInFlight(inFlight),
      setWxAppAnswerPending: (pending) => this.setWxAppAnswerPending(pending),
      resetWxAppMuted: () => {
        this.wxAppMuted = false;
      },
      syncWxAppMuteFromCallDetails: () => this.syncWxAppMuteFromCallDetails(),
      mapWxAppVoiceError: (error, method) => mapWxAppVoiceError(error, method, CC_FILE),
    };
  }

  private getStateMachineSnapshot() {
    return this.stateMachineService?.getSnapshot?.();
  }

  /**
   * Accepts the task. Routes to wxApp telephony answer when `enableWxBetterTogether` and wxApp offer.
   */
  public async accept(): Promise<TaskResponse> {
    if (this.enableWxBetterTogether && this.isWebexAppCallingOffer()) {
      await runWxAppAccept(this.getWxAppVoiceDependencies(), this.createWxAppLifecycle());

      return Promise.resolve();
    }

    return super.unsupportedMethodError(METHODS.ACCEPT);
  }

  /**
   * Declines the task. Routes wxApp inbound to telephony reject; wxApp outdial offer to cancelTask.
   */
  public async decline(): Promise<TaskResponse> {
    if (this.enableWxBetterTogether && this.isWebexAppInboundCallingOffer()) {
      await runWxAppReject(this.getWxAppVoiceDependencies(), this.createWxAppLifecycle());

      return Promise.resolve();
    }

    const isOutdial = this.data?.interaction?.outboundType === 'OUTDIAL';
    if (!this.enableWxBetterTogether || !isOutdial || !this.isWebexAppCallingOffer()) {
      return super.unsupportedMethodError(METHODS.REJECT);
    }

    const interactionId = this.data.interactionId;
    LoggerProxy.log(`Declining wxApp outdial task for taskId:${interactionId}`, {
      module: CC_FILE,
      method: METHODS.REJECT,
      interactionId,
    });

    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_DECLINE_SUCCESS,
        METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
      ]);

      this.setWxAppAnswerPending(false);
      const response = await this.contact.cancelTask({interactionId});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_DECLINE_SUCCESS,
        {
          taskId: interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral']
      );

      return response;
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
        {
          taskId: interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(
            (error as any).details || {}
          ),
        },
        ['operational', 'behavioral']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.REJECT, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Toggles mute for wxApp engaged telephony when `enableWxBetterTogether` is active.
   */
  public async toggleMute(options?: TaskToggleMuteOptions): Promise<void> {
    if (this.enableWxBetterTogether && this.getWebexCallingCallId()) {
      if (this.wxAppMuteToggleInFlight) {
        await this.wxAppMuteToggleInFlight.catch(() => undefined);
      }

      const togglePromise = runWxAppToggleMute(
        this.getWxAppVoiceDependencies(),
        this.createWxAppLifecycle(),
        options
      );

      this.wxAppMuteToggleInFlight = togglePromise;
      togglePromise
        .finally(() => {
          if (this.wxAppMuteToggleInFlight === togglePromise) {
            this.wxAppMuteToggleInFlight = undefined;
          }
        })
        .catch(() => undefined);

      await togglePromise;

      return;
    }

    super.unsupportedMethodError(METHODS.TOGGLE_MUTE);
  }

  /**
   * Sends in-call DTMF for wxApp engaged telephony when `enableWxBetterTogether` is active.
   */
  public async transmitDtmf(options: TaskTransmitDtmfOptions): Promise<void> {
    if (this.enableWxBetterTogether && this.getWebexCallingCallId()) {
      await runWxAppTransmitDtmf(
        this.getWxAppVoiceDependencies(),
        this.createWxAppLifecycle(),
        options
      );

      return;
    }

    super.unsupportedMethodError(METHODS.TRANSMIT_DTMF);
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
    const snapshot = this.getStateMachineSnapshot();
    const snapshotState = snapshot?.value as TaskState | undefined;
    const mainInteractionId = this.data.interaction?.mainInteractionId || this.data.interactionId;
    const mainMediaResource =
      this.data.interaction?.media?.[mainInteractionId]?.mediaResourceId ||
      this.data.mediaResourceId;
    const mediaHoldState =
      this.data.interaction?.media?.[mainInteractionId]?.isHold ??
      this.data.interaction.media?.[mainMediaResource]?.isHold;
    let shouldHold = !(mediaHoldState ?? false);
    if (snapshotState === TaskState.HELD || snapshotState === TaskState.RESUME_INITIATING) {
      shouldHold = false;
    } else if (snapshotState === TaskState.CONNECTED && mediaHoldState !== true) {
      // CONNECTED with isHold:true can happen after consult RONA/decline when event ordering
      // leaves the machine in CONNECTED while main media is still on hold — resume on first click.
      shouldHold = true;
    }

    // Validate operation is allowed in current state
    const state = snapshot;
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
      } else if (
        !state.matches(TaskState.HELD) &&
        !(state.matches(TaskState.CONFERENCING) && mediaHoldState === true) &&
        !(state.matches(TaskState.CONNECTED) && mediaHoldState === true)
      ) {
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
        mediaResourceId: mainMediaResource,
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
          data: {mediaResourceId: mainMediaResource},
        });

        // Send success event to complete the transition
        if (this.stateMachineService) {
          this.stateMachineService.send({
            type: TaskEvent.HOLD_SUCCESS,
            mediaResourceId: mainMediaResource,
          });
        }

        this.metricsManager.trackEvent(
          successEvt,
          {
            taskId: this.data.interactionId,
            mediaResourceId: mainMediaResource,
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
        response = await this.contact.unHold({
          interactionId: this.data.interactionId,
          data: {mediaResourceId: mainMediaResource},
        });

        // Send success event to complete the transition
        if (this.stateMachineService) {
          this.stateMachineService.send({
            type: TaskEvent.UNHOLD_SUCCESS,
            mediaResourceId: mainMediaResource,
          });
        }

        this.metricsManager.trackEvent(
          successEvt,
          {
            taskId: this.data.interactionId,
            mainInteractionId,
            mediaResourceId: mainMediaResource,
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
    const state = this.getStateMachineSnapshot();
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
    const state = this.getStateMachineSnapshot();
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
    const state = this.getStateMachineSnapshot();
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

    const requestInteractionId =
      this.data.interaction?.mainInteractionId || this.data.interactionId;

    try {
      LoggerProxy.info(`Starting consult`, {
        module: CC_FILE,
        method: 'consult',
        interactionId: requestInteractionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONSULT_START_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED,
      ]);
      const result = await this.contact.consult({
        interactionId: requestInteractionId,
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
          requestInteractionId,
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
        interactionId: requestInteractionId,
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
          requestInteractionId,
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
    const requestInteractionId =
      this.data.interaction?.mainInteractionId || this.data.interactionId;

    try {
      LoggerProxy.info(`Ending consult`, {
        module: CC_FILE,
        method: 'endConsult',
        interactionId: requestInteractionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED,
      ]);
      const result = await this.contact.consultEnd({
        interactionId: requestInteractionId,
        data: consultEndPayload,
      });
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS,
        {
          taskId: this.data.interactionId,
          requestInteractionId,
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
          requestInteractionId,
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
        const normalizedDestinationType =
          payload.destinationType === 'Agent' || payload.destinationType === 'Queue'
            ? (payload.destinationType.toLowerCase() as ConsultTransferPayLoad['destinationType'])
            : payload.destinationType;
        let consultPayload: ConsultTransferPayLoad = {
          to: payload.to,
          destinationType: normalizedDestinationType,
        };

        if (normalizedDestinationType === CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE) {
          const consultContext = this.getStateMachineSnapshot()?.context;
          const destAgent = consultContext?.consultDestinationAgentId || this.data.destAgentId;
          if (!destAgent) {
            throw new Error('No agent has accepted this queue consult yet');
          }
          consultPayload = {
            to: destAgent,
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
    const derivedDestAgentId =
      this.data.interaction && this.data.agentId
        ? calculateDestAgentId(this.data.interaction, this.data.agentId)
        : '';
    const derivedDestType =
      this.data.interaction && this.data.agentId
        ? calculateDestType(this.data.interaction, this.data.agentId)
        : '';

    // derivedDestType is most reliable as it inspects live interaction participants
    const resolvedDestinationType =
      derivedDestType ||
      this.getStateMachineSnapshot()?.context?.consultDestinationType ||
      this.data.destinationType ||
      'agent';

    const consultationData: consultConferencePayloadData = {
      agentId: this.data.agentId,
      destinationType: resolvedDestinationType,
      // derivedDestAgentId is most reliable as it resolves epId for EP_DN
      // and agent ID for regular agents from live interaction data
      destAgentId:
        derivedDestAgentId ||
        this.getStateMachineSnapshot()?.context?.consultDestinationAgentId ||
        this.data.destAgentId,
    };

    // Send state machine event to transition to CONF_INITIATING
    if (this.stateMachineService) {
      this.stateMachineService.send({
        type: TaskEvent.MERGE_TO_CONFERENCE,
      });
    }

    try {
      if (!consultationData.destAgentId) {
        throw new Error('Unable to determine consult destination for conference');
      }

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
   * Removes another participant from an active conference.
   * Completion is correlated with ParticipantLeftConference by the AQM request layer.
   * @param payload - Participant identifier to remove
   * @returns Promise<TaskResponse>
   */
  public async dropConferenceParticipant(
    payload: DropConferenceParticipantPayload
  ): Promise<TaskResponse> {
    // The TypeScript contract requires payload, but the published SDK is also callable from
    // untyped JavaScript. Keep an explicit runtime boundary check before direct property access.
    if (!payload) {
      throw new Error('participantId must be a non-empty string');
    }

    const {participantId} = payload;

    if (typeof participantId !== 'string' || participantId.trim().length === 0) {
      throw new Error('participantId must be a non-empty string');
    }

    const requestInteractionId =
      this.data.interaction?.mainInteractionId || this.data.interactionId;
    // taskId identifies the SDK task instance, which can remain child-interaction keyed after
    // consult/EP-DN flows. requestInteractionId identifies the main interaction sent to AQM.

    LoggerProxy.info('Dropping conference participant', {
      module: CC_FILE,
      method: METHODS.DROP_CONFERENCE_PARTICIPANT,
      interactionId: requestInteractionId,
    });

    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_FAILED,
      ]);

      const response = await this.contact.dropConferenceParticipant({
        interactionId: requestInteractionId,
        participantId,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_SUCCESS,
        {
          taskId: this.data.interactionId,
          requestInteractionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
          agentId: this.agentId,
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log('Successfully dropped conference participant', {
        module: CC_FILE,
        method: METHODS.DROP_CONFERENCE_PARTICIPANT,
        trackingId: response?.trackingId,
        interactionId: requestInteractionId,
      });

      return response;
    } catch (error) {
      const failureTrackingFields = MetricsManager.getCommonTrackingFieldForAQMResponseFailed(
        error?.details || {}
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_FAILED,
        {
          taskId: this.data.interactionId,
          requestInteractionId,
          agentId: this.agentId,
          trackingId: failureTrackingFields.trackingId,
          notifTrackingId: failureTrackingFields.notifTrackingId,
          orgId: failureTrackingFields.orgId,
          failureType: failureTrackingFields.failureType,
          reasonCode: failureTrackingFields.reasonCode,
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.error('Failed to drop conference participant', {
        module: CC_FILE,
        method: METHODS.DROP_CONFERENCE_PARTICIPANT,
        trackingId: failureTrackingFields.trackingId,
        interactionId: requestInteractionId,
      });

      throw error;
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
    const state = this.getStateMachineSnapshot();
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

    const requestInteractionId =
      this.data.interaction?.mainInteractionId || this.data.interactionId;

    try {
      LoggerProxy.info(`Exiting conference`, {
        module: CC_FILE,
        method: 'exitConference',
        interactionId: requestInteractionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONFERENCE_EXIT_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONFERENCE_EXIT_FAILED,
      ]);

      const response = await this.contact.exitConference({
        interactionId: requestInteractionId,
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
          requestInteractionId,
          agentId: this.data.agentId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Successfully exited conference`, {
        module: CC_FILE,
        method: 'exitConference',
        trackingId: response.trackingId,
        interactionId: requestInteractionId,
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
          requestInteractionId,
          agentId: this.data.agentId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.error(`Failed to exit conference`, {
        module: CC_FILE,
        method: 'exitConference',
        interactionId: requestInteractionId,
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
    const state = this.getStateMachineSnapshot();
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

    const requestInteractionId =
      this.data.interaction?.mainInteractionId || this.data.interactionId;

    try {
      LoggerProxy.info(`Transferring conference`, {
        module: CC_FILE,
        method: 'transferConference',
        interactionId: requestInteractionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_FAILED,
      ]);

      const response = await this.contact.conferenceTransfer({
        interactionId: requestInteractionId,
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
          requestInteractionId,
          agentId: this.data.agentId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Successfully transferred conference`, {
        module: CC_FILE,
        method: 'transferConference',
        trackingId: response.trackingId,
        interactionId: requestInteractionId,
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
          requestInteractionId,
          agentId: this.data.agentId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.error(`Failed to transfer conference`, {
        module: CC_FILE,
        method: 'transferConference',
        interactionId: requestInteractionId,
      });

      throw detailedError;
    }
  }

  /**
   * Toggle between consult call and main call during consulting.
   * If on consult leg (consultCallHeld = false), switches to main call by holding consult.
   * If on main call (consultCallHeld = true), switches to consult by resuming consult.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if not in CONSULTING state or no consult media resource
   * @example
   * ```typescript
   * await task.switchCall();
   * ```
   */
  public async switchCall(): Promise<TaskResponse> {
    // Validate we're in CONSULTING state
    const state = this.getStateMachineSnapshot();
    if (!state?.matches(TaskState.CONSULTING)) {
      const currentState = state?.value as TaskState;
      const error = new Error(`Cannot switch call in ${currentState} state`);
      LoggerProxy.error('Switch call operation not allowed', {
        module: CC_FILE,
        method: 'switchCall',
        interactionId: this.data.interactionId,
      });
      throw error;
    }

    // Validate we have a consult media resource
    const consultMediaResourceId = getConsultMediaResourceId(
      this.data.interaction,
      this.data.consultMediaResourceId,
      this.data.agentId
    );
    if (!consultMediaResourceId) {
      const error = new Error('No consult media resource available');
      LoggerProxy.error('Switch call failed - no consult media resource', {
        module: CC_FILE,
        method: 'switchCall',
        interactionId: this.data.interactionId,
      });
      throw error;
    }

    const context = state.context;
    const isOnConsultLeg = !context.consultCallHeld;

    // Determine direction and send appropriate state machine event
    const targetEvent = isOnConsultLeg
      ? TaskEvent.SWITCH_TO_MAIN_CALL
      : TaskEvent.SWITCH_TO_CONSULT;
    const revertEvent = isOnConsultLeg
      ? TaskEvent.SWITCH_TO_CONSULT
      : TaskEvent.SWITCH_TO_MAIN_CALL;

    if (this.stateMachineService) {
      this.stateMachineService.send({type: targetEvent});
    }

    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.TASK_SWITCH_CALL_SUCCESS,
      METRIC_EVENT_NAMES.TASK_SWITCH_CALL_FAILED,
    ]);

    try {
      if (isOnConsultLeg) {
        const response = await this.contact.unHold({
          interactionId: this.data.interactionId,
          data: {mediaResourceId: this.data.mediaResourceId},
        });

        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.TASK_SWITCH_CALL_SUCCESS,
          {
            taskId: this.data.interactionId,
            direction: 'toMainCall',
            mediaResourceId: consultMediaResourceId,
            ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
          },
          ['operational', 'behavioral']
        );

        LoggerProxy.log(`Switched to main call successfully`, {
          module: CC_FILE,
          method: 'switchCall',
          trackingId: response.trackingId,
          interactionId: this.data.interactionId,
        });

        return response;
      }

      const response = await this.contact.hold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId: this.data.mediaResourceId},
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_SWITCH_CALL_SUCCESS,
        {
          taskId: this.data.interactionId,
          direction: 'toConsultCall',
          mediaResourceId: consultMediaResourceId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral']
      );

      LoggerProxy.log(`Switched to consult call successfully`, {
        module: CC_FILE,
        method: 'switchCall',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      if (this.stateMachineService) {
        this.stateMachineService.send({type: revertEvent});
      }

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_SWITCH_CALL_FAILED,
        {
          taskId: this.data.interactionId,
          direction: isOnConsultLeg ? 'toMainCall' : 'toConsultCall',
          mediaResourceId: consultMediaResourceId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral']
      );

      const {error: detailedError} = getErrorDetails(error, 'switchCall', CC_FILE);
      LoggerProxy.error(`Failed to switch call`, {
        module: CC_FILE,
        method: 'switchCall',
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
      emitTaskConferenceFailed: this.createEmitSelfAction(TASK_EVENTS.TASK_CONFERENCE_FAILED, {
        updateTaskData: true,
      }),
      emitTaskExitConference: this.createEmitSelfAction(TASK_EVENTS.TASK_EXIT_CONFERENCE, {
        updateTaskData: false,
      }),
      emitTaskTransferConference: this.createEmitSelfAction(TASK_EVENTS.TASK_TRANSFER_CONFERENCE, {
        updateTaskData: false,
      }),
      emitTaskSwitchCall: this.createEmitSelfAction(TASK_EVENTS.TASK_SWITCH_CALL, {
        updateTaskData: false,
      }),
      emitTaskTransferConferenceFailed: this.createEmitSelfAction(
        TASK_EVENTS.TASK_CONFERENCE_TRANSFER_FAILED,
        {updateTaskData: true}
      ),
      emitTaskOutdialFailed: ({event}: TaskActionArgs) => {
        const taskData = (event as {taskData?: TaskData})?.taskData;
        if (taskData) {
          this.updateTaskData(taskData);
        }
        if (taskData?.suppressOutdialFailedPopup) {
          return;
        }
        const reason = (event as {reason?: string})?.reason || 'Outdial failed';
        this.emit(TASK_EVENTS.TASK_OUTDIAL_FAILED, reason);
      },
    };
  }
}
