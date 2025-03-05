import {messageHandler} from './webWorker';

describe('webWorker', () => {
  let originalFetch: typeof fetch;
  let postedMessages: any[] = [];

  beforeEach(() => {
    jest.useFakeTimers();
    postedMessages = [];
    originalFetch = global.fetch;
    global.fetch = jest.fn();

    global.postMessage = jest.fn((msg: any) => {
      postedMessages.push(msg);
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.fetch = originalFetch;
    delete (global as any).self;
  });

  it('should start keepalive lifecycle correctly', async () => {
    const fakeSuccessResponse = {ok: true, status: 200};
    (global.fetch as jest.Mock).mockResolvedValue(fakeSuccessResponse);

    // Start keepalive
    messageHandler({
      data: {
        type: 'START_KEEPALIVE',
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 1,
        url: 'http://example.com',
      },
    } as MessageEvent);

    await jest.advanceTimersByTime(1000);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
  });

  it('should clear keepalive timer on receiving CLEAR_KEEPALIVE message', async () => {
    const fakeSuccessResponse = {ok: true, status: 200};
    (global.fetch as jest.Mock).mockResolvedValue(fakeSuccessResponse);

    const startEvent = {
      data: {
        type: 'START_KEEPALIVE',
        accessToken: 'dummy',
        deviceUrl: 'dummyDevice',
        interval: 1,
        retryCountThreshold: 1,
        url: 'http://example.com',
      },
    };

    messageHandler(startEvent as MessageEvent);
    messageHandler({data: {type: 'CLEAR_KEEPALIVE'}} as MessageEvent);

    jest.advanceTimersByTime(3000);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(3);
  });
});
