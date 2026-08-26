import {AI_SUMMARY_ERROR_CODES} from '../../constants';
import {CC_AI_SUMMARY_EVENTS} from '../config/types';
import {AI_SUMMARY_DURATION_MS, AI_SUMMARY_REQUEST_CANCELLED} from './constants';
import {
  AISummaryInboundType,
  AISummaryPayloadByInboundType,
  AISummaryPendingRegistration,
  AISummaryReceiverDropReason,
  AISummaryRequestCoordinator,
  AISummaryTimeoutCodeByInboundType,
  FeatureEnablementEventPayload,
  ITask,
  MidCallSummaryReceivingAgentPayload,
  TASK_EVENTS,
} from './types';
import {createAISummaryError} from '../AISummaryUtils';

type PendingAISummaryRequest<T extends AISummaryInboundType> = {
  requestToken: symbol;
  taskId: string;
  conversationId: string;
  eventType: T;
  timeoutId?: ReturnType<typeof setTimeout>;
  resolve: (payload: AISummaryPayloadByInboundType[T]) => void;
  reject: (error: Error) => void;
};

type PendingAISummaryRequestMaps = {
  [T in AISummaryInboundType]: Map<string, PendingAISummaryRequest<T>>;
};

type BufferedReceivingSummary = {
  payload: MidCallSummaryReceivingAgentPayload;
  timeoutId?: ReturnType<typeof setTimeout>;
};

type InteractionFeatureEnablementEntry = {
  payload: FeatureEnablementEventPayload;
  timeoutId?: ReturnType<typeof setTimeout>;
};

type ReceiverDropCallback = (metadata: {
  eventType: typeof CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT;
  dropReason: AISummaryReceiverDropReason;
  conversationId: string;
}) => void;

type ReceiverDeliveryFailureCallback = (metadata: {
  eventType: typeof CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT;
  conversationId: string;
}) => void;

export default class AISummaryCoordinator implements AISummaryRequestCoordinator {
  private pendingAISummaryRequests: PendingAISummaryRequestMaps = {
    POST_CALL_SUMMARY: new Map(),
    MID_CALL_SUMMARY: new Map(),
  };

  private receivingSummaryBuffer = new Map<string, BufferedReceivingSummary>();
  private interactionFeatureEnablement = new Map<string, InteractionFeatureEnablementEntry>();
  private onReceiverDrop: ReceiverDropCallback;
  private onReceiverDeliveryFailure: ReceiverDeliveryFailureCallback;

  public constructor(
    onReceiverDrop: ReceiverDropCallback = () => undefined,
    onReceiverDeliveryFailure: ReceiverDeliveryFailureCallback = () => undefined
  ) {
    this.onReceiverDrop = onReceiverDrop;
    this.onReceiverDeliveryFailure = onReceiverDeliveryFailure;
  }

  private emitReceivingSummary(
    task: Pick<ITask, 'data' | 'emit'>,
    payload: MidCallSummaryReceivingAgentPayload
  ): void {
    try {
      task.emit(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, payload);
    } catch {
      this.onReceiverDeliveryFailure({
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        conversationId: payload.conversationId,
      });
    }
  }

  private deliverReceivingSummary(
    conversationId: string,
    task: Pick<ITask, 'data' | 'emit'>,
    payload: MidCallSummaryReceivingAgentPayload
  ): 'delivered' {
    this.removeTimedEntry(this.receivingSummaryBuffer, conversationId);
    this.emitReceivingSummary(task, payload);

    return 'delivered';
  }

  private dropAmbiguousReceivingSummary(conversationId: string): 'dropped-ambiguous' {
    this.removeTimedEntry(this.receivingSummaryBuffer, conversationId);
    this.reportReceiverDrop('ambiguous-receiver', conversationId);

    return 'dropped-ambiguous';
  }

  private getPendingMap<T extends AISummaryInboundType>(
    eventType: T
  ): Map<string, PendingAISummaryRequest<T>> {
    return this.pendingAISummaryRequests[eventType] as Map<string, PendingAISummaryRequest<T>>;
  }

  private removeTimedEntry<T extends {timeoutId?: ReturnType<typeof setTimeout>}>(
    entries: Map<string, T>,
    key: string,
    settleWhilePresent?: (entry: T) => void
  ): T | undefined {
    const entry = entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }

    if (settleWhilePresent) {
      settleWhilePresent(entry);
    }

    entries.delete(key);

    return entry;
  }

  public getFeatureEnablement(interactionId: string): FeatureEnablementEventPayload | undefined {
    return this.interactionFeatureEnablement.get(interactionId)?.payload;
  }

  public async registerPendingAISummaryRequest<T extends AISummaryInboundType>(
    taskId: string,
    conversationId: string,
    eventType: T,
    timeoutCode: AISummaryTimeoutCodeByInboundType[T]
  ): Promise<AISummaryPendingRegistration<T>> {
    const entries = this.getPendingMap(eventType);

    if (entries.has(conversationId)) {
      throw createAISummaryError(AI_SUMMARY_ERROR_CODES.AI_SUMMARY_REQUEST_ALREADY_PENDING);
    }

    let resolveResult: (payload: AISummaryPayloadByInboundType[T]) => void = () => undefined;
    let rejectResult: (error: Error) => void = () => undefined;
    const result = new Promise<AISummaryPayloadByInboundType[T]>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const requestToken = Symbol('ai-summary-request');
    const entry: PendingAISummaryRequest<T> = {
      requestToken,
      taskId,
      conversationId,
      eventType,
      resolve: resolveResult,
      reject: rejectResult,
    };

    entry.timeoutId = setTimeout(() => {
      this.removeTimedEntry(entries, conversationId, (currentEntry) => {
        currentEntry.reject(createAISummaryError(timeoutCode));
      });
    }, AI_SUMMARY_DURATION_MS);
    entries.set(conversationId, entry);

    return {requestToken, result};
  }

  public cancelPendingAISummaryRequest<T extends AISummaryInboundType>(
    taskId: string,
    conversationId: string,
    eventType: T,
    requestToken: symbol
  ): void {
    const entries = this.getPendingMap(eventType);
    const entry = entries.get(conversationId);

    if (!entry || entry.taskId !== taskId || entry.requestToken !== requestToken) {
      return;
    }

    this.removeTimedEntry(entries, conversationId);
  }

  public setFeatureEnablement(
    payload: FeatureEnablementEventPayload,
    hasRegisteredTask: boolean
  ): void {
    const interactionId = payload.interactionId;

    this.clearFeatureEnablement(interactionId);

    const entry: InteractionFeatureEnablementEntry = {payload};

    if (!hasRegisteredTask) {
      entry.timeoutId = setTimeout(() => {
        this.removeTimedEntry(this.interactionFeatureEnablement, interactionId);
      }, AI_SUMMARY_DURATION_MS);
    }

    this.interactionFeatureEnablement.set(interactionId, entry);
  }

  public retainFeatureEnablementForTask(interactionId: string): void {
    const entry = this.interactionFeatureEnablement.get(interactionId);

    if (!entry) {
      return;
    }

    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
      entry.timeoutId = undefined;
    }
  }

  public clearFeatureEnablement(interactionId: string): void {
    this.removeTimedEntry(this.interactionFeatureEnablement, interactionId);
  }

  public resolvePendingAISummaryRequest<T extends AISummaryInboundType>(
    conversationId: string,
    eventType: T,
    payload: AISummaryPayloadByInboundType[T]
  ): 'resolved' | 'not-found' {
    const entries = this.getPendingMap(eventType);
    const removed = this.removeTimedEntry(entries, conversationId, (entry) => {
      entry.resolve(payload);
    });

    return removed ? 'resolved' : 'not-found';
  }

  public routeReceivingSummary(
    payload: MidCallSummaryReceivingAgentPayload,
    matchingTasks: ReadonlyArray<Pick<ITask, 'data' | 'emit'>>
  ): 'delivered' | 'buffered' | 'dropped-ambiguous' {
    const conversationId = payload.conversationId;

    if (matchingTasks.length === 1) {
      return this.deliverReceivingSummary(conversationId, matchingTasks[0], payload);
    }

    if (matchingTasks.length === 0) {
      this.removeTimedEntry(this.receivingSummaryBuffer, conversationId);
      const entry: BufferedReceivingSummary = {payload};

      entry.timeoutId = setTimeout(() => {
        const removed = this.removeTimedEntry(this.receivingSummaryBuffer, conversationId);
        if (removed) {
          this.reportReceiverDrop('receiver-buffer-expired', conversationId);
        }
      }, AI_SUMMARY_DURATION_MS);
      this.receivingSummaryBuffer.set(conversationId, entry);

      return 'buffered';
    }

    return this.dropAmbiguousReceivingSummary(conversationId);
  }

  public flushReceivingSummary(
    conversationId: string,
    matchingTasks: ReadonlyArray<Pick<ITask, 'data' | 'emit'>>
  ): 'delivered' | 'retained' | 'dropped-ambiguous' | 'not-found' {
    const entry = this.receivingSummaryBuffer.get(conversationId);

    if (!entry) {
      return 'not-found';
    }

    if (matchingTasks.length === 0) {
      return 'retained';
    }

    if (matchingTasks.length === 1) {
      return this.deliverReceivingSummary(conversationId, matchingTasks[0], entry.payload);
    }

    return this.dropAmbiguousReceivingSummary(conversationId);
  }

  public clearTaskAISummaryState(taskId: string, conversationId: string): void {
    (Object.keys(this.pendingAISummaryRequests) as AISummaryInboundType[]).forEach((eventType) => {
      const entries = this.getPendingMap(eventType);
      const entry = entries.get(conversationId);

      if (entry?.taskId === taskId) {
        this.removeTimedEntry(entries, conversationId, (currentEntry) => {
          currentEntry.reject(createAISummaryError(AI_SUMMARY_REQUEST_CANCELLED));
        });
      }
    });
  }

  public clearAISummaryState(): void {
    (Object.keys(this.pendingAISummaryRequests) as AISummaryInboundType[]).forEach((eventType) => {
      const entries = this.getPendingMap(eventType);

      Array.from(entries.keys()).forEach((conversationId) => {
        this.removeTimedEntry(entries, conversationId, (entry) => {
          entry.reject(createAISummaryError(AI_SUMMARY_REQUEST_CANCELLED));
        });
      });
    });

    Array.from(this.receivingSummaryBuffer.keys()).forEach((conversationId) => {
      this.removeTimedEntry(this.receivingSummaryBuffer, conversationId);
    });
    Array.from(this.interactionFeatureEnablement.keys()).forEach((interactionId) => {
      this.removeTimedEntry(this.interactionFeatureEnablement, interactionId);
    });
  }

  private reportReceiverDrop(
    dropReason: AISummaryReceiverDropReason,
    conversationId: string
  ): void {
    this.onReceiverDrop({
      eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
      dropReason,
      conversationId,
    });
  }
}
