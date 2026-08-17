import EventEmitter from 'events';
import {ICall, LINE_EVENTS} from '@webex/calling';
import {WebSocketManager} from '../core/websocket/WebSocketManager';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import {
  MEDIA_CHANNEL,
  TASK_EVENTS,
  TaskData,
  TaskId,
  ITask,
  WebSocketPayload,
  WebSocketMessage,
  TaskEventActions,
  EventContext,
  FeatureEnablementEventPayload,
  GeneratedSummaryFlagsAccessor,
  MidCallSummaryEventPayload,
  MidCallSummaryReceivingAgentPayload,
  MidCallSummarySections,
  PostCallSummaryEventPayload,
  PostCallSummarySections,
} from './types';
import {TASK_MANAGER_FILE} from '../../constants';
import {METHODS, TRANSCRIPT_EVENT_MAP} from './constants';
import {CC_AI_SUMMARY_EVENTS, CC_EVENTS, WrapupData} from '../config/types';
import {ConfigFlags, LoginOption, AIAssistantEventType, AIAssistantEventName} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {
  getIsConferenceInProgress,
  isCampaignPreviewTask,
  isCampaignPreviewReservation,
  isSecondaryEpDnAgent,
  shouldAutoAnswerTask,
  tryGetAISummaryCorrelation,
} from './TaskUtils';
import TaskFactory from './TaskFactory';
import WebRTC from './voice/WebRTC';
import {TaskEvent, type TaskEventPayload} from './state-machine';
import {normalizeTaskData} from './taskDataNormalizer';
import {ApiAIAssistant} from '../ApiAiAssistant';
import AISummaryCoordinator from './AISummaryCoordinator';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import {AGENT_EVENTS} from '../agent/types';
import {isNonEmptyString} from '../AISummaryUtils';

const CC_EVENT_SET = new Set<CC_EVENTS>(Object.values(CC_EVENTS) as CC_EVENTS[]);

const isCcEvent = (value: string): value is CC_EVENTS => CC_EVENT_SET.has(value as CC_EVENTS);

const AI_SUMMARY_EVENT_SET = new Set<string>(Object.values(CC_AI_SUMMARY_EVENTS));
const AI_SUMMARY_INBOUND_TYPE_BY_EVENT = {
  [CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY]: 'POST_CALL_SUMMARY',
  [CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY]: 'MID_CALL_SUMMARY',
} as const;

type AISummaryInboundDropReason =
  | 'unparseable'
  | 'malformed-envelope'
  | 'unknown-event'
  | 'invalid-payload'
  | 'late-or-uncorrelated'
  | 'sdk-deregistered'
  | 'ambiguous-receiver'
  | 'receiver-buffer-expired';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasValidOptionalString = (payload: Record<string, unknown>, key: string): boolean =>
  payload[key] === undefined || typeof payload[key] === 'string';

const hasValidOptionalBoolean = (payload: Record<string, unknown>, key: string): boolean =>
  payload[key] === undefined || typeof payload[key] === 'boolean';

const hasValidOptionalNumber = (payload: Record<string, unknown>, key: string): boolean =>
  payload[key] === undefined || (typeof payload[key] === 'number' && Number.isFinite(payload[key]));

const hasValidOptionalRecord = (payload: Record<string, unknown>, key: string): boolean =>
  payload[key] === undefined || isRecord(payload[key]);

const hasValidOptionalSectionStrings = (
  payload: Record<string, unknown>,
  knownSectionKeys: readonly string[]
): boolean =>
  knownSectionKeys.every((key) => payload[key] === undefined || typeof payload[key] === 'string');

const POST_CALL_SUMMARY_SECTION_KEYS = [
  'initialContactReason',
  'additionalContactReasons',
  'additionalContext',
  'keyActionsTaken',
  'nextSteps',
] as const satisfies readonly (keyof PostCallSummarySections)[];

const MID_CALL_SUMMARY_SECTION_KEYS = [
  'reasonForTransferOrConsult',
  'additionalContext',
  'keyActionsTaken',
] as const satisfies readonly (keyof MidCallSummarySections)[];

const COMMON_INITIATOR_SUMMARY_STRING_FIELDS = [
  'adaptiveCardId',
  'editAdaptiveCardId',
  'languageCode',
  'summaryText',
  'resolution',
] as const;

const hasValidOptionalInitiatorSummaryCommonFields = (
  payload: Record<string, unknown>,
  sectionKeys: readonly string[]
): boolean =>
  COMMON_INITIATOR_SUMMARY_STRING_FIELDS.every((key) => hasValidOptionalString(payload, key)) &&
  hasValidOptionalRecord(payload, 'adaptiveCard') &&
  hasValidOptionalRecord(payload, 'editAdaptiveCard') &&
  hasValidOptionalBoolean(payload, 'areTranscriptsAvailable') &&
  hasValidOptionalNumber(payload, 'timestamp') &&
  (payload.sections === undefined ||
    (isRecord(payload.sections) && hasValidOptionalSectionStrings(payload.sections, sectionKeys)));

const hasValidOptionalSuggestedWrapUpCodes = (payload: Record<string, unknown>): boolean => {
  const suggestedWrapUpCodes = payload.suggestedWrapUpCodes;

  if (suggestedWrapUpCodes === undefined) {
    return true;
  }

  return (
    Array.isArray(suggestedWrapUpCodes) &&
    suggestedWrapUpCodes.every(
      (wrapUpCode) => isRecord(wrapUpCode) && typeof wrapUpCode.name === 'string'
    )
  );
};

/** @internal */
export default class TaskManager extends EventEmitter {
  private call: ICall;
  private contact: ReturnType<typeof routingContact>;
  /**
   * Collection of tasks indexed by TaskId
   * @type {Record<TaskId, ITask>}
   * @private
   */
  private taskCollection: Record<TaskId, ITask>;
  private webCallingService: WebCallingService;
  private webSocketManager: WebSocketManager;
  private rtdWebSocketManager: WebSocketManager;
  // eslint-disable-next-line no-use-before-define
  private static taskManager: TaskManager;
  private configFlags?: ConfigFlags;
  private wrapupData: WrapupData;
  private agentId: string;
  private agentName: string;
  private webRtcEnabled: boolean;
  private apiAIAssistant?: ApiAIAssistant;
  private metricsManager: MetricsManager;
  private aiSummaryCoordinator: AISummaryCoordinator;
  private aiSummaryInboundActive = true;
  private readonly getGeneratedSummaryFlags: GeneratedSummaryFlagsAccessor = () =>
    this.configFlags?.aiFeature?.generatedSummaries;

  /**
   * @param contact - Routing Contact layer. Talks to AQMReq layer to convert events to promises
   * @param webCallingService - Webrtc Service Layer
   * @param webSocketManager - Websocket Manager to maintain websocket connection and keepalives
   */
  constructor(
    apiAIAssistant: ApiAIAssistant,
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    webSocketManager: WebSocketManager,
    rtdWebSocketManager: WebSocketManager
  ) {
    super();
    this.apiAIAssistant = apiAIAssistant;
    this.contact = contact;
    this.webCallingService = webCallingService;
    this.webSocketManager = webSocketManager;
    this.rtdWebSocketManager = rtdWebSocketManager;
    this.taskCollection = {};
    this.webRtcEnabled = false;
    this.metricsManager = MetricsManager.getInstance();
    this.aiSummaryCoordinator = new AISummaryCoordinator(
      (metadata) => {
        this.trackAISummaryInboundDrop(metadata.dropReason, metadata.eventType, {
          conversationId: metadata.conversationId,
        });
      },
      (metadata) => {
        LoggerProxy.error('AI summary receiver listener failed', {
          module: TASK_MANAGER_FILE,
          method: METHODS.HANDLE_AI_SUMMARY_EVENT,
          data: {
            reason: 'consumer-listener-error',
            eventType: metadata.eventType,
            conversationId: metadata.conversationId,
          },
        });
      }
    );

    this.registerTaskListeners();
    this.registerIncomingCallEvent();
  }

  public handleRealtimeWebsocketEvent(event: string) {
    let payload: unknown;

    try {
      payload = JSON.parse(event);
    } catch {
      this.trackAISummaryInboundDrop('unparseable', 'unknown');
      LoggerProxy.error('Failed to parse RTD WebSocket message', {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_REAL_TIME_WEBSOCKET_EVENT,
        data: {reason: 'unparseable'},
      });

      return;
    }

    try {
      this.dispatchRealtimeWebsocketPayload(payload);
    } catch {
      this.logRealtimeDispatchFailure(payload);
    }
  }

  private dispatchRealtimeWebsocketPayload(payload: unknown): void {
    if (this.isAISummaryRealtimeFrame(payload)) {
      this.handleAISummaryEvent(payload);

      return;
    }

    if (this.isPossibleAISummaryRealtimeFrame(payload)) {
      this.trackAISummaryInboundDrop('unknown-event', this.getRealtimeEventType(payload));

      return;
    }

    if (!isRecord(payload)) {
      return;
    }

    const interactionId = this.getRealtimeConversationId(payload);
    if (!interactionId) return;

    const task = this.taskCollection[interactionId];
    if (!task) {
      LoggerProxy.info(`Realtime transcription task not found`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_REAL_TIME_WEBSOCKET_EVENT,
        interactionId,
      });

      return;
    }

    switch (payload.type) {
      case CC_EVENTS.REAL_TIME_TRANSCRIPTION:
      case CC_EVENTS.SUGGESTED_RESPONSE:
        task.emit(payload.type, payload.data);
        break;
      default:
        break;
    }
  }

  private getRealtimeEventType(payload: unknown): string {
    if (isRecord(payload) && isNonEmptyString(payload.type)) {
      return payload.type;
    }

    return 'unknown';
  }

  private getRealtimeConversationId(payload: unknown): string | undefined {
    if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.data)) {
      return undefined;
    }

    return isNonEmptyString(payload.data.data.conversationId)
      ? payload.data.data.conversationId
      : undefined;
  }

  private logRealtimeDispatchFailure(payload: unknown): void {
    const conversationId = this.getRealtimeConversationId(payload);

    LoggerProxy.error('Failed to dispatch RTD WebSocket message', {
      module: TASK_MANAGER_FILE,
      method: METHODS.HANDLE_REAL_TIME_WEBSOCKET_EVENT,
      data: {
        reason: 'dispatch-error',
        eventType: this.getRealtimeEventType(payload),
        ...(conversationId ? {conversationId} : {}),
      },
    });
  }

  private isAISummaryRealtimeFrame(payload: unknown): payload is {
    type: CC_AI_SUMMARY_EVENTS;
    data?: {data?: unknown};
  } {
    return (
      isRecord(payload) &&
      typeof payload.type === 'string' &&
      AI_SUMMARY_EVENT_SET.has(payload.type)
    );
  }

  private isPossibleAISummaryRealtimeFrame(payload: unknown): payload is {type: string} {
    return (
      isRecord(payload) &&
      typeof payload.type === 'string' &&
      (payload.type.includes('SUMMARY') || payload.type.includes('FEATURE_ENABLEMENT'))
    );
  }

  private handleAISummaryEvent(payload: {
    type: CC_AI_SUMMARY_EVENTS;
    data?: {data?: unknown};
  }): void {
    const eventType = payload.type;

    if (!this.aiSummaryInboundActive) {
      this.trackAISummaryInboundDrop('sdk-deregistered', eventType);

      return;
    }

    const innerPayload = payload?.data?.data;

    if (eventType === CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT) {
      this.handleFeatureEnablementEvent(isRecord(innerPayload) ? innerPayload : {});

      return;
    }

    if (!innerPayload || typeof innerPayload !== 'object' || Array.isArray(innerPayload)) {
      this.trackAISummaryInboundDrop('malformed-envelope', eventType);

      return;
    }

    switch (eventType) {
      case CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY:
        this.handlePostCallSummaryEvent(innerPayload as Record<string, unknown>);
        break;

      case CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY:
        this.handleMidCallSummaryEvent(innerPayload as Record<string, unknown>);
        break;

      case CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT:
        this.handleReceivingAgentSummaryEvent(innerPayload as Record<string, unknown>);
        break;

      default:
        this.trackAISummaryInboundDrop('unknown-event', String(eventType));
    }
  }

  private handleFeatureEnablementEvent(payload: Record<string, unknown>): void {
    const validationOutcome = this.validateFeatureEnablementPayload(payload);

    if (validationOutcome !== 'valid') {
      this.trackFeatureEnablementReceived({validationOutcome});

      return;
    }

    const featurePayload = payload as FeatureEnablementEventPayload;
    const matchingTask = Object.values(this.taskCollection).find((task) => {
      const correlation = this.getAISummaryCorrelationForTask(task, 'feature-presence-scan');

      return correlation?.interactionId === featurePayload.interactionId;
    });

    this.trackFeatureEnablementReceived({
      validationOutcome,
      postCallEnabled:
        featurePayload.postCallEnabled === undefined ? 'absent' : featurePayload.postCallEnabled,
      midCallEnabled:
        featurePayload.midCallEnabled === undefined ? 'absent' : featurePayload.midCallEnabled,
    });
    this.aiSummaryCoordinator.setFeatureEnablement(featurePayload, matchingTask !== undefined);
    this.emit(AGENT_EVENTS.FEATURE_ENABLEMENT, featurePayload);

    if (matchingTask) {
      matchingTask.emit(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, featurePayload);
    }
  }

  private validateFeatureEnablementPayload(payload: Record<string, unknown>): 'valid' | 'invalid' {
    const actionTimeStamp = payload.actionTimeStamp;
    const hasInvalidPostCall =
      payload.postCallEnabled !== undefined && typeof payload.postCallEnabled !== 'boolean';
    const hasInvalidMidCall =
      payload.midCallEnabled !== undefined && typeof payload.midCallEnabled !== 'boolean';
    const hasInvalidTimestamp =
      actionTimeStamp !== undefined &&
      (typeof actionTimeStamp !== 'number' ||
        !Number.isFinite(actionTimeStamp) ||
        actionTimeStamp < 0);

    if (
      !isNonEmptyString(payload.interactionId) ||
      hasInvalidPostCall ||
      hasInvalidMidCall ||
      hasInvalidTimestamp
    ) {
      return 'invalid';
    }

    return 'valid';
  }

  private isPostCallSummaryEventPayload(
    payload: Record<string, unknown>
  ): payload is PostCallSummaryEventPayload {
    return (
      isNonEmptyString(payload.conversationId) &&
      hasValidOptionalInitiatorSummaryCommonFields(payload, POST_CALL_SUMMARY_SECTION_KEYS) &&
      hasValidOptionalSuggestedWrapUpCodes(payload) &&
      hasValidOptionalString(payload, 'suggestedWrapUpCodesMessage')
    );
  }

  private isMidCallSummaryEventPayload(
    payload: Record<string, unknown>
  ): payload is MidCallSummaryEventPayload {
    return (
      isNonEmptyString(payload.conversationId) &&
      hasValidOptionalInitiatorSummaryCommonFields(payload, MID_CALL_SUMMARY_SECTION_KEYS)
    );
  }

  private handlePostCallSummaryEvent(payload: Record<string, unknown>): void {
    if (!this.isPostCallSummaryEventPayload(payload)) {
      this.trackAISummaryInboundDrop('invalid-payload', CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY);

      return;
    }

    const result = this.aiSummaryCoordinator.resolvePendingAISummaryRequest(
      payload.conversationId,
      AI_SUMMARY_INBOUND_TYPE_BY_EVENT[CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY],
      payload
    );

    if (result === 'not-found') {
      this.trackAISummaryInboundDrop(
        'late-or-uncorrelated',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {
          conversationId: payload.conversationId,
        }
      );
    }
  }

  private handleMidCallSummaryEvent(payload: Record<string, unknown>): void {
    if (!this.isMidCallSummaryEventPayload(payload)) {
      this.trackAISummaryInboundDrop('invalid-payload', CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY);

      return;
    }

    const result = this.aiSummaryCoordinator.resolvePendingAISummaryRequest(
      payload.conversationId,
      AI_SUMMARY_INBOUND_TYPE_BY_EVENT[CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY],
      payload
    );

    if (result === 'not-found') {
      this.trackAISummaryInboundDrop(
        'late-or-uncorrelated',
        CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        {
          conversationId: payload.conversationId,
        }
      );
    }
  }

  private handleReceivingAgentSummaryEvent(payload: Record<string, unknown>): void {
    if (!isNonEmptyString(payload.conversationId)) {
      this.trackAISummaryInboundDrop(
        'invalid-payload',
        CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT
      );

      return;
    }

    const matchingTasks = this.selectReceivingSummaryTasks(payload.conversationId);
    this.aiSummaryCoordinator.routeReceivingSummary(
      payload as MidCallSummaryReceivingAgentPayload,
      matchingTasks
    );
  }

  private trackFeatureEnablementReceived(payload: Record<string, unknown>): void {
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED,
      payload as never,
      ['operational']
    );
  }

  private trackAISummaryInboundDrop(
    dropReason: AISummaryInboundDropReason,
    eventType: string,
    extra?: {conversationId?: string}
  ): void {
    const metadata = {
      eventType,
      dropReason,
      ...(isNonEmptyString(extra?.conversationId) ? {conversationId: extra.conversationId} : {}),
    };

    LoggerProxy.warn('AI summary inbound event dropped', {
      module: TASK_MANAGER_FILE,
      method: METHODS.HANDLE_AI_SUMMARY_EVENT,
      data: {
        reason: metadata.dropReason,
        eventType: metadata.eventType,
        ...(metadata.conversationId ? {conversationId: metadata.conversationId} : {}),
      },
    });
    this.metricsManager.trackEvent(METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED, metadata, [
      'operational',
    ]);
  }

  /**
   * Set config flags for task creation
   */
  public setConfigFlags(configFlags: ConfigFlags) {
    this.configFlags = configFlags;
    this.aiSummaryInboundActive = true;
  }

  public clearAISummaryState(): void {
    this.aiSummaryInboundActive = false;
    this.aiSummaryCoordinator.clearAISummaryState();
  }

  private configureTaskAISummary(task: ITask): void {
    (
      task as ITask & {
        configureAISummary?: (
          adapter: ApiAIAssistant | undefined,
          coordinator: AISummaryCoordinator,
          getGeneratedSummaryFlags: GeneratedSummaryFlagsAccessor
        ) => void;
      }
    ).configureAISummary?.(
      this.apiAIAssistant,
      this.aiSummaryCoordinator,
      this.getGeneratedSummaryFlags
    );
  }

  private getTaskOwnerId(task: ITask): string {
    return task.data?.taskId ?? task.data?.interactionId ?? '';
  }

  private getAISummaryCorrelationForTask(
    task: ITask,
    scanContext: string
  ): ReturnType<typeof tryGetAISummaryCorrelation> {
    const correlation = tryGetAISummaryCorrelation(task?.data);

    if (!correlation) {
      LoggerProxy.warn('Invalid AI summary task correlation', {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_AI_SUMMARY_EVENT,
        data: {
          reason: 'invalid-task-correlation',
          scanContext,
          taskId: this.getTaskOwnerId(task),
        },
      });
    }

    return correlation;
  }

  private getConversationMatchingTasks(conversationId: string, scanContext: string): ITask[] {
    return Object.values(this.taskCollection).filter((task) => {
      const correlation = this.getAISummaryCorrelationForTask(task, scanContext);

      return correlation?.conversationId === conversationId;
    });
  }

  private selectReceivingSummaryTasks(conversationId: string): ITask[] {
    const matchingTasks = this.getConversationMatchingTasks(
      conversationId,
      'receiver-candidate-scan'
    );

    if (matchingTasks.length <= 1) {
      return matchingTasks;
    }

    const parentInteractionIds = new Set<string>();
    matchingTasks.forEach((task) => {
      const parentInteractionId =
        task.data?.interaction?.callProcessingDetails?.parentInteractionId;

      if (isNonEmptyString(parentInteractionId)) {
        parentInteractionIds.add(parentInteractionId);
      }
    });

    const leafTasks = matchingTasks.filter((task) => {
      const interactionId = task.data?.interactionId;

      return isNonEmptyString(interactionId) && !parentInteractionIds.has(interactionId);
    });

    return leafTasks.length === 1 ? leafTasks : matchingTasks;
  }

  private flushReceivingSummaryForConversation(conversationId: string): void {
    const matchingTasks = this.selectReceivingSummaryTasks(conversationId);

    this.aiSummaryCoordinator.flushReceivingSummary(conversationId, matchingTasks);
  }

  private flushReceivingSummaryForTask(task: ITask): void {
    const correlation = this.getAISummaryCorrelationForTask(task, 'receiving-summary-flush');

    if (correlation) {
      this.flushReceivingSummaryForConversation(correlation.conversationId);
    }
  }

  private retainFeatureEnablementForTask(task: ITask): void {
    const correlation = this.getAISummaryCorrelationForTask(task, 'feature-retention');

    if (correlation) {
      this.aiSummaryCoordinator.retainFeatureEnablementForTask(correlation.interactionId);
    }
  }

  private deliverFeatureEnablementToTask(task: ITask): void {
    const correlation = this.getAISummaryCorrelationForTask(task, 'feature-delivery');

    if (correlation) {
      const featurePayload = this.aiSummaryCoordinator.getFeatureEnablement(
        correlation.interactionId
      );

      if (featurePayload) {
        task.emit(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, featurePayload);
      }
    }
  }

  private clearFeatureEnablementIfFinalTask(interactionId: string): void {
    const hasRegisteredTask = Object.values(this.taskCollection).some((task) => {
      const correlation = this.getAISummaryCorrelationForTask(task, 'feature-final-task-cleanup');

      return correlation?.interactionId === interactionId;
    });

    if (!hasRegisteredTask) {
      this.aiSummaryCoordinator.clearFeatureEnablement(interactionId);
    }
  }

  /**
   * Set wrapup configuration data
   */
  public setWrapupData(wrapupData: WrapupData) {
    this.wrapupData = wrapupData;
  }

  /**
   * Set agent ID for task operations
   */
  public setAgentId(agentId: string) {
    this.agentId = agentId;
  }

  public setAgentName(agentName: string) {
    this.agentName = agentName;
  }

  /**
   * Gets the current agent ID
   * @returns {string} The agent ID set for this task manager instance
   * @public
   */
  public getAgentId(): string {
    return this.agentId;
  }

  public setWebRtcEnabled(webRtcEnabled: boolean) {
    this.webRtcEnabled = webRtcEnabled;
  }

  private handleIncomingWebCall = (call: ICall) => {
    const currentTask = Object.values(this.taskCollection).find(
      (task) =>
        task.data.interaction.mediaType === 'telephony' && !isCampaignPreviewReservation(task)
    );

    if (currentTask) {
      this.webCallingService.mapCallToTask(call.getCallId(), currentTask.data.interactionId);
      LoggerProxy.log(`Call mapped to task`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_INCOMING_WEB_CALL,
        interactionId: currentTask.data.interactionId,
      });

      // Send TASK_INCOMING to state machine - it will emit on the task object
      const eventPayload = TaskManager.mapEventToTaskStateMachineEvent(
        CC_EVENTS.AGENT_CONTACT_RESERVED,
        currentTask.data
      );
      if (eventPayload && currentTask) {
        currentTask.sendStateMachineEvent(eventPayload);
      }
    }
    this.call = call;
  };

  public registerIncomingCallEvent() {
    this.webCallingService.on(LINE_EVENTS.INCOMING_CALL, this.handleIncomingWebCall);
  }

  public unregisterIncomingCallEvent() {
    this.webCallingService.off(LINE_EVENTS.INCOMING_CALL, this.handleIncomingWebCall);
  }

  /**
   * Map WebSocket CC_EVENTS to state machine TaskEvent
   * @param ccEvent - The CC_EVENT type from WebSocket
   * @param payload - The event payload
   * @param agentId - Optional agent ID for state detection (needed for HYDRATE)
   * @returns TaskEventPayload for state machine or null if no mapping
   */
  private static mapEventToTaskStateMachineEvent(
    ccEvent: CC_EVENTS,
    payload: WebSocketPayload,
    agentId?: string
  ): TaskEventPayload | null {
    const mediaResourceId =
      payload.mediaResourceId ||
      payload.interaction?.media?.[payload.interactionId]?.mediaResourceId;

    switch (ccEvent) {
      // CC -> TaskEvent mappings (see TaskStateMachine comment for quick reference)
      case CC_EVENTS.AGENT_CONTACT_RESERVED: // AgentContactReserved -> TASK_INCOMING
        if (isCampaignPreviewTask(payload)) {
          return {
            type: TaskEvent.TASK_INCOMING,
            taskData: payload,
            isCampaignReservationAccept: true,
          };
        }

        return {type: TaskEvent.TASK_INCOMING, taskData: payload};

      case CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION: // -> TASK_INCOMING (campaign branch via guard)
        return {
          type: TaskEvent.TASK_INCOMING,
          taskData: payload,
          isCampaignReservationAccept: true,
        };

      case CC_EVENTS.AGENT_OFFER_CONTACT: // AgentOfferContact -> TASK_OFFERED
        return {type: TaskEvent.TASK_OFFERED, taskData: payload};

      case CC_EVENTS.AGENT_CONTACT: // AgentContact -> HYDRATE
        // Include agentId for state detection (e.g., checking isWrapUp in participant data)
        return {type: TaskEvent.HYDRATE, taskData: payload, agentId};

      case CC_EVENTS.CONTACT_UPDATED:
        return {type: TaskEvent.CONTACT_UPDATED, taskData: payload};
      case CC_EVENTS.CONTACT_OWNER_CHANGED:
        return {type: TaskEvent.CONTACT_OWNER_CHANGED, taskData: payload};

      case CC_EVENTS.AGENT_OFFER_CONSULT: // AgentOfferConsult -> OFFER_CONSULT
        return {
          type: TaskEvent.OFFER_CONSULT,
          taskData: {...payload, isConsulted: true},
        };

      case CC_EVENTS.AGENT_CONTACT_ASSIGNED: // AgentContactAssigned -> ASSIGN
        return {type: TaskEvent.ASSIGN, taskData: payload};

      case CC_EVENTS.AGENT_CONTACT_HELD:
        return {
          type: TaskEvent.HOLD_SUCCESS,
          mediaResourceId: mediaResourceId || '',
          taskData: payload,
        };

      case CC_EVENTS.AGENT_CONTACT_UNHELD:
        return {
          type: TaskEvent.UNHOLD_SUCCESS,
          mediaResourceId: mediaResourceId || '',
          taskData: payload,
        };

      case CC_EVENTS.AGENT_CONSULT_CREATED:
        return {
          type: TaskEvent.CONSULT_CREATED,
          taskData: {...payload, isConsulted: false},
        };

      case CC_EVENTS.AGENT_CONSULTING: // AgentConsulting -> CONSULTING_ACTIVE
        // use context to figure out if it's the initiator or receiver using consultInitiator from context
        return {
          type: TaskEvent.CONSULTING_ACTIVE,
          consultDestinationAgentJoined: true,
          taskData: payload,
        };

      case CC_EVENTS.AGENT_CONSULT_ENDED: // AgentConsultEnded -> CONSULT_END
        return {type: TaskEvent.CONSULT_END, taskData: payload};

      case CC_EVENTS.AGENT_CONSULT_FAILED:
      case CC_EVENTS.AGENT_CTQ_FAILED:
        return {type: TaskEvent.CONSULT_FAILED, reason: payload.reason, taskData: payload};

      case CC_EVENTS.AGENT_CTQ_CANCELLED:
        return {type: TaskEvent.CTQ_CANCEL, taskData: payload};

      case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
        return {type: TaskEvent.CTQ_CANCEL_FAILED, taskData: payload};

      case CC_EVENTS.AGENT_BLIND_TRANSFERRED: // AgentBlindTransferred -> TRANSFER_SUCCESS
      case CC_EVENTS.AGENT_CONSULT_TRANSFERRED: // AgentConsultTransferred -> TRANSFER_SUCCESS
      case CC_EVENTS.AGENT_VTEAM_TRANSFERRED: // AgentVTeamTransferred -> TRANSFER_SUCCESS
        return {
          type: TaskEvent.TRANSFER_SUCCESS,
          taskData: payload,
        };

      case CC_EVENTS.AGENT_WRAPUP:
        return {type: TaskEvent.TASK_WRAPUP, taskData: {...payload, wrapUpRequired: true}};
      case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
        return null; // Add WRAPUP if needed

      case CC_EVENTS.AGENT_BLIND_TRANSFER_FAILED:
      case CC_EVENTS.AGENT_VTEAM_TRANSFER_FAILED:
      case CC_EVENTS.AGENT_CONSULT_TRANSFER_FAILED:
      case CC_EVENTS.AGENT_CONFERENCE_TRANSFER_FAILED:
        return {type: TaskEvent.TRANSFER_FAILED, taskData: payload};

      case CC_EVENTS.CONTACT_ENDED:
        return {
          type: TaskEvent.CONTACT_ENDED,
          taskData: {
            ...payload,
            wrapUpRequired: isCampaignPreviewTask(payload)
              ? false
              : payload.agentsPendingWrapUp?.includes(agentId || '') || false,
          },
        };

      case CC_EVENTS.AGENT_INVITE_FAILED:
        return {type: TaskEvent.INVITE_FAILED, reason: payload.reason};

      case CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED:
        return {type: TaskEvent.ASSIGN_FAILED, reason: payload.reason};

      case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
        return {type: TaskEvent.RONA, taskData: payload, reason: payload.reason};

      case CC_EVENTS.AGENT_OUTBOUND_FAILED:
        return {type: TaskEvent.OUTBOUND_FAILED, taskData: payload, reason: payload.reason};

      case CC_EVENTS.CAMPAIGN_PREVIEW_ACCEPT_FAILED:
        return {type: TaskEvent.CAMPAIGN_PREVIEW_ACCEPT_FAILED, taskData: payload};

      case CC_EVENTS.CAMPAIGN_PREVIEW_SKIP_FAILED:
        return {type: TaskEvent.CAMPAIGN_PREVIEW_SKIP_FAILED, taskData: payload};

      case CC_EVENTS.CAMPAIGN_PREVIEW_REMOVE_FAILED:
        return {type: TaskEvent.CAMPAIGN_PREVIEW_REMOVE_FAILED, taskData: payload};

      case CC_EVENTS.CONTACT_RECORDING_STARTED:
        return {type: TaskEvent.RECORDING_STARTED, taskData: payload};

      case CC_EVENTS.CONTACT_RECORDING_PAUSED:
        return {type: TaskEvent.PAUSE_RECORDING, taskData: payload};

      case CC_EVENTS.CONTACT_RECORDING_RESUMED:
        return {type: TaskEvent.RESUME_RECORDING, taskData: payload};

      case CC_EVENTS.AGENT_WRAPPEDUP:
        return {type: TaskEvent.WRAPUP_COMPLETE, taskData: payload};

      // Conference events - these trigger state machine transition to CONFERENCING
      case CC_EVENTS.AGENT_CONSULT_CONFERENCED:
      case CC_EVENTS.AGENT_CONSULT_CONFERENCING:
      case CC_EVENTS.PARTICIPANT_JOINED_CONFERENCE:
        return {type: TaskEvent.CONFERENCE_START, taskData: payload};

      case CC_EVENTS.AGENT_CONSULT_CONFERENCE_FAILED:
        return {type: TaskEvent.CONFERENCE_FAILED, reason: payload.reason, taskData: payload};

      case CC_EVENTS.AGENT_CONSULT_CONFERENCE_ENDED:
        return {type: TaskEvent.CONFERENCE_END, taskData: payload};

      case CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE:
        return {
          type: TaskEvent.PARTICIPANT_LEAVE,
          taskData: payload,
          participantId: payload?.participantId,
        };

      case CC_EVENTS.AGENT_CONFERENCE_TRANSFERRED:
        return {type: TaskEvent.TRANSFER_CONFERENCE_SUCCESS, taskData: payload};

      default:
        // Not all events need state machine mapping
        return null;
    }
  }

  /**
   * Register WebSocket message listeners for task events
   *
   * Main entry point that orchestrates event processing through a clear pipeline:
   * 1. Parse and validate incoming WebSocket messages
   * 2. Prepare event context with task and state machine mappings
   * 3. Handle task lifecycle (creation, updates, collection management)
   * 4. Send events to state machine (task-level transitions/emissions)
   * 5. Cleanup is triggered via task events emitted by the state machine
   *
   * This architecture separates concerns:
   * - TaskManager: Manages task collection lifecycle and operational concerns
   * - State Machine: Manages individual task state and event emissions
   */
  private registerTaskListeners() {
    this.webSocketManager.on('message', (event) => {
      // Step 1: Parse and validate the message
      const message = TaskManager.parseWebSocketMessage(event);
      if (!message) return;

      // Step 2: Prepare event context
      const eventContext = this.prepareEventContext(message);
      if (!eventContext) return;

      const actions = this.handleTaskLifecycleEvent(eventContext);

      const {task} = actions;
      if (!task) return;

      const {payload, stateMachineEvent} = eventContext;

      // Always keep task.data updated (even for mapped events) so consumers relying
      // on TaskManager-managed task instances see the latest payload.
      if (payload) {
        this.updateTaskData(task, payload);
      }

      // Send event to state machine - this will trigger all TASK_EVENTS emissions
      // including TASK_INCOMING which is now handled via the state machine callbacks
      if (stateMachineEvent) {
        task.sendStateMachineEvent(stateMachineEvent);
      }

      this.flushReceivingSummaryForTask(task);

      // Emit TASK_POST_CALL_ACTIVITY for ParticipantPostCallActivity events so
      // consumers (Widgets) can detect the interaction state change to post_call.
      if (eventContext.eventType === CC_EVENTS.PARTICIPANT_POST_CALL_ACTIVITY) {
        task.emit(TASK_EVENTS.TASK_POST_CALL_ACTIVITY, task);
      }

      // Send transcript start/stop events for relevant CC events
      this.requestRealTimeTranscripts(eventContext.eventType, payload.interactionId);
    });
  }

  /**
   * Parse and validate WebSocket message
   * @returns Parsed message or null if invalid/keepalive
   */
  private static parseWebSocketMessage(event: string): WebSocketMessage | null {
    try {
      const payload = JSON.parse(event) as WebSocketMessage;

      // Filter out keepalive messages
      if (payload?.keepalive === 'true' || payload?.keepalive === true) {
        return null;
      }

      // Normalize task data if present
      if (payload?.data?.interaction) {
        payload.data = normalizeTaskData(payload.data);
      }

      return payload;
    } catch (error) {
      LoggerProxy.error('Failed to parse WebSocket message', {
        module: TASK_MANAGER_FILE,
        method: 'parseWebSocketMessage',
        error,
      });

      return null;
    }
  }

  /**
   * Prepare context for event processing
   * @returns Event context or null if event type is invalid
   */
  private prepareEventContext(message: WebSocketMessage): EventContext | null {
    const eventType = message.data?.type || message.type;

    if (!eventType || !isCcEvent(eventType)) {
      return null;
    }

    const interactionId = message.data.interactionId;
    const reservationInteractionId = message.data.reservationInteractionId;
    let task = this.taskCollection[interactionId];

    // When a campaign preview contact is accepted, the assigned event may arrive
    // with a new interactionId while the task is stored under the original
    // reservationInteractionId. Fall back to that key so the task is found.
    if (!task && reservationInteractionId) {
      task = this.taskCollection[reservationInteractionId];
      if (task) {
        // Re-key the task under the new interaction ID and remove the old entry
        delete this.taskCollection[reservationInteractionId];
        this.taskCollection[interactionId] = task;
        this.aiSummaryCoordinator.clearFeatureEnablement(reservationInteractionId);
      }
    }

    const wasConsultedTask = Boolean(task?.data?.isConsulted);
    const computeWrapUpRequired = () => {
      if (message.data.wrapUpRequired !== undefined) {
        return message.data.wrapUpRequired;
      }
      if (message.data.isConsulted !== undefined) {
        return !message.data.isConsulted;
      }

      return !wasConsultedTask;
    };

    const adjustedPayload =
      eventType === CC_EVENTS.AGENT_CONSULT_TRANSFERRED ||
      eventType === CC_EVENTS.AGENT_BLIND_TRANSFERRED ||
      eventType === CC_EVENTS.AGENT_VTEAM_TRANSFERRED
        ? {
            ...message.data,
            wrapUpRequired: computeWrapUpRequired(),
          }
        : message.data;

    const stateMachineEvent = TaskManager.mapEventToTaskStateMachineEvent(
      eventType,
      adjustedPayload,
      this.agentId
    );

    LoggerProxy.info(`Handling task event ${eventType}`, {
      module: TASK_MANAGER_FILE,
      method: 'prepareEventContext',
      interactionId,
    });

    return {
      eventType,
      payload: adjustedPayload,
      task,
      stateMachineEvent,
    };
  }

  /**
   * Handle task lifecycle events and determine required actions
   *
   * Delegates to specific event handlers based on event type. Each handler
   * is responsible for TaskManager-level concerns:
   * - Task creation and collection management
   * - Metrics tracking
   * - Resource cleanup decisions
   *
   * Note: Task-level state transitions and event emissions are handled by
   * the task state machine via sendStateMachineEvent()
   */
  private handleTaskLifecycleEvent(context: EventContext): TaskEventActions {
    const {eventType} = context;

    switch (eventType) {
      case CC_EVENTS.AGENT_CONTACT_RESERVED:
        return this.handleContactReserved(context);

      case CC_EVENTS.AGENT_CONTACT:
        return this.handleAgentContact(context);

      case CC_EVENTS.CONTACT_MERGED:
        return this.handleContactMergedEvent(context);

      case CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION:
        return this.handleCampaignPreviewReservation(context);

      case CC_EVENTS.CAMPAIGN_CONTACT_UPDATED:
        return this.handleCampaignContactUpdated(context);

      default:
        return {task: context.task};
    }
  }

  private handleCampaignContactUpdated(context: EventContext) {
    const {payload} = context;
    let {task} = context;
    // CampaignContactUpdated is a non-terminal event (e.g., next contact after skip/remove).
    // Update the task data and emit an event so consumers can react to the updated contact.
    // Do NOT remove the task or emit TASK_END — cleanup is handled by CONTACT_ENDED.
    if (task) {
      // Carry forward campaign preview fields from existing task data since the updated
      // contact payload may not include them, and reconcileData would delete them.
      const existingCpd = task.data?.interaction?.callProcessingDetails;
      const updatedData: TaskData = {...payload};

      if (existingCpd) {
        const campaignFields = {
          ...(existingCpd.campaignPreviewAutoAction && {
            campaignPreviewAutoAction: existingCpd.campaignPreviewAutoAction,
          }),
          ...(existingCpd.campaignPreviewOfferTimeout && {
            campaignPreviewOfferTimeout: existingCpd.campaignPreviewOfferTimeout,
          }),
          ...(existingCpd.campaignPreviewSkipDisabled && {
            campaignPreviewSkipDisabled: existingCpd.campaignPreviewSkipDisabled,
          }),
          ...(existingCpd.campaignPreviewRemoveDisabled && {
            campaignPreviewRemoveDisabled: existingCpd.campaignPreviewRemoveDisabled,
          }),
        };

        if (!updatedData.interaction) {
          updatedData.interaction = {} as typeof updatedData.interaction;
        }

        updatedData.interaction = {
          ...updatedData.interaction,
          callProcessingDetails: {
            ...campaignFields,
            ...(updatedData.interaction.callProcessingDetails || {}),
          } as typeof existingCpd,
        };
      }

      LoggerProxy.log('Campaign contact updated - carrying forward preview fields', {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: payload.interactionId,
        data: {
          hasCpd: !!updatedData.interaction?.callProcessingDetails,
          autoAction: updatedData.interaction?.callProcessingDetails?.campaignPreviewAutoAction,
          skipDisabled: updatedData.interaction?.callProcessingDetails?.campaignPreviewSkipDisabled,
          removeDisabled:
            updatedData.interaction?.callProcessingDetails?.campaignPreviewRemoveDisabled,
        },
      });

      task = this.updateTaskData(task, updatedData);
      task.emit(TASK_EVENTS.TASK_CAMPAIGN_CONTACT_UPDATED, task);
    }

    return {task};
  }

  /**
   * Creates or updates a task for campaign preview reservation.
   * TASK_CAMPAIGN_PREVIEW_RESERVATION is emitted by the state machine (campaign TASK_INCOMING branch).
   */
  private handleCampaignPreviewReservation(context: EventContext): TaskEventActions {
    const {payload} = context;
    let {task} = context;

    LoggerProxy.log('Campaign preview reservation received', {
      module: TASK_MANAGER_FILE,
      method: METHODS.REGISTER_TASK_LISTENERS,
      interactionId: payload.interactionId,
    });

    if (!task) {
      task = TaskFactory.createTask(
        this.contact,
        this.webCallingService,
        {
          ...payload,
          wrapUpRequired: false,
          isConferenceInProgress: false,
          isAutoAnswering: false,
        },
        this.configFlags,
        this.wrapupData,
        this.agentId,
        this.agentName
      );
      this.configureTaskAISummary(task);
      this.setupTaskListeners(task);
      this.taskCollection[payload.interactionId] = task;
      this.retainFeatureEnablementForTask(task);
      this.deliverFeatureEnablementToTask(task);
    } else {
      task = this.updateTaskData(task, payload);
    }

    return {task};
  }

  /**
   * Handle AGENT_CONTACT_RESERVED event
   * Creates a new task; state machine event is sent during processing
   */
  private handleContactReserved(context: EventContext): TaskEventActions {
    const {payload} = context;
    const isConsultedTask =
      payload.isConsulted === true || isSecondaryEpDnAgent(payload.interaction);
    const shouldAutoAnswer = shouldAutoAnswerTask(
      payload,
      this.agentId,
      this.webCallingService.loginOption,
      this.webRtcEnabled
    );

    const taskData: TaskData = {
      ...payload,
      isConsulted: isConsultedTask,
      isAutoAnswering: shouldAutoAnswer,
    };

    const task = TaskFactory.createTask(
      this.contact,
      this.webCallingService,
      taskData,
      this.configFlags,
      this.wrapupData,
      this.agentId
    );

    this.configureTaskAISummary(task);
    this.setupTaskListeners(task);
    this.taskCollection[payload.interactionId] = task;
    this.retainFeatureEnablementForTask(task);
    this.deliverFeatureEnablementToTask(task);

    return {task};
  }

  /**
   * Handle AGENT_CONTACT event
   * Re-creates task if missing (multi-session scenario)
   */
  private handleAgentContact(context: EventContext): TaskEventActions {
    let {task} = context;
    const {payload} = context;

    if (!task) {
      const isConsultedTask =
        payload.isConsulted === true || isSecondaryEpDnAgent(payload.interaction);
      const shouldAutoAnswer = shouldAutoAnswerTask(
        payload,
        this.agentId,
        this.webCallingService.loginOption,
        this.webRtcEnabled
      );
      const taskData: TaskData = {
        ...payload,
        isConsulted: isConsultedTask,
        wrapUpRequired: payload.interaction?.participants?.[this.agentId]?.isWrapUp || false,
        isConferenceInProgress: getIsConferenceInProgress(payload),
        isAutoAnswering: shouldAutoAnswer,
      };

      task = TaskFactory.createTask(
        this.contact,
        this.webCallingService,
        taskData,
        this.configFlags,
        this.wrapupData,
        this.agentId,
        this.agentName
      );
      this.configureTaskAISummary(task);
      this.setupTaskListeners(task);
      this.taskCollection[payload.interactionId] = task;
      this.retainFeatureEnablementForTask(task);
      this.deliverFeatureEnablementToTask(task);
    }

    return {task};
  }

  private updateTaskData(task: ITask, taskData: TaskData): ITask {
    if (!task) {
      throw new Error('Task not found for update');
    }

    const snapshot = task.stateMachineService?.getSnapshot?.();
    const isConsultingFlow =
      snapshot?.value === 'CONSULTING' || taskData.interaction?.state === 'consulting';

    const updateTaskData = isConsultingFlow
      ? {
          ...taskData,
          destAgentId: taskData.destAgentId ?? snapshot?.context?.consultDestinationAgentId ?? null,
          destinationType:
            taskData.destinationType ?? snapshot?.context?.consultDestinationType ?? null,
        }
      : taskData;

    task.updateTaskData(updateTaskData);
    this.taskCollection[taskData.interactionId] = task;
    this.retainFeatureEnablementForTask(task);

    return task;
  }

  /**
   * Setup listeners for task events that need to be bubbled up to TaskManager
   * This replaces the previous callback injection pattern
   */
  private setupTaskListeners(task: ITask): void {
    // Listen for TASK_INCOMING and re-emit so webex.cc can notify consumers
    task.on(TASK_EVENTS.TASK_INCOMING, (t: ITask) => {
      LoggerProxy.log(`Task incoming event received`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: t.data?.interactionId,
      });

      this.emit(TASK_EVENTS.TASK_INCOMING, t);
    });

    task.on(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION, (t: ITask) => {
      LoggerProxy.log(`Campaign preview reservation event received`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: t.data?.interactionId,
      });

      this.emit(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION, t);
    });

    // Listen for TASK_HYDRATE on the task and re-emit on TaskManager
    task.on(TASK_EVENTS.TASK_HYDRATE, (t: ITask) => {
      // Task data is already updated by the task itself before emitting
      this.emit(TASK_EVENTS.TASK_HYDRATE, t);
    });

    task.on(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, (t: ITask) => {
      this.emit(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, t);
    });

    // Listen for internal cleanup signal emitted by the state machine
    task.on(TASK_EVENTS.TASK_CLEANUP, (t: ITask, options?: {removeFromCollection?: boolean}) => {
      this.handleTaskCleanup(t);
      if (options?.removeFromCollection) {
        const interactionId = t?.data?.interactionId;
        if (interactionId && this.taskCollection[interactionId]) {
          this.removeTaskFromCollection(t);
        }
      }
    });
  }

  private removeTaskFromCollection(task: ITask) {
    const correlation = this.getAISummaryCorrelationForTask(task, 'task-removal');
    const ownerId = this.getTaskOwnerId(task);

    if (typeof task.cancelAutoWrapupTimer === 'function') {
      task.cancelAutoWrapupTimer();
    }
    if (task?.data?.interactionId) {
      delete this.taskCollection[task.data.interactionId];
      LoggerProxy.info(`Task removed from collection`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REMOVE_TASK_FROM_COLLECTION,
        interactionId: task.data.interactionId,
      });
    }

    if (correlation) {
      this.aiSummaryCoordinator.clearTaskAISummaryState(ownerId, correlation.conversationId);
      this.flushReceivingSummaryForConversation(correlation.conversationId);
      this.clearFeatureEnablementIfFinalTask(correlation.interactionId);
    }
  }

  /**
   * Handles CONTACT_MERGED event logic
   * @param task - The task to process
   * @param taskData - The task data from the event payload
   * @returns Updated or newly created task
   * @private
   */
  private handleContactMergedEvent(context: EventContext): TaskEventActions {
    const {payload} = context;
    let task = context.task;

    if (payload.childInteractionId && this.taskCollection[payload.childInteractionId]) {
      this.removeTaskFromCollection(this.taskCollection[payload.childInteractionId]);
    }

    if (task) {
      LoggerProxy.log(`Got CONTACT_MERGED: Task already exists in collection`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: payload.interactionId,
      });
      // update the task data
      this.updateTaskData(task, payload);
    } else {
      // Case2 : Task is not present in taskCollection
      LoggerProxy.log(`Got CONTACT_MERGED : Creating new task in taskManager`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: payload.interactionId,
      });

      const taskData: TaskData = {
        ...payload,
        wrapUpRequired: payload.interaction?.participants?.[this.agentId]?.isWrapUp || false,
        isConferenceInProgress: getIsConferenceInProgress(payload),
        isConsulted: false,
      };

      task = TaskFactory.createTask(
        this.contact,
        this.webCallingService,
        taskData,
        this.configFlags,
        this.wrapupData,
        this.agentId,
        this.agentName
      );
      this.configureTaskAISummary(task);
      this.taskCollection[payload.interactionId] = task;

      // Transition the new task out of IDLE immediately so UI controls are
      // computed before TASK_MERGED is emitted. This handles the race where
      // AgentContactAssigned arrives before ContactMerged and gets dropped.
      // Send HYDRATE before setupTaskListeners so the emitTaskHydrate action
      // doesn't bubble up to the Widget (avoids duplicate listener registration).
      task.sendStateMachineEvent({
        type: TaskEvent.HYDRATE,
        taskData,
        agentId: this.agentId,
      } as TaskEventPayload);

      this.setupTaskListeners(task);
      this.retainFeatureEnablementForTask(task);
      this.deliverFeatureEnablementToTask(task);
    }

    if (task) {
      this.emit(TASK_EVENTS.TASK_MERGED, task);
      this.flushReceivingSummaryForTask(task);
    }

    return {task};
  }

  /**
   * Handles cleanup of task resources including Desktop/WebRTC call cleanup and task removal
   * @param task - The task to clean up
   * @private
   */
  private handleTaskCleanup(task: ITask) {
    // Clean up Desktop/WebRTC calling resources for browser-based telephony tasks
    if (
      this.webCallingService.loginOption === LoginOption.BROWSER &&
      task.data.interaction.mediaType === MEDIA_CHANNEL.TELEPHONY &&
      task instanceof WebRTC
    ) {
      task.unregisterWebCallListeners();
      this.webCallingService.cleanUpCall();
    }

    const isOutdial = task.data.interaction.outboundType === 'OUTDIAL';
    const isNew = task.data.interaction.state === 'new';
    const needsWrapUp = task.data.agentsPendingWrapUp?.includes(this.agentId) ?? false;

    // For OUTDIAL: only remove if NOT terminated (user-declined, no wrap-up follows)
    // For non-OUTDIAL: remove if state is 'new'
    // Always remove if secondary EpDn agent
    if (
      (isNew && !(isOutdial && needsWrapUp)) ||
      isSecondaryEpDnAgent(task.data.interaction) ||
      (!needsWrapUp && isOutdial) // For outdial tasks, needs wrap-up is false and state is "WRAPUP". We need to just remove the task.
    ) {
      this.removeTaskFromCollection(task);
    }
  }

  /**
   * Sends transcript start/stop event based on the CC event type.
   * Fire-and-forget; errors are logged but do not interrupt event processing.
   */
  private requestRealTimeTranscripts(eventType: string, interactionId: string): void {
    const action = TRANSCRIPT_EVENT_MAP[eventType];
    if (!action || !this.apiAIAssistant) return;
    if (this.configFlags?.aiFeature?.realtimeTranscripts?.enable !== true) return;

    this.apiAIAssistant
      .sendEvent(
        this.agentId,
        interactionId,
        AIAssistantEventType.CUSTOM_EVENT,
        AIAssistantEventName.GET_TRANSCRIPTS,
        {action}
      )
      .catch((error) => {
        LoggerProxy.error(`Failed to send transcript ${action} event`, {
          module: TASK_MANAGER_FILE,
          method: METHODS.REQUEST_REAL_TIME_TRANSCRIPTS,
          interactionId,
          error,
        });
      });
  }

  public getTask(taskId: TaskId): ITask {
    return this.taskCollection[taskId];
  }

  public getAllTasks(): Record<TaskId, ITask> {
    return {...this.taskCollection};
  }

  public static getTaskManager(
    apiAIAssistant: ApiAIAssistant,
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    webSocketManager: WebSocketManager,
    rtdWebSocketManager?: WebSocketManager
  ): TaskManager {
    if (!TaskManager.taskManager) {
      TaskManager.taskManager = new TaskManager(
        apiAIAssistant,
        contact,
        webCallingService,
        webSocketManager,
        rtdWebSocketManager
      );
    }

    return TaskManager.taskManager;
  }
}
