import ApiAIAssistant from '../../../../src/services/ApiAiAssistant';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import {HTTP_METHODS, SuggestedResponseUserActionId, WebexSDK} from '../../../../src/types';

jest.mock('../../../../src/metrics/MetricsManager');
jest.mock('../../../../src/logger-proxy');

describe('ApiAIAssistant', () => {
  let apiAIAssistant: ApiAIAssistant;
  let mockWebex: WebexSDK;
  let mockMetricsManager: jest.Mocked<MetricsManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(WebexRequest, 'getInstance').mockReturnValue({
      uploadLogs: jest.fn(),
    } as any);

    mockWebex = {
      credentials: {
        getOrgId: jest.fn().mockReturnValue('test-org-id'),
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

    apiAIAssistant = new ApiAIAssistant(mockWebex);
  });

  it('should send transcript start event successfully', async () => {
    (mockWebex.request as jest.Mock).mockResolvedValue({body: {ok: true}});

    const result = await apiAIAssistant.sendEvent(
      'test-agent-id',
      'interaction-1',
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      {action: 'START'}
    );

    expect(mockWebex.request).toHaveBeenCalledTimes(1);
    const requestArgs = (mockWebex.request as jest.Mock).mock.calls[0][0];

    expect(requestArgs.uri).toBe('https://api-ai-assistant.produs1.ciscoccservice.com/event');
    expect(requestArgs.method).toBe(HTTP_METHODS.POST);
    expect(requestArgs.addAuthHeader).toBe(true);
    expect(requestArgs.body.agentId).toBe('test-agent-id');
    expect(requestArgs.body.orgId).toBe('test-org-id');
    expect(requestArgs.body.eventType).toBe('CUSTOM_EVENT');
    expect(requestArgs.body.eventName).toBe('GET_TRANSCRIPTS');
    expect(requestArgs.body.eventDetails.data.interactionId).toBe('interaction-1');
    expect(requestArgs.body.eventDetails.data.action).toBe('START');
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
        orgId: 'test-org-id',
        interactionId: 'interaction-1',
      },
    });
    expect(result).toEqual(responseBody as any);
  });

  it('should request suggested response without extra context using sendEvent', async () => {
    const sendEventSpy = jest.spyOn(apiAIAssistant, 'sendEvent').mockResolvedValue({ok: true});
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: true}} as any);

    const result = await apiAIAssistant.getSuggestedResponse({
      agentId: 'test-agent-id',
      interactionId: 'interaction-1',
    });

    expect(sendEventSpy).toHaveBeenCalledTimes(1);
    const [agentId, interactionId, eventType, eventName, metadata, languageCode, trackingId] =
      sendEventSpy.mock.calls[0];

    expect(agentId).toBe('test-agent-id');
    expect(interactionId).toBe('interaction-1');
    expect(eventType).toBe('CUSTOM_EVENT');
    expect(eventName).toBe('GET_SUGGESTIONS');
    expect(metadata).toBeUndefined();
    expect(languageCode).toBe('en');
    expect(typeof trackingId).toBe('string');
    expect(trackingId.startsWith('WX_CC_SDK_')).toBe(true);
    expect(result).toEqual({ok: true});
  });

  it('should request suggested response with extra context using sendEvent', async () => {
    const sendEventSpy = jest.spyOn(apiAIAssistant, 'sendEvent').mockResolvedValue({ok: true});
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: true}} as any);

    const result = await apiAIAssistant.getSuggestedResponse({
      agentId: 'test-agent-id',
      interactionId: 'interaction-1',
      context: 'Need assistance with credit card payment due date',
    });

    expect(sendEventSpy).toHaveBeenCalledTimes(1);
    const [agentId, interactionId, eventType, eventName, metadata, languageCode, trackingId] =
      sendEventSpy.mock.calls[0];

    expect(agentId).toBe('test-agent-id');
    expect(interactionId).toBe('interaction-1');
    expect(eventType).toBe('CUSTOM_EVENT');
    expect(eventName).toBe('ADD_SUGGESTIONS_EXTRA_CONTEXT');
    expect(metadata).toEqual({context: 'Need assistance with credit card payment due date'});
    expect(languageCode).toBe('en');
    expect(typeof trackingId).toBe('string');
    expect(trackingId.startsWith('WX_CC_SDK_')).toBe(true);
    expect(result).toEqual({ok: true});
  });

  it('should treat whitespace-only context as GET_SUGGESTIONS', async () => {
    const sendEventSpy = jest.spyOn(apiAIAssistant, 'sendEvent').mockResolvedValue({ok: true});
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: true}} as any);

    const result = await apiAIAssistant.getSuggestedResponse({
      agentId: 'test-agent-id',
      interactionId: 'interaction-1',
      context: '   ',
    });

    expect(sendEventSpy).toHaveBeenCalledTimes(1);
    const [agentId, interactionId, eventType, eventName, metadata, languageCode, trackingId] =
      sendEventSpy.mock.calls[0];

    expect(agentId).toBe('test-agent-id');
    expect(interactionId).toBe('interaction-1');
    expect(eventType).toBe('CUSTOM_EVENT');
    expect(eventName).toBe('GET_SUGGESTIONS');
    expect(metadata).toEqual({context: ''});
    expect(languageCode).toBe('en');
    expect(typeof trackingId).toBe('string');
    expect(trackingId.startsWith('WX_CC_SDK_')).toBe(true);
    expect(result).toEqual({ok: true});
  });

  [
    SuggestedResponseUserActionId.LIKE,
    SuggestedResponseUserActionId.DISLIKE,
    SuggestedResponseUserActionId.COPY,
  ].forEach((actionId) => {
    it(`should send suggested response user action for ${actionId}`, async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue({body: {ok: true}});
      apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: true}} as any);

      const result = await apiAIAssistant.sendSuggestedResponseUserAction({
        agentId: 'test-agent-id',
        interactionId: 'interaction-1',
        adaptiveCardId: 'adaptive-card-1',
        actionId,
      });

      expect(mockWebex.request).toHaveBeenCalledTimes(1);
      const requestArgs = (mockWebex.request as jest.Mock).mock.calls[0][0];
      const eventData = requestArgs.body.eventDetails.data;

      expect(requestArgs.uri).toBe('https://api-ai-assistant.produs1.ciscoccservice.com/event');
      expect(requestArgs.method).toBe(HTTP_METHODS.POST);
      expect(requestArgs.addAuthHeader).toBe(true);
      expect(requestArgs.body.agentId).toBe('test-agent-id');
      expect(requestArgs.body.orgId).toBe('test-org-id');
      expect(requestArgs.body.eventType).toBe('CUSTOM_EVENT');
      expect(requestArgs.body.eventName).toBe('SUGGESTED_RESPONSES_USER_ACTION');
      expect(eventData.interactionId).toBe('interaction-1');
      expect(eventData.adaptiveCardId).toBe('adaptive-card-1');
      expect(eventData.userAction.actionType).toBe('Action.Submit');
      expect(eventData.userAction.actionId).toBe(actionId);
      expect(eventData.languageCode).toBe('en');
      expect(typeof eventData.actionTimeStamp).toBe('string');
      expect(eventData.trackingId.startsWith('WX_CC_SDK_')).toBe(true);
      expect(result).toEqual({ok: true});
    });
  });

  it('should fail when base URL mapping is not available', async () => {
    (mockWebex.internal.services.get as jest.Mock).mockReturnValue('https://unknown-host.invalid');

    let failed = false;
    try {
      await apiAIAssistant.sendEvent(
        'test-agent-id',
        'interaction-1',
        'CUSTOM_EVENT',
        'GET_TRANSCRIPTS',
        {action: 'STOP'}
      );
    } catch (_error) {
      failed = true;
    }

    expect(failed).toBe(true);
    expect(LoggerProxy.error).toHaveBeenCalled();
  });

  it('should fail when realtime transcripts feature is disabled', async () => {
    apiAIAssistant.setAIFeatureFlags({realtimeTranscripts: {enable: false}} as any);
    let errorMessage = '';

    try {
      await apiAIAssistant.fetchHistoricTranscripts('test-agent-id', 'interaction-1');
    } catch (error) {
      errorMessage = (error as Error)?.message || '';
    }

    expect(errorMessage).toBe('Error while performing fetchHistoricTranscripts');
  });

  it('should fail when suggested responses feature is disabled', async () => {
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: false}} as any);
    let errorMessage = '';

    try {
      await apiAIAssistant.getSuggestedResponse({
        agentId: 'test-agent-id',
        interactionId: 'interaction-1',
      });
    } catch (error) {
      errorMessage = (error as Error)?.message || '';
    }

    expect(errorMessage).toBe('Error while performing getSuggestedResponse');
  });

  it('should fail to send suggested response user action when feature is disabled', async () => {
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: false}} as any);
    let errorMessage = '';

    try {
      await apiAIAssistant.sendSuggestedResponseUserAction({
        agentId: 'test-agent-id',
        interactionId: 'interaction-1',
        adaptiveCardId: 'adaptive-card-1',
        actionId: SuggestedResponseUserActionId.LIKE,
      });
    } catch (error) {
      errorMessage = (error as Error)?.message || '';
    }

    expect(errorMessage).toBe('Error while performing sendSuggestedResponseUserAction');
  });
});
