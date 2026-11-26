import ApiAIAssistant from '../../../../src/services/ApiAiAssistant';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import {
  HTTP_METHODS,
  AIAssistantEventType,
  AIAssistantEventName,
  RealTimeAssistanceUserActionId,
  WELLNESS_BREAK_USER_ACTIONS,
  WebexSDK,
} from '../../../../src/types';
import {createRegionRecoveryError} from '../../../../src/services/core/Utils';

jest.mock('../../../../src/metrics/MetricsManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
}));
jest.mock('../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
}));
jest.mock('../../../../src/services/core/Utils', () => {
  const actual = jest.requireActual('../../../../src/services/core/Utils');

  return {...actual, getErrorDetails: jest.fn(actual.getErrorDetails)};
});

describe('ApiAIAssistant', () => {
  let apiAIAssistant: ApiAIAssistant;
  let mockWebex: WebexSDK;
  let mockMetricsManager: jest.Mocked<MetricsManager>;
  let mockUploadLogs: jest.Mock;
  let wellnessContext: {
    isWellnessBreakEnabled: boolean;
    agentId?: string;
    agentSessionId?: string;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadLogs = jest.fn();

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

    jest.spyOn(WebexRequest, 'getInstance').mockReturnValue({
      request: mockWebex.request,
      uploadLogs: mockUploadLogs,
    } as any);

    mockMetricsManager = {
      trackEvent: jest.fn(),
      timeEvent: jest.fn(),
    } as unknown as jest.Mocked<MetricsManager>;
    (MetricsManager.getInstance as jest.Mock).mockReturnValue(mockMetricsManager);

    wellnessContext = {isWellnessBreakEnabled: false};
    apiAIAssistant = new ApiAIAssistant(mockWebex, () => wellnessContext);
  });

  describe('T-008/T-010 RTD ownership', () => {
    const flush = async () => {
      for (let i = 0; i < 12; i += 1) await Promise.resolve();
    };
    const deferred = <T>() => {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return {promise, resolve, reject};
    };
    const observeLateSettlement = async (settle: () => void) => {
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);
      try {
        settle();
        await flush();
        // Use a real event-loop turn while request deadlines remain under fake timers.
        await new Promise<void>((resolve) => jest.requireActual('timers').setImmediate(resolve));
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.removeListener('unhandledRejection', unhandled);
      }
    };
    const options = (signal?: AbortSignal) => ({
      signal,
      correlationId: 'conversation',
      rtdEventType: 'POST_CALL_SUMMARY',
      timeoutMs: 1000,
      createTimeoutError: () => new Error('TIMEOUT'),
      agentId: 'agent',
      interactionId: 'interaction',
      eventType: 'CTI_EVENT' as any,
      eventName: 'GET_POST_CALL_SUMMARY' as any,
    });
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      apiAIAssistant.clearAllRtdRequests();
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('captures the default publish timestamp when the RTD request starts', async () => {
      const startedAt = Date.now();
      (mockWebex.request as jest.Mock).mockResolvedValue({body: {accepted: true}});
      const request = apiAIAssistant.requestAndWaitForRtd(options());

      jest.setSystemTime(startedAt + 1_000);
      await flush();
      const payload = {summary: 'ready'};
      apiAIAssistant.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation', payload);

      await expect(request).resolves.toEqual(payload);
      const [{body}] = (mockWebex.request as jest.Mock).mock.calls[0];
      expect(body.publishTimestamp).toBe(startedAt);
    });

    it.each(['before', 'queued', 'pending'])('cancels an RTD request when abort occurs %s', async (phase) => {
      const controller = new AbortController();
      const http = deferred<unknown>();
      (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
      const add = jest.spyOn(controller.signal, 'addEventListener');
      const remove = jest.spyOn(controller.signal, 'removeEventListener');
      if (phase === 'before') controller.abort();

      const observed = expect(apiAIAssistant.requestAndWaitForRtd(options(controller.signal)))
        .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      if (phase === 'pending') await flush();
      controller.abort();
      await observed;
      expect(mockWebex.request).toHaveBeenCalledTimes(phase === 'pending' ? 1 : 0);
      expect(add).toHaveBeenCalledTimes(phase === 'before' ? 0 : 1);
      expect(remove.mock.calls).toEqual(add.mock.calls.map(([type, listener]) => [type, listener]));
      expect(jest.getTimerCount()).toBe(0);
      expect(apiAIAssistant['pendingRtdRequests'].size).toBe(0);
      if (phase === 'pending') await observeLateSettlement(() => http.reject(new Error('late HTTP')));
      expect(apiAIAssistant['pendingRtdRequests'].size).toBe(0);
      add.mockRestore();
      remove.mockRestore();
    });

    it.each(['success', 'rejection'])('full RTD clear is final after late HTTP %s', async (settlement) => {
      const http = deferred<unknown>();
      (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
      const controller = new AbortController();
      const remove = jest.spyOn(controller.signal, 'removeEventListener');
      const error = createRegionRecoveryError('RECOVERY_INTERRUPTED');
      const observed = expect(apiAIAssistant.requestAndWaitForRtd(options(controller.signal))).rejects.toBe(error);
      await flush();
      expect(mockWebex.request).toHaveBeenCalledTimes(1);

      apiAIAssistant.clearAllRtdRequests(() => error);
      await observed;
      await observeLateSettlement(() => {
        if (settlement === 'success') http.resolve({body: {accepted: true}});
        else http.reject(new Error('late HTTP failure'));
      });

      expect(remove).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
      expect(apiAIAssistant.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation', {})).toBe('not-found');
      remove.mockRestore();
    });

    it('stale ACK, deadline and abort cannot remove a same-key replacement', async () => {
      const oldHttp = deferred<unknown>();
      (mockWebex.request as jest.Mock)
        .mockReturnValueOnce(oldHttp.promise)
        .mockResolvedValueOnce({body: {accepted: true}});
      const controller = new AbortController();
      const timeout = jest.spyOn(global, 'setTimeout');
      const abort = jest.spyOn(controller.signal, 'addEventListener');
      const oldError = jest.fn(() => new Error('old timeout'));
      const old = apiAIAssistant.requestAndWaitForRtd({...options(controller.signal), createTimeoutError: oldError});
      const retired = expect(old).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      const staleTimeout = timeout.mock.calls[0][0] as () => void;
      const staleAbort = abort.mock.calls[0][1] as EventListener;
      await flush();

      const current = apiAIAssistant.requestAndWaitForRtd({...options(), timeoutMs: 2000});
      await retired;
      oldHttp.reject(new Error('stale HTTP failure'));
      staleTimeout();
      staleAbort(new Event('abort'));
      await flush();
      expect(mockWebex.request).toHaveBeenCalledTimes(2);
      expect(oldError).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(1);

      const payload = {summary: 'current'};
      expect(apiAIAssistant.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation', payload)).toBe('resolved');
      await expect(current).resolves.toEqual(payload);
      expect(jest.getTimerCount()).toBe(0);
      timeout.mockRestore();
      abort.mockRestore();
    });

    it('clears requests with independent recovery errors and preserves the default error', async () => {
      const first = apiAIAssistant.requestAndWaitForRtd(options()).catch((error) => error);
      const second = apiAIAssistant.requestAndWaitForRtd({...options(), correlationId: 'second'}).catch((error) => error);
      apiAIAssistant.clearAllRtdRequests(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
      const [a, b] = await Promise.all([first, second]);
      expect(a).not.toBe(b);
      expect(a.data).not.toBe(b.data);
      for (const error of [a, b]) expect(error.data.reason).toBe('RECOVERY_INTERRUPTED');

      const normal = expect(apiAIAssistant.requestAndWaitForRtd(options())).rejects.toThrow('RTD request cleared');
      apiAIAssistant.clearAllRtdRequests();
      await normal;
    });

    const httpBody = {interactionId: 'interaction', data: []};
    let recoverySignal: AbortSignal | undefined;
    let controller: AbortController;
    const createOwnedAssistant = () => {
      const instance = new ApiAIAssistant(
        mockWebex,
        () => ({isWellnessBreakEnabled: true, agentId: 'agent', agentSessionId: 'session'}),
        () => recoverySignal
      );
      instance.setAIFeatureFlags({realtimeTranscripts: {enable: true}, suggestedResponses: {enable: true}} as any);

      return instance;
    };
    const sendEvent = (instance: ApiAIAssistant) => instance.sendEvent(
      'agent', 'interaction', AIAssistantEventType.CUSTOM_EVENT, AIAssistantEventName.GET_TRANSCRIPTS
    );
    beforeEach(() => {
      controller = new AbortController();
      recoverySignal = controller.signal;
    });

    const wellnessOperations = [
      ['requestWellnessBreak', (instance: ApiAIAssistant) => instance.requestWellnessBreak()],
      ['respondToWellnessBreak', (instance: ApiAIAssistant) => instance.respondToWellnessBreak({action: WELLNESS_BREAK_USER_ACTIONS.ACCEPTED})],
    ] as const;

    it.each(wellnessOperations)('completes %s through HTTP while RTD is paused', async (_name, invoke) => {
      recoverySignal = undefined;
      (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});
      await expect(invoke(createOwnedAssistant())).resolves.toBeUndefined();
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
    });

    it.each(wellnessOperations)('allows a pending %s HTTP request to finish when RTD pauses', async (_name, invoke) => {
      const http = deferred<unknown>();
      (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
      const request = invoke(createOwnedAssistant());
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
      controller.abort();
      http.resolve({statusCode: 202});
      await expect(request).resolves.toBeUndefined();
    });

    it.each(['before', 'after'])('interrupts an RTD request %s its event while HTTP is pending', async (phase) => {
      const http = deferred<unknown>();
      (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
      const instance = createOwnedAssistant();
      const observed = expect(instance.requestAndWaitForRtd(options())).rejects.toMatchObject({
        data: {reason: 'RECOVERY_INTERRUPTED'},
      });
      await flush();
      if (phase === 'after') {
        expect(instance.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation', {})).toBe('resolved');
      }
      controller.abort();
      await observed;
      expect(instance.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation', {})).toBe('not-found');
      expect(jest.getTimerCount()).toBe(0);
      await observeLateSettlement(() => http.resolve({body: {accepted: true}}));
    });

    it('allows in-flight direct HTTP to finish after RTD cleanup', async () => {
      const http = deferred<unknown>();
      (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
      const instance = createOwnedAssistant();
      const event = sendEvent(instance);
      const rtd = expect(instance.requestAndWaitForRtd(options())).rejects.toThrow('RTD request cleared');
      instance.clearAllRtdRequests();
      await rtd;
      http.resolve({statusCode: 202, body: httpBody});
      await expect(event).resolves.toEqual(httpBody);
      expect(controller.signal.aborted).toBe(false);
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
    });

    it('passes through an HTTP recovery error with its diagnostic fields', async () => {
      const error = createRegionRecoveryError('RECOVERY_INTERRUPTED', {trackingId: 'tracking', status: 409});
      (mockWebex.request as jest.Mock).mockRejectedValue(error);
      await expect(sendEvent(createOwnedAssistant())).rejects.toBe(error);
      expect(error.data).toEqual({reason: 'RECOVERY_INTERRUPTED', trackingId: 'tracking', status: 409});
      expect(mockUploadLogs).not.toHaveBeenCalled();
    });

  });

  it('sends a summary request and resolves it from the matching RTD event', async () => {
    (mockWebex.request as jest.Mock).mockResolvedValue({body: {accepted: true}});

    const request = apiAIAssistant.requestAndWaitForRtd({
      correlationId: 'conversation-1',
      rtdEventType: 'POST_CALL_SUMMARY',
      timeoutMs: 15000,
      createTimeoutError: () => new Error('TIMEOUT'),
      agentId: 'agent-1',
      interactionId: 'interaction-1',
      eventType: 'CTI_EVENT' as any,
      eventName: 'GET_POST_CALL_SUMMARY' as any,
      eventMetaData: {conversationId: 'conversation-1'},
      timeout: 15000,
    });

    await Promise.resolve();
    expect(apiAIAssistant.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation-1', {summary: 'ready'})).toBe(
      'resolved'
    );
    await expect(request).resolves.toEqual({summary: 'ready'});
    expect(mockWebex.request).toHaveBeenCalledTimes(1);
    const requestBody = (mockWebex.request as jest.Mock).mock.calls[0][0].body;

    expect(requestBody.publishTimestamp).toEqual(expect.any(Number));
    expect(requestBody.eventDetails.data).toMatchObject({
      conversationId: 'conversation-1',
      interactionId: 'interaction-1',
      actionTimeStamp: expect.any(String),
    });
  });

  it('rejects an RTD request when its timeout expires', async () => {
    jest.useFakeTimers();
    (mockWebex.request as jest.Mock).mockResolvedValue({body: {accepted: true}});
    const request = apiAIAssistant.requestAndWaitForRtd({
      correlationId: 'conversation-1',
      rtdEventType: 'POST_CALL_SUMMARY',
      timeoutMs: 15000,
      createTimeoutError: () => new Error('TIMEOUT'),
      agentId: 'agent-1',
      interactionId: 'interaction-1',
      eventType: 'CTI_EVENT' as any,
      eventName: 'GET_POST_CALL_SUMMARY' as any,
    });

    jest.advanceTimersByTime(15000);
    await expect(request).rejects.toThrow('TIMEOUT');
    jest.useRealTimers();
  });

  it('removes the pending RTD request when the HTTP request fails', async () => {
    const error = new Error('HTTP_FAILED');
    (mockWebex.request as jest.Mock).mockRejectedValue(error);

    const request = apiAIAssistant.requestAndWaitForRtd({
      correlationId: 'conversation-1',
      rtdEventType: 'POST_CALL_SUMMARY',
      timeoutMs: 15000,
      createTimeoutError: () => new Error('TIMEOUT'),
      agentId: 'agent-1',
      interactionId: 'interaction-1',
      eventType: 'CTI_EVENT' as any,
      eventName: 'GET_POST_CALL_SUMMARY' as any,
    });

    await expect(request).rejects.toBeInstanceOf(Error);
    expect(apiAIAssistant.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation-1', {})).toBe(
      'not-found'
    );
  });


  it('should send transcript start event successfully', async () => {
    (mockWebex.request as jest.Mock).mockResolvedValue({body: {ok: true}});

    const result = await apiAIAssistant.sendEvent(
      'test-agent-id',
      'interaction-1',
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      {action: 'START', actionTimeStamp: 'caller-supplied'}
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
    expect(requestArgs.body.eventDetails.data.actionTimeStamp).toEqual(expect.any(String));
    expect(requestArgs.body.eventDetails.data.actionTimeStamp).not.toBe('caller-supplied');
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

  it('rejects an invalid agentId/interactionId and does not call webex.request', async () => {
    apiAIAssistant.setAIFeatureFlags({realtimeTranscripts: {enable: true}} as any);

    await expect(
      apiAIAssistant.fetchHistoricTranscripts('', 'interaction-1')
    ).rejects.toBeDefined();
    await expect(
      apiAIAssistant.fetchHistoricTranscripts('test-agent-id', 'bad id!')
    ).rejects.toBeDefined();

    expect(mockWebex.request).not.toHaveBeenCalled();
  });

  it('should request real-time assistance without extra context using sendEvent', async () => {
    const sendEventSpy = jest.spyOn(apiAIAssistant, 'sendEvent').mockResolvedValue({ok: true});
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: true}} as any);

    const result = await apiAIAssistant.getRealTimeAssistance({
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

  it('should request real-time assistance with extra context using sendEvent', async () => {
    const sendEventSpy = jest.spyOn(apiAIAssistant, 'sendEvent').mockResolvedValue({ok: true});
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: true}} as any);

    const result = await apiAIAssistant.getRealTimeAssistance({
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

    const result = await apiAIAssistant.getRealTimeAssistance({
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
    RealTimeAssistanceUserActionId.LIKE,
    RealTimeAssistanceUserActionId.DISLIKE,
    RealTimeAssistanceUserActionId.COPY,
  ].forEach((actionId) => {
    it(`should send real-time assistance user action for ${actionId}`, async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue({body: {ok: true}});
      apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: true}} as any);

      const result = await apiAIAssistant.sendRealTimeAssistanceUserAction({
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

  it('should fail when real-time assistance feature is disabled', async () => {
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: false}} as any);
    let errorMessage = '';

    try {
      await apiAIAssistant.getRealTimeAssistance({
        agentId: 'test-agent-id',
        interactionId: 'interaction-1',
      });
    } catch (error) {
      errorMessage = (error as Error)?.message || '';
    }

    expect(errorMessage).toBe('Error while performing getRealTimeAssistance');
  });

  it('should fail to send real-time assistance user action when feature is disabled', async () => {
    apiAIAssistant.setAIFeatureFlags({suggestedResponses: {enable: false}} as any);
    let errorMessage = '';

    try {
      await apiAIAssistant.sendRealTimeAssistanceUserAction({
        agentId: 'test-agent-id',
        interactionId: 'interaction-1',
        adaptiveCardId: 'adaptive-card-1',
        actionId: RealTimeAssistanceUserActionId.LIKE,
      });
    } catch (error) {
      errorMessage = (error as Error)?.message || '';
    }

    expect(errorMessage).toBe('Error while performing sendRealTimeAssistanceUserAction');
  });

  describe('Agent Wellness Break actions', () => {
    beforeEach(() => {
      wellnessContext = {
        isWellnessBreakEnabled: true,
        agentId: 'test-agent-id',
        agentSessionId: 'session-1',
      };
    });

    it('does not expose wellness context mutation on the public assistant instance', () => {
      expect(apiAIAssistant).not.toHaveProperty('setWellnessContext');
    });

    it('sends the exact REQUESTED body and resolves only for HTTP 202', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1787640000000);
      (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});

      await expect(apiAIAssistant.requestWellnessBreak()).resolves.toBeUndefined();

      expect(mockWebex.request).toHaveBeenCalledWith({
        uri: 'https://api-ai-assistant.produs1.ciscoccservice.com/event',
        method: HTTP_METHODS.POST,
        addAuthHeader: true,
        body: {
          agentId: 'test-agent-id',
          orgId: 'test-org-id',
          eventType: 'CUSTOM_EVENT',
          eventName: 'WellnessBreakAction',
          eventDetails: {
            data: {
              action: 'REQUESTED',
              agentSessionId: 'session-1',
              actionTimeStamp: 1787640000000,
            },
          },
        },
      });
    });

    it.each([
      WELLNESS_BREAK_USER_ACTIONS.ACCEPTED,
      WELLNESS_BREAK_USER_ACTIONS.REJECTED,
      WELLNESS_BREAK_USER_ACTIONS.NO_RESPONSE,
    ] as const)(
      'sends the %s offer action',
      async (action) => {
        (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});

        await apiAIAssistant.respondToWellnessBreak({action});

        expect(
          (mockWebex.request as jest.Mock).mock.calls[0][0].body.eventDetails.data.action
        ).toBe(action);
      }
    );

    it('rejects disabled or incomplete internal session context before HTTP', async () => {
      wellnessContext = {
        isWellnessBreakEnabled: false,
        agentId: 'test-agent-id',
        agentSessionId: 'session-1',
      };
      await expect(apiAIAssistant.requestWellnessBreak()).rejects.toThrow(
        'WELLNESS_BREAK_NOT_ENABLED'
      );

      wellnessContext = {
        isWellnessBreakEnabled: true,
      };
      await expect(apiAIAssistant.requestWellnessBreak()).rejects.toThrow(
        'WELLNESS_BREAK_AGENT_ID_REQUIRED'
      );

      wellnessContext = {
        isWellnessBreakEnabled: true,
        agentId: 'test-agent-id',
      };
      await expect(apiAIAssistant.requestWellnessBreak()).rejects.toThrow(
        'WELLNESS_BREAK_AGENT_SESSION_REQUIRED'
      );
      expect(mockWebex.request).not.toHaveBeenCalled();
    });

    it('rejects a missing organization before HTTP', async () => {
      (mockWebex.credentials.getOrgId as jest.Mock).mockReturnValue('   ');

      await expect(apiAIAssistant.requestWellnessBreak()).rejects.toThrow(
        'WELLNESS_BREAK_ORG_ID_REQUIRED'
      );
      expect(mockWebex.request).not.toHaveBeenCalled();
    });

    it.each([200, 204, 400, 401, 403, 404, 409, 429, 500])(
      'rejects the non-202 HTTP status %i',
      async (statusCode) => {
        (mockWebex.request as jest.Mock).mockResolvedValue({statusCode});

        await expect(apiAIAssistant.requestWellnessBreak()).rejects.toThrow(
          `WELLNESS_BREAK_ACTION_UNEXPECTED_STATUS_${statusCode}`
        );
      }
    );

    it('rejects network failures through the structured error path', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Network unavailable'));

      await expect(apiAIAssistant.requestWellnessBreak()).rejects.toThrow(
        'Error while performing requestWellnessBreak'
      );
    });

    it('rejects unsupported offer actions before HTTP', async () => {
      await expect(
        apiAIAssistant.respondToWellnessBreak({
          action: 'REQUESTED',
        } as unknown as Parameters<ApiAIAssistant['respondToWellnessBreak']>[0])
      ).rejects.toThrow('WELLNESS_BREAK_ACTION_INVALID');
      expect(mockWebex.request).not.toHaveBeenCalled();
    });
  });
});
