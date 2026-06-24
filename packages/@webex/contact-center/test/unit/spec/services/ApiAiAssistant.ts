import ApiAIAssistant from '../../../../src/services/ApiAiAssistant';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import LoggerProxy from '../../../../src/logger-proxy';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import {
  AIAssistantEventAction,
  AIAssistantEventName,
  AIAssistantEventType,
  HandoffSummaryRequestDisabledReason,
  HTTP_METHODS,
  WebexSDK,
} from '../../../../src/types';

jest.mock('../../../../src/metrics/MetricsManager');
jest.mock('../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

describe('ApiAIAssistant', () => {
  let apiAIAssistant: ApiAIAssistant;
  let mockWebex: WebexSDK;
  let mockMetricsManager: jest.Mocked<MetricsManager>;
  let mockUploadLogs: jest.Mock;

  const agentId = 'agent-123';
  const interactionId = 'interaction-456';
  const orgId = 'org-789';

  beforeEach(() => {
    jest.clearAllMocks();

    mockWebex = {
      credentials: {
        getOrgId: jest.fn().mockReturnValue(orgId),
      },
      request: jest.fn(),
      internal: {
        services: {
          get: jest.fn().mockReturnValue('https://api.wxcc-us1.cisco.com'),
        },
        newMetrics: {
          submitBehavioralEvent: jest.fn(),
          submitOperationalEvent: jest.fn(),
          submitBusinessEvent: jest.fn(),
        },
      },
      ready: true,
      once: jest.fn(),
    } as unknown as WebexSDK;

    mockMetricsManager = {
      trackEvent: jest.fn(),
      timeEvent: jest.fn(),
    } as unknown as jest.Mocked<MetricsManager>;
    (MetricsManager.getInstance as jest.Mock).mockReturnValue(mockMetricsManager);

    mockUploadLogs = jest.fn();
    jest.spyOn(WebexRequest, 'getInstance').mockReturnValue({
      uploadLogs: mockUploadLogs,
    } as unknown as WebexRequest);

    apiAIAssistant = new ApiAIAssistant(mockWebex);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should send transcript start event successfully', async () => {
    (mockWebex.request as jest.Mock).mockResolvedValue({body: {ok: true}});

    const result = await apiAIAssistant.sendEvent(
      'test-agent-id',
      'interaction-1',
      AIAssistantEventType.CUSTOM_EVENT,
      AIAssistantEventName.GET_TRANSCRIPTS,
      AIAssistantEventAction.START
    );

    expect(mockWebex.request).toHaveBeenCalledWith({
      uri: 'https://api-ai-assistant.produs1.ciscoccservice.com/event',
      method: HTTP_METHODS.POST,
      addAuthHeader: true,
      body: {
        agentId: 'test-agent-id',
        orgId,
        eventType: AIAssistantEventType.CUSTOM_EVENT,
        eventName: AIAssistantEventName.GET_TRANSCRIPTS,
        eventDetails: {
          data: expect.objectContaining({
            interactionId: 'interaction-1',
            action: AIAssistantEventAction.START,
          }),
        },
      },
    });
    expect(result).toEqual({ok: true});
  });

  it('should fetch historic transcripts with mapped base URL', async () => {
    const responseBody = {interactionId: 'interaction-1', data: []};
    (mockWebex.request as jest.Mock).mockResolvedValue({body: responseBody});
    apiAIAssistant.setAIFeatureFlags({realtimeTranscripts: {enable: true}} as any);

    const result = await apiAIAssistant.fetchHistoricTranscripts('test-agent-id', 'interaction-1');

    expect(mockWebex.request).toHaveBeenCalledWith({
      uri: 'https://api-ai-assistant.produs1.ciscoccservice.com/transcripts/list',
      method: HTTP_METHODS.POST,
      addAuthHeader: true,
      body: {
        agentId: 'test-agent-id',
        orgId,
        interactionId: 'interaction-1',
      },
    });
    expect(result).toEqual(responseBody as any);
  });

  it('should fail when base URL mapping is not available', async () => {
    (mockWebex.internal.services.get as jest.Mock).mockReturnValue('https://unknown-host.invalid');

    let failed = false;
    try {
      await apiAIAssistant.sendEvent(
        'test-agent-id',
        'interaction-1',
        AIAssistantEventType.CUSTOM_EVENT,
        AIAssistantEventName.GET_TRANSCRIPTS,
        AIAssistantEventAction.STOP
      );
    } catch (_error) {
      failed = true;
    }

    expect(failed).toBe(true);
    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_FAILED,
      expect.objectContaining({
        interactionId: 'interaction-1',
        eventType: AIAssistantEventType.CUSTOM_EVENT,
        eventName: AIAssistantEventName.GET_TRANSCRIPTS,
        action: AIAssistantEventAction.STOP,
        error: 'Error',
      }),
      ['operational']
    );
  });

  it('requests a handoff summary through the AI Assistant event transport when enabled', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    (mockWebex.request as jest.Mock).mockResolvedValue({
      statusCode: 202,
      body: {accepted: true},
    });
    apiAIAssistant.setAIFeatureFlags({
      id: 'feature-1',
      generatedSummaries: {
        consultTransferSummariesEnabled: true,
      },
    });

    const result = await apiAIAssistant.requestHandoffSummary({agentId, interactionId});

    expect(result).toEqual({enabled: true, response: {accepted: true}});
    expect(mockWebex.request).toHaveBeenCalledWith({
      uri: 'https://api-ai-assistant.produs1.ciscoccservice.com/event',
      method: HTTP_METHODS.POST,
      addAuthHeader: true,
      body: {
        agentId,
        orgId,
        eventType: AIAssistantEventType.CUSTOM_EVENT,
        eventName: AIAssistantEventName.GET_MID_CALL_SUMMARY,
        eventDetails: {
          data: {
            interactionId,
            action: AIAssistantEventAction.REQUEST,
            actionTimeStamp: '1700000000000',
          },
        },
      },
    });
    expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS,
      METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_FAILED,
    ]);
    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_ASSISTANT_HANDOFF_SUMMARY_REQUEST_SUCCESS,
      {
        agentId,
        interactionId,
        eventName: AIAssistantEventName.GET_MID_CALL_SUMMARY,
        action: AIAssistantEventAction.REQUEST,
      },
      ['operational']
    );
  });

  it('does not call AI Assistant when consult transfer summaries are disabled', async () => {
    apiAIAssistant.setAIFeatureFlags({
      id: 'feature-1',
      generatedSummaries: {
        consultTransferSummariesEnabled: false,
      },
    });

    const result = await apiAIAssistant.requestHandoffSummary({agentId, interactionId});

    expect(result).toEqual({
      enabled: false,
      reason: HandoffSummaryRequestDisabledReason.CONSULT_TRANSFER_SUMMARIES_DISABLED,
    });
    expect(mockWebex.request).not.toHaveBeenCalled();
    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_ASSISTANT_HANDOFF_SUMMARY_REQUEST_DISABLED,
      {
        agentId,
        interactionId,
        eventName: AIAssistantEventName.GET_MID_CALL_SUMMARY,
      },
      ['operational']
    );
  });

  it('does not call AI Assistant when the summary gate is missing', async () => {
    const result = await apiAIAssistant.requestHandoffSummary({agentId, interactionId});

    expect(result).toEqual({
      enabled: false,
      reason: HandoffSummaryRequestDisabledReason.CONSULT_TRANSFER_SUMMARIES_DISABLED,
    });
    expect(mockWebex.request).not.toHaveBeenCalled();
  });

  it('logs and metrics request failures without logging summary content', async () => {
    const sensitiveText = 'Sensitive summary body should not be logged';
    apiAIAssistant.setAIFeatureFlags({
      id: 'feature-1',
      generatedSummaries: {
        consultTransferSummariesEnabled: true,
      },
    });
    (mockWebex.request as jest.Mock).mockRejectedValue(new Error(sensitiveText));

    await expect(
      apiAIAssistant.requestHandoffSummary({agentId, interactionId})
    ).rejects.toThrow('Error while performing sendEvent');

    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_ASSISTANT_HANDOFF_SUMMARY_REQUEST_FAILED,
      {
        agentId,
        interactionId,
        eventName: AIAssistantEventName.GET_MID_CALL_SUMMARY,
        action: AIAssistantEventAction.REQUEST,
        error: 'Error',
      },
      ['operational']
    );
    expect(LoggerProxy.error).toHaveBeenCalledWith('Handoff summary request failed', {
      module: 'cc',
      method: 'requestHandoffSummary',
      interactionId,
      data: {
        eventName: AIAssistantEventName.GET_MID_CALL_SUMMARY,
        action: AIAssistantEventAction.REQUEST,
        error: 'Error',
      },
    });
    expect(JSON.stringify((LoggerProxy.error as jest.Mock).mock.calls)).not.toContain(
      sensitiveText
    );
    expect(JSON.stringify(mockMetricsManager.trackEvent.mock.calls)).not.toContain(sensitiveText);
  });
});
