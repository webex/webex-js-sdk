/* eslint-disable @typescript-eslint/no-explicit-any */
import {WebSocketManager} from '../../../../../../src/services/core/WebSocket/WebSocketManager';
import {WebexSDK, SubscribeRequest, WelcomeResponse} from '../../../../../../src/types';
import {SUBSCRIBE_API, WCC_API_GATEWAY} from '../../../../../../src/services/constants';

jest.useFakeTimers();
jest.mock('../../../../../../src/services/core/HttpRequest');
jest.mock('../../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    logger: {
      log: jest.fn(),
      error: jest.fn(),
    },
    initialize: jest.fn(),
  },
}));

describe('WebSocketManager', () => {
  let webSocketManager: WebSocketManager;
  let mockWebex: WebexSDK;
  let mockWorker: any;
  let mockWebSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWebex = {
      request: jest.fn(),
    } as unknown as WebexSDK;

    mockWorker = {
      postMessage: jest.fn(),
      onmessage: jest.fn(),
    };

    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      onopen: jest.fn(),
      onerror: jest.fn(),
      onclose: jest.fn(),
      onmessage: jest.fn(),
    };

    global.Worker = jest.fn(() => mockWorker) as any;
    global.WebSocket = jest.fn(() => mockWebSocket) as any;
    console.log = jest.fn();
    console.error = jest.fn();
    console.info = jest.fn();

    // Mock Blob and URL.createObjectURL
    global.Blob = function (content: any[], options: any) {
      return {content, options};
    } as any;

    global.URL.createObjectURL = function (blob: Blob) {
      return 'blob:http://localhost:3000/12345';
    };

    webSocketManager = new WebSocketManager({webex: mockWebex});
  });

  it('should initialize WebSocketManager', () => {
    expect(webSocketManager).toBeDefined();
  });

  it('should register and connect to WebSocket', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    const subscribeRequest: SubscribeRequest = {
      routingId: 'test-routing-id',
    };

    const _ = webSocketManager.initWebSocket({body: subscribeRequest});

    expect(mockWebex.request).toHaveBeenCalledWith({
      service: WCC_API_GATEWAY,
      resource: SUBSCRIBE_API,
      method: 'POST',
      body: subscribeRequest,
    });
  });

  it('should close WebSocket connection', () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    const subscribeRequest: SubscribeRequest = {
      routingId: 'test-routing-id',
    };

    const promise = webSocketManager.initWebSocket({body: subscribeRequest});
    
    webSocketManager.close(true, 'Test reason');

    expect(mockWebSocket.close).toHaveBeenCalled();
    expect(mockWorker.postMessage).toHaveBeenCalledWith({type: 'terminate'});
  });

  it('should handle WebSocket keepalive messages', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    const subscribeRequest: SubscribeRequest = {
      routingId: 'test-routing-id',
    };

    const _ = webSocketManager.initWebSocket({body: subscribeRequest});

    mockWebSocket.onopen();

    mockWorker.onmessage({
      data: {type: 'keepalive'},
    });

    jest.advanceTimersByTime(4000);

    expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({keepalive: 'true'}));
  });

  it('should handle WebSocket close due to network issue', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    const subscribeRequest: SubscribeRequest = {
      routingId: 'test-routing-id',
    };

    await webSocketManager.initWebSocket({body: subscribeRequest});

    mockWebSocket.onopen();

    mockWorker.onmessage({
      data: {type: 'closeSocket'},
    });

    jest.advanceTimersByTime(6000);

    expect(mockWebSocket.close).toHaveBeenCalled();
  });
});
