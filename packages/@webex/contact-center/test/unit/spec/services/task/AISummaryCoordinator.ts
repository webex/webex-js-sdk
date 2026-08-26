import AISummaryCoordinator from '../../../../../src/services/task/AISummaryCoordinator';
import {
  AI_SUMMARY_DURATION_MS,
  AI_SUMMARY_REQUEST_CANCELLED,
} from '../../../../../src/services/task/constants';
import {
  AISummaryInboundType,
  AISummaryPayloadByInboundType,
  ITask,
  TASK_EVENTS,
} from '../../../../../src/services/task/types';
import {AI_SUMMARY_ERROR_CODES} from '../../../../../src/constants';
import {CC_AI_SUMMARY_EVENTS} from '../../../../../src/services/config/types';
import {createAISummaryErrorExpectation} from '../../../fixtures/aiSummaryTestUtils';

type PendingAISummaryRequestTestEntry<T extends AISummaryInboundType> = {
  requestToken: symbol;
  taskId: string;
  conversationId: string;
  eventType: T;
  timeoutId?: ReturnType<typeof setTimeout>;
  resolve: (payload: AISummaryPayloadByInboundType[T]) => void;
  reject: (error: Error) => void;
};

type AISummaryCoordinatorTestInspection = {
  pendingAISummaryRequests: {
    [T in AISummaryInboundType]: Map<string, PendingAISummaryRequestTestEntry<T>>;
  };
};

const scheduleEventLoopTurn = setImmediate;

const waitForEventLoopTurn = () =>
  new Promise<void>((resolve) => {
    scheduleEventLoopTurn(resolve);
  });

const drainQueuedTimerAndPromiseWork = async () => {
  const jestWithAsyncTimerDrain = jest as typeof jest & {
    advanceTimersByTimeAsync?: (milliseconds: number) => Promise<void>;
  };

  await waitForEventLoopTurn();

  if (jestWithAsyncTimerDrain.advanceTimersByTimeAsync) {
    try {
      await jestWithAsyncTimerDrain.advanceTimersByTimeAsync(0);
    } catch (error) {
      if (!String(error).includes('does not support async fake timers')) {
        throw error;
      }

      jest.advanceTimersByTime(0);
    }
  } else {
    jest.advanceTimersByTime(0);
  }

  await waitForEventLoopTurn();
};

const getPendingAISummaryRequest = <T extends AISummaryInboundType>(
  coordinator: AISummaryCoordinator,
  eventType: T,
  conversationId: string
) =>
  (coordinator as unknown as AISummaryCoordinatorTestInspection).pendingAISummaryRequests[
    eventType
  ].get(conversationId);

describe('AISummaryCoordinator', () => {
  const createErrorExpectation = (code: string) =>
    expect.objectContaining(createAISummaryErrorExpectation(code));

  const createTask = (interactionId: string) =>
    ({
      data: {interactionId},
      emit: jest.fn(),
    } as unknown as Pick<ITask, 'data' | 'emit'>);

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('uses the shared AI summary duration', () => {
    expect(AI_SUMMARY_DURATION_MS).toBe(15_000);
  });

  it('should infer and resolve exact post-call and mid-call pending payloads', async () => {
    const coordinator = new AISummaryCoordinator();
    const postRegistration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'POST_CALL_SUMMARY',
      'POST_CALL_SUMMARY_TIMEOUT'
    );
    const midRegistration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const postPayload: AISummaryPayloadByInboundType['POST_CALL_SUMMARY'] = {
      conversationId: 'conversation-1',
      summaryText: 'post summary',
      suggestedWrapUpCodes: [{name: 'Resolved'}],
    };
    const midPayload: AISummaryPayloadByInboundType['MID_CALL_SUMMARY'] = {
      conversationId: 'conversation-1',
      summaryText: 'mid summary',
    };
    const postResolved = jest.fn();
    const postRejected = jest.fn();

    postRegistration.result.then(postResolved, postRejected);
    expect(typeof postRegistration.requestToken).toBe('symbol');
    expect(typeof midRegistration.requestToken).toBe('symbol');
    expect(postRegistration.requestToken).not.toBe(midRegistration.requestToken);
    expect(
      coordinator.resolvePendingAISummaryRequest(
        'conversation-1',
        'MID_CALL_SUMMARY',
        midPayload
      )
    ).toBe('resolved');
    await waitForEventLoopTurn();
    expect(postResolved).not.toHaveBeenCalled();
    expect(postRejected).not.toHaveBeenCalled();
    expect(
      getPendingAISummaryRequest(coordinator, 'POST_CALL_SUMMARY', 'conversation-1')
        ?.requestToken
    ).toBe(postRegistration.requestToken);
    expect(
      coordinator.resolvePendingAISummaryRequest(
        'conversation-1',
        'POST_CALL_SUMMARY',
        postPayload
      )
    ).toBe('resolved');

    await expect(postRegistration.result).resolves.toBe(postPayload);
    await expect(midRegistration.result).resolves.toBe(midPayload);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should return not-found for unmatched pending payloads without arming timers', () => {
    const coordinator = new AISummaryCoordinator();

    expect(
      coordinator.resolvePendingAISummaryRequest('conversation-1', 'MID_CALL_SUMMARY', {
        conversationId: 'conversation-1',
      })
    ).toBe('not-found');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should reject overlapping registration before adding a second result promise or timer', async () => {
    const coordinator = new AISummaryCoordinator();
    const registration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const firstPendingEntry = getPendingAISummaryRequest(
      coordinator,
      'MID_CALL_SUMMARY',
      'conversation-1'
    );
    const firstTimeoutId = firstPendingEntry?.timeoutId;

    await expect(
      coordinator.registerPendingAISummaryRequest(
        'task-2',
        'conversation-1',
        'MID_CALL_SUMMARY',
        'MID_CALL_SUMMARY_TIMEOUT'
      )
    ).rejects.toEqual(
        createErrorExpectation(AI_SUMMARY_ERROR_CODES.AI_SUMMARY_REQUEST_ALREADY_PENDING)
    );
    expect(jest.getTimerCount()).toBe(1);
    expect(
      getPendingAISummaryRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')
    ).toBe(firstPendingEntry);
    expect(
      getPendingAISummaryRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')
        ?.requestToken
    ).toBe(registration.requestToken);
    expect(
      getPendingAISummaryRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')?.timeoutId
    ).toBe(firstTimeoutId);

    coordinator.resolvePendingAISummaryRequest('conversation-1', 'MID_CALL_SUMMARY', {
      conversationId: 'conversation-1',
    });
    await expect(registration.result).resolves.toEqual({conversationId: 'conversation-1'});
  });

  it('should timeout, delete before promise reactions, and allow immediate sequential registration', async () => {
    const coordinator = new AISummaryCoordinator();
    const registration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'POST_CALL_SUMMARY',
      'POST_CALL_SUMMARY_TIMEOUT'
    );
    const rejection = registration.result.catch((error) => {
      expect(
        (coordinator as unknown as {
          pendingAISummaryRequests: {POST_CALL_SUMMARY: Map<string, unknown>};
        }).pendingAISummaryRequests.POST_CALL_SUMMARY.has('conversation-1')
      ).toBe(false);

      throw error;
    });

    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS);

    await expect(rejection).rejects.toEqual(
      createErrorExpectation(AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_TIMEOUT)
    );

    await expect(
      coordinator.registerPendingAISummaryRequest(
        'task-1',
        'conversation-1',
        'POST_CALL_SUMMARY',
        'POST_CALL_SUMMARY_TIMEOUT'
      )
    ).resolves.toEqual({
      requestToken: expect.any(Symbol),
      result: expect.any(Promise),
    });
  });

  it('should let exact-token transport cleanup clear state without settling the result promise', async () => {
    const coordinator = new AISummaryCoordinator();
    const registration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const pendingEntry = getPendingAISummaryRequest(
      coordinator,
      'MID_CALL_SUMMARY',
      'conversation-1'
    );
    if (!pendingEntry) {
      throw new Error('Expected pending AI summary request to be registered');
    }
    const resolveSpy = jest.spyOn(pendingEntry, 'resolve');
    const rejectSpy = jest.spyOn(pendingEntry, 'reject');
    const observer = jest.fn();

    registration.result.then(observer, observer);
    coordinator.cancelPendingAISummaryRequest(
      'task-other',
      'conversation-1',
      'MID_CALL_SUMMARY',
      registration.requestToken
    );
    expect(jest.getTimerCount()).toBe(1);
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).not.toHaveBeenCalled();
    expect(
      getPendingAISummaryRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')
    ).toBe(pendingEntry);

    coordinator.cancelPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      Symbol('stale')
    );
    expect(jest.getTimerCount()).toBe(1);
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).not.toHaveBeenCalled();
    expect(
      getPendingAISummaryRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')
    ).toBe(pendingEntry);

    coordinator.cancelPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      registration.requestToken
    );
    expect(
      getPendingAISummaryRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')
    ).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);

    const nextRegistration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    expect(nextRegistration).toEqual({
      requestToken: expect.any(Symbol),
      result: expect.any(Promise),
    });
    expect(jest.getTimerCount()).toBe(1);

    await drainQueuedTimerAndPromiseWork();

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
    const nextPendingEntry = getPendingAISummaryRequest(
      coordinator,
      'MID_CALL_SUMMARY',
      'conversation-1'
    );
    expect(nextPendingEntry?.requestToken).toBe(nextRegistration.requestToken);

    coordinator.cancelPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      nextRegistration.requestToken
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should reject owner and full lifecycle cleanup with AI_SUMMARY_REQUEST_CANCELLED', async () => {
    const coordinator = new AISummaryCoordinator();
    const ownerRegistration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'POST_CALL_SUMMARY',
      'POST_CALL_SUMMARY_TIMEOUT'
    );
    const otherRegistration = await coordinator.registerPendingAISummaryRequest(
      'task-2',
      'conversation-2',
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );

    coordinator.clearTaskAISummaryState('task-1', 'conversation-1');
    await expect(ownerRegistration.result).rejects.toEqual(
      createErrorExpectation(AI_SUMMARY_REQUEST_CANCELLED)
    );
    expect(jest.getTimerCount()).toBe(1);

    coordinator.clearAISummaryState();
    await expect(otherRegistration.result).rejects.toEqual(
      createErrorExpectation(AI_SUMMARY_REQUEST_CANCELLED)
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should clear only the owner request while preserving receiver and feature conversation state', async () => {
    const coordinator = new AISummaryCoordinator();
    const receiverTask = createTask('receiver-task');
    const registration = await coordinator.registerPendingAISummaryRequest(
      'task-1',
      'conversation-1',
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const featurePayload = {
      interactionId: 'interaction-1',
      postCallEnabled: true,
      midCallEnabled: false,
    };
    const receivingPayload = {
      conversationId: 'conversation-1',
      summaryText: 'retained receiver summary',
    };

    coordinator.setFeatureEnablement(featurePayload, true);
    coordinator.routeReceivingSummary(receivingPayload, []);
    expect(jest.getTimerCount()).toBe(2);

    coordinator.clearTaskAISummaryState('task-1', 'conversation-1');

    await expect(registration.result).rejects.toEqual(
      createErrorExpectation(AI_SUMMARY_REQUEST_CANCELLED)
    );
    expect(coordinator.getFeatureEnablement('interaction-1')).toStrictEqual(featurePayload);
    expect(coordinator.flushReceivingSummary('conversation-1', [receiverTask])).toBe('delivered');
    expect(receiverTask.emit).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      receivingPayload
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should retain raw feature flags, promote task-owned snapshots, replace orphans, and expire unmatched snapshots', () => {
    const coordinator = new AISummaryCoordinator();

    coordinator.setFeatureEnablement(
      {interactionId: 'interaction-1', postCallEnabled: false, midCallEnabled: undefined},
      false
    );
    const rawFeaturePayload = coordinator.getFeatureEnablement('interaction-1');

    expect(rawFeaturePayload).toStrictEqual({
      interactionId: 'interaction-1',
      postCallEnabled: false,
      midCallEnabled: undefined,
    });
    expect(Object.prototype.hasOwnProperty.call(rawFeaturePayload, 'midCallEnabled')).toBe(true);
    expect(jest.getTimerCount()).toBe(1);

    coordinator.setFeatureEnablement(
      {interactionId: 'interaction-1', postCallEnabled: true, midCallEnabled: false},
      false
    );
    expect(coordinator.getFeatureEnablement('interaction-1')).toEqual({
      interactionId: 'interaction-1',
      postCallEnabled: true,
      midCallEnabled: false,
    });
    expect(jest.getTimerCount()).toBe(1);

    coordinator.retainFeatureEnablementForTask('interaction-1');
    expect(jest.getTimerCount()).toBe(0);
    expect(coordinator.getFeatureEnablement('interaction-1')?.postCallEnabled).toBe(true);

    coordinator.setFeatureEnablement(
      {interactionId: 'interaction-with-task', postCallEnabled: true},
      true
    );
    expect(coordinator.getFeatureEnablement('interaction-with-task')).toStrictEqual({
      interactionId: 'interaction-with-task',
      postCallEnabled: true,
    });
    expect(jest.getTimerCount()).toBe(0);

    coordinator.setFeatureEnablement({interactionId: 'interaction-2', midCallEnabled: true}, false);
    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS);
    expect(coordinator.getFeatureEnablement('interaction-2')).toBeUndefined();
  });

  it('should deliver single-match receiver payloads immediately without a retention timer', () => {
    const onReceiverDrop = jest.fn();
    const coordinator = new AISummaryCoordinator(onReceiverDrop);
    const task = createTask('leaf-task');
    const payload = {conversationId: 'conversation-1', summaryText: 'receiver summary'};

    expect(coordinator.routeReceivingSummary(payload, [task])).toBe('delivered');

    expect(task.emit).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      payload
    );
    expect(coordinator.flushReceivingSummary('conversation-1', [task])).toBe('not-found');
    expect(onReceiverDrop).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['direct', 'buffered-flush'] as const)(
    'should contain receiver consumer failures during %s delivery with bounded metadata',
    (deliveryPath) => {
      const onReceiverDrop = jest.fn();
      const onReceiverDeliveryFailure = jest.fn();
      const coordinator = new AISummaryCoordinator(
        onReceiverDrop,
        onReceiverDeliveryFailure
      );
      const payload = {
        conversationId: 'conversation-1',
        summaryText: 'private summary content',
      };
      const task = createTask('throwing-task');

      (task.emit as jest.Mock).mockImplementation(() => {
        throw new Error('private consumer failure');
      });

      if (deliveryPath === 'direct') {
        expect(() => coordinator.routeReceivingSummary(payload, [task])).not.toThrow();
      } else {
        coordinator.routeReceivingSummary(payload, []);
        expect(() => coordinator.flushReceivingSummary('conversation-1', [task])).not.toThrow();
      }

      expect(onReceiverDeliveryFailure).toHaveBeenCalledTimes(1);
      expect(onReceiverDeliveryFailure).toHaveBeenCalledWith({
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        conversationId: 'conversation-1',
      });
      expect(JSON.stringify(onReceiverDeliveryFailure.mock.calls)).not.toContain(
        'private summary content'
      );
      expect(onReceiverDrop).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it('should buffer only zero-match receiver payloads, deliver latest on flush, and avoid stale timers', () => {
    const onReceiverDrop = jest.fn();
    const coordinator = new AISummaryCoordinator(onReceiverDrop);
    const task = createTask('leaf-task');

    expect(
      coordinator.routeReceivingSummary(
        {conversationId: 'conversation-1', summaryText: 'first'},
        []
      )
    ).toBe('buffered');
    expect(
      coordinator.routeReceivingSummary(
        {conversationId: 'conversation-1', summaryText: 'latest'},
        []
      )
    ).toBe('buffered');
    expect(jest.getTimerCount()).toBe(1);

    expect(coordinator.flushReceivingSummary('conversation-1', [task])).toBe('delivered');
    expect(task.emit).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      {conversationId: 'conversation-1', summaryText: 'latest'}
    );
    expect(jest.getTimerCount()).toBe(0);
    expect(onReceiverDrop).not.toHaveBeenCalled();
  });

  it('should retain zero-candidate receiver flushes on the original buffer deadline', () => {
    const onReceiverDrop = jest.fn();
    const coordinator = new AISummaryCoordinator(onReceiverDrop);
    const retainedElapsedMs = AI_SUMMARY_DURATION_MS / 2;

    expect(
      coordinator.routeReceivingSummary(
        {conversationId: 'conversation-1', summaryText: 'retained receiver summary'},
        []
      )
    ).toBe('buffered');
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(retainedElapsedMs);

    expect(coordinator.flushReceivingSummary('conversation-1', [])).toBe('retained');
    expect(jest.getTimerCount()).toBe(1);
    expect(onReceiverDrop).not.toHaveBeenCalled();

    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS - retainedElapsedMs - 1);
    expect(onReceiverDrop).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);

    expect(onReceiverDrop).toHaveBeenCalledTimes(1);
    expect(onReceiverDrop).toHaveBeenCalledWith({
      eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
      dropReason: 'receiver-buffer-expired',
      conversationId: 'conversation-1',
    });
    expect(coordinator.flushReceivingSummary('conversation-1', [createTask('task-1')])).toBe(
      'not-found'
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should drop flush-time ambiguous receiver payloads exactly once and clear the buffer', () => {
    const onReceiverDrop = jest.fn();
    const coordinator = new AISummaryCoordinator(onReceiverDrop);
    const taskA = createTask('task-a');
    const taskB = createTask('task-b');

    expect(
      coordinator.routeReceivingSummary(
        {conversationId: 'conversation-1', summaryText: 'ambiguous receiver summary'},
        []
      )
    ).toBe('buffered');

    expect(coordinator.flushReceivingSummary('conversation-1', [taskA, taskB])).toBe(
      'dropped-ambiguous'
    );

    expect(taskA.emit).not.toHaveBeenCalled();
    expect(taskB.emit).not.toHaveBeenCalled();
    expect(onReceiverDrop).toHaveBeenCalledTimes(1);
    expect(onReceiverDrop).toHaveBeenCalledWith({
      eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
      dropReason: 'ambiguous-receiver',
      conversationId: 'conversation-1',
    });
    expect(coordinator.flushReceivingSummary('conversation-1', [taskA])).toBe('not-found');
    expect(onReceiverDrop).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should drop ambiguous receiver payloads with bounded metadata and report expiry separately', () => {
    const onReceiverDrop = jest.fn();
    const coordinator = new AISummaryCoordinator(onReceiverDrop);
    const taskA = createTask('task-a');
    const taskB = createTask('task-b');

    expect(
      coordinator.routeReceivingSummary(
        {
          conversationId: 'conversation-1',
          summaryText: 'private-summary',
          sections: {privateKey: 'private-value'},
          adaptiveCard: {body: ['private-card']},
          agentName: 'private-agent',
        },
        [taskA, taskB]
      )
    ).toBe('dropped-ambiguous');
    expect(onReceiverDrop).toHaveBeenCalledWith({
      eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
      dropReason: 'ambiguous-receiver',
      conversationId: 'conversation-1',
    });
    expect(JSON.stringify(onReceiverDrop.mock.calls)).not.toContain('private-summary');
    expect(JSON.stringify(onReceiverDrop.mock.calls)).not.toContain('privateKey');
    expect(JSON.stringify(onReceiverDrop.mock.calls)).not.toContain('private-value');
    expect(JSON.stringify(onReceiverDrop.mock.calls)).not.toContain('private-card');
    expect(JSON.stringify(onReceiverDrop.mock.calls)).not.toContain('private-agent');

    onReceiverDrop.mockClear();
    coordinator.routeReceivingSummary({conversationId: 'conversation-2'}, []);
    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS);

    expect(onReceiverDrop).toHaveBeenCalledWith({
      eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
      dropReason: 'receiver-buffer-expired',
      conversationId: 'conversation-2',
    });
  });

  it('should clear receiver buffers, feature snapshots, and timers during full cleanup', () => {
    const coordinator = new AISummaryCoordinator();

    coordinator.routeReceivingSummary({conversationId: 'conversation-1'}, []);
    coordinator.setFeatureEnablement({interactionId: 'interaction-1', postCallEnabled: true}, false);
    expect(jest.getTimerCount()).toBe(2);

    coordinator.clearAISummaryState();

    expect(coordinator.flushReceivingSummary('conversation-1', [createTask('task-1')])).toBe(
      'not-found'
    );
    expect(coordinator.getFeatureEnablement('interaction-1')).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });
});
