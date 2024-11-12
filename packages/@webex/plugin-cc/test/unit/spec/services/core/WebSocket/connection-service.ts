import {ConnectionService} from '../../../../../../src/services/core/WebSocket/connection-service';
import {WebSocketManager} from '../../../../../../src/services/core/WebSocket/WebSocketManager';
import {SubscribeRequest} from '../../../../../../src/types';
import LoggerProxy from '../../../../../../src/logger-proxy';
import {CONNECTIVITY_CHECK_INTERVAL} from '../../../../../../src/services/core/constants';

jest.mock('../../../../../../src/services/core/WebSocket/WebSocketManager');
jest.mock('../../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    logger: {
      log: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    },
    initialize: jest.fn(),
  },
}));

// Mock CustomEvent class
class MockCustomEvent<T> extends Event {
  detail: T;

  constructor(event: string, params: {detail: T}) {
    super(event);
    this.detail = params.detail;
  }
}

global.CustomEvent = MockCustomEvent as any;

describe('ConnectionService', () => {
  let connectionService: ConnectionService;
  let mockWebSocketManager: jest.Mocked<WebSocketManager>;
  const mockSubscribeRequest: SubscribeRequest = {
    force: true,
    isKeepAliveEnabled: false,
    clientType: 'WebexCCSDK',
    allowMultiLogin: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockWebSocketManager = new WebSocketManager({
      webex: {} as any,
    }) as jest.Mocked<WebSocketManager>;
    mockWebSocketManager.initWebSocket = jest.fn().mockResolvedValue({});

    // Mock the addEventListener method
    mockWebSocketManager.addEventListener = jest.fn();

    connectionService = new ConnectionService(mockWebSocketManager, mockSubscribeRequest);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should initialize ConnectionService', () => {
    expect(connectionService).toBeDefined();
  });

  it('should set connection properties', () => {
    const newProps = {lostConnectionRecoveryTimeout: 30000};
    connectionService.setConnectionProp(newProps);
    expect(connectionService['connectionProp']).toEqual(newProps);
  });

  it('should handle ping message and update connection data', () => {
    const pingMessage = new CustomEvent<string>('message', {
      detail: JSON.stringify({keepalive: 'true'}),
    });
    connectionService['onPing'](pingMessage);
    expect(connectionService['isKeepAlive']).toBe(true);
    expect(connectionService['isConnectionLost']).toBe(false);
    expect(connectionService['isRestoreFailed']).toBe(false);
    expect(connectionService['isSocketReconnected']).toBe(false);
  });

  it('should handle connection lost', () => {
    connectionService['handleConnectionLost']();
    expect(connectionService['isConnectionLost']).toBe(true);
  });

  it('should clear timer on restore failed', async () => {
    connectionService['reconnectInterval'] = setInterval(() => {}, 1000);
    jest.spyOn(global, 'clearInterval');
    await connectionService['clearTimerOnRestoreFailed']();
    expect(clearInterval).toHaveBeenCalledWith(connectionService['reconnectInterval']);
  });

  it('should handle restore failed', async () => {
    await connectionService['handleRestoreFailed']();
    expect(connectionService['isRestoreFailed']).toBe(true);
    expect(connectionService['webSocketManager'].shouldReconnect).toBe(false);
  });

  it('should handle socket close when online', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        onLine: true,
      },
      configurable: true,
    });

    await connectionService['handleSocketClose']();
    expect(LoggerProxy.logger.info).toHaveBeenCalledWith(
      'event=socketConnectionRetry | Trying to reconnect to notifs socket'
    );
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({body: mockSubscribeRequest});
  });

  it('should handle ping message without keepalive and not update connection data', () => {
    const pingMessage = new CustomEvent<string>('message', {
      detail: JSON.stringify({ someOtherProperty: 'value' }),
    });
    connectionService['onPing'](pingMessage);
    expect(connectionService['isKeepAlive']).toBe(false);
    expect(connectionService['isConnectionLost']).toBe(false);
    expect(connectionService['isRestoreFailed']).toBe(false);
    expect(connectionService['isSocketReconnected']).toBe(false);
  });

  describe('ConnectionService Reconnect', () => {
    it('should handle connection lost and set isConnectionLost to true', () => {
      connectionService['handleConnectionLost']();
      expect(connectionService['isConnectionLost']).toBe(true);
    });

    it('should handle restore failed and set isRestoreFailed to true', async () => {
      await connectionService['handleRestoreFailed']();
      expect(connectionService['isRestoreFailed']).toBe(true);
    });

    it('should handle restore failed and set shouldReconnect to false', async () => {
      await connectionService['handleRestoreFailed']();
      expect(connectionService['webSocketManager'].shouldReconnect).toBe(false);
    });

    it('should handle socket close and reconnect when online', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
        },
        configurable: true,
      });

      await connectionService['handleSocketClose']();
      expect(LoggerProxy.logger.info).toHaveBeenCalledWith(
        'event=socketConnectionRetry | Trying to reconnect to notifs socket'
      );
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({body: mockSubscribeRequest});
    });

    it('should handle onSocketClose and start reconnect interval', () => {
      jest.spyOn(global, 'setInterval');
      connectionService['onSocketClose']();
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), CONNECTIVITY_CHECK_INTERVAL);
    });
  });
});