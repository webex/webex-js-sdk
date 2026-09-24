import {v4 as uuidv4} from 'uuid';
import LoggerProxy from '../logger-proxy';
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';
import {AI_SUMMARY_ERROR_CODES, CC_FILE, METHODS} from '../constants';
import {
  HTTP_METHODS,
  WebexSDK,
  IHttpResponse,
  AIAssistantEventType,
  AIAssistantEventName,
  HistoricTranscriptsResponse,
  RealTimeAssistanceParams,
  RealTimeAssistanceUserActionParams,
  RespondToWellnessBreakParams,
  WellnessBreakUserAction,
  WELLNESS_BREAK_USER_ACTIONS,
  GenericError,
} from '../types';
import {getErrorDetails} from './core/Utils';
import type {PendingRtdRequest, RtdRequestOptions} from './core/types';
import {
  AI_ASSISTANT_BASE_URL_TEMPLATE,
  AI_ASSISTANT_ENV_MAP,
  AI_ASSISTANT_API_URLS,
  WCC_API_GATEWAY,
} from './constants';
import {AIFeatureFlags} from './config/types';

type WellnessBreakContextProvider = () => {
  isWellnessBreakEnabled: boolean;
  agentId?: string;
  agentSessionId?: string;
};

/**
 * ApiAIAssistant provides AI Assistant APIs for transcript controls.
 * @public
 */
export class ApiAIAssistant {
  private webex: WebexSDK;
  private metricsManager: MetricsManager;
  private aiFeature: AIFeatureFlags;
  private pendingRtdRequests = new Map<string, PendingRtdRequest<unknown>>();
  private readonly wellnessContextProvider?: WellnessBreakContextProvider;

  private createWellnessError(reason: string): GenericError {
    const error = new Error(reason) as GenericError;
    error.details = {
      type: 'SDK_VALIDATION_ERROR',
      orgId: this.webex.credentials.getOrgId(),
      trackingId: '',
      data: {reason},
    };

    return error;
  }

  constructor(webex: WebexSDK, wellnessContextProvider?: WellnessBreakContextProvider) {
    this.webex = webex;
    this.wellnessContextProvider = wellnessContextProvider;
    this.metricsManager = MetricsManager.getInstance({webex});
  }

  public setAIFeatureFlags(aiFeature: AIFeatureFlags): void {
    this.aiFeature = aiFeature;
  }

  private async sendWellnessBreakAction(
    action: WellnessBreakUserAction,
    method: string
  ): Promise<void> {
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_ACTION_ACCEPTED,
      METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_ACTION_FAILED,
    ]);

    try {
      const context = this.wellnessContextProvider?.();
      const agentId = context?.agentId?.trim();
      const agentSessionId = context?.agentSessionId?.trim();
      const orgId = this.webex.credentials.getOrgId()?.trim();

      if (context?.isWellnessBreakEnabled !== true) {
        throw this.createWellnessError('WELLNESS_BREAK_NOT_ENABLED');
      }
      if (!orgId) {
        throw this.createWellnessError('WELLNESS_BREAK_ORG_ID_REQUIRED');
      }
      if (!agentId) {
        throw this.createWellnessError('WELLNESS_BREAK_AGENT_ID_REQUIRED');
      }
      if (!agentSessionId) {
        throw this.createWellnessError('WELLNESS_BREAK_AGENT_SESSION_REQUIRED');
      }

      const baseUrl = this.getBaseUrl();
      const response = (await this.webex.request({
        uri: `${baseUrl}${AI_ASSISTANT_API_URLS.EVENT}`,
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        body: {
          agentId,
          orgId,
          eventType: AIAssistantEventType.CUSTOM_EVENT,
          eventName: AIAssistantEventName.WELLNESS_BREAK_ACTION,
          eventDetails: {
            data: {
              action,
              agentSessionId,
              actionTimeStamp: Date.now(),
            },
          },
        },
      })) as IHttpResponse;

      if (response.statusCode !== 202) {
        throw this.createWellnessError(
          `WELLNESS_BREAK_ACTION_UNEXPECTED_STATUS_${response.statusCode}`
        );
      }

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_ACTION_ACCEPTED,
        {action},
        ['operational']
      );
      LoggerProxy.log('Wellness action accepted by AI Assistant', {
        module: CC_FILE,
        method,
        data: {action},
      });
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_ACTION_FAILED,
        {
          action,
          error: error instanceof Error ? error.message : String(error),
        },
        ['operational']
      );
      const {error: detailedError} = getErrorDetails(error, method, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Requests an Agent Wellness Break.
   * The promise resolves when the HTTP request is accepted with status 202; the later
   * approval or denial is delivered independently through a wellness notification.
   * @returns A promise that resolves with no value after HTTP acceptance
   * @throws Structured Contact Center error when disabled, stale, invalid, or delivery fails
   * @example
   * await webex.cc.apiAIAssistant.requestWellnessBreak();
   * @public
   */
  public async requestWellnessBreak(): Promise<void> {
    return this.sendWellnessBreakAction(
      WELLNESS_BREAK_USER_ACTIONS.REQUESTED,
      METHODS.REQUEST_WELLNESS_BREAK
    );
  }

  /**
   * Responds to a backend-provided Agent Wellness Break offer.
   * The promise resolves when the HTTP request is accepted with status 202 and does not
   * wait for a WebSocket completion event.
   * @param params - ACCEPTED, REJECTED, or NO_RESPONSE
   * @returns A promise that resolves with no value after HTTP acceptance
   * @throws Structured Contact Center error when disabled, stale, invalid, or delivery fails
   * @example
   * await webex.cc.apiAIAssistant.respondToWellnessBreak({
   *   action: WELLNESS_BREAK_USER_ACTIONS.ACCEPTED,
   * });
   * @public
   */
  public async respondToWellnessBreak(params: RespondToWellnessBreakParams): Promise<void> {
    const {action} = params;
    if (
      ![
        WELLNESS_BREAK_USER_ACTIONS.ACCEPTED,
        WELLNESS_BREAK_USER_ACTIONS.REJECTED,
        WELLNESS_BREAK_USER_ACTIONS.NO_RESPONSE,
      ].includes(action)
    ) {
      const {error} = getErrorDetails(
        this.createWellnessError('WELLNESS_BREAK_ACTION_INVALID'),
        METHODS.RESPOND_TO_WELLNESS_BREAK,
        CC_FILE
      );
      throw error;
    }

    return this.sendWellnessBreakAction(action, METHODS.RESPOND_TO_WELLNESS_BREAK);
  }

  private getBaseUrl(): string {
    const wccApiGatewayUrl = this.webex.internal.services.get(WCC_API_GATEWAY) || '';

    if (!wccApiGatewayUrl) {
      const {error: detailedError} = getErrorDetails(
        new Error(AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE),
        METHODS.GET_BASE_URL,
        CC_FILE
      );
      throw detailedError;
    }

    let hostname = '';
    try {
      hostname = new URL(wccApiGatewayUrl).hostname.toLowerCase();
    } catch (error) {
      hostname = wccApiGatewayUrl.toLowerCase();
    }

    const resolvedEnv = AI_ASSISTANT_ENV_MAP[hostname];

    if (!resolvedEnv) {
      const {error: detailedError} = getErrorDetails(
        new Error(AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE),
        METHODS.GET_BASE_URL,
        CC_FILE
      );
      throw detailedError;
    }

    return AI_ASSISTANT_BASE_URL_TEMPLATE.replace('%s', resolvedEnv);
  }

  private static getRtdRequestKey(rtdEventType: string, correlationId: string): string {
    return JSON.stringify([rtdEventType, correlationId]);
  }

  private removeRtdRequest<T>(
    rtdEventType: string,
    correlationId: string,
    settle?: (request: PendingRtdRequest<T>) => void
  ): PendingRtdRequest<T> | undefined {
    const key = ApiAIAssistant.getRtdRequestKey(rtdEventType, correlationId);
    const request = this.pendingRtdRequests.get(key) as PendingRtdRequest<T> | undefined;

    if (!request) {
      return undefined;
    }

    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    settle?.(request);
    this.pendingRtdRequests.delete(key);

    return request;
  }

  /** Sends an AI event and waits for its matching RTD response. @internal */
  public async requestAndWaitForRtd<T>(options: RtdRequestOptions): Promise<T> {
    const key = ApiAIAssistant.getRtdRequestKey(options.rtdEventType, options.correlationId);
    let resolveResult: (payload: T) => void = () => undefined;
    let rejectResult: (error: Error) => void = () => undefined;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const previousRequest = this.pendingRtdRequests.get(key);
    if (previousRequest?.timeoutId) {
      clearTimeout(previousRequest.timeoutId);
    }
    const request: PendingRtdRequest<T> = {
      correlationId: options.correlationId,
      rtdEventType: options.rtdEventType,
      resolve: resolveResult,
      reject: rejectResult,
    };

    request.timeoutId = setTimeout(() => {
      this.removeRtdRequest<T>(options.rtdEventType, options.correlationId, (currentRequest) => {
        currentRequest.reject(options.createTimeoutError());
      });
    }, options.timeoutMs);
    this.pendingRtdRequests.set(key, request as PendingRtdRequest<unknown>);
    const publishTimestamp = options.publishTimestamp ?? Date.now();
    const acknowledgement = Promise.resolve()
      .then(() =>
        this.sendEvent(
          options.agentId,
          options.interactionId,
          options.eventType,
          options.eventName,
          options.eventMetaData,
          undefined,
          undefined,
          publishTimestamp,
          options.timeout
        )
      )
      .catch((error) => {
        this.removeRtdRequest(options.rtdEventType, options.correlationId);
        throw error;
      });

    const [payload] = await Promise.all([result, acknowledgement]);

    return payload;
  }

  /** Resolves a pending request from a parsed RTD event. @internal */
  public resolveFromRtdEvent<T>(
    rtdEventType: string,
    correlationId: string,
    payload: T
  ): 'resolved' | 'not-found' {
    const request = this.removeRtdRequest<T>(rtdEventType, correlationId, (currentRequest) => {
      currentRequest.resolve(payload);
    });

    return request ? 'resolved' : 'not-found';
  }

  /** Clears pending RTD requests when the RTD lifecycle ends. @internal */
  public clearAllRtdRequests(): void {
    Array.from(this.pendingRtdRequests.values()).forEach((request) => {
      this.removeRtdRequest(request.rtdEventType, request.correlationId, (currentRequest) => {
        currentRequest.reject(new Error('RTD request cleared'));
      });
    });
  }

  /**
   * Sends an event to the AI Assistant service.
   * @param agentId - agent identifier
   * @param interactionId - interaction/conversation identifier
   * @param eventType - the type of event (e.g. 'CUSTOM_EVENT')
   * @param eventName - the name of the event (e.g. 'GET_TRANSCRIPTS')
   * @param eventMetaData - event-specific fields to include in eventDetails.data
   * @param languageCode - language code within eventDetails.data
   * @param trackingId - tracking identifier within eventDetails.data
   */
  public async sendEvent(
    agentId: string,
    interactionId: string,
    eventType: AIAssistantEventType,
    eventName: AIAssistantEventName,
    eventMetaData?: Record<string, unknown>,
    languageCode?: string,
    trackingId?: string,
    publishTimestamp?: number,
    timeout?: number
  ): Promise<Record<string, unknown>> {
    LoggerProxy.info('Sending event', {
      module: CC_FILE,
      method: METHODS.SEND_EVENT,
      interactionId,
      data: {eventType, eventName, eventMetaData},
    });
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_FAILED,
    ]);

    try {
      const baseUrl = this.getBaseUrl();
      const orgId = this.webex.credentials.getOrgId();
      const data = {
        ...eventMetaData,
        interactionId,
        actionTimeStamp: String(Date.now()),
        languageCode,
        trackingId,
      };
      const response = (await this.webex.request({
        uri: `${baseUrl}${AI_ASSISTANT_API_URLS.EVENT}`,
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        ...(timeout !== undefined ? {timeout} : {}),
        body: {
          agentId,
          orgId,
          eventType,
          eventName,
          ...(publishTimestamp !== undefined ? {publishTimestamp} : {}),
          eventDetails: {
            data,
          },
        },
      })) as IHttpResponse;

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS,
        {agentId, orgId, interactionId, eventType, eventName},
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
          error: error instanceof Error ? error.message : String(error),
        },
        ['operational']
      );

      const {error: detailedError} = getErrorDetails(error, METHODS.SEND_EVENT, CC_FILE);
      throw detailedError;
    }
  }

  /**
   * Requests real-time assistance for an interaction.
   *
   * @param params - Real-time assistance request parameters
   * @returns HTTP response body from the AI Assistant event API
   * @public
   */
  public async getRealTimeAssistance(params: RealTimeAssistanceParams) {
    const {agentId, interactionId, context} = params;
    const trimmedContext = context?.trim();
    const languageCode = params.languageCode ?? 'en';
    const trackingId = `WX_CC_SDK_${uuidv4()}`;
    const eventName = trimmedContext
      ? AIAssistantEventName.ADD_SUGGESTIONS_EXTRA_CONTEXT
      : AIAssistantEventName.GET_SUGGESTIONS;

    const loggerContext = {
      module: CC_FILE,
      method: METHODS.GET_REAL_TIME_ASSISTANCE,
      interactionId,
      trackingId,
      data: {eventName},
    };

    LoggerProxy.info('Requesting real-time assistance', loggerContext);

    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_GET_REAL_TIME_ASSISTANCE_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_GET_REAL_TIME_ASSISTANCE_FAILED,
    ]);

    try {
      if (!this.aiFeature?.suggestedResponses?.enable) {
        const {error: detailedError} = getErrorDetails(
          new Error('SUGGESTED_RESPONSES_NOT_ENABLED'),
          METHODS.GET_REAL_TIME_ASSISTANCE,
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
        trimmedContext !== undefined ? {context: trimmedContext} : undefined,
        languageCode,
        trackingId
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_GET_REAL_TIME_ASSISTANCE_SUCCESS,
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
      LoggerProxy.log('Real-time assistance request succeeded', loggerContext);

      return response;
    } catch (error) {
      LoggerProxy.error('Real-time assistance request failed', {...loggerContext, error});
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_GET_REAL_TIME_ASSISTANCE_FAILED,
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
        METHODS.GET_REAL_TIME_ASSISTANCE,
        CC_FILE
      );
      throw detailedError;
    }
  }

  /**
   * Sends user action feedback for a real-time assistance adaptive card.
   *
   * @param params - Real-time assistance user action parameters
   * @returns HTTP response body from the AI Assistant event API
   * @public
   */
  public async sendRealTimeAssistanceUserAction(
    params: RealTimeAssistanceUserActionParams
  ): Promise<Record<string, unknown>> {
    const {agentId, interactionId, adaptiveCardId, actionId} = params;
    const actionType = 'Action.Submit';
    const languageCode = params.languageCode ?? 'en';
    const trackingId = `WX_CC_SDK_${uuidv4()}`;

    const loggerContext = {
      module: CC_FILE,
      method: METHODS.SEND_REAL_TIME_ASSISTANCE_USER_ACTION,
      interactionId,
      trackingId,
      data: {actionId, adaptiveCardId},
    };

    LoggerProxy.info('Sending real-time assistance user action', loggerContext);

    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_REAL_TIME_ASSISTANCE_USER_ACTION_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_REAL_TIME_ASSISTANCE_USER_ACTION_FAILED,
    ]);

    try {
      if (!this.aiFeature?.suggestedResponses?.enable) {
        const {error: detailedError} = getErrorDetails(
          new Error('SUGGESTED_RESPONSES_NOT_ENABLED'),
          METHODS.SEND_REAL_TIME_ASSISTANCE_USER_ACTION,
          CC_FILE
        );
        throw detailedError;
      }

      const orgId = this.webex.credentials.getOrgId();
      const response = await this.sendEvent(
        agentId,
        interactionId,
        AIAssistantEventType.CUSTOM_EVENT,
        AIAssistantEventName.SUGGESTED_RESPONSES_USER_ACTION,
        {
          adaptiveCardId,
          userAction: {
            actionType,
            actionId,
          },
        },
        languageCode,
        trackingId
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_REAL_TIME_ASSISTANCE_USER_ACTION_SUCCESS,
        {
          agentId,
          orgId,
          interactionId,
          adaptiveCardId,
          actionId,
          trackingId,
        },
        ['operational']
      );
      LoggerProxy.log('Real-time assistance user action sent', loggerContext);

      return response;
    } catch (error) {
      LoggerProxy.error('Real-time assistance user action failed', {...loggerContext, error});
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_REAL_TIME_ASSISTANCE_USER_ACTION_FAILED,
        {
          agentId,
          interactionId,
          adaptiveCardId,
          actionId,
          trackingId,
          error: error instanceof Error ? error.message : String(error),
        },
        ['operational']
      );

      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.SEND_REAL_TIME_ASSISTANCE_USER_ACTION,
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
