import ApiAIAssistant from '../../../../src/services/ApiAiAssistant';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
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
import type {PendingRtdRequest} from '../../../../src/services/core/types';
import {CC_FILE, METHODS} from '../../../../src/constants';
import {createRegionRecoveryError, getErrorDetails} from '../../../../src/services/core/Utils';

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

    it.each(['before', 'queued', 'pending'])(
      'rtdRequestSignalOwnsCancellation %s',
      async (phase) => {
        const controller = new AbortController();
        const http = deferred<unknown>();
        (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
        const addAbort = jest.spyOn(controller.signal, 'addEventListener');
        const removeAbort = jest.spyOn(controller.signal, 'removeEventListener');
        const resolved = jest.fn();
        const rejected = jest.fn();

        try {
          if (phase === 'before') controller.abort();
          const promise = apiAIAssistant.requestAndWaitForRtd(options(controller.signal));
          const observed = promise.then(resolved, rejected);
          const pendingRequests = apiAIAssistant['pendingRtdRequests'];
          let abort: EventListener | undefined;
          if (phase === 'before') {
            expect(addAbort).not.toHaveBeenCalled();
            expect(pendingRequests.size).toBe(0);
            expect(jest.getTimerCount()).toBe(0);
          } else {
            expect(addAbort).toHaveBeenCalledTimes(1);
            abort = addAbort.mock.calls[0][1] as EventListener;
            expect(addAbort.mock.calls).toEqual([['abort', abort, {once: true}]]);
            expect(pendingRequests.size).toBe(1);
            expect([...pendingRequests.values()][0].detachAbort).toEqual(expect.any(Function));
            expect(jest.getTimerCount()).toBe(1);
          }
          if (phase === 'pending') await flush();
          expect(mockWebex.request).toHaveBeenCalledTimes(phase === 'pending' ? 1 : 0);
          controller.abort();
          // Cancellation settles before the dispatched HTTP promise does.
          await observed;
          expect(resolved).not.toHaveBeenCalled();
          expect(rejected).toHaveBeenCalledTimes(1);
          const error = rejected.mock.calls[0][0];
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBe('RECOVERY_INTERRUPTED');
          expect(error.data).toEqual({reason: 'RECOVERY_INTERRUPTED'});
          expect(pendingRequests.size).toBe(0);
          expect(jest.getTimerCount()).toBe(0);
          expect(removeAbort.mock.calls).toEqual(phase === 'before' ? [] : [['abort', abort]]);

          if (phase === 'pending') {
            await observeLateSettlement(() => http.reject(new Error('late HTTP')));
          } else await flush();

          expect(mockWebex.request).toHaveBeenCalledTimes(phase === 'pending' ? 1 : 0);
          expect(rejected.mock.calls).toEqual([[error]]);
          expect(resolved).not.toHaveBeenCalled();
          expect(pendingRequests.size).toBe(0);
          expect(jest.getTimerCount()).toBe(0);
          expect(addAbort).toHaveBeenCalledTimes(phase === 'before' ? 0 : 1);
          expect(removeAbort.mock.calls).toEqual(phase === 'before' ? [] : [['abort', abort]]);
        } finally {
          addAbort.mockRestore();
          removeAbort.mockRestore();
        }
      }
    );

    it.each(['success', 'rejection'])(
      'lateHttpCannotRearmClearedRequest: %s after full clear',
      async (settlement) => {
        const http = deferred<unknown>();
        (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
        const controller = new AbortController();
        const addAbort = jest.spyOn(controller.signal, 'addEventListener');
        const removeAbort = jest.spyOn(controller.signal, 'removeEventListener');
        const error = createRegionRecoveryError('RECOVERY_INTERRUPTED');
        const createError = jest.fn(() => error);
        const resolved = jest.fn();
        const rejected = jest.fn();

        try {
          const promise = apiAIAssistant.requestAndWaitForRtd(options(controller.signal));
          const observed = promise.then(resolved, rejected);
          await flush();
          expect(mockWebex.request).toHaveBeenCalledTimes(1);
          const pendingRequests = apiAIAssistant['pendingRtdRequests'];
          expect(pendingRequests.size).toBe(1);
          const record = [...pendingRequests.values()][0];
          expect(record.detachAbort).toEqual(expect.any(Function));
          expect(record.timeoutId).toBeDefined();
          expect(jest.getTimerCount()).toBe(1);
          expect(addAbort).toHaveBeenCalledTimes(1);
          const abort = addAbort.mock.calls[0][1];
          expect(addAbort.mock.calls).toEqual([['abort', abort, {once: true}]]);

          apiAIAssistant.clearAllRtdRequests(createError);
          await expect(promise).rejects.toBe(error);
          await observed;
          expect(createError).toHaveBeenCalledTimes(1);
          expect(rejected.mock.calls).toEqual([[error]]);
          expect(resolved).not.toHaveBeenCalled();
          expect(error.data).toEqual({reason: 'RECOVERY_INTERRUPTED'});

          const expectCleared = () => {
            expect(pendingRequests.size).toBe(0);
            expect(jest.getTimerCount()).toBe(0);
            expect(removeAbort.mock.calls).toEqual([['abort', abort]]);
            expect(addAbort).toHaveBeenCalledTimes(1);
            expect(
              apiAIAssistant.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation', {
                summary: 'late',
              })
            ).toBe('not-found');
            expect(rejected.mock.calls).toEqual([[error]]);
            expect(resolved).not.toHaveBeenCalled();
          };
          expectCleared();
          await observeLateSettlement(() => {
            if (settlement === 'success') http.resolve({body: {accepted: true}});
            else http.reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));
          });
          expectCleared();
        } finally {
          addAbort.mockRestore();
          removeAbort.mockRestore();
        }
      }
    );

    it.each(['event', 'timeout', 'abort'])(
      'oldAckFailureCannotRemoveSameKeyReplacement / staleTimeoutAndAbortCannotRemoveSameKeyReplacement: %s',
      async (settlement) => {
        const oldHttp = deferred<unknown>();
        const currentHttp = deferred<unknown>();
        (mockWebex.request as jest.Mock)
          .mockReturnValueOnce(oldHttp.promise)
          .mockReturnValueOnce(currentHttp.promise);
        const oldController = new AbortController();
        const currentController = new AbortController();
        const timeoutSpy = jest.spyOn(global, 'setTimeout');
        const abortSpy = jest.spyOn(oldController.signal, 'addEventListener');
        const detachAbortSpy = jest.spyOn(oldController.signal, 'removeEventListener');
        const oldTimeoutError = jest.fn(() => new Error('OLD_TIMEOUT'));
        const currentTimeout = new Error('CURRENT_TIMEOUT');
        const currentTimeoutError = jest.fn(() => currentTimeout);

        try {
          const old = apiAIAssistant.requestAndWaitForRtd({
            ...options(oldController.signal),
            createTimeoutError: oldTimeoutError,
          });
          const oldObserved = expect(old).rejects.toMatchObject({
            data: {reason: 'RECOVERY_INTERRUPTED'},
          });
          await flush();
          // Retain the actual closures: they may already be queued when cleanup runs.
          expect(timeoutSpy).toHaveBeenCalledTimes(1);
          expect(abortSpy).toHaveBeenCalledTimes(1);
          const staleTimeout = timeoutSpy.mock.calls[0][0] as () => void;
          const staleAbort = abortSpy.mock.calls[0][1] as EventListener;
          const pendingRequests: Map<string, PendingRtdRequest<unknown>> = (apiAIAssistant as any)
            .pendingRtdRequests;
          const [key, oldRecord] = [...pendingRequests.entries()][0];

          jest.advanceTimersByTime(250);
          const current = apiAIAssistant.requestAndWaitForRtd({
            ...options(currentController.signal),
            timeoutMs: 2000,
            createTimeoutError: currentTimeoutError,
          });
          const resolved = jest.fn();
          const rejected = jest.fn();
          const currentObserved = current.then(resolved, rejected);
          await oldObserved;
          await flush();
          expect(detachAbortSpy).toHaveBeenCalledWith('abort', staleAbort);
          expect(mockWebex.request).toHaveBeenCalledTimes(2);
          expect(timeoutSpy).toHaveBeenCalledTimes(2);
          const currentRecord = pendingRequests.get(key)!;
          const currentTimer = timeoutSpy.mock.results[1].value;
          expect(currentRecord).not.toBe(oldRecord);
          expect(currentTimer).not.toBe(oldRecord.timeoutId);

          const expectCurrentOwner = () => {
            expect(pendingRequests.size).toBe(1);
            expect(pendingRequests.get(key)).toBe(currentRecord);
            expect(currentRecord.timeoutId).toBe(currentTimer);
            expect(jest.getTimerCount()).toBe(1);
            expect(resolved).not.toHaveBeenCalled();
            expect(rejected).not.toHaveBeenCalled();
            expect(oldTimeoutError).not.toHaveBeenCalled();
            expect(currentTimeoutError).not.toHaveBeenCalled();
          };

          oldHttp.reject(new Error('late old HTTP failure'));
          await flush();
          expectCurrentOwner();

          // Cross the old deadline while the replacement has 1250 ms remaining.
          jest.advanceTimersByTime(750);
          staleTimeout();
          await flush();
          expectCurrentOwner();

          oldController.abort();
          staleAbort(new Event('abort'));
          await flush();
          expectCurrentOwner();

          currentHttp.resolve({body: {accepted: true}});
          await flush();
          jest.advanceTimersByTime(1249);
          await flush();
          expectCurrentOwner();

          if (settlement === 'event') {
            const payload = {summary: 'current'};
            expect(
              apiAIAssistant.resolveFromRtdEvent('POST_CALL_SUMMARY', 'conversation', payload)
            ).toBe('resolved');
            await expect(current).resolves.toEqual(payload);
            expect(resolved.mock.calls).toEqual([[payload]]);
            expect(rejected).not.toHaveBeenCalled();
          } else {
            if (settlement === 'timeout') {
              jest.advanceTimersByTime(1);
              await expect(current).rejects.toBe(currentTimeout);
              expect(currentTimeoutError).toHaveBeenCalledTimes(1);
            } else {
              currentController.abort();
              await expect(current).rejects.toMatchObject({
                data: {reason: 'RECOVERY_INTERRUPTED'},
              });
            }
            expect(rejected).toHaveBeenCalledTimes(1);
            expect(resolved).not.toHaveBeenCalled();
          }
          await currentObserved;
          expect(pendingRequests.size).toBe(0);
          expect(jest.getTimerCount()).toBe(0);
          expect(oldTimeoutError).not.toHaveBeenCalled();
          if (settlement !== 'timeout') expect(currentTimeoutError).not.toHaveBeenCalled();
        } finally {
          timeoutSpy.mockRestore();
          abortSpy.mockRestore();
          detachAbortSpy.mockRestore();
        }
      }
    );

    it('interruptionErrorsAreIndependent and no-argument clear stays compatible', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue({body: {}});
      const first = apiAIAssistant.requestAndWaitForRtd(options()).catch((e) => e);
      const second = apiAIAssistant
        .requestAndWaitForRtd({...options(), correlationId: 'second'})
        .catch((e) => e);
      const {createRegionRecoveryError} = jest.requireActual('../../../../src/services/core/Utils');
      apiAIAssistant.clearAllRtdRequests(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
      const [a, b] = await Promise.all([first, second]);
      expect(a).not.toBe(b);
      expect(a.data).not.toBe(b.data);
      a.data.reason = 'changed';
      expect(b.data.reason).toBe('RECOVERY_INTERRUPTED');
      const normal = apiAIAssistant.requestAndWaitForRtd(options()).catch((e) => e);
      apiAIAssistant.clearAllRtdRequests();
      expect((await normal).message).toBe('RTD request cleared');
    });

    const httpBody = {interactionId: 'interaction', data: []};
    const nonTaskOperations = [
      {
        name: 'sendEvent',
        helperMethods: [METHODS.SEND_EVENT],
        callerErrors: [],
        invoke: (instance: ApiAIAssistant) =>
          instance.sendEvent(
            'agent',
            'interaction',
            AIAssistantEventType.CUSTOM_EVENT,
            AIAssistantEventName.GET_TRANSCRIPTS
          ),
        successMetrics: [METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS],
        result: httpBody,
      },
      {
        name: 'fetchHistoricTranscripts',
        helperMethods: [METHODS.FETCH_HISTORIC_TRANSCRIPTS],
        callerErrors: [],
        invoke: (instance: ApiAIAssistant) =>
          instance.fetchHistoricTranscripts('agent', 'interaction'),
        successMetrics: [METRIC_EVENT_NAMES.AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS],
        result: httpBody,
      },
      {
        name: 'getRealTimeAssistance',
        helperMethods: [METHODS.SEND_EVENT, METHODS.GET_REAL_TIME_ASSISTANCE],
        callerErrors: ['Real-time assistance request failed'],
        invoke: (instance: ApiAIAssistant) =>
          instance.getRealTimeAssistance({
            agentId: 'agent',
            interactionId: 'interaction',
          }),
        successMetrics: [
          METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS,
          METRIC_EVENT_NAMES.AI_ASSISTANT_GET_REAL_TIME_ASSISTANCE_SUCCESS,
        ],
        result: httpBody,
      },
      {
        name: 'sendRealTimeAssistanceUserAction',
        helperMethods: [METHODS.SEND_EVENT, METHODS.SEND_REAL_TIME_ASSISTANCE_USER_ACTION],
        callerErrors: ['Real-time assistance user action failed'],
        invoke: (instance: ApiAIAssistant) =>
          instance.sendRealTimeAssistanceUserAction({
            agentId: 'agent',
            interactionId: 'interaction',
            adaptiveCardId: 'card',
            actionId: RealTimeAssistanceUserActionId.LIKE,
          }),
        successMetrics: [
          METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_EVENT_SUCCESS,
          METRIC_EVENT_NAMES.AI_ASSISTANT_SEND_REAL_TIME_ASSISTANCE_USER_ACTION_SUCCESS,
        ],
        result: httpBody,
      },
      {
        name: 'requestWellnessBreak',
        helperMethods: [METHODS.REQUEST_WELLNESS_BREAK],
        callerErrors: [],
        invoke: (instance: ApiAIAssistant) => instance.requestWellnessBreak(),
        successMetrics: [METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_ACTION_ACCEPTED],
        result: undefined,
      },
      {
        name: 'respondToWellnessBreak',
        helperMethods: [METHODS.RESPOND_TO_WELLNESS_BREAK],
        callerErrors: [],
        invoke: (instance: ApiAIAssistant) =>
          instance.respondToWellnessBreak({
            action: WELLNESS_BREAK_USER_ACTIONS.ACCEPTED,
          }),
        successMetrics: [METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_ACTION_ACCEPTED],
        result: undefined,
      },
    ];

    describe.each(nonTaskOperations)(
      'nonTaskRtdOperationsUseCurrentOwner $name',
      ({name, invoke, helperMethods, callerErrors, successMetrics, result}) => {
        let controller: AbortController;
        let owner: {generation: number; signal: AbortSignal} | undefined;
        const createInstance = (standalone = false) => {
          const instance = new ApiAIAssistant(
            mockWebex,
            () => ({isWellnessBreakEnabled: true, agentId: 'agent', agentSessionId: 'session'}),
            standalone ? undefined : () => owner
          );
          instance.setAIFeatureFlags({
            realtimeTranscripts: {enable: true},
            suggestedResponses: {enable: true},
          } as any);

          return instance;
        };

        beforeEach(() => {
          controller = new AbortController();
          owner = {generation: 1, signal: controller.signal};
        });

        it.each(['undefined', 'aborted'])(
          'rejects a configured %s owner before HTTP',
          async (state) => {
            if (state === 'undefined') owner = undefined;
            else controller.abort();

            await expect(invoke(createInstance())).rejects.toMatchObject({
              data: {reason: 'RECOVERY_INTERRUPTED'},
            });
            expect(mockWebex.request).not.toHaveBeenCalled();
            expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
          }
        );

        it.each(['standalone', 'live'])('succeeds with a %s owner', async (state) => {
          const http = deferred<unknown>();
          (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
          const promise = invoke(createInstance(state === 'standalone'));
          await flush();
          expect(mockWebex.request).toHaveBeenCalledTimes(1);
          expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
          // An equivalent getter result is still the same owner.
          owner = {generation: 1, signal: controller.signal};
          http.resolve({statusCode: 202, body: httpBody});

          await expect(promise).resolves.toEqual(result);
          expect(mockMetricsManager.trackEvent.mock.calls.map(([name]) => name)).toEqual(
            successMetrics
          );
          expect(controller.signal.aborted).toBe(false);
        });

        it('T-008 lifecycleCallerCatchPreservesIdentityAndReason after HTTP dispatch', async () => {
          const reason = 'RECOVERY_INTERRUPTED';
          const diagnostics = {trackingId: 'assistant-lifecycle-tracking', status: 409};
          const error = createRegionRecoveryError(reason, diagnostics);
          const data = error.data;
          const http = deferred<unknown>();
          (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
          // Standalone ownership and enabled features force the rejection through the real catches.
          const promise = invoke(createInstance(true));
          const observed = expect(promise).rejects.toBe(error);
          await flush();
          expect(mockWebex.request).toHaveBeenCalledTimes(1);
          http.reject(error);
          await observed;

          expect(error.message).toBe(reason);
          expect(error.data).toBe(data);
          expect(error.data).toEqual({reason, ...diagnostics});
          const methods = name === 'fetchHistoricTranscripts' ? [] : helperMethods;
          expect((getErrorDetails as jest.Mock).mock.calls).toEqual(
            methods.map((method) => [error, method, CC_FILE])
          );
          expect((getErrorDetails as jest.Mock).mock.results.map(({value}) => value)).toEqual(
            methods.map(() => ({error, reason}))
          );
          // Retain caller-owned diagnostics while excluding every helper-origin error log.
          expect((LoggerProxy.error as jest.Mock).mock.calls.map(([message]) => message)).toEqual(
            callerErrors
          );
          for (const message of callerErrors) {
            expect(LoggerProxy.error).toHaveBeenCalledWith(
              message,
              expect.objectContaining({error})
            );
          }
          expect(mockUploadLogs).not.toHaveBeenCalled();
        });

        it('ordinary HTTP failure reaches the real helper log and upload sinks', async () => {
          const error = {
            statusCode: 503,
            details: {trackingId: 'assistant-http-tracking', data: {reason: 'HTTP_FAILURE'}},
          };
          const http = deferred<unknown>();
          (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
          const promise = invoke(createInstance(true));
          const reasonFor = (method: string, index: number) =>
            index === 0 ? 'HTTP_FAILURE' : `Error while performing ${method}`;
          const observed = expect(promise).rejects.toThrow(
            reasonFor(helperMethods[helperMethods.length - 1], helperMethods.length - 1)
          );
          await flush();
          expect(mockWebex.request).toHaveBeenCalledTimes(1);
          http.reject(error);
          await observed;

          const helper = getErrorDetails as jest.Mock;
          expect(helper.mock.calls).toEqual(
            helperMethods.map((method, index) => [
              index === 0 ? error : helper.mock.results[index - 1].value.error,
              method,
              CC_FILE,
            ])
          );
          expect(
            (LoggerProxy.error as jest.Mock).mock.calls.filter(([message]) =>
              message.includes(' failed with reason: ')
            )
          ).toEqual(
            helperMethods.map((method, index) => [
              `${method} failed with reason: ${reasonFor(method, index)}`,
              {
                module: CC_FILE,
                method,
                trackingId: index === 0 ? 'assistant-http-tracking' : undefined,
              },
            ])
          );
          expect(LoggerProxy.error).toHaveBeenCalledTimes(helperMethods.length + callerErrors.length);
          expect(mockUploadLogs.mock.calls).toEqual(
            helperMethods.map((_method, index) => [
              {correlationId: index === 0 ? 'assistant-http-tracking' : undefined},
            ])
          );
        });

        it('settles admitted HTTP after RTD request cleanup without revoking its borrowed owner', async () => {
          const http = deferred<unknown>();
          (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
          const instance = createInstance();
          const promise = invoke(instance);
          const rtd = instance.requestAndWaitForRtd(options());
          const cleared = expect(rtd).rejects.toThrow('RTD request cleared');
          expect(instance['pendingRtdRequests'].size).toBe(1);
          instance.clearAllRtdRequests();
          await cleared;
          await flush();
          expect(instance['pendingRtdRequests'].size).toBe(0);
          expect(mockWebex.request).toHaveBeenCalledTimes(1);
          expect(controller.signal.aborted).toBe(false);
          http.resolve({statusCode: 202, body: httpBody});

          await expect(promise).resolves.toEqual(result);
          expect(mockMetricsManager.trackEvent.mock.calls.map(([name]) => name)).toEqual(
            successMetrics
          );
        });

        it.each(['aborted', 'undefined', 'generation', 'signal', 'generation and signal'])(
          'suppresses late HTTP success after the owner becomes %s',
          async (state) => {
            const http = deferred<unknown>();
            (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
            const promise = invoke(createInstance());
            const observed = expect(promise).rejects.toMatchObject({
              data: {reason: 'RECOVERY_INTERRUPTED'},
            });
            await flush();
            expect(mockWebex.request).toHaveBeenCalledTimes(1);
            if (state === 'aborted') controller.abort();
            else if (state === 'undefined') owner = undefined;
            else
              owner = {
                generation: state === 'signal' ? 1 : 2,
                signal: state === 'generation' ? controller.signal : new AbortController().signal,
              };
            // Abort must settle without waiting for the HTTP result. Other replacements
            // deliberately leave the captured signal live to exercise owner identity checks.
            if (state === 'aborted') await observed;
            else expect(controller.signal.aborted).toBe(false);
            http.resolve({statusCode: 202, body: httpBody});
            await observed;
            await flush();
            expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
            expect(getErrorDetails).not.toHaveBeenCalled();
            expect(LoggerProxy.error).not.toHaveBeenCalled();
            expect(mockUploadLogs).not.toHaveBeenCalled();
          }
        );

        it('observes late HTTP rejection after owner cancellation', async () => {
          const http = deferred<unknown>();
          (mockWebex.request as jest.Mock).mockReturnValue(http.promise);
          const promise = invoke(createInstance());
          const observed = expect(promise).rejects.toMatchObject({
            data: {reason: 'RECOVERY_INTERRUPTED'},
          });
          await flush();
          expect(mockWebex.request).toHaveBeenCalledTimes(1);
          controller.abort();
          await observed;
          await observeLateSettlement(() => http.reject(new Error('late HTTP failure')));
          expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
          expect(getErrorDetails).not.toHaveBeenCalled();
          expect(LoggerProxy.error).not.toHaveBeenCalled();
          expect(mockUploadLogs).not.toHaveBeenCalled();
        });
      }
    );
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
