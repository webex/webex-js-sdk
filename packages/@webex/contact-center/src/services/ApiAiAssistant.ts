import {v4 as uuidv4} from 'uuid';
import LoggerProxy from '../logger-proxy';
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';
import {AI_ASSISTANT_CLIENT_TYPE, AI_SUMMARY_ERROR_CODES, CC_FILE, METHODS} from '../constants';
import {
  HTTP_METHODS,
  WebexSDK,
  IHttpResponse,
  TranscriptAction,
  AIAssistantEventType,
  AIAssistantEventName,
  HistoricTranscriptsResponse,
  SuggestedResponseParams,
  AISummaryResponseTransportPayload,
} from '../types';
import {getErrorDetails} from './core/Utils';
import {TIMEOUT_REQ} from './core/constants';
import {
  AI_ASSISTANT_BASE_URL_TEMPLATE,
  AI_ASSISTANT_ENV_MAP,
  AI_ASSISTANT_API_URLS,
  WCC_API_GATEWAY,
} from './constants';
import {AIFeatureFlags} from './config/types';
import {isFiniteNonNegativeNumber, isNonEmptyString} from './AISummaryUtils';

export const AI_SUMMARY_HTTP_TIMEOUT_MS = TIMEOUT_REQ;

export const AI_SUMMARY_TRANSPORT_ERROR_CODES = {
  VALIDATION_FAILED: 'AI_SUMMARY_TRANSPORT_VALIDATION_FAILED',
  HTTP_REQUEST_FAILED: 'AI_SUMMARY_HTTP_REQUEST_FAILED',
  TIMEOUT: 'AI_SUMMARY_TRANSPORT_TIMEOUT',
} as const;

type SummaryGetEventName =
  | typeof AIAssistantEventName.GET_POST_CALL_SUMMARY
  | typeof AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY
  | typeof AIAssistantEventName.GET_MID_CALL_TRANSFER_SUMMARY;

type SummaryResponseEventName =
  | typeof AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE
  | typeof AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE
  | typeof AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE;

type SummaryResponseTransportPayload = AISummaryResponseTransportPayload & {
  eventName: SummaryResponseEventName;
};

type SummaryEnvelopeInput =
  | {
      kind: 'get';
      agentId: string;
      orgId: string;
      interactionId: string;
      conversationId: string;
      eventName: SummaryGetEventName;
      publishTimestamp: number;
      actionTimeStamp: number;
    }
  | {
      kind: 'response';
      agentId: string;
      orgId: string;
      payload: SummaryResponseTransportPayload;
      publishTimestamp: number;
      actionTimeStamp: number;
    };

type SummaryFailureContext = {
  methodName: string;
  eventName: string;
  agentId: string;
  orgId: string;
  interactionId: string;
  conversationId: string;
};

const SUMMARY_GET_EVENT_NAMES = new Set<string>([
  AIAssistantEventName.GET_POST_CALL_SUMMARY,
  AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY,
  AIAssistantEventName.GET_MID_CALL_TRANSFER_SUMMARY,
]);

const SUMMARY_RESPONSE_EVENT_NAMES = new Set<string>([
  AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
  AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
  AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
]);

const SUMMARY_FEEDBACK_VALUES = new Set<unknown>([
  'none',
  'thumbs_up',
  'thumbs_down',
] satisfies SummaryResponseTransportPayload['feedback'][]);

/**
 * ApiAIAssistant provides AI Assistant APIs for transcript controls.
 * @public
 */
export class ApiAIAssistant {
  private webex: WebexSDK;
  private metricsManager: MetricsManager;
  private aiFeature: AIFeatureFlags;

  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.metricsManager = MetricsManager.getInstance({webex});
  }

  public setAIFeatureFlags(aiFeature: AIFeatureFlags): void {
    this.aiFeature = aiFeature;
  }

  private resolveBaseUrl(): string | undefined {
    const wccApiGatewayUrl = this.webex.internal.services.get(WCC_API_GATEWAY) || '';

    if (!wccApiGatewayUrl) {
      return undefined;
    }

    let hostname = '';
    try {
      hostname = new URL(wccApiGatewayUrl).hostname.toLowerCase();
    } catch (error) {
      hostname = wccApiGatewayUrl.toLowerCase();
    }

    const resolvedEnv = AI_ASSISTANT_ENV_MAP[hostname];

    return resolvedEnv ? AI_ASSISTANT_BASE_URL_TEMPLATE.replace('%s', resolvedEnv) : undefined;
  }

  private getBaseUrl(): string {
    const baseUrl = this.resolveBaseUrl();

    if (!baseUrl) {
      const {error: detailedError} = getErrorDetails(
        new Error('AI_ASSISTANT_BASE_URL_NOT_AVAILABLE'),
        METHODS.GET_BASE_URL,
        CC_FILE
      );
      throw detailedError;
    }

    return baseUrl;
  }

  private createSummaryError(
    errorCode: string,
    methodName: string,
    context?: Partial<SummaryFailureContext> & {statusCode?: number}
  ): Error {
    const {error} = getErrorDetails(
      {
        ...(context?.statusCode !== undefined ? {statusCode: context.statusCode} : {}),
        details: {
          data: {
            reason: errorCode,
            methodName,
            ...(context?.eventName ? {eventName: context.eventName} : {}),
            ...(context?.agentId ? {agentId: context.agentId} : {}),
            ...(context?.orgId ? {orgId: context.orgId} : {}),
            ...(context?.interactionId ? {interactionId: context.interactionId} : {}),
            ...(context?.conversationId ? {conversationId: context.conversationId} : {}),
          },
        },
      },
      methodName,
      CC_FILE,
      {uploadLogs: false}
    );

    (error as Error & {data?: Record<string, unknown>}).data = {
      ...((error as Error & {data?: Record<string, unknown>}).data ?? {}),
      errorCode,
      ...(context?.statusCode !== undefined ? {statusCode: context.statusCode} : {}),
    };

    return error;
  }

  private getSummaryBaseUrl(): string {
    try {
      const baseUrl = this.resolveBaseUrl();

      if (!baseUrl) {
        throw new Error(AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE);
      }

      return baseUrl;
    } catch (_error) {
      throw this.createSummaryError(
        AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE,
        METHODS.GET_BASE_URL
      );
    }
  }

  private buildSummaryEventEnvelope(input: SummaryEnvelopeInput): Record<string, unknown> {
    const eventName = input.kind === 'get' ? input.eventName : input.payload.eventName;
    const interactionId = input.kind === 'get' ? input.interactionId : input.payload.interactionId;
    const conversationId =
      input.kind === 'get' ? input.conversationId : input.payload.conversationId;
    const data: Record<string, unknown> = {
      interactionId,
      conversationId,
      clientType: AI_ASSISTANT_CLIENT_TYPE,
      actionTimeStamp: input.actionTimeStamp,
    };

    if (input.kind === 'response') {
      data.action = eventName;
      data.summary = input.payload.summary;
      data.numberOfTimesViewed = input.payload.numberOfTimesViewed;
      data.numberOfTimesEdited = input.payload.numberOfTimesEdited;
      data.numberOfTimesCopied = input.payload.numberOfTimesCopied;
      data.feedback = input.payload.feedback;
      data.state = input.payload.state;

      if (input.payload.eventName === AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE) {
        if (input.payload.wrapUpCode !== undefined) {
          data.wrapUpCode = input.payload.wrapUpCode;
        }
      } else if (input.payload.agentName !== undefined) {
        data.agentName = input.payload.agentName;
      }
    }

    return {
      agentId: input.agentId,
      orgId: input.orgId,
      eventType: AIAssistantEventType.CTI_EVENT,
      eventName,
      publishTimestamp: input.publishTimestamp,
      eventDetails: {
        data,
      },
    };
  }

  private async boundedSummaryPost(
    baseUrl: string,
    body: Record<string, unknown>,
    context: SummaryFailureContext
  ): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutMarker = {code: AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT};

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(timeoutMarker), AI_SUMMARY_HTTP_TIMEOUT_MS);
    });

    try {
      const requestPromise = Promise.resolve(
        this.webex.request({
          uri: `${baseUrl}${AI_ASSISTANT_API_URLS.EVENT}`,
          method: HTTP_METHODS.POST,
          addAuthHeader: true,
          body,
          timeout: AI_SUMMARY_HTTP_TIMEOUT_MS,
        } as Parameters<WebexSDK['request']>[0] & {timeout: number})
      );
      requestPromise.catch(() => undefined);

      const response = await Promise.race([requestPromise, timeoutPromise]);
      if ((response as {code?: unknown})?.code === 'ETIMEDOUT') {
        throw timeoutMarker;
      }
    } catch (error) {
      if (error === timeoutMarker || (error as {code?: unknown})?.code === 'ETIMEDOUT') {
        throw this.createSummaryError(
          AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT,
          context.methodName,
          context
        );
      }

      const statusCode = isFiniteNonNegativeNumber((error as {statusCode?: unknown})?.statusCode)
        ? (error as {statusCode: number}).statusCode
        : undefined;

      throw this.createSummaryError(
        AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED,
        context.methodName,
        {...context, ...(statusCode !== undefined ? {statusCode} : {})}
      );
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  public async sendSummaryGetEvent(
    agentId: string,
    interactionId: string,
    conversationId: string,
    eventName: SummaryGetEventName
  ): Promise<void> {
    let orgId: string;

    try {
      orgId = this.webex.credentials.getOrgId();
    } catch (_error) {
      throw this.createSummaryError(
        AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED,
        METHODS.SEND_SUMMARY_GET_EVENT
      );
    }

    if (
      !isNonEmptyString(agentId) ||
      !isNonEmptyString(orgId) ||
      !isNonEmptyString(interactionId) ||
      !isNonEmptyString(conversationId) ||
      !SUMMARY_GET_EVENT_NAMES.has(eventName)
    ) {
      throw this.createSummaryError(
        AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED,
        METHODS.SEND_SUMMARY_GET_EVENT
      );
    }

    const now = Date.now();
    const baseUrl = this.getSummaryBaseUrl();
    const body = this.buildSummaryEventEnvelope({
      kind: 'get',
      agentId,
      orgId,
      interactionId,
      conversationId,
      eventName,
      publishTimestamp: now,
      actionTimeStamp: now,
    });

    await this.boundedSummaryPost(baseUrl, body, {
      methodName: METHODS.SEND_SUMMARY_GET_EVENT,
      eventName,
      agentId,
      orgId,
      interactionId,
      conversationId,
    });
  }

  public async sendSummaryResponseEvent(
    agentId: string,
    payload: SummaryResponseTransportPayload
  ): Promise<void> {
    let orgId: string;

    try {
      orgId = this.webex.credentials.getOrgId();
    } catch (_error) {
      throw this.createSummaryError(
        AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED,
        METHODS.SEND_SUMMARY_RESPONSE_EVENT
      );
    }

    if (
      !isNonEmptyString(agentId) ||
      !isNonEmptyString(orgId) ||
      !isNonEmptyString(payload?.interactionId) ||
      !isNonEmptyString(payload?.conversationId) ||
      !SUMMARY_RESPONSE_EVENT_NAMES.has(payload?.eventName) ||
      !isFiniteNonNegativeNumber(payload?.numberOfTimesViewed) ||
      !isFiniteNonNegativeNumber(payload?.numberOfTimesEdited) ||
      !isFiniteNonNegativeNumber(payload?.numberOfTimesCopied) ||
      !SUMMARY_FEEDBACK_VALUES.has(payload?.feedback) ||
      (payload?.actionTimeStamp !== undefined &&
        !isFiniteNonNegativeNumber(payload.actionTimeStamp)) ||
      (payload?.publishTimestamp !== undefined &&
        !isFiniteNonNegativeNumber(payload.publishTimestamp))
    ) {
      throw this.createSummaryError(
        AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED,
        METHODS.SEND_SUMMARY_RESPONSE_EVENT
      );
    }

    const fallbackNow = Date.now();
    const actionTimeStamp = payload.actionTimeStamp ?? fallbackNow;
    const publishTimestamp = payload.publishTimestamp ?? fallbackNow;
    const baseUrl = this.getSummaryBaseUrl();
    const body = this.buildSummaryEventEnvelope({
      kind: 'response',
      agentId,
      orgId,
      payload,
      publishTimestamp,
      actionTimeStamp,
    });

    await this.boundedSummaryPost(baseUrl, body, {
      methodName: METHODS.SEND_SUMMARY_RESPONSE_EVENT,
      eventName: payload.eventName,
      agentId,
      orgId,
      interactionId: payload.interactionId,
      conversationId: payload.conversationId,
    });
  }

  /**
   * Sends an event to the AI Assistant service.
   * @param agentId - agent identifier
   * @param interactionId - interaction/conversation identifier
   * @param eventType - the type of event (e.g. 'CUSTOM_EVENT')
   * @param eventName - the name of the event (e.g. 'GET_TRANSCRIPTS')
   * @param action - action within eventDetails (e.g. 'START' or 'STOP')
   */
  public async sendEvent(
    agentId: string,
    interactionId: string,
    eventType: AIAssistantEventType,
    eventName: AIAssistantEventName,
    action?: TranscriptAction,
    context?: string,
    languageCode?: string,
    trackingId?: string
  ): Promise<Record<string, unknown>> {
    LoggerProxy.info('Sending event', {
      module: CC_FILE,
      method: METHODS.SEND_EVENT,
      interactionId,
      data: {eventType, eventName, action, context},
    });
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_FAILED,
    ]);

    try {
      const baseUrl = this.getBaseUrl();
      const orgId = this.webex.credentials.getOrgId();
      const response = (await this.webex.request({
        uri: `${baseUrl}${AI_ASSISTANT_API_URLS.EVENT}`,
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        body: {
          agentId,
          orgId,
          eventType,
          eventName,
          eventDetails: {
            data: {
              interactionId,
              action,
              context,
              actionTimeStamp: String(Date.now()),
              languageCode,
              trackingId,
            },
          },
        },
      })) as IHttpResponse;

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS,
        {agentId, orgId, interactionId, eventType, eventName, action},
        ['operational']
      );

      return response?.body || {};
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_FAILED,
        {
          interactionId,
          eventType,
          eventName,
          action,
          error: error instanceof Error ? error.message : String(error),
        },
        ['operational']
      );

      const {error: detailedError} = getErrorDetails(error, METHODS.SEND_EVENT, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Requests a suggested response for an interaction.
   *
   * @param params - Suggestion request parameters
   * @returns HTTP response body from the AI Assistant event API
   * @public
   */
  public async getSuggestedResponse(params: SuggestedResponseParams): Promise<any> {
    const {agentId, interactionId, context} = params;
    const trimmedContext = context?.trim();
    const languageCode = params.languageCode ?? 'en';
    const trackingId = `WX_CC_SDK_${uuidv4()}`;
    const eventName = trimmedContext
      ? AIAssistantEventName.ADD_SUGGESTIONS_EXTRA_CONTEXT
      : AIAssistantEventName.GET_SUGGESTIONS;

    const loggerContext = {
      module: CC_FILE,
      method: METHODS.GET_SUGGESTED_RESPONSE,
      interactionId,
      trackingId,
      data: {eventName},
    };

    LoggerProxy.info('Requesting suggested response', loggerContext);

    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_GET_SUGGESTED_RESPONSE_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_GET_SUGGESTED_RESPONSE_FAILED,
    ]);

    try {
      if (!this.aiFeature?.suggestedResponses?.enable) {
        const {error: detailedError} = getErrorDetails(
          new Error('SUGGESTED_RESPONSES_NOT_ENABLED'),
          METHODS.GET_SUGGESTED_RESPONSE,
          CC_FILE
        );
        throw detailedError;
      }

      const orgId = this.webex.credentials.getOrgId();

      const response = await this.sendEvent(
        agentId,
        interactionId,
        AIAssistantEventType.CUSTOM_EVENT,
        eventName,
        undefined,
        trimmedContext,
        languageCode,
        trackingId
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_GET_SUGGESTED_RESPONSE_SUCCESS,
        {
          agentId,
          orgId,
          interactionId,
          eventName,
          trackingId,
          context,
        },
        ['operational']
      );
      LoggerProxy.log('Suggested response request succeeded', loggerContext);

      return response;
    } catch (error) {
      LoggerProxy.error('Suggested response request failed', {...loggerContext, error});
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_GET_SUGGESTED_RESPONSE_FAILED,
        {
          agentId,
          interactionId,
          trackingId,
          eventName,
          error: error instanceof Error ? error.message : String(error),
        },
        ['operational']
      );

      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.GET_SUGGESTED_RESPONSE,
        CC_FILE
      );
      throw detailedError;
    }
  }

  /**
   * Fetches historic transcripts for an interaction.
   * This API is allowed only when real-time transcription feature is enabled.
   *
   * @param interactionId - interaction/conversation identifier
   */
  public async fetchHistoricTranscripts(
    agentId: string,
    interactionId: string
  ): Promise<HistoricTranscriptsResponse> {
    LoggerProxy.info('Fetching historic transcripts', {
      module: CC_FILE,
      method: METHODS.FETCH_HISTORIC_TRANSCRIPTS,
      interactionId,
    });
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_FAILED,
    ]);
    if (!this.aiFeature?.realtimeTranscripts?.enable) {
      const {error: detailedError} = getErrorDetails(
        new Error('REAL_TIME_TRANSCRIPTION_NOT_ENABLED'),
        METHODS.FETCH_HISTORIC_TRANSCRIPTS,
        CC_FILE
      );
      throw detailedError;
    }

    try {
      const baseUrl = this.getBaseUrl();
      const orgId = this.webex.credentials.getOrgId();
      const response = (await this.webex.request({
        uri: `${baseUrl}${AI_ASSISTANT_API_URLS.TRANSCRIPTS_LIST}`,
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        body: {
          agentId,
          orgId,
          interactionId,
        },
      })) as IHttpResponse;

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS,
        {agentId, orgId, interactionId},
        ['operational']
      );

      return response.body as HistoricTranscriptsResponse;
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_FAILED,
        {
          interactionId,
          error: error instanceof Error ? error.message : String(error),
        },
        ['operational']
      );

      if (error instanceof Error) {
        throw error;
      }
      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.FETCH_HISTORIC_TRANSCRIPTS,
        CC_FILE
      );
      throw detailedError;
    }
  }
}

export default ApiAIAssistant;
