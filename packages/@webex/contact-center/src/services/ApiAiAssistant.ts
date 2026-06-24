import LoggerProxy from '../logger-proxy';
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';
import {CC_FILE, METHODS} from '../constants';
import {
  AIAssistantEventAction,
  AIAssistantEventName,
  AIAssistantEventType,
  HandoffSummaryRequestDisabledReason,
  HandoffSummaryRequestParams,
  HandoffSummaryRequestResult,
  HistoricTranscriptsResponse,
  HTTP_METHODS,
  IHttpResponse,
  WebexSDK,
} from '../types';
import {getErrorDetails} from './core/Utils';
import {
  AI_ASSISTANT_API_URLS,
  AI_ASSISTANT_BASE_URL_TEMPLATE,
  AI_ASSISTANT_ENV_MAP,
  WCC_API_GATEWAY,
} from './constants';
import {AIFeatureFlags} from './config/types';

/**
 * ApiAIAssistant provides AI Assistant APIs for transcript and handoff-summary controls.
 * @public
 */
export class ApiAIAssistant {
  private webex: WebexSDK;
  private metricsManager: MetricsManager;
  public aiFeature?: AIFeatureFlags;

  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.metricsManager = MetricsManager.getInstance({webex});
  }

  public setAIFeatureFlags(aiFeature?: AIFeatureFlags): void {
    this.aiFeature = aiFeature;
  }

  public isHandoffSummaryEnabled(): boolean {
    return this.aiFeature?.generatedSummaries?.consultTransferSummariesEnabled === true;
  }

  private getBaseUrl(): string {
    const wccApiGatewayUrl = this.webex.internal.services.get(WCC_API_GATEWAY) || '';

    if (!wccApiGatewayUrl) {
      const {error: detailedError} = getErrorDetails(
        new Error('AI_ASSISTANT_BASE_URL_NOT_AVAILABLE'),
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
        new Error('AI_ASSISTANT_BASE_URL_NOT_AVAILABLE'),
        METHODS.GET_BASE_URL,
        CC_FILE
      );
      throw detailedError;
    }

    return AI_ASSISTANT_BASE_URL_TEMPLATE.replace('%s', resolvedEnv);
  }

  private static getSanitizedError(error: unknown): string {
    if (error instanceof Error) {
      return error.name || 'Error';
    }

    return typeof error;
  }

  /**
   * Sends an event to the AI Assistant service.
   * @param agentId - agent identifier
   * @param interactionId - interaction/conversation identifier
   * @param eventType - the type of event
   * @param eventName - the name of the event
   * @param action - action within eventDetails
   */
  public async sendEvent(
    agentId: string,
    interactionId: string,
    eventType: AIAssistantEventType,
    eventName: AIAssistantEventName,
    action: AIAssistantEventAction
  ): Promise<Record<string, unknown>> {
    LoggerProxy.info('Sending event', {
      module: CC_FILE,
      method: METHODS.SEND_EVENT,
      interactionId,
      data: {eventType, eventName, action},
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
              actionTimeStamp: String(Date.now()),
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
          error: ApiAIAssistant.getSanitizedError(error),
        },
        ['operational']
      );

      const {error: detailedError} = getErrorDetails(error, METHODS.SEND_EVENT, CC_FILE);
      throw detailedError;
    }
  }

  public async requestHandoffSummary(
    params: HandoffSummaryRequestParams
  ): Promise<HandoffSummaryRequestResult> {
    const {agentId, interactionId} = params;
    const eventName = AIAssistantEventName.GET_MID_CALL_SUMMARY;
    const action = AIAssistantEventAction.REQUEST;

    LoggerProxy.info('Requesting handoff summary', {
      module: CC_FILE,
      method: METHODS.REQUEST_HANDOFF_SUMMARY,
      interactionId,
      data: {eventName, enabled: this.isHandoffSummaryEnabled()},
    });

    if (!this.isHandoffSummaryEnabled()) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_HANDOFF_SUMMARY_REQUEST_DISABLED,
        {
          agentId,
          interactionId,
          eventName,
        },
        ['operational']
      );

      return {
        enabled: false,
        reason: HandoffSummaryRequestDisabledReason.CONSULT_TRANSFER_SUMMARIES_DISABLED,
      };
    }

    try {
      const response = await this.sendEvent(
        agentId,
        interactionId,
        AIAssistantEventType.CUSTOM_EVENT,
        eventName,
        action
      );

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_HANDOFF_SUMMARY_REQUEST_SUCCESS,
        {
          agentId,
          interactionId,
          eventName,
          action,
        },
        ['operational']
      );

      return {enabled: true, response};
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_HANDOFF_SUMMARY_REQUEST_FAILED,
        {
          agentId,
          interactionId,
          eventName,
          action,
          error: ApiAIAssistant.getSanitizedError(error),
        },
        ['operational']
      );

      LoggerProxy.error('Handoff summary request failed', {
        module: CC_FILE,
        method: METHODS.REQUEST_HANDOFF_SUMMARY,
        interactionId,
        data: {eventName, action, error: ApiAIAssistant.getSanitizedError(error)},
      });

      throw error;
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
          error: ApiAIAssistant.getSanitizedError(error),
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
