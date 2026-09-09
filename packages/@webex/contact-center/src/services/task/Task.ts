import {EventEmitter} from 'events';
import {createActor} from 'xstate';
import type {ActorRefFrom, SnapshotFrom} from 'xstate';
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
  DropConferenceParticipantPayload,
  ConsultEndPayload,
  ConsultPayload,
  ConsultTransferPayLoad,
  ResumeRecordingPayload,
  MEDIA_CHANNEL,
  TASK_CHANNEL_TYPE,
  VOICE_VARIANT,
  CallId,
  AISummaryActionType,
  PostCallSummaryEventPayload,
  MidCallSummaryEventPayload,
  PostCallSummaryResponsePayload,
  MidCallSummaryResponsePayload,
  FeatureEnablementAccessor,
  GeneratedSummaryFlagsAccessor,
  AISummaryAdapter,
  AISummaryResponseContext,
  TaskToggleMuteOptions,
  TaskTransmitDtmfOptions,
} from './types';
import {AI_SUMMARY_DURATION_MS, ENTRY_POINT_TRANSFER_DESTINATION_TYPE, METHODS} from './constants';
import {
  AI_ASSISTANT_CLIENT_TYPE,
  AI_SUMMARY_ERROR_CODES,
  CC_FILE,
  TASK_FILE,
} from '../../constants';
import {getErrorDetails} from '../core/Utils';
import routingContact from './contact';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import LoggerProxy from '../../logger-proxy';
import {createTaskStateMachine, TaskState} from './state-machine';
import type {
  TaskEventPayload,
  TaskStateMachine,
  UIControlConfig,
  TaskContext,
  TaskActionsMap,
  TaskActionArgs,
} from './state-machine';
import {
  computeUIControls,
  getDefaultUIControls,
  haveUIControlsChanged,
} from './state-machine/uiControlsComputer';
import AutoWrapup from './AutoWrapup';
import {WrapupData} from '../config/types';
import {AIAssistantEventName, AIAssistantEventType} from '../../types';
import {createSummaryError} from './TaskUtils';

type UIControlConfigInput = Omit<UIControlConfig, 'channelType'> & {
  channelType?: UIControlConfig['channelType'];
};

const AI_SUMMARY_INVALID_RESPONSE_PAYLOAD = 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD';

export default abstract class Task extends EventEmitter implements ITask {
  protected contact: ReturnType<typeof routingContact>;
  protected metricsManager: MetricsManager;
  public stateMachineService?: ActorRefFrom<TaskStateMachine>;
  public data: TaskData;
  public webCallMap: Record<TaskId, CallId>;
  public state?: SnapshotFrom<TaskStateMachine>;
  private lastState?: TaskState;
  protected currentUiControls: TaskUIControls;
  protected uiControlConfig: UIControlConfig;
  protected wrapupData?: WrapupData;
  public autoWrapup?: AutoWrapup;
  protected agentId?: string;
  protected agentName?: string;
  private aiSummaryAdapter?: AISummaryAdapter;
  private getFeatureEnablement?: FeatureEnablementAccessor;
  private getGeneratedSummaryFlags?: GeneratedSummaryFlagsAccessor;
  private postCallSummaryResponseContext?: AISummaryResponseContext;
  private midCallSummaryResponseContext?: AISummaryResponseContext;

  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    uiControlConfig: UIControlConfigInput,
    wrapupData?: WrapupData,
    agentId?: string,
    agentName?: string
  ) {
    super();
    this.contact = contact;
    this.data = data;
    const channelType = uiControlConfig.channelType ?? Task.resolveChannelType(data);
    // Include agentId in the config for ownership checks (transfer conference)
    this.uiControlConfig = {...uiControlConfig, channelType, agentId};
    this.wrapupData = wrapupData;
    this.agentId = agentId;
    this.agentName = agentName;
    this.metricsManager = MetricsManager.getInstance();
    this.webCallMap = {};
    this.currentUiControls = getDefaultUIControls();
    this.initializeStateMachine();
    this.setupAutoWrapupTimer();
  }

  private static resolveChannelType(data: TaskData): UIControlConfig['channelType'] {
    const mediaType = data?.interaction?.mediaType ?? MEDIA_CHANNEL.TELEPHONY;

    return mediaType === MEDIA_CHANNEL.TELEPHONY
      ? TASK_CHANNEL_TYPE.VOICE
      : TASK_CHANNEL_TYPE.DIGITAL;
  }

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

  public async resumeRecording(
    resumeRecordingPayload: ResumeRecordingPayload
  ): Promise<TaskResponse> {
    if (resumeRecordingPayload) {
      // parameter intentionally unused
    }
    this.unsupportedMethodError('resumeRecording');
  }

  public async consult(consultPayload: ConsultPayload): Promise<TaskResponse> {
    if (consultPayload) {
      // parameter intentionally unused
    }
    this.unsupportedMethodError('consult');
  }

  public async endConsult(consultEndPayload: ConsultEndPayload): Promise<TaskResponse> {
    if (consultEndPayload) {
      // parameter intentionally unused
    }
    this.unsupportedMethodError('endConsult');
  }

  public async consultTransfer(
    consultTransferPayload?: ConsultTransferPayLoad
  ): Promise<TaskResponse> {
    if (consultTransferPayload) {
      // parameter intentionally unused
    }
    this.unsupportedMethodError('consultTransfer');
  }

  public async consultConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('consultConference');
  }

  public async dropConferenceParticipant(
    // The base task preserves the public signature; Voice provides the implementation.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    payload: DropConferenceParticipantPayload
  ): Promise<TaskResponse> {
    this.unsupportedMethodError(METHODS.DROP_CONFERENCE_PARTICIPANT);
  }

  public async exitConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('exitConference');
  }

  public async transferConference(): Promise<TaskResponse> {
    this.unsupportedMethodError('transferConference');
  }

  public async switchCall(): Promise<TaskResponse> {
    this.unsupportedMethodError('switchCall');
  }

  public async toggleMute(options?: TaskToggleMuteOptions): Promise<void> {
    if (options) {
      // parameter intentionally unused
    }
    this.unsupportedMethodError('toggleMute');
  }

  public async transmitDtmf(options: TaskTransmitDtmfOptions): Promise<void> {
    if (options) {
      // parameter intentionally unused
    }
    this.unsupportedMethodError('transmitDtmf');
  }

  public unregisterWebCallListeners(): void {
    // Default implementation - child classes can override
    LoggerProxy.log('unregisterWebCallListeners called', {
      module: CC_FILE,
      method: 'unregisterWebCallListeners',
      interactionId: this.data?.interactionId,
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

  public configureAISummary(
    apiAIAssistant: AISummaryAdapter | undefined,
    getGeneratedSummaryFlags: GeneratedSummaryFlagsAccessor,
    getFeatureEnablement: FeatureEnablementAccessor
  ): void {
    this.aiSummaryAdapter = apiAIAssistant;
    this.getFeatureEnablement = getFeatureEnablement;
    this.getGeneratedSummaryFlags = getGeneratedSummaryFlags;
  }

  public requestPostCallSummary(): Promise<PostCallSummaryEventPayload> {
    const operation = this.requestPostCallSummaryInternal();

    operation.catch(() => undefined);

    return operation;
  }

  private async requestPostCallSummaryInternal(): Promise<PostCallSummaryEventPayload> {
    const metricFields: Record<string, unknown> = {
      operation: METHODS.REQUEST_POST_CALL_SUMMARY,
    };

    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_SUCCESS,
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
      ]);
      const interactionId = this.data.interactionId;
      const conversationId = this.data.interaction?.mainInteractionId || interactionId;
      Object.assign(metricFields, {conversationId, interactionId});

      const organizationEnabled =
        (this.getGeneratedSummaryFlags as GeneratedSummaryFlagsAccessor)()
          ?.wrapUpSummariesEnabled === true;
      const interactionEnabled =
        (this.getFeatureEnablement as FeatureEnablementAccessor)(interactionId)?.postCallEnabled ===
        true;

      if (!organizationEnabled || !interactionEnabled) {
        throw createSummaryError(AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED);
      }

      const result = await (
        this.aiSummaryAdapter as AISummaryAdapter
      ).requestAndWaitForRtd<PostCallSummaryEventPayload>({
        correlationId: conversationId,
        rtdEventType: 'POST_CALL_SUMMARY',
        timeoutMs: AI_SUMMARY_DURATION_MS,
        createTimeoutError: () =>
          createSummaryError(AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_TIMEOUT),
        agentId: this.agentId as string,
        interactionId,
        eventType: AIAssistantEventType.CTI_EVENT,
        eventName: AIAssistantEventName.GET_POST_CALL_SUMMARY,
        eventMetaData: {
          conversationId,
          clientType: AI_ASSISTANT_CLIENT_TYPE,
        },
        timeout: AI_SUMMARY_DURATION_MS,
      });

      this.postCallSummaryResponseContext = {conversationId, interactionId};

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_SUCCESS,
        {taskId: this.data?.interactionId, ...metricFields},
        ['operational']
      );

      return result;
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
        {
          taskId: this.data?.interactionId,
          ...metricFields,
          failureCode: Task.getAISummaryFailureCode(error),
        },
        ['operational']
      );
      throw error;
    }
  }

  public async sendPostCallSummaryResponse(payload: PostCallSummaryResponsePayload): Promise<void> {
    const metricFields: Record<string, unknown> = {
      operation: METHODS.SEND_POST_CALL_SUMMARY_RESPONSE,
    };

    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.AI_SUMMARY_POST_CALL_RESPONSE_SUCCESS,
        METRIC_EVENT_NAMES.AI_SUMMARY_POST_CALL_RESPONSE_FAILED,
      ]);
      const context = this.postCallSummaryResponseContext ?? {
        conversationId: this.data.interaction?.mainInteractionId || this.data.interactionId,
        interactionId: this.data.interactionId,
      };
      Object.assign(metricFields, {
        conversationId: context.conversationId,
        interactionId: context.interactionId,
      });

      const fallbackTimestamp = Date.now();
      const actionTimeStamp = payload.actionTimeStamp ?? fallbackTimestamp;
      const publishTimestamp = payload.publishTimestamp ?? fallbackTimestamp;
      await (this.aiSummaryAdapter as AISummaryAdapter).sendEvent(
        this.agentId as string,
        context.interactionId,
        AIAssistantEventType.CTI_EVENT,
        AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
        {
          conversationId: context.conversationId,
          clientType: AI_ASSISTANT_CLIENT_TYPE,
          action: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
          actionTimeStamp,
          summary: payload.summary,
          wrapUpCode: payload.wrapUpCode,
          numberOfTimesViewed: payload.numberOfTimesViewed,
          numberOfTimesEdited: payload.numberOfTimesEdited,
          numberOfTimesCopied: payload.numberOfTimesCopied,
          feedback: payload.feedback,
          state: payload.state,
        },
        undefined,
        undefined,
        publishTimestamp,
        AI_SUMMARY_DURATION_MS
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_POST_CALL_RESPONSE_SUCCESS,
        {taskId: this.data?.interactionId, ...metricFields},
        ['operational']
      );
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_POST_CALL_RESPONSE_FAILED,
        {
          taskId: this.data?.interactionId,
          ...metricFields,
          failureCode: Task.getAISummaryFailureCode(error),
        },
        ['operational']
      );
      throw error;
    }
  }

  public requestMidCallSummary(
    actionType: AISummaryActionType
  ): Promise<MidCallSummaryEventPayload> {
    const operation = this.requestMidCallSummaryInternal(actionType);

    operation.catch(() => undefined);

    return operation;
  }

  private async requestMidCallSummaryInternal(
    actionType: AISummaryActionType
  ): Promise<MidCallSummaryEventPayload> {
    const metricFields: Record<string, unknown> = {
      operation: METHODS.REQUEST_MID_CALL_SUMMARY,
    };

    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_SUCCESS,
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
      ]);
      Object.assign(metricFields, {actionType});
      const interactionId = this.data.interactionId;
      const conversationId = this.data.interaction?.mainInteractionId || interactionId;
      Object.assign(metricFields, {conversationId, interactionId});

      const organizationEnabled =
        (this.getGeneratedSummaryFlags as GeneratedSummaryFlagsAccessor)()
          ?.consultTransferSummariesEnabled === true;
      const interactionEnabled =
        (this.getFeatureEnablement as FeatureEnablementAccessor)(interactionId)?.midCallEnabled ===
        true;

      if (!organizationEnabled || !interactionEnabled) {
        throw createSummaryError(AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED);
      }

      const result = await (
        this.aiSummaryAdapter as AISummaryAdapter
      ).requestAndWaitForRtd<MidCallSummaryEventPayload>({
        correlationId: conversationId,
        rtdEventType: 'MID_CALL_SUMMARY',
        timeoutMs: AI_SUMMARY_DURATION_MS,
        createTimeoutError: () =>
          createSummaryError(AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_TIMEOUT),
        agentId: this.agentId as string,
        interactionId,
        eventType: AIAssistantEventType.CTI_EVENT,
        eventName:
          actionType === 'CONSULT'
            ? AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY
            : AIAssistantEventName.GET_MID_CALL_TRANSFER_SUMMARY,
        eventMetaData: {
          conversationId,
          clientType: AI_ASSISTANT_CLIENT_TYPE,
        },
        timeout: AI_SUMMARY_DURATION_MS,
      });

      this.midCallSummaryResponseContext = {conversationId, interactionId};

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_SUCCESS,
        {taskId: this.data?.interactionId, ...metricFields},
        ['operational']
      );

      return result;
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
        {
          taskId: this.data?.interactionId,
          ...metricFields,
          failureCode: Task.getAISummaryFailureCode(error),
        },
        ['operational']
      );
      throw error;
    }
  }

  public async sendMidCallSummaryResponse(
    payload: MidCallSummaryResponsePayload,
    actionType: AISummaryActionType
  ): Promise<void> {
    const metricFields: Record<string, unknown> = {
      operation: METHODS.SEND_MID_CALL_SUMMARY_RESPONSE,
    };

    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_SUCCESS,
        METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_FAILED,
      ]);
      Object.assign(metricFields, {actionType});
      const context = this.midCallSummaryResponseContext ?? {
        conversationId: this.data.interaction?.mainInteractionId || this.data.interactionId,
        interactionId: this.data.interactionId,
      };
      Object.assign(metricFields, {
        conversationId: context.conversationId,
        interactionId: context.interactionId,
      });

      const fallbackTimestamp = Date.now();
      const actionTimeStamp = payload.actionTimeStamp ?? fallbackTimestamp;
      const publishTimestamp = payload.publishTimestamp ?? fallbackTimestamp;
      const eventName =
        actionType === 'CONSULT'
          ? AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE
          : AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE;
      await (this.aiSummaryAdapter as AISummaryAdapter).sendEvent(
        this.agentId as string,
        context.interactionId,
        AIAssistantEventType.CTI_EVENT,
        eventName,
        {
          conversationId: context.conversationId,
          clientType: AI_ASSISTANT_CLIENT_TYPE,
          action: eventName,
          actionTimeStamp,
          summary: payload.summary,
          agentName: this.agentName ?? '',
          numberOfTimesViewed: payload.numberOfTimesViewed,
          numberOfTimesEdited: payload.numberOfTimesEdited,
          numberOfTimesCopied: payload.numberOfTimesCopied,
          feedback: payload.feedback,
          state: payload.state,
        },
        undefined,
        undefined,
        publishTimestamp,
        AI_SUMMARY_DURATION_MS
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_SUCCESS,
        {taskId: this.data?.interactionId, ...metricFields},
        ['operational']
      );
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_FAILED,
        {
          taskId: this.data?.interactionId,
          ...metricFields,
          failureCode: Task.getAISummaryFailureCode(error),
        },
        ['operational']
      );
      throw error;
    }
  }

  private static getAISummaryFailureCode(error: unknown): string {
    const errorCode = (error as {data?: {errorCode?: unknown}})?.data?.errorCode;

    if (typeof errorCode === 'string') {
      return errorCode;
    }

    return AI_SUMMARY_INVALID_RESPONSE_PAYLOAD;
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
   * Initialize the state machine
   */
  private initializeStateMachine(): void {
    const machine: TaskStateMachine = createTaskStateMachine(this.uiControlConfig, {
      actions: this.getStateMachineActionOverrides(),
    });

    this.stateMachineService = createActor(machine);

    this.stateMachineService.subscribe((snapshot) => {
      const previousState = this.lastState;
      const currentState = snapshot.value as TaskState;
      LoggerProxy.log(`State machine transition: ${previousState || 'N/A'} -> ${currentState}`, {
        module: CC_FILE,
        method: 'onTransition',
        // @ts-ignore - snapshot may include event detail depending on XState version
        eventType: (snapshot as any)?.event?.type,
      });
      this.lastState = currentState;
      this.state = snapshot;

      this.updateUiControls(previousState !== currentState);
    });

    this.stateMachineService.start();
    this.updateUiControls(true);
  }

  /**
   * Send an event to the state machine
   */
  public sendStateMachineEvent(event: TaskEventPayload): void {
    if (this.stateMachineService) {
      LoggerProxy.log(`Sending state machine event: ${event?.type}`, {
        module: CC_FILE,
        method: 'sendStateMachineEvent',
        interactionId: this.data?.interactionId,
      });

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
  /**
   * Update wxApp thick-client answer flag at runtime (Voice overrides).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setEnableWxBetterTogether(_enabled: boolean): void {
    // no-op for non-voice tasks
  }

  /**
   * Apply wxApp mute state from external sync (Voice overrides).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public applyWxAppMuteStateFromSync(_incomingCallId: string, _muted: boolean): void {
    // no-op for non-voice tasks
  }

  /**
   * Hook for post-assign wxApp sync (Voice overrides).
   */
  protected onTaskAssigned(): void {
    // no-op by default
  }

  /**
   * Hook for post-hydrate wxApp sync (Voice overrides).
   */
  protected onTaskHydrated(): void {
    // no-op by default
  }

  protected computeUIControls(): TaskUIControls {
    const snapshot = this.stateMachineService?.getSnapshot?.();

    if (!snapshot) {
      return getDefaultUIControls();
    }

    const currentState = snapshot.value as TaskState;
    const context = snapshot.context as TaskContext;
    const mergedContext: TaskContext = {
      ...context,
      uiControlConfig: {...context.uiControlConfig, ...this.uiControlConfig},
    };

    const uiControls = computeUIControls(currentState, mergedContext, this.data);

    return uiControls;
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

  private static extractTaskDataFromEvent(event?: TaskEventPayload): TaskData | undefined {
    if (!event || typeof event !== 'object') {
      return undefined;
    }

    if ('taskData' in event) {
      return (event as {taskData?: TaskData}).taskData;
    }

    return undefined;
  }

  private async autoAnswerIfNeeded(): Promise<void> {
    if (!this.data) {
      return;
    }

    const autoAnswerSupported =
      this.uiControlConfig.channelType === TASK_CHANNEL_TYPE.DIGITAL ||
      this.uiControlConfig.voiceVariant === VOICE_VARIANT.WEBRTC;

    if (!autoAnswerSupported) {
      return;
    }

    const shouldAutoAnswer = this.data.isAutoAnswering === true;

    if (!shouldAutoAnswer) {
      return;
    }

    LoggerProxy.info(`Auto-answering task`, {
      module: TASK_FILE,
      method: 'autoAnswerIfNeeded',
      interactionId: this.data.interactionId,
    });

    try {
      await this.accept();
      LoggerProxy.info(`Task auto-answered successfully`, {
        module: TASK_FILE,
        method: 'autoAnswerIfNeeded',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_AUTO_ANSWER_SUCCESS,
        {
          taskId: this.data.interactionId,
          mediaType: this.data.interaction.mediaType,
          isAutoAnswered: true,
        },
        ['behavioral', 'operational']
      );

      this.emit(TASK_EVENTS.TASK_AUTO_ANSWERED, this);
    } catch (error) {
      this.updateTaskData({...this.data, isAutoAnswering: false});
      LoggerProxy.error(`Failed to auto-answer task`, {
        module: TASK_FILE,
        method: 'autoAnswerIfNeeded',
        interactionId: this.data.interactionId,
        error,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_AUTO_ANSWER_FAILED,
        {
          taskId: this.data.interactionId,
          mediaType: this.data.interaction.mediaType,
          error: error?.message || 'Unknown error',
          isAutoAnswered: false,
        },
        ['behavioral', 'operational']
      );
    }
  }

  private updateTaskFromEvent(event?: TaskEventPayload): void {
    const taskData = Task.extractTaskDataFromEvent(event);
    if (taskData) {
      this.updateTaskData(taskData);
    }
  }

  protected getStateMachineActionOverrides(): Partial<TaskActionsMap> {
    return {
      ...this.getCommonActionOverrides(),
      ...this.getChannelSpecificActionOverrides(),
    };
  }

  protected getChannelSpecificActionOverrides(): Partial<TaskActionsMap> {
    return {};
  }

  protected createEmitSelfAction(
    taskEvent: TASK_EVENTS,
    {updateTaskData = false}: {updateTaskData?: boolean} = {}
  ) {
    return ({event}: TaskActionArgs) => {
      if (updateTaskData) {
        this.updateTaskFromEvent(event);
      }
      LoggerProxy.info(`Emitting task event ${taskEvent}`, {
        module: TASK_FILE,
        method: 'emitTaskEvent',
        interactionId: this.data?.interactionId,
      });
      this.emit(taskEvent, this);
    };
  }

  private getCommonActionOverrides(): Partial<TaskActionsMap> {
    return {
      syncTaskDataFromEvent: ({event}: {event: TaskEventPayload}) => {
        this.updateTaskFromEvent(event);
      },
      emitTaskIncoming: this.createEmitSelfAction(TASK_EVENTS.TASK_INCOMING, {
        updateTaskData: true,
      }),
      emitTaskCampaignPreviewReservation: this.createEmitSelfAction(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
        {updateTaskData: true}
      ),
      emitTaskCampaignPreviewAcceptFailed: this.createEmitSelfAction(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_ACCEPT_FAILED
      ),
      emitTaskCampaignPreviewSkipFailed: this.createEmitSelfAction(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_SKIP_FAILED
      ),
      emitTaskCampaignPreviewRemoveFailed: this.createEmitSelfAction(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_REMOVE_FAILED
      ),
      emitTaskHydrate: ({event}: TaskActionArgs) => {
        this.updateTaskFromEvent(event);
        LoggerProxy.info(`Emitting task event ${TASK_EVENTS.TASK_HYDRATE}`, {
          module: TASK_FILE,
          method: 'emitTaskEvent',
          interactionId: this.data?.interactionId,
        });
        this.emit(TASK_EVENTS.TASK_HYDRATE, this);
        this.onTaskHydrated();
      },
      emitTaskOfferContact: this.createEmitSelfAction(TASK_EVENTS.TASK_OFFER_CONTACT, {
        updateTaskData: true,
      }),
      emitTaskAssigned: ({event}: TaskActionArgs) => {
        this.updateTaskFromEvent(event);
        this.emit(TASK_EVENTS.TASK_ASSIGNED, this);
        this.emit(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, this);
        this.onTaskAssigned();
      },
      emitTaskEnd: this.createEmitSelfAction(TASK_EVENTS.TASK_END, {updateTaskData: true}),
      emitTaskOfferConsult: this.createEmitSelfAction(TASK_EVENTS.TASK_OFFER_CONSULT, {
        updateTaskData: true,
      }),
      emitTaskConsultCreated: this.createEmitSelfAction(TASK_EVENTS.TASK_CONSULT_CREATED, {
        updateTaskData: true,
      }),
      emitTaskConsulting: ({event}: TaskActionArgs) => {
        this.updateTaskFromEvent(event);
        if (this.data.isConsulted) {
          this.emit(TASK_EVENTS.TASK_CONSULT_ACCEPTED, this);
        } else {
          this.emit(TASK_EVENTS.TASK_CONSULTING, this);
        }
        this.emit(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, this);
      },
      emitTaskConsultAccepted: this.createEmitSelfAction(TASK_EVENTS.TASK_CONSULT_ACCEPTED),
      emitTaskConsultEnd: this.createEmitSelfAction(TASK_EVENTS.TASK_CONSULT_END, {
        updateTaskData: true,
      }),
      emitTaskConsultQueueCancelled: this.createEmitSelfAction(
        TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED,
        {
          updateTaskData: true,
        }
      ),
      emitTaskConsultQueueFailed: this.createEmitSelfAction(TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED, {
        updateTaskData: true,
      }),
      emitTaskReject: ({event}: TaskActionArgs) => {
        this.updateTaskFromEvent(event);
        const reason =
          event && typeof event === 'object' && 'reason' in event
            ? (event as {reason?: string}).reason
            : undefined;
        this.emit(TASK_EVENTS.TASK_REJECT, reason);
      },
      emitTaskWrapup: ({event}: {event?: TaskEventPayload}) => {
        this.updateTaskFromEvent(event);

        const shouldEmitWrapup = Boolean(this.data.wrapUpRequired);
        if (!shouldEmitWrapup) {
          LoggerProxy.info(`Skipping task:wrapup event - wrapUpRequired is false`, {
            module: TASK_FILE,
            method: 'emitTaskEvent',
            interactionId: this.data?.interactionId,
          });

          return;
        }
        LoggerProxy.info(`Emitting task event ${TASK_EVENTS.TASK_WRAPUP}`, {
          module: TASK_FILE,
          method: 'emitTaskEvent',
          interactionId: this.data?.interactionId,
        });
        this.emit(TASK_EVENTS.TASK_WRAPUP, this);
      },
      emitTaskWrappedup: this.createEmitSelfAction(TASK_EVENTS.TASK_WRAPPEDUP, {
        updateTaskData: true,
      }),
      requestAutoAnswer: ({event}: TaskActionArgs) => {
        if (event) {
          // parameter intentionally unused
        }
        this.autoAnswerIfNeeded();
      },
      requestCleanup: () => {
        this.emit(TASK_EVENTS.TASK_CLEANUP, this, {removeFromCollection: false});
      },
      cleanupResources: () => {
        this.emit(TASK_EVENTS.TASK_CLEANUP, this, {removeFromCollection: true});
      },
    };
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
  protected unsupportedMethodError(methodName: string): never {
    LoggerProxy.error(`Unsupported operation`, {
      module: 'TASK',
      method: methodName,
      interactionId: this.data?.interactionId,
    });
    throw new Error(`Unsupported operation: ${methodName}`);
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
  public updateTaskData(updatedData: TaskData, shouldOverwrite = false): ITask {
    this.data = shouldOverwrite ? updatedData : this.reconcileData(this.data, updatedData);
    if (!shouldOverwrite) {
      this.pruneStaleInteractionMaps(updatedData);
    }
    this.updateUiControls();
    this.setupAutoWrapupTimer();

    return this;
  }

  /**
   * The backend sends `interaction.media` and `interaction.participants` as complete snapshots
   * of the current call state. `reconcileData` deep-merges and never removes keys, so entries the
   * backend dropped (e.g. a consult leg's media and consultee participant after the consult ends)
   * linger in `this.data`. That stale data drives incorrect UI controls (e.g. the consult button
   * staying disabled after the consult leg is gone, until a page refresh re-hydrates cleanly).
   * Make only these two snapshot maps authoritative to the incoming payload, leaving every other
   * field on the generic deep-merge path (CAD and other partial updates still merge as before).
   */
  private pruneStaleInteractionMaps(incoming: TaskData): void {
    const incomingInteraction = incoming?.interaction;
    const currentInteraction = this.data?.interaction;
    if (!incomingInteraction || !currentInteraction) {
      return;
    }

    (['media', 'participants'] as const).forEach((mapKey) => {
      const incomingMap = incomingInteraction[mapKey] as Record<string, unknown> | undefined;
      const currentMap = currentInteraction[mapKey] as Record<string, unknown> | undefined;
      if (!incomingMap || !currentMap || typeof incomingMap !== 'object') {
        return;
      }

      Object.keys(currentMap).forEach((id) => {
        if (!(id in incomingMap)) {
          delete currentMap[id];
        }
      });
    });
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
      const isQueueTransfer = transferPayload.destinationType === DESTINATION_TYPE.QUEUE;
      const isEntryPointTransfer = transferPayload.destinationType === DESTINATION_TYPE.ENTRYPOINT;

      if (isQueueTransfer || isEntryPointTransfer) {
        result = await this.contact.vteamTransfer({
          interactionId: this.data.interactionId,
          data: {
            ...transferPayload,
            destinationType: isEntryPointTransfer
              ? ENTRY_POINT_TRANSFER_DESTINATION_TYPE
              : DESTINATION_TYPE.QUEUE,
          },
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
    const requestInteractionId =
      this.data.interaction?.mainInteractionId || this.data.interactionId;

    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_END_SUCCESS,
        METRIC_EVENT_NAMES.TASK_END_FAILED,
      ]);
      const response = await this.contact.end({interactionId: requestInteractionId});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_END_SUCCESS,
        {
          taskId: this.data.interactionId,
          requestInteractionId,
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
          requestInteractionId,
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
