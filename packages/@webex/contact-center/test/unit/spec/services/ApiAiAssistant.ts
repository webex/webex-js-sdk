import ApiAIAssistant from '../../../../src/services/ApiAiAssistant';
import {
  AI_SUMMARY_HTTP_TIMEOUT_MS,
  AI_SUMMARY_TRANSPORT_ERROR_CODES,
} from '../../../../src/services/ApiAiAssistant';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import {getErrorDetails} from '../../../../src/services/core/Utils';
import {
  AIAssistantEventName,
  AIAssistantEventType,
  HTTP_METHODS,
  WebexSDK,
} from '../../../../src/types';
import {
  AI_ASSISTANT_CLIENT_TYPE,
  AI_SUMMARY_ERROR_CODES,
  CC_FILE,
  METHODS,
} from '../../../../src/constants';

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
jest.mock('../../../../src/services/core/Utils', () => ({
  __esModule: true,
  getErrorDetails: jest.fn((error: any, methodName: string, moduleName: string) => {
    const LoggerProxyMock = require('../../../../src/logger-proxy').default;
    const reason = error?.details?.data?.reason ?? `Error while performing ${methodName}`;
    const detailedError = new Error(reason) as Error & {data?: Record<string, unknown>};

    detailedError.data = {};
    LoggerProxyMock.error(`${methodName} failed with reason: ${reason}`, {
      module: moduleName,
      method: methodName,
    });

    return {error: detailedError, reason};
  }),
}));

describe('ApiAIAssistant', () => {
  let apiAIAssistant: ApiAIAssistant;
  let mockWebex: WebexSDK;
  let mockMetricsManager: jest.Mocked<MetricsManager>;
  let mockUploadLogs: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadLogs = jest.fn();
    jest.spyOn(WebexRequest, 'getInstance').mockReturnValue({
      uploadLogs: mockUploadLogs,
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

  const projectDiagnosticValue = (
    value: unknown,
    seen = new WeakSet<object>()
  ): unknown => {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (value instanceof Error) {
      const projectedError: Record<string, unknown> = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };

      if (Object.prototype.hasOwnProperty.call(value, 'cause')) {
        projectedError.cause = projectDiagnosticValue(
          (value as Error & {cause?: unknown}).cause,
          seen
        );
      }

      Object.keys(value).forEach((key) => {
        projectedError[key] = projectDiagnosticValue(
          (value as unknown as Record<string, unknown>)[key],
          seen
        );
      });

      return projectedError;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => projectDiagnosticValue(entry, seen));
    }

    return Object.keys(value).reduce<Record<string, unknown>>((projected, key) => {
      projected[key] = projectDiagnosticValue(
        (value as Record<string, unknown>)[key],
        seen
      );

      return projected;
    }, {});
  };

  const serializeDiagnostics = (...surfaces: unknown[]) =>
    JSON.stringify(projectDiagnosticValue(surfaces));

  const expectOwnPropertiesAbsent = (value: object, propertyNames: readonly string[]) => {
    propertyNames.forEach((propertyName) => {
      expect(Object.prototype.hasOwnProperty.call(value, propertyName)).toBe(false);
    });
  };

  const PROHIBITED_ERROR_PROPERTIES = [
    'request',
    'options',
    'body',
    'response',
    'details',
    'cause',
  ] as const;

  const expectSummaryError = async (promise: Promise<unknown>, errorCode: string) => {
    const caughtError = await promise.then(
      () => {
        throw new Error(`Expected summary operation to reject with ${errorCode}, but it resolved`);
      },
      (error) => error as Error & {data?: Record<string, unknown>}
    );

    expect(caughtError.message).toBe(errorCode);
    expect(caughtError.data?.errorCode).toBe(errorCode);

    return caughtError;
  };

  const expectedGetBody = (eventName: string, timestamp: number) => ({
    agentId: 'test-agent-id',
    orgId: 'test-org-id',
    eventType: AIAssistantEventType.CTI_EVENT,
    eventName,
    publishTimestamp: timestamp,
    eventDetails: {
      data: {
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        clientType: AI_ASSISTANT_CLIENT_TYPE,
        actionTimeStamp: timestamp,
      },
    },
  });

  const expectedResponseBody = (
    eventName: AIAssistantEventName,
    publishTimestamp: number,
    actionTimeStamp: number,
    responseData: Record<string, unknown>
  ) => ({
    agentId: 'test-agent-id',
    orgId: 'test-org-id',
    eventType: AIAssistantEventType.CTI_EVENT,
    eventName,
    publishTimestamp,
    eventDetails: {
      data: {
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        clientType: AI_ASSISTANT_CLIENT_TYPE,
        actionTimeStamp,
        action: eventName,
        ...responseData,
      },
    },
  });

  const AI_SUMMARY_EVENT_URI = 'https://api-ai-assistant.produs1.ciscoccservice.com/event';
  const GET_FLOW_INVALID_DATA_KEYS = [
    'action',
    'summary',
    'numberOfTimesViewed',
    'numberOfTimesEdited',
    'numberOfTimesCopied',
    'feedback',
    'state',
    'wrapUpCode',
    'agentName',
    'summaryReceived',
  ] as const;
  const POST_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS = ['agentName', 'summaryReceived'] as const;
  const MID_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS = ['wrapUpCode', 'summaryReceived'] as const;

  const expectDataPropertiesAbsent = (data: object, propertyNames: readonly string[]) => {
    propertyNames.forEach((propertyName) => {
      expect(data).not.toHaveProperty(propertyName);
    });
  };

  const expectOneSummaryPostRequest = (body: Record<string, unknown>) => {
    expect(mockWebex.request).toHaveBeenCalledTimes(1);
    const request = (mockWebex.request as jest.Mock).mock.calls[0][0];

    expect(request).toStrictEqual({
      uri: AI_SUMMARY_EVENT_URI,
      method: HTTP_METHODS.POST,
      addAuthHeader: true,
      timeout: AI_SUMMARY_HTTP_TIMEOUT_MS,
      body,
    });

    return request;
  };

  const validMidCallResponsePayload = (overrides: Record<string, unknown> = {}) =>
    ({
      agentId: 'payload-agent-id',
      interactionId: 'interaction-1',
      conversationId: 'conversation-1',
      eventName: AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
      summary: '',
      feedback: 'none',
      state: 'NOT_RECEIVED',
      agentName: 'Agent One',
      numberOfTimesViewed: 0,
      numberOfTimesEdited: 0,
      numberOfTimesCopied: 0,
      ...overrides,
    } as Parameters<ApiAIAssistant['sendSummaryResponseEvent']>[1]);

  const validPostCallResponsePayload = (overrides: Record<string, unknown> = {}) =>
    ({
      agentId: 'payload-agent-id',
      interactionId: 'interaction-1',
      conversationId: 'conversation-1',
      eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
      summary: '',
      feedback: 'none',
      state: 'NOT_RECEIVED',
      wrapUpCode: 'unavailable',
      numberOfTimesViewed: 0,
      numberOfTimesEdited: 0,
      numberOfTimesCopied: 0,
      ...overrides,
    } as Parameters<ApiAIAssistant['sendSummaryResponseEvent']>[1]);

  const getLastErrorDetailsCall = () => {
    const calls = (getErrorDetails as jest.Mock).mock.calls;

    return calls[calls.length - 1];
  };

  describe('summary transport', () => {
    const summaryGetEventNames: Array<Parameters<ApiAIAssistant['sendSummaryGetEvent']>[3]> = [
      AIAssistantEventName.GET_POST_CALL_SUMMARY,
      AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY,
      AIAssistantEventName.GET_MID_CALL_TRANSFER_SUMMARY,
    ];

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it.each([
      {
        label: 'get',
        invoke: () =>
          apiAIAssistant.sendSummaryGetEvent(
            'test-agent-id',
            'interaction-1',
            'conversation-1',
            AIAssistantEventName.GET_POST_CALL_SUMMARY
          ),
      },
      {
        label: 'response',
        invoke: () =>
          apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validMidCallResponsePayload()
          ),
      },
    ])('clears the bounded timer after a successful $label request', async ({invoke}) => {
      jest.useFakeTimers();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234);
      (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});

      await expect(invoke()).resolves.toBeUndefined();

      expect(nowSpy).toHaveBeenCalledTimes(1);
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each([
      {
        label: 'get',
        invoke: () =>
          apiAIAssistant.sendSummaryGetEvent(
            'test-agent-id',
            'interaction-1',
            'conversation-1',
            AIAssistantEventName.GET_POST_CALL_SUMMARY
          ),
      },
      {
        label: 'response',
        invoke: () =>
          apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validMidCallResponsePayload()
          ),
      },
    ])('clears the bounded timer after a failed $label request', async ({invoke}) => {
      jest.useFakeTimers();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(4321);
      (mockWebex.request as jest.Mock).mockRejectedValue({statusCode: 503});

      await expectSummaryError(invoke(), AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED);

      expect(nowSpy).toHaveBeenCalledTimes(1);
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(summaryGetEventNames)(
      'serializes %s summary get events through one bounded POST',
      async (eventName) => {
        jest.spyOn(Date, 'now').mockReturnValue(1234);
        (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});

        await expect(
          apiAIAssistant.sendSummaryGetEvent(
            'test-agent-id',
            'interaction-1',
            'conversation-1',
            eventName
          )
        ).resolves.toBeUndefined();

        const request = expectOneSummaryPostRequest(expectedGetBody(eventName, 1234));
        expectDataPropertiesAbsent(
          request.body.eventDetails.data,
          GET_FLOW_INVALID_DATA_KEYS
        );
      }
    );

    it.each(summaryGetEventNames)(
      'rejects %s HTTP failures after one bounded POST attempt',
      async (eventName) => {
        jest.spyOn(Date, 'now').mockReturnValue(4321);
        (mockWebex.request as jest.Mock).mockRejectedValue({statusCode: 503});

        await expectSummaryError(
          apiAIAssistant.sendSummaryGetEvent(
            'test-agent-id',
            'interaction-1',
            'conversation-1',
            eventName
          ),
          AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED
        );

        expectOneSummaryPostRequest(expectedGetBody(eventName, 4321));
      }
    );

    it('classifies exact ETIMEDOUT request errors as transport timeouts', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue({code: 'ETIMEDOUT'});

      await expectSummaryError(
        apiAIAssistant.sendSummaryGetEvent(
          'test-agent-id',
          'interaction-1',
          'conversation-1',
          AIAssistantEventName.GET_POST_CALL_SUMMARY
        ),
        AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT
      );
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
    });

    it('does not classify an HTTP failure as timeout from its message string', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue({
        message: AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT,
        statusCode: 503,
      });

      const caughtError = await expectSummaryError(
        apiAIAssistant.sendSummaryGetEvent(
          'test-agent-id',
          'interaction-1',
          'conversation-1',
          AIAssistantEventName.GET_POST_CALL_SUMMARY
        ),
        AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED
      );

      expect(caughtError.data?.statusCode).toBe(503);
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['finite zero', 0, 0],
      ['finite server error', 503, 503],
      ['NaN', Number.NaN, undefined],
      ['Infinity', Number.POSITIVE_INFINITY, undefined],
      ['negative', -1, undefined],
      ['string', '503', undefined],
      ['null', null, undefined],
    ] as const)(
      'projects %s statusCode only when it is finite and non-negative',
      async (_label, statusCode, expectedStatusCode) => {
        (mockWebex.request as jest.Mock).mockRejectedValue({statusCode});

        const caughtError = await expectSummaryError(
          apiAIAssistant.sendSummaryGetEvent(
            'test-agent-id',
            'interaction-1',
            'conversation-1',
            AIAssistantEventName.GET_POST_CALL_SUMMARY
          ),
          AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED
        );
        const [errorArg] = getLastErrorDetailsCall();

        if (expectedStatusCode === undefined) {
          expect(caughtError.data).not.toHaveProperty('statusCode');
          expect(errorArg).not.toHaveProperty('statusCode');
        } else {
          expect(caughtError.data?.statusCode).toBe(expectedStatusCode);
          expect(errorArg.statusCode).toBe(expectedStatusCode);
        }
        expect(mockWebex.request).toHaveBeenCalledTimes(1);
      }
    );

    it('normalizes synchronous request adapter failures through the safe diagnostic projection', async () => {
      const sentinelSummary = 'sync-summary-sentinel';
      const sentinelSectionKey = 'syncSectionKeySentinel';
      const sentinelSectionValue = 'sync-section-value-sentinel';
      const sentinelAgentName = 'sync-agent-name-sentinel';
      const originalError = {
        statusCode: 502,
        message: sentinelSummary,
        stack: sentinelSectionValue,
        request: {body: {[sentinelSectionKey]: sentinelSectionValue}},
        options: {body: {agentName: sentinelAgentName}},
        details: {data: {reason: sentinelSummary}},
      };
      (mockWebex.request as jest.Mock).mockImplementation(() => {
        throw originalError;
      });

      const caughtError = await expectSummaryError(
        apiAIAssistant.sendSummaryResponseEvent('test-agent-id', {
          agentId: 'payload-agent-id',
          interactionId: 'interaction-1',
          conversationId: 'conversation-1',
          eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
          summary: {[sentinelSectionKey]: sentinelSectionValue},
          feedback: 'none',
          state: 'DEFAULT',
          agentName: sentinelAgentName,
          numberOfTimesViewed: 1,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
        }),
        AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED
      );

      expect(mockWebex.request).toHaveBeenCalledTimes(1);
      expect(caughtError.data?.statusCode).toBe(502);
      const [errorArg, methodName, moduleName, options] = getLastErrorDetailsCall();
      expect(errorArg).toStrictEqual({
        statusCode: 502,
        details: {
          data: {
            reason: AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED,
            methodName: METHODS.SEND_SUMMARY_RESPONSE_EVENT,
            eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
            agentId: 'test-agent-id',
            orgId: 'test-org-id',
            interactionId: 'interaction-1',
            conversationId: 'conversation-1',
          },
        },
      });
      expect(methodName).toBe(METHODS.SEND_SUMMARY_RESPONSE_EVENT);
      expect(moduleName).toBe(CC_FILE);
      expect(options).toStrictEqual({uploadLogs: false});
      expect(mockUploadLogs).not.toHaveBeenCalled();

      expectOwnPropertiesAbsent(caughtError, PROHIBITED_ERROR_PROPERTIES);
      expectOwnPropertiesAbsent(caughtError.data ?? {}, PROHIBITED_ERROR_PROPERTIES);

      const diagnostics = serializeDiagnostics(
        caughtError,
        (LoggerProxy.error as jest.Mock).mock.calls,
        (getErrorDetails as jest.Mock).mock.calls
      );
      [sentinelSummary, sentinelSectionKey, sentinelSectionValue, sentinelAgentName].forEach(
        (sentinel) => {
          expect(diagnostics).not.toContain(sentinel);
        }
      );
    });

    it('normalizes synchronous credential failures through validation diagnostics', async () => {
      const credentialSentinel = 'credential-secret-sentinel';
      (mockWebex.credentials.getOrgId as jest.Mock).mockImplementation(() => {
        throw Object.assign(new Error(credentialSentinel), {
          options: {body: {orgId: credentialSentinel}},
        });
      });

      const result = apiAIAssistant.sendSummaryGetEvent(
        'test-agent-id',
        'interaction-1',
        'conversation-1',
        AIAssistantEventName.GET_POST_CALL_SUMMARY
      );

      expect(result).toBeInstanceOf(Promise);
      await expectSummaryError(result, AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED);
      expect(mockWebex.request).not.toHaveBeenCalled();

      const [errorArg, methodName, moduleName, options] = getLastErrorDetailsCall();
      expect(errorArg).toStrictEqual({
        details: {
          data: {
            reason: AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED,
            methodName: METHODS.SEND_SUMMARY_GET_EVENT,
          },
        },
      });
      expect(methodName).toBe(METHODS.SEND_SUMMARY_GET_EVENT);
      expect(moduleName).toBe(CC_FILE);
      expect(options).toStrictEqual({uploadLogs: false});
      expect(mockUploadLogs).not.toHaveBeenCalled();
      expect(
        serializeDiagnostics(
          errorArg,
          (LoggerProxy.error as jest.Mock).mock.calls,
          (getErrorDetails as jest.Mock).mock.calls
        )
      ).not.toContain(credentialSentinel);
    });

    it('serializes post-call responses with supplied independent timestamps only', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});

      await apiAIAssistant.sendSummaryResponseEvent('test-agent-id', {
        agentId: 'payload-agent-id',
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
        summary: {initialContactReason: 'billing'},
        feedback: 'thumbs_up',
        state: 'DEFAULT',
        wrapUpCode: 'resolved',
        numberOfTimesViewed: 2,
        numberOfTimesEdited: 1,
        numberOfTimesCopied: 3,
        actionTimeStamp: 111,
        publishTimestamp: 222,
      });

      const expectedBody = expectedResponseBody(
        AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
        222,
        111,
        {
          summary: {initialContactReason: 'billing'},
          numberOfTimesViewed: 2,
          numberOfTimesEdited: 1,
          numberOfTimesCopied: 3,
          feedback: 'thumbs_up',
          state: 'DEFAULT',
          wrapUpCode: 'resolved',
        }
      );
      const request = expectOneSummaryPostRequest(expectedBody);
      expectDataPropertiesAbsent(
        request.body.eventDetails.data,
        POST_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS
      );
    });

    it.each([
      {
        label: 'post-call',
        payload: validPostCallResponsePayload({
          summary: 'Caller reported a billing discrepancy.',
          feedback: 'thumbs_up',
          state: 'DEFAULT',
          wrapUpCode: 'resolved',
          numberOfTimesViewed: 2,
          numberOfTimesEdited: 1,
          numberOfTimesCopied: 3,
          actionTimeStamp: 111,
          publishTimestamp: 222,
        }),
        expectedBody: expectedResponseBody(
          AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
          222,
          111,
          {
            summary: 'Caller reported a billing discrepancy.',
            numberOfTimesViewed: 2,
            numberOfTimesEdited: 1,
            numberOfTimesCopied: 3,
            feedback: 'thumbs_up',
            state: 'DEFAULT',
            wrapUpCode: 'resolved',
          }
        ),
        invalidDataKeys: POST_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS,
      },
      {
        label: 'mid-call',
        payload: validMidCallResponsePayload({
          eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
          summary: 'Caller reported a billing discrepancy.',
          feedback: 'thumbs_down',
          state: 'DEFAULT',
          agentName: 'Agent One',
          numberOfTimesViewed: 2,
          numberOfTimesEdited: 1,
          numberOfTimesCopied: 3,
          actionTimeStamp: 333,
          publishTimestamp: 444,
        }),
        expectedBody: expectedResponseBody(
          AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
          444,
          333,
          {
            summary: 'Caller reported a billing discrepancy.',
            numberOfTimesViewed: 2,
            numberOfTimesEdited: 1,
            numberOfTimesCopied: 3,
            feedback: 'thumbs_down',
            state: 'DEFAULT',
            agentName: 'Agent One',
          }
        ),
        invalidDataKeys: MID_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS,
      },
    ])('serializes $label plain-text response summaries unchanged', async ({payload, expectedBody, invalidDataKeys}) => {
      (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});

      await apiAIAssistant.sendSummaryResponseEvent('test-agent-id', payload);

      const request = expectOneSummaryPostRequest(expectedBody);

      expect(request.body.eventDetails.data.summary).toBe('Caller reported a billing discrepancy.');
      expectDataPropertiesAbsent(request.body.eventDetails.data, invalidDataKeys);
    });

    it.each([
      [AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE, 'NOT_RECEIVED'],
      [AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE, 'MID_CALL_CANCELLED'],
      [AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE, 'NOT_RECEIVED'],
      [AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE, 'MID_CALL_CANCELLED'],
    ] as const)('serializes %s %s mid-call responses without wrapUpCode or summaryReceived', async (eventName, state) => {
      (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});
      jest.spyOn(Date, 'now').mockReturnValue(555);

      await apiAIAssistant.sendSummaryResponseEvent('test-agent-id', {
        agentId: 'payload-agent-id',
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        eventName,
        summary: '',
        feedback: 'none',
        state,
        agentName: 'Agent One',
        numberOfTimesViewed: 0,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
        publishTimestamp: 777,
      });

      const expectedBody = expectedResponseBody(eventName, 777, 555, {
        summary: '',
        numberOfTimesViewed: 0,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
        feedback: 'none',
        state,
        agentName: 'Agent One',
      });
      const request = expectOneSummaryPostRequest(expectedBody);
      const data = request.body.eventDetails.data;

      expect(data.actionTimeStamp).toBe(555);
      expectDataPropertiesAbsent(data, MID_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS);
    });

    it.each([
      {
        label: 'post-call NOT_RECEIVED',
        payload: validPostCallResponsePayload({
          actionTimeStamp: 101,
          publishTimestamp: 202,
          agentName: 'Post Call Agent',
          summaryReceived: false,
        }),
        expectedBody: expectedResponseBody(
          AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
          202,
          101,
          {
            summary: '',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
            feedback: 'none',
            state: 'NOT_RECEIVED',
            wrapUpCode: 'unavailable',
          }
        ),
        invalidDataKeys: POST_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS,
      },
      {
        label: 'mid-call summaryReceived:false',
        payload: validMidCallResponsePayload({
          eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
          summaryReceived: false,
          actionTimeStamp: 303,
          publishTimestamp: 404,
        }),
        expectedBody: expectedResponseBody(
          AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
          404,
          303,
          {
            summary: '',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
            feedback: 'none',
            state: 'NOT_RECEIVED',
            agentName: 'Agent One',
          }
        ),
        invalidDataKeys: MID_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS,
      },
    ])('serializes $label response body with required identifiers', async ({payload, expectedBody, invalidDataKeys}) => {
      (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});

      await apiAIAssistant.sendSummaryResponseEvent('test-agent-id', payload);

      const request = expectOneSummaryPostRequest(expectedBody);
      expectDataPropertiesAbsent(request.body.eventDetails.data, invalidDataKeys);
    });

    it.each([
      {
        label: 'action-only',
        timestamps: {actionTimeStamp: 111},
        expectedActionTimeStamp: 111,
        expectedPublishTimestamp: 999,
      },
      {
        label: 'publish-only',
        timestamps: {publishTimestamp: 222},
        expectedActionTimeStamp: 999,
        expectedPublishTimestamp: 222,
      },
      {
        label: 'both omitted',
        timestamps: {},
        expectedActionTimeStamp: 999,
        expectedPublishTimestamp: 999,
      },
    ])(
      'serializes post-call $label timestamp fallback without agentName',
      async ({timestamps, expectedActionTimeStamp, expectedPublishTimestamp}) => {
        (mockWebex.request as jest.Mock).mockResolvedValue({statusCode: 202});
        jest.spyOn(Date, 'now').mockReturnValue(999);

        await apiAIAssistant.sendSummaryResponseEvent(
          'test-agent-id',
          validPostCallResponsePayload({
            ...timestamps,
            agentName: 'Post Call Agent',
          })
        );

        const request = expectOneSummaryPostRequest(
          expectedResponseBody(
            AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
            expectedPublishTimestamp,
            expectedActionTimeStamp,
            {
              summary: '',
              numberOfTimesViewed: 0,
              numberOfTimesEdited: 0,
              numberOfTimesCopied: 0,
              feedback: 'none',
              state: 'NOT_RECEIVED',
              wrapUpCode: 'unavailable',
            }
          )
        );

        expectDataPropertiesAbsent(
          request.body.eventDetails.data,
          POST_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS
        );
      }
    );

    it.each([
      ['agentId', '', 'interaction-1', 'conversation-1', AIAssistantEventName.GET_POST_CALL_SUMMARY],
      ['interactionId', 'test-agent-id', '', 'conversation-1', AIAssistantEventName.GET_POST_CALL_SUMMARY],
      ['conversationId', 'test-agent-id', 'interaction-1', '', AIAssistantEventName.GET_POST_CALL_SUMMARY],
      ['eventName', 'test-agent-id', 'interaction-1', 'conversation-1', AIAssistantEventName.GET_MID_CALL_SUMMARY],
      [
        'response eventName',
        'test-agent-id',
        'interaction-1',
        'conversation-1',
        AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
      ],
    ])('rejects invalid GET %s before HTTP as a Promise rejection', async (_field, agentId, interactionId, conversationId, eventName) => {
      const result = apiAIAssistant.sendSummaryGetEvent(
        agentId,
        interactionId,
        conversationId,
        eventName as any
      );

      expect(result).toBeInstanceOf(Promise);
      await expectSummaryError(result, AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED);
      expect(mockWebex.request).not.toHaveBeenCalled();
    });

    it('rejects empty derived GET orgId before HTTP as a Promise rejection', async () => {
      (mockWebex.credentials.getOrgId as jest.Mock).mockReturnValue('');

      const result = apiAIAssistant.sendSummaryGetEvent(
        'test-agent-id',
        'interaction-1',
        'conversation-1',
        AIAssistantEventName.GET_POST_CALL_SUMMARY
      );

      expect(result).toBeInstanceOf(Promise);
      await expectSummaryError(result, AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED);
      expect(mockWebex.request).not.toHaveBeenCalled();
    });

    it.each([
      [
        'agentId',
        () => apiAIAssistant.sendSummaryResponseEvent('', validMidCallResponsePayload()),
      ],
      [
        'interactionId',
        () =>
          apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validMidCallResponsePayload({interactionId: ''})
          ),
      ],
      [
        'conversationId',
        () =>
          apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validMidCallResponsePayload({conversationId: ''})
          ),
      ],
      [
        'derived orgId',
        () => {
          (mockWebex.credentials.getOrgId as jest.Mock).mockReturnValue('');

          return apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validMidCallResponsePayload()
          );
        },
      ],
      [
        'GET eventName',
        () =>
          apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validMidCallResponsePayload({
              eventName: AIAssistantEventName.GET_POST_CALL_SUMMARY,
            })
          ),
      ],
    ])(
      'rejects invalid response %s before HTTP as a Promise rejection',
      async (_field, sendInvalidResponseEvent) => {
        const result = sendInvalidResponseEvent();

        expect(result).toBeInstanceOf(Promise);
        await expectSummaryError(result, AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED);
        expect(mockWebex.request).not.toHaveBeenCalled();
      }
    );

    it.each([
      {
        label: 'GET',
        sendSummaryOperation: () =>
          apiAIAssistant.sendSummaryGetEvent(
            '',
            'interaction-1',
            'conversation-1',
            AIAssistantEventName.GET_POST_CALL_SUMMARY
          ),
      },
      {
        label: 'response',
        sendSummaryOperation: () =>
          apiAIAssistant.sendSummaryResponseEvent('', validMidCallResponsePayload()),
      },
    ])(
      'rejects invalid $label input before unavailable base URL resolution',
      async ({sendSummaryOperation}) => {
        (mockWebex.internal.services.get as jest.Mock).mockReturnValue(
          'https://unknown-host.invalid'
        );

        const result = sendSummaryOperation();

        expect(result).toBeInstanceOf(Promise);
        await expectSummaryError(result, AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED);
        expect(mockWebex.internal.services.get).not.toHaveBeenCalled();
        expect(mockWebex.request).not.toHaveBeenCalled();
      }
    );

    it.each([
      ['numberOfTimesViewed', '123'],
      ['numberOfTimesViewed', Number.NaN],
      ['numberOfTimesViewed', Number.POSITIVE_INFINITY],
      ['numberOfTimesViewed', -1],
      ['numberOfTimesEdited', '123'],
      ['numberOfTimesEdited', Number.NaN],
      ['numberOfTimesEdited', Number.POSITIVE_INFINITY],
      ['numberOfTimesEdited', -1],
      ['numberOfTimesCopied', '123'],
      ['numberOfTimesCopied', Number.NaN],
      ['numberOfTimesCopied', Number.POSITIVE_INFINITY],
      ['numberOfTimesCopied', -1],
      ['feedback', 'other'],
    ] as const)(
      'rejects invalid response %s value %p before HTTP',
      async (field, value) => {
        await expectSummaryError(
          apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validPostCallResponsePayload({summary: 'summary', state: 'DEFAULT', [field]: value})
          ),
          AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED
        );
        expect(mockWebex.request).not.toHaveBeenCalled();
      }
    );

    it.each(
      (['actionTimeStamp', 'publishTimestamp'] as const).flatMap((field) =>
        [
          ['NaN', Number.NaN],
          ['Infinity', Number.POSITIVE_INFINITY],
          ['negative', -1],
          ['non-number', '123'],
        ].map(([label, value]) => [field, label, value] as const)
      )
    )(
      'rejects invalid response %s %s before base URL resolution or HTTP',
      async (field, _label, value) => {
        const result = apiAIAssistant.sendSummaryResponseEvent(
          'test-agent-id',
          validPostCallResponsePayload({summary: 'summary', state: 'DEFAULT', [field]: value})
        );

        expect(result).toBeInstanceOf(Promise);
        await expectSummaryError(result, AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED);
        expect(mockWebex.internal.services.get).not.toHaveBeenCalled();
        expect(mockWebex.request).not.toHaveBeenCalled();
      }
    );

    it.each([
      {
        label: 'get',
        invoke: () =>
          apiAIAssistant.sendSummaryGetEvent(
            'test-agent-id',
            'interaction-1',
            'conversation-1',
            AIAssistantEventName.GET_POST_CALL_SUMMARY
          ),
      },
      {
        label: 'response',
        invoke: () =>
          apiAIAssistant.sendSummaryResponseEvent(
            'test-agent-id',
            validMidCallResponsePayload()
          ),
      },
    ])('rejects $label summary base URL failures with the public error code', async ({invoke}) => {
      (mockWebex.internal.services.get as jest.Mock).mockReturnValue('https://unknown-host.invalid');

      await expectSummaryError(
        invoke(),
        AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE
      );
      expect(mockWebex.request).not.toHaveBeenCalled();
      const [errorArg, methodName, moduleName, options] = getLastErrorDetailsCall();
      expect(errorArg).toStrictEqual({
        details: {
          data: {
            reason: AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE,
            methodName: METHODS.GET_BASE_URL,
          },
        },
      });
      expect(methodName).toBe(METHODS.GET_BASE_URL);
      expect(moduleName).toBe(CC_FILE);
      expect(options).toStrictEqual({uploadLogs: false});
      expect(mockUploadLogs).not.toHaveBeenCalled();
    });

    it.each(summaryGetEventNames)(
      'settles never-resolving %s HTTP requests through one bounded timeout guard',
      async (eventName) => {
        jest.useFakeTimers();
        (mockWebex.request as jest.Mock).mockReturnValue(new Promise(() => undefined));

        const result = apiAIAssistant.sendSummaryGetEvent(
          'test-agent-id',
          'interaction-1',
          'conversation-1',
          eventName
        );

        expect(mockWebex.request).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(AI_SUMMARY_HTTP_TIMEOUT_MS);
        await expectSummaryError(result, AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT);
        expect(jest.getTimerCount()).toBe(0);
      }
    );

    it('settles never-resolving response HTTP requests at the bounded timeout guard', async () => {
      jest.useFakeTimers();
      (mockWebex.request as jest.Mock).mockReturnValue(new Promise(() => undefined));

      const result = apiAIAssistant.sendSummaryResponseEvent(
        'test-agent-id',
        validMidCallResponsePayload({
          actionTimeStamp: 111,
          publishTimestamp: 222,
        })
      );
      const request = expectOneSummaryPostRequest(
        expectedResponseBody(
          AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
          222,
          111,
          {
            summary: '',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
            feedback: 'none',
            state: 'NOT_RECEIVED',
            agentName: 'Agent One',
          }
        )
      );
      expectDataPropertiesAbsent(
        request.body.eventDetails.data,
        MID_CALL_RESPONSE_FLOW_INVALID_DATA_KEYS
      );

      let isRejected = false;
      let caughtError: (Error & {data?: Record<string, unknown>}) | undefined;
      const observedResult = result.catch((error) => {
        isRejected = true;
        caughtError = error;
      });

      jest.advanceTimersByTime(AI_SUMMARY_HTTP_TIMEOUT_MS - 1);
      await Promise.resolve();
      expect(isRejected).toBe(false);

      jest.advanceTimersByTime(1);
      await observedResult;
      expect(isRejected).toBe(true);
      expect(caughtError?.message).toBe(AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT);
      expect(caughtError?.data?.errorCode).toBe(AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('sanitizes HTTP failures and omits original payload sentinels from diagnostics', async () => {
      const sentinelSummary = 'summary-sentinel';
      const sentinelSectionKey = 'humanAuthoredSectionKeySentinel';
      const sentinelSectionValue = 'human-authored-section-value-sentinel';
      const sentinelCard = 'Adaptive-Card-sentinel';
      const sentinelAgentName = 'agent-name-sentinel';
      const actionTimeStamp = 2468;
      let capturedRequest: Parameters<WebexSDK['request']>[0] | undefined;
      jest.spyOn(Date, 'now').mockReturnValue(actionTimeStamp);
      (mockWebex.request as jest.Mock).mockImplementation((request) => {
        capturedRequest = request;

        return Promise.reject({
          statusCode: 503,
          message: sentinelSummary,
          request: {body: request.body},
          options: {body: request.body},
          response: {body: request.body},
          cause: new Error(sentinelCard),
        });
      });

      const expectedBody = expectedResponseBody(
        AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
        actionTimeStamp,
        actionTimeStamp,
        {
          summary: {
            [sentinelSectionKey]: sentinelSectionValue,
            adaptiveCard: sentinelCard,
          },
          numberOfTimesViewed: 1,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
          feedback: 'none',
          state: 'DEFAULT',
          agentName: sentinelAgentName,
        }
      );

      const caughtError = await expectSummaryError(
        apiAIAssistant.sendSummaryResponseEvent('test-agent-id', {
          agentId: 'payload-agent-id',
          interactionId: 'interaction-1',
          conversationId: 'conversation-1',
          eventName: AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
          summary: {
            [sentinelSectionKey]: sentinelSectionValue,
            adaptiveCard: sentinelCard,
          },
          feedback: 'none',
          state: 'DEFAULT',
          agentName: sentinelAgentName,
          numberOfTimesViewed: 1,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
        }),
        AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED
      );

      const request = expectOneSummaryPostRequest(expectedBody);
      expect(capturedRequest).toBe(request);
      expect(caughtError.data?.statusCode).toBe(503);
      const [errorArg, methodName, moduleName, options] = getLastErrorDetailsCall();
      expect(errorArg).toStrictEqual({
        statusCode: 503,
        details: {
          data: {
            reason: AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED,
            methodName: METHODS.SEND_SUMMARY_RESPONSE_EVENT,
            eventName: AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
            agentId: 'test-agent-id',
            orgId: 'test-org-id',
            interactionId: 'interaction-1',
            conversationId: 'conversation-1',
          },
        },
      });
      expect(methodName).toBe(METHODS.SEND_SUMMARY_RESPONSE_EVENT);
      expect(moduleName).toBe(CC_FILE);
      expect(options).toStrictEqual({uploadLogs: false});
      expect(mockUploadLogs).not.toHaveBeenCalled();
      expectOwnPropertiesAbsent(caughtError, PROHIBITED_ERROR_PROPERTIES);
      expectOwnPropertiesAbsent(caughtError.data ?? {}, PROHIBITED_ERROR_PROPERTIES);

      const diagnostics = serializeDiagnostics(
        caughtError,
        (LoggerProxy.log as jest.Mock).mock.calls,
        (LoggerProxy.error as jest.Mock).mock.calls,
        (LoggerProxy.info as jest.Mock).mock.calls,
        (LoggerProxy.warn as jest.Mock).mock.calls,
        (LoggerProxy.trace as jest.Mock).mock.calls,
        (LoggerProxy.debug as jest.Mock).mock.calls,
        (getErrorDetails as jest.Mock).mock.calls,
        mockMetricsManager.timeEvent.mock.calls,
        mockMetricsManager.trackEvent.mock.calls
      );
      [sentinelSummary, sentinelSectionKey, sentinelSectionValue, sentinelCard, sentinelAgentName].forEach(
        (sentinel) => {
          expect(diagnostics).not.toContain(sentinel);
        }
      );

      const realGetErrorDetails = jest.requireActual(
        '../../../../src/services/core/Utils'
      ).getErrorDetails as typeof getErrorDetails;
      const realProjection = realGetErrorDetails(
        errorArg,
        METHODS.SEND_SUMMARY_RESPONSE_EVENT,
        CC_FILE,
        {uploadLogs: false}
      );
      const realDiagnostics = serializeDiagnostics(realProjection);

      [sentinelSummary, sentinelSectionKey, sentinelSectionValue, sentinelCard, sentinelAgentName].forEach(
        (sentinel) => {
          expect(realDiagnostics).not.toContain(sentinel);
        }
      );
    });
  });

  it('should send transcript start event successfully', async () => {
    (mockWebex.request as jest.Mock).mockResolvedValue({body: {ok: true}});

    const result = await apiAIAssistant.sendEvent(
      'test-agent-id',
      'interaction-1',
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      'START'
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
    const [agentId, interactionId, eventType, eventName, action, context, languageCode, trackingId] =
      sendEventSpy.mock.calls[0];

    expect(agentId).toBe('test-agent-id');
    expect(interactionId).toBe('interaction-1');
    expect(eventType).toBe('CUSTOM_EVENT');
    expect(eventName).toBe('GET_SUGGESTIONS');
    expect(action).toBeUndefined();
    expect(context).toBeUndefined();
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
    const [agentId, interactionId, eventType, eventName, action, context, languageCode, trackingId] =
      sendEventSpy.mock.calls[0];

    expect(agentId).toBe('test-agent-id');
    expect(interactionId).toBe('interaction-1');
    expect(eventType).toBe('CUSTOM_EVENT');
    expect(eventName).toBe('ADD_SUGGESTIONS_EXTRA_CONTEXT');
    expect(action).toBeUndefined();
    expect(context).toBe('Need assistance with credit card payment due date');
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
    const [agentId, interactionId, eventType, eventName, action, context, languageCode, trackingId] =
      sendEventSpy.mock.calls[0];

    expect(agentId).toBe('test-agent-id');
    expect(interactionId).toBe('interaction-1');
    expect(eventType).toBe('CUSTOM_EVENT');
    expect(eventName).toBe('GET_SUGGESTIONS');
    expect(action).toBeUndefined();
    expect(context).toBe('');
    expect(languageCode).toBe('en');
    expect(typeof trackingId).toBe('string');
    expect(trackingId.startsWith('WX_CC_SDK_')).toBe(true);
    expect(result).toEqual({ok: true});
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
        'STOP'
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
});
