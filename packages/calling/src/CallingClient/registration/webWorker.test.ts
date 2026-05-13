import messageHandler from './webWorker';
import {WorkerMessageType} from '../../common/types';

(global as any).self = global;

describe('webWorker', () => {
  let postMessageSpy: jest.SpyInstance;
  let capturedIntervalCallback: any;
  let capturedIntervalTimer: any;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();

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

  it('should post SEND_KEEPALIVE on a keepalive tick', async () => {
    messageHandler({
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        interval: 1,
        retryCountThreshold: 3,
      },
    } as MessageEvent);

    await capturedIntervalCallback();

    expect(postMessageSpy).toHaveBeenCalledWith({
      type: WorkerMessageType.SEND_KEEPALIVE,
    });
  });

  it('should post KEEPALIVE_FAILURE when keepalive result is a failure', async () => {
    messageHandler({
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        interval: 1,
        retryCountThreshold: 3,
      },
    } as MessageEvent);

    await capturedIntervalCallback();

    messageHandler({
      data: {
        type: WorkerMessageType.KEEPALIVE_RESULT,
        err: {
          statusCode: 401,
          statusText: 'Unauthorized',
          type: undefined,
        },
      },
    } as MessageEvent);

    expect(postMessageSpy).toHaveBeenCalledWith({
      type: WorkerMessageType.KEEPALIVE_FAILURE,
      err: {
        statusCode: 401,
        statusText: 'Unauthorized',
        type: undefined,
      },
      keepAliveRetryCount: 1,
    });
  });

  it('should post KEEPALIVE_SUCCESS after a failure when keepalive result succeeds', async () => {
    messageHandler({
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        interval: 1,
        retryCountThreshold: 3,
      },
    } as MessageEvent);

    await capturedIntervalCallback();
    messageHandler({
      data: {
        type: WorkerMessageType.KEEPALIVE_RESULT,
        err: {
          statusCode: 404,
          statusText: 'Not Found',
        },
      },
    } as MessageEvent);

    messageHandler({
      data: {
        type: WorkerMessageType.KEEPALIVE_RESULT,
        statusCode: 200,
      },
    } as MessageEvent);

    expect(postMessageSpy.mock.calls[2][0].type).toBe(WorkerMessageType.KEEPALIVE_SUCCESS);
    expect(postMessageSpy.mock.calls[2][0].statusCode).toBe(200);
  });

  it('should clear keepalive timer on receiving CLEAR_KEEPALIVE message', async () => {
    const startEvent = {
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        interval: 1,
        retryCountThreshold: 1,
      },
    };

    messageHandler(startEvent as MessageEvent);
    messageHandler({data: {type: WorkerMessageType.CLEAR_KEEPALIVE}} as MessageEvent);

    jest.advanceTimersByTime(3000);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('improve coverage: should not clear keepalive timer on receiving CLEAR_KEEPALIVE message without keepTimer', async () => {
    jest.spyOn(global, 'setInterval').mockReturnValue(undefined);

    const startEvent = {
      data: {
        type: WorkerMessageType.START_KEEPALIVE,
        interval: 1,
        retryCountThreshold: 1,
      },
    };

    messageHandler(startEvent as MessageEvent);
    messageHandler({data: {type: WorkerMessageType.CLEAR_KEEPALIVE}} as MessageEvent);

    jest.advanceTimersByTime(3000);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });
});
