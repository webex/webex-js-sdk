import RtdRequestResolver from '../../../../../src/services/core/RtdRequestResolver';

const createError = (code: string) => new Error(code);

const createOptions = (overrides: Record<string, unknown> = {}) => ({
  correlationId: 'conversation-1',
  eventType: 'AI_SUMMARY',
  timeoutMs: 15000,
  createDuplicateRequestError: () => createError('DUPLICATE'),
  createTimeoutError: () => createError('TIMEOUT'),
  createCancellationError: () => createError('CANCELLED'),
  sendRequest: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('RtdRequestResolver', () => {
  it('registers before sending HTTP and resolves from the matching RTD event', async () => {
    const resolver = new RtdRequestResolver();
    const sendRequest = jest.fn().mockImplementation(() => {
      expect(resolver.resolve('AI_SUMMARY', 'conversation-1', {summary: 'ready'})).toBe('resolved');

      return Promise.resolve();
    });
    const request = resolver.request(
      createOptions({sendRequest, createTimeoutError: () => createError('TIMEOUT')})
    );

    expect(sendRequest).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(sendRequest).toHaveBeenCalledTimes(1);
    await expect(request).resolves.toEqual({summary: 'ready'});
  });

  it('rejects duplicate requests with the same event and correlation key', async () => {
    const resolver = new RtdRequestResolver();
    const first = resolver.request(createOptions({sendRequest: () => new Promise(() => undefined)}));

    await expect(resolver.request(createOptions())).rejects.toThrow('DUPLICATE');
    resolver.clearAll();
    await expect(first).rejects.toThrow('CANCELLED');
  });

  it('cancels a request when HTTP acknowledgement fails', async () => {
    const resolver = new RtdRequestResolver();
    const error = createError('HTTP_FAILED');
    const request = resolver.request(createOptions({sendRequest: () => Promise.reject(error)}));

    await expect(request).rejects.toBe(error);
    expect(resolver.resolve('AI_SUMMARY', 'conversation-1', {})).toBe('not-found');
  });

  it('rejects on timeout and supports owner cleanup', async () => {
    jest.useFakeTimers();
    const resolver = new RtdRequestResolver();
    const request = resolver.request(
      createOptions({ownerId: 'task-1', sendRequest: () => new Promise(() => undefined)})
    );

    jest.advanceTimersByTime(15000);
    await expect(request).rejects.toThrow('TIMEOUT');

    const cleanupRequest = resolver.request(
      createOptions({ownerId: 'task-2', sendRequest: () => new Promise(() => undefined)})
    );
    resolver.clear('task-2');
    await expect(cleanupRequest).rejects.toThrow('CANCELLED');
    jest.useRealTimers();
  });
});
