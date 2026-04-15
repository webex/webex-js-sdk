/* eslint-disable @typescript-eslint/no-explicit-any */
import {WebSocketManager} from '../../../../../../src/services/core/websocket/WebSocketManager';
import {WebexSDK, SubscribeRequest} from '../../../../../../src/types';
import {SUBSCRIBE_API, WCC_API_GATEWAY} from '../../../../../../src/services/constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../../../../src/constants';
import LoggerProxy from '../../../../../../src/logger-proxy';

jest.mock('../../../../../../src/services/core/WebexRequest');
jest.mock('../../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

class MockWebSocket {
  static inst: MockWebSocket;
  onopen: () => void = () => { };
  onerror: (event: any) => void = () => { };
  onclose: (event: any) => void = () => { };
  onmessage: (msg: any) => void = () => { };
  close = jest.fn();
  send = jest.fn();

  constructor() {
    MockWebSocket.inst = this;
    setTimeout(() => {
      this.onopen();
    }, 10);
  }
}

// Mock CustomEvent class
class MockCustomEvent<T> extends Event {
  detail: T;

  constructor(event: string, params: { detail: T }) {
    super(event);
    this.detail = params.detail;
  }
}

global.CustomEvent = MockCustomEvent as any;

// Mock MessageEvent class
class MockMessageEvent extends Event {
  data: any;

  constructor(type: string, eventInitDict: { data: any }) {
    super(type);
    this.data = eventInitDict.data;
  }
}

global.MessageEvent = MockMessageEvent as any;

describe('WebSocketManager', () => {
  let webSocketManager: WebSocketManager;
  let mockWebex: WebexSDK;
  let mockWorker: any;

  const fakeSubscribeRequest: SubscribeRequest = {
    force: true,
    isKeepAliveEnabled: false,
    clientType: 'WebexCCSDK',
    allowMultiLogin: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockWebex = {
      request: jest.fn(),
      credentials: {
        getOrgId: jest.fn().mockReturnValue('test-org-id'),
      },
      internal: {
        services: {
          isIntegrationEnvironment: jest.fn().mockReturnValue(true), // INT environment by default
        },
      },
    } as unknown as WebexSDK;

    mockWorker = {
      postMessage: jest.fn(),
      onmessage: jest.fn(),
    };

    global.Worker = jest.fn(() => mockWorker) as any;
    global.WebSocket = MockWebSocket as any;

    global.Blob = function (content: any[], options: any) {
      return { content, options };
    } as any;

    global.URL.createObjectURL = function (blob: Blob) {
      return 'blob:http://localhost:3000/12345';
    };

    webSocketManager = new WebSocketManager({ webex: mockWebex });

    setTimeout(() => {
      MockWebSocket.inst.onopen();
      MockWebSocket.inst.onmessage({ data: JSON.stringify({ type: "Welcome" }) });
    }, 1);

    console.log = jest.fn();
    console.error = jest.fn();
  });

  it('should initialize WebSocketManager', () => {
    expect(webSocketManager).toBeDefined();
  });

  it('should register and connect to WebSocket with X-ORGANIZATION-ID header for INT environment', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    // Mock INT environment (services.isIntegrationEnvironment returns true)
    (mockWebex.internal.services.isIntegrationEnvironment as jest.Mock).mockReturnValue(true);
    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    expect(mockWebex.request).toHaveBeenCalledWith({
      service: WCC_API_GATEWAY,
      resource: SUBSCRIBE_API,
      method: 'POST',
      body: fakeSubscribeRequest,
      headers: {'X-ORGANIZATION-ID': 'test-org-id'},
    });
  });

  it('should register and connect to WebSocket without X-ORGANIZATION-ID header for production environment', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    // Mock production environment (services.isIntegrationEnvironment returns false)
    (mockWebex.internal.services.isIntegrationEnvironment as jest.Mock).mockReturnValue(false);
    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    // Create new WebSocketManager instance with production mock
    webSocketManager = new WebSocketManager({ webex: mockWebex });

    setTimeout(() => {
      MockWebSocket.inst.onopen();
      MockWebSocket.inst.onmessage({ data: JSON.stringify({ type: "Welcome" }) });
    }, 1);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    expect(mockWebex.request).toHaveBeenCalledWith({
      service: WCC_API_GATEWAY,
      resource: SUBSCRIBE_API,
      method: 'POST',
      body: fakeSubscribeRequest,
      headers: undefined,
    });
  });

  it('should not send X-ORGANIZATION-ID header when services.isIntegrationEnvironment is not available', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    // Mock services not available (defaults to production behavior)
    (mockWebex as any).internal = undefined;
    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    webSocketManager = new WebSocketManager({ webex: mockWebex });

    setTimeout(() => {
      MockWebSocket.inst.onopen();
      MockWebSocket.inst.onmessage({ data: JSON.stringify({ type: "Welcome" }) });
    }, 1);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    expect(mockWebex.request).toHaveBeenCalledWith({
      service: WCC_API_GATEWAY,
      resource: SUBSCRIBE_API,
      method: 'POST',
      body: fakeSubscribeRequest,
      headers: undefined,
    });
  });

  it('should log error and throw when register API fails in initWebSocket', async () => {
    const error = new Error('Register API failed');

    (mockWebex.request as jest.Mock).mockRejectedValueOnce(error);

    await expect(
      webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API })
    ).rejects.toThrow(error);

    expect(LoggerProxy.error).toHaveBeenCalledWith(
      `Register API Failed, Request to RoutingNotifs websocket registration API failed ${error}`,
      { module: WEB_SOCKET_MANAGER_FILE, method: 'register' }
    );

    expect(LoggerProxy.error).toHaveBeenCalledWith(
      `[WebSocketStatus] | Error in registering Websocket ${error}`,
      { module: WEB_SOCKET_MANAGER_FILE, method: 'initWebSocket' }
    );
  });

  it('should close WebSocket connection', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    webSocketManager.close(true, 'Test reason');

    expect(MockWebSocket.inst.close).toHaveBeenCalled();
    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'terminate' });
  });

  it('should handle WebSocket keepalive messages', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    setTimeout(() => {
      MockWebSocket.inst.onopen();
      MockWebSocket.inst.onmessage({ data: JSON.stringify({ type: 'keepalive' }) });
      mockWorker.onmessage({
        data: {
          type: 'keepalive'
        }
      });
    }, 1);

    expect(MockWebSocket.inst.send).toHaveBeenCalledWith(JSON.stringify({ keepalive: 'true' }));
  });

  it('should handle WebSocket close due to network issue', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    // Mock navigator.onLine to simulate network issue
    Object.defineProperty(global, 'navigator', {
      value: {
        onLine: false,
      },
      configurable: true,
    });

    // Simulate the WebSocket close event
    setTimeout(() => {
      MockWebSocket.inst.onclose({
        wasClean: false,
        code: 1006,
        reason: 'network issue',
        target: MockWebSocket.inst,
      });
    }, 1);

    // Wait for the close event to be handled
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'terminate' });
    expect(LoggerProxy.error).toHaveBeenCalledWith(
      '[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: network issue',
      { module: WEB_SOCKET_MANAGER_FILE, method: 'webSocketOnCloseHandler' }
    );

    // Restore navigator.onLine to true
    Object.defineProperty(global, 'navigator', {
      value: {
        onLine: true,
      },
      configurable: true,
    });
  });

  it('should handle WebSocket error event', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    const errorEvent = new Event('error');
    MockWebSocket.inst.onerror(errorEvent);

    expect(LoggerProxy.error).toHaveBeenCalledWith(
      '[WebSocketStatus] | event=socketConnectionFailed | WebSocket connection failed [object Event]',
      { module: WEB_SOCKET_MANAGER_FILE, method: 'connect' }
    );
  });

  it('should handle WebSocket message event with AGENT_MULTI_LOGIN', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify({ type: 'AGENT_MULTI_LOGIN' }),
    });
    MockWebSocket.inst.onmessage(messageEvent);

    expect(MockWebSocket.inst.close).toHaveBeenCalled();
    expect(LoggerProxy.error).toHaveBeenCalledWith(
      '[WebSocketStatus] | event=agentMultiLogin | WebSocket connection closed by agent multiLogin',
      { module: WEB_SOCKET_MANAGER_FILE, method: 'connect' }
    );
  });

  it('should handle WebSocket message event with Welcome', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify({ type: 'Welcome', data: { someData: 'data' } }),
    });
    MockWebSocket.inst.onmessage(messageEvent);

    expect(webSocketManager['isWelcomeReceived']).toBe(true);
  });

  it('should handle WebSocket close with forceCloseWebSocketOnTimeout', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    webSocketManager['forceCloseWebSocketOnTimeout'] = true;

    // Simulate the WebSocket close event
    setTimeout(() => {
      MockWebSocket.inst.onclose({
        wasClean: false,
        code: 1006,
        reason: 'timeout',
        target: MockWebSocket.inst,
      });
    }, 1);

    webSocketManager.shouldReconnect = true;

    // Wait for the close event to be handled
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'terminate' });
    expect(LoggerProxy.error).toHaveBeenCalledWith(
      '[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: WebSocket auto close timed out. Forcefully closed websocket.',
      { module: WEB_SOCKET_MANAGER_FILE, method: 'webSocketOnCloseHandler' }
    );
  });

  it('should handle WebSocket close without reconnect', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });
    webSocketManager.shouldReconnect = false;
    // Simulate the WebSocket close event
    setTimeout(() => {
      MockWebSocket.inst.onclose({
        wasClean: false,
        code: 1006,
        reason: 'no reconnect',
        target: MockWebSocket.inst,
      });
    }, 1);
    
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'terminate' });
    expect(LoggerProxy.error).not.toHaveBeenCalledWith(
      '[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: no reconnect',
      { module: WEB_SOCKET_MANAGER_FILE, method: 'webSocketOnCloseHandler' }
    );
  });

  it('should handle WebSocket close with clean close', async () => {
    const subscribeResponse = {
      body: {
        webSocketUrl: 'wss://fake-url',
      },
    };

    (mockWebex.request as jest.Mock).mockResolvedValueOnce(subscribeResponse);

    await webSocketManager.initWebSocket({ body: fakeSubscribeRequest, resource: SUBSCRIBE_API });

    // Simulate the WebSocket close event
    setTimeout(() => {
      MockWebSocket.inst.onclose({
        wasClean: true,
        code: 1000,
        reason: 'clean close',
        target: MockWebSocket.inst,
      });
    }, 1);

    // Wait for the close event to be handled
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'terminate' });
    expect(LoggerProxy.error).not.toHaveBeenCalledWith(
      '[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: clean close',
      { module: WEB_SOCKET_MANAGER_FILE, method: 'webSocketOnCloseHandler' }
    );
  });
});