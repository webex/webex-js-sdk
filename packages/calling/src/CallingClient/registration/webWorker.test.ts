import {v4 as uuid} from 'uuid';
import messageHandler from './webWorker';
import {WorkerMessageType} from '../../common/types';

(global as any).self = global;

jest.mock('uuid');

describe('webWorker', () => {
  let postMessageSpy: jest.SpyInstance;
  let capturedIntervalCallback: any;
  let capturedIntervalTimer: any;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
    (uuid as jest.Mock).mockReturnValue('mock-uuid');

    postMessageSpy = jest.spyOn(global, 'postMessage').mockImplementation(() => {});
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    // Overriding setInterval so that we capture the callback rather than schedule a timer
    jest.spyOn(global, 'setInterval').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (callback: any, interval: number): NodeJS.Timeout => {
        capturedIntervalCallback = callback;
        // Create a dummy timer object (could be any non-null value)
        capturedIntervalTimer = {dummy: true};

        return capturedIntervalTimer as NodeJS.Timeout;
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should start keepalive lifecycle correctly', async () => {
    const fakeSuccessResponse = {
      ok: true,
      status: 200,
    };
    (global.fetch as jest.Mock).mockResolvedValue(fakeSuccessResponse);

    messageHandler({
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 3,
        url: 'http://example.com',
      },
    } as MessageEvent);

    // Manually invoke the captured interval callback to simulate one tick
    await capturedIntervalCallback();

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith('http://example.com/status', {
      method: 'POST',
      headers: {
        'cisco-device-url': 'dummyDevice',
        'spark-user-agent': 'webex-calling/beta',
        Authorization: 'dummy',
        trackingId: 'web_worker_mock-uuid',
      },
    });
    expect(postMessageSpy).not.toHaveBeenCalled();

    const failureHeaders = {
      has: (key: string) => key === 'Retry-After' || key === 'Trackingid',
      get: (key: string) =>
        // eslint-disable-next-line no-nested-ternary
        key === 'Retry-After' ? '10' : key === 'Trackingid' ? 'web_worker_mock-uuid' : null,
    };
    const fakeFailureResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: failureHeaders,
    };
    (global.fetch as jest.Mock).mockResolvedValue(fakeFailureResponse);

    messageHandler({
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 3,
        url: 'http://example.com',
      },
    } as MessageEvent);

    // Manually invoke the captured interval callback to simulate one tick
    await capturedIntervalCallback();

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
    expect(postMessageSpy).toHaveBeenCalledWith({
      type: WorkerMessageType.KEEPALIVE_FAILURE,
      err: {
        headers: {'retry-after': '10', trackingid: 'web_worker_mock-uuid'},
        statusCode: 429,
        statusText: 'Too Many Requests',
        type: undefined,
      },
      keepAliveRetryCount: 1,
    });
  });

  it('should post KEEPALIVE_FAILURE when fetch fails', async () => {
    const failureHeaders2 = {
      has: (key: string) => key === 'Trackingid',
      get: (key: string) => (key === 'Trackingid' ? 'web_worker_mock-uuid' : null),
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: failureHeaders2,
    });

    messageHandler({
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 1,
        url: 'http://example.com',
      },
    } as MessageEvent);

    await capturedIntervalCallback();

    expect(postMessageSpy).toHaveBeenCalledWith({
      type: WorkerMessageType.KEEPALIVE_FAILURE,
      err: {
        headers: {trackingid: 'web_worker_mock-uuid'},
        statusCode: 401,
        statusText: 'Unauthorized',
        type: undefined,
      },
      keepAliveRetryCount: 1,
    });
  });

  it('should post KEEPALIVE_SUCCESS after a failure when fetch succeeds', async () => {
    // Set fetch so that first tick rejects (failure) and second tick resolves (success)
    const failureHeaders3 = {
      has: (key: string) => key === 'Trackingid',
      get: (key: string) => (key === 'Trackingid' ? 'web_worker_mock-uuid' : null),
    };
    const mockError = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: failureHeaders3,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockError)
      .mockResolvedValueOnce({ok: true, status: 200});

    messageHandler({
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 3,
        url: 'http://example.com',
      },
    } as MessageEvent);

    // First tick: trigger failure
    await capturedIntervalCallback();
    expect(postMessageSpy.mock.calls[0][0].type).toBe(WorkerMessageType.KEEPALIVE_FAILURE);

    // Second tick: trigger success.
    await capturedIntervalCallback();
    expect(postMessageSpy.mock.calls[1][0].type).toBe(WorkerMessageType.KEEPALIVE_SUCCESS);
    expect(postMessageSpy.mock.calls[1][0].statusCode).toBe(200);
  });

  it('should clear keepalive timer on receiving CLEAR_KEEPALIVE message', async () => {
    const fakeSuccessResponse = {ok: true, status: 200};
    (global.fetch as jest.Mock).mockResolvedValue(fakeSuccessResponse);

    const startEvent = {
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 1,
        url: 'http://example.com',
      },
    };

    messageHandler(startEvent as MessageEvent);
    messageHandler({data: {type: WorkerMessageType.CLEAR_KEEPALIVE}} as MessageEvent);

    jest.advanceTimersByTime(3000);
    expect((global.fetch as jest.Mock).mock.calls.length).toBeLessThanOrEqual(3);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('improve coverage: should not clear keepalive timer on receiving CLEAR_KEEPALIVE message without keepTimer', async () => {
    jest.spyOn(global, 'setInterval').mockReturnValue(undefined);
    const fakeSuccessResponse = {ok: true, status: 200};
    (global.fetch as jest.Mock).mockResolvedValue(fakeSuccessResponse);

    const startEvent = {
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 1,
        url: 'http://example.com',
      },
    };

    messageHandler(startEvent as MessageEvent);
    messageHandler({data: {type: WorkerMessageType.CLEAR_KEEPALIVE}} as MessageEvent);

    jest.advanceTimersByTime(3000);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });
});
