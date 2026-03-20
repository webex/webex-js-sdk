import LoggerProxy from '../logger-proxy';
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';
import {CC_FILE, METHODS} from '../constants';
import {
  HTTP_METHODS,
  WebexSDK,
  IHttpResponse,
  TranscriptAction,
  AIAssistantEventType,
  AIAssistantEventName,
  HistoricTranscriptsResponse,
} from '../types';
import {getErrorDetails} from './core/Utils';
import {WCC_API_GATEWAY} from './constants';
import {AIFeatureFlags} from './config/types';

/**
 * ApiAIAssistant provides AI Assistant APIs for transcript controls.
 * @public
 */
export class ApiAIAssistant {
  private webex: WebexSDK;
  private metricsManager: MetricsManager;
  private aiFeature: AIFeatureFlags;
  private orgId: string;

  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.metricsManager = MetricsManager.getInstance({webex});
    this.orgId = this.webex.credentials.getOrgId();
  }

  public setAIFeatureFlags(aiFeature: AIFeatureFlags): void {
    this.aiFeature = aiFeature;
  }

  private getBaseUrl(): string {
    let wccApiGatewayUrl = '';
    try {
      wccApiGatewayUrl = this.webex.internal.services.get(WCC_API_GATEWAY) || '';
    } catch (_error) {
      wccApiGatewayUrl = '';
    }
    if (!wccApiGatewayUrl) {
      throw new Error('AI_ASSISTANT_BASE_URL_NOT_AVAILABLE');
    }

    let hostname = '';
    try {
      hostname = new URL(wccApiGatewayUrl).hostname.toLowerCase();
    } catch (_error) {
      hostname = wccApiGatewayUrl.toLowerCase();
    }

    const envMap: Record<string, string> = {
      'api.intgus1.ciscoccservice.com': 'intgus1',
      'api.qaus1.ciscoccservice.com': 'qaus1',
      'api.wxcc-us1.cisco.com': 'produs1',
      'api.wxcc-eu1.cisco.com': 'prodeu1',
      'api.wxcc-eu2.cisco.com': 'prodeu2',
      'api.wxcc-anz1.cisco.com': 'prodanz1',
      'api.wxcc-ca1.cisco.com': 'prodca1',
      'api.wxcc-jp1.cisco.com': 'prodjp1',
      'api.wxcc-sg1.cisco.com': 'prodsg1',
      'api.wxcc-in1.cisco.com': 'prodin1',
      'api.loadus1.cisco.com': 'loadus1',
    };

    const resolvedEnv = envMap[hostname];
    if (!resolvedEnv) {
      throw new Error('AI_ASSISTANT_BASE_URL_NOT_AVAILABLE');
    }

    return `https://api-ai-assistant.${resolvedEnv}.ciscoccservice.com`;
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
    action: TranscriptAction
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
      const response = (await this.webex.request({
        uri: `${baseUrl}/event`,
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        body: {
          agentId,
          orgId: this.orgId,
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
        {agentId, orgId: this.orgId, interactionId, eventType, eventName, action},
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

    try {
      if (!this.aiFeature?.realtimeTranscripts?.enable) {
        throw new Error('REAL_TIME_TRANSCRIPTION_NOT_ENABLED');
      }

      const baseUrl = this.getBaseUrl();
      const response = (await this.webex.request({
        uri: `${baseUrl}/transcripts/list`,
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        body: {
          agentId,
          orgId: this.orgId,
          interactionId,
        },
      })) as IHttpResponse;

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS,
        {agentId, orgId: this.orgId, interactionId},
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
