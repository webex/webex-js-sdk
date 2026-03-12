import LoggerProxy from '../logger-proxy';
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';
import {CC_FILE} from '../constants';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../types';
import {getErrorDetails} from './core/Utils';
import {Profile} from './config/types';

const METHODS = {
  SEND_TRANSCRIPT_EVENT: 'sendTranscriptEvent',
  FETCH_HISTORIC_TRANSCRIPTS: 'fetchHistoricTranscripts',
} as const;

export type TranscriptAction = 'START' | 'STOP';

export type TranscriptMessage = {
  role: string;
  content: string;
  messageId: string;
  publishTimestamp: number;
};

export type HistoricTranscriptsResponse = {
  orgId: string;
  agentId: string;
  conversationId: string | null;
  interactionId: string;
  source: string;
  data: TranscriptMessage[];
};

/**
 * ApiAIAssistant provides AI Assistant APIs for transcript controls.
 * @public
 */
export class ApiAIAssistant {
  private webex: WebexSDK;
  private metricsManager: MetricsManager;
  private getAgentConfig: () => Profile | undefined;

  constructor(webex: WebexSDK, getAgentConfig: () => Profile | undefined) {
    this.webex = webex;
    this.metricsManager = MetricsManager.getInstance({webex});
    this.getAgentConfig = getAgentConfig;
  }

  private getBaseUrl(): string {
    const profile = this.getAgentConfig();
    const aiAssistantBaseUrl = profile?.aiFeature?.aiAssistantBaseUrl;
    if (!aiAssistantBaseUrl) {
      throw new Error('AI_ASSISTANT_BASE_URL_NOT_AVAILABLE');
    }

    return aiAssistantBaseUrl;
  }

  private getRequiredAgentContext(): {agentId: string; orgId: string} {
    const profile = this.getAgentConfig();
    const agentId = profile?.agentId;
    const orgId = this.webex.credentials.getOrgId();

    if (!agentId || !orgId) {
      throw new Error('AGENT_CONTEXT_NOT_AVAILABLE');
    }

    return {agentId, orgId};
  }

  /**
   * Sends transcript start/stop event for an interaction.
   * @param interactionId - interaction/conversation identifier
   * @param action - START or STOP
   */
  public async sendTranscriptEvent(
    interactionId: string,
    action: TranscriptAction
  ): Promise<Record<string, unknown>> {
    LoggerProxy.info('Sending transcript event', {
      module: CC_FILE,
      method: METHODS.SEND_TRANSCRIPT_EVENT,
      interactionId,
      data: {action},
    });
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_TRANSCRIPT_EVENT_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_TRANSCRIPT_EVENT_FAILED,
    ]);

    try {
      const {agentId, orgId} = this.getRequiredAgentContext();
      const baseUrl = this.getBaseUrl();
      const response = (await this.webex.request({
        uri: `${baseUrl}/event`,
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        body: {
          agentId,
          orgId,
          eventType: 'CUSTOM_EVENT',
          eventName: 'GET_TRANSCRIPTS',
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
        METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_TRANSCRIPT_EVENT_SUCCESS,
        {agentId, orgId, interactionId, action},
        ['operational']
      );

      return response?.body || {};
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_TRANSCRIPT_EVENT_FAILED,
        {
          interactionId,
          action,
          error: error instanceof Error ? error.message : String(error),
        },
        ['operational']
      );
      const {error: detailedError} = getErrorDetails(error, METHODS.SEND_TRANSCRIPT_EVENT, CC_FILE);
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
      const profile = this.getAgentConfig();
      const featureEnabled = Boolean(
        profile?.aiFeature?.realTimeTranscriptionEnabled ??
          profile?.['ai-feature']?.realTimeTranscriptionEnabled
      );
      if (!featureEnabled) {
        throw new Error('REAL_TIME_TRANSCRIPTION_NOT_ENABLED');
      }

      const {agentId, orgId} = this.getRequiredAgentContext();
      const baseUrl = this.getBaseUrl();
      const response = (await this.webex.request({
        uri: `${baseUrl}/transcripts/list`,
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
