import { ConnectionService } from '../../../../../../src/services/core/WebSocket/connection-service';
import { WebSocketManager } from '../../../../../../src/services/core/WebSocket/WebSocketManager';
import { SubscribeRequest } from '../../../../../../src/types';

jest.mock('../../../../../../src/services/core/WebSocket/WebSocketManager');

// Mock CustomEvent class
class MockCustomEvent<T> extends Event {
  detail: T;

  constructor(event: string, params: { detail: T }) {
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
    mockWebSocketManager = new WebSocketManager({ webex: {} as any }) as jest.Mocked<WebSocketManager>;

    // Mock the addEventListener method
    mockWebSocketManager.addEventListener = jest.fn();

    connectionService = new ConnectionService(mockWebSocketManager, mockSubscribeRequest);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should initialize ConnectionService', () => {
    expect(connectionService).toBeDefined();
  });

  it('should set connection properties', () => {
    const newProps = { lostConnectionRecoveryTimeout: 30000 };
    connectionService.setConnectionProp(newProps);
    expect(connectionService['connectionProp']).toEqual(newProps);
  });

  it('should handle ping message and update connection data', () => {
    const pingMessage = new CustomEvent<string>('message', { detail: JSON.stringify({ keepalive: 'true' }) });
    connectionService['onPing'](pingMessage);
    expect(connectionService['isKeepAlive']).toBe(true);
    expect(connectionService['isConnectionLost']).toBe(false);
    expect(connectionService['isRestoreFailed']).toBe(false);
    expect(connectionService['isSocketReconnected']).toBe(false);
  });
});