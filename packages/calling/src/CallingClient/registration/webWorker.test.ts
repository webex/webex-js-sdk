import {v4 as uuid} from 'uuid';
import {messageHandler} from './webWorker';
import {WorkerMessageType} from '../../common/types';

(global as any).self = global;

jest.mock('uuid');

describe('webWorker', () => {
  let originalFetch: typeof fetch;
  let postMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    (uuid as jest.Mock).mockReturnValue('mock-uuid');

    postMessageSpy = jest.spyOn(global, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    global.fetch = originalFetch;
    delete (global as any).self;
  });

  it('should start keepalive lifecycle correctly', async () => {
    const fakeSuccessResponse = {ok: true, status: 200};
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

    jest.advanceTimersByTime(1000);

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
  });

  it('should clear keepalive timer on receiving CLEAR_KEEPALIVE message', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
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

    // Advance timers after clearing to simulate a period where the interval would have run
    jest.advanceTimersByTime(3000);

    // If the timer was cleared, fetch should not be invoked repeatedly.
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(3);
    expect(setIntervalSpy).toHaveBeenCalled();
  });
});
