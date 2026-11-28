import {EventEmitter} from 'events';
import {ConnectionService} from '../../../../../../src/services/core/websocket/connection-service';
import LoggerProxy from '../../../../../../src/logger-proxy';
import type {WebSocketManager} from '../../../../../../src/services/core/websocket/WebSocketManager';
import type {SubscribeRequest, WebexSDK} from '../../../../../../src/types';
import {SUBSCRIBE_API} from '../../../../../../src/services/constants';
import {createDeferred} from '../../../../fixtures/aiSummaryTestUtils';

class SocketManagerDouble extends EventEmitter {
  shouldReconnect = true;
  usable = true;
  initWebSocket = jest.fn(async () => {
    this.shouldReconnect = true;
    this.usable = true;
    return {};
  });
  close = jest.fn((shouldReconnect: boolean) => {
    this.shouldReconnect = shouldReconnect;
    this.usable = false;
  });
  handleConnectionLost = jest.fn();
  hasUsableSocket = jest.fn(() => this.usable);
}

const flush = async () => {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
};
const tick = async (duration: number) => {
  jest.advanceTimersByTime(duration);
  await flush();
};
const lost = {
  isConnectionLost: true,
  isRestoreFailed: false,
  isSocketReconnected: false,
  isKeepAlive: false,
};

describe('ConnectionService', () => {
  let connectionService: ConnectionService;
  let mockWebSocketManager: SocketManagerDouble;
  let failures: jest.Mock;
  let events: jest.Mock;
  const mockSubscribeRequest: SubscribeRequest = {
    force: true,
    isKeepAliveEnabled: false,
    clientType: 'WebexCCSDK',
    allowMultiLogin: true,
  };
  const originalLogger = LoggerProxy.logger;
  const originalNavigator = global.navigator;

  const reset = () => connectionService.reset();
  const lose = () => {
    mockWebSocketManager.usable = false;
    mockWebSocketManager.emit('socketClose', {shouldReconnect: true});
  };

  beforeEach(() => {
    jest.useFakeTimers('modern');
    LoggerProxy.initialize({log: jest.fn(), info: jest.fn(), error: jest.fn()} as any);
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    mockWebSocketManager = new SocketManagerDouble();
    connectionService = new ConnectionService({
      webex: {internal: {services: {updateServices: jest.fn()}}} as unknown as WebexSDK,
      webSocketManager: mockWebSocketManager as unknown as WebSocketManager,
      subscribeRequest: mockSubscribeRequest,
    });
    failures = jest.fn();
    events = jest.fn();
    reset();
    connectionService.on('connectionLost', events);
    connectionService.on('reconnectFailed', failures);
  });

  afterEach(() => {
    connectionService.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(global, 'navigator', {value: originalNavigator, configurable: true});
    LoggerProxy.logger = originalLogger;
  });

  it('monitors an existing socket and resets listeners without reconnecting it', async () => {
    reset();
    expect(mockWebSocketManager.listenerCount('message')).toBe(1);
    expect(mockWebSocketManager.listenerCount('socketClose')).toBe(1);
    expect(jest.getTimerCount()).toBe(2);
    await tick(7999);
    expect(events).not.toHaveBeenCalled();
    await tick(1);
    expect(events).toHaveBeenLastCalledWith(lost);
    expect(mockWebSocketManager.handleConnectionLost).toHaveBeenLastCalledWith(lost);
    expect(mockWebSocketManager.initWebSocket).not.toHaveBeenCalled();
  });

  it('returns Welcome from explicit connect without emitting an ordinary reconnect', async () => {
    connectionService.stop();
    const welcome = createDeferred<any>();
    mockWebSocketManager.initWebSocket.mockReturnValueOnce(welcome.promise);
    const connection = connectionService.connect();
    const resolved = jest.fn();
    connection.then(resolved);
    await flush();
    expect(resolved).not.toHaveBeenCalled();
    welcome.resolve({agentId: 'agent'});
    await expect(connection).resolves.toEqual({agentId: 'agent'});
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
      body: mockSubscribeRequest, resource: SUBSCRIBE_API,
    });
    expect(events).not.toHaveBeenCalled();
  });

  it('reuses subscribe-and-connect and waits for Welcome before reporting reconnection', async () => {
    const welcome = createDeferred<any>();
    mockWebSocketManager.initWebSocket.mockReturnValueOnce(welcome.promise);
    lose();
    expect(events).toHaveBeenLastCalledWith(lost);
    await tick(4999);
    expect(mockWebSocketManager.initWebSocket).not.toHaveBeenCalled();
    await tick(1);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({body: mockSubscribeRequest, resource: SUBSCRIBE_API});
    expect(events).toHaveBeenCalledTimes(1);
    mockWebSocketManager.usable = true;
    welcome.resolve({});
    await flush();
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
    expect(jest.getTimerCount()).toBe(2);
  });

  it('retries a failed connection on the next five-second slot', async () => {
    const error = {statusCode: 503};
    mockWebSocketManager.initWebSocket.mockRejectedValueOnce(error);
    lose();
    await tick(5000);
    expect(failures).toHaveBeenCalledTimes(1);
    expect(failures).toHaveBeenCalledWith(error);
    await tick(4999);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(2);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
  });

  it('keeps one pending connection while retry slots elapse', async () => {
    const pending = createDeferred<any>();
    mockWebSocketManager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    await tick(12000);
    mockWebSocketManager.emit('message', JSON.stringify({keepalive: 'true'}));
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
    pending.reject(new Error('connection unavailable'));
    await flush();
    await tick(2999);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(2);
  });

  it('clears scheduled reconnects and socket listeners on stop', async () => {
    lose();
    connectionService.stop();
    await tick(60000);
    expect(mockWebSocketManager.initWebSocket).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(mockWebSocketManager.listenerCount('message')).toBe(0);
    expect(mockWebSocketManager.listenerCount('socketClose')).toBe(0);
    expect(connectionService.listenerCount('connectionLost')).toBe(1);
  });

  it.each(['stop', 'reset'])('ignores a pending connection after %s', async (action) => {
    const pending = createDeferred<any>();
    mockWebSocketManager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    if (action === 'reset') {
      mockWebSocketManager.usable = true;
      reset();
    } else connectionService[action]();
    expect(mockWebSocketManager.close).toHaveBeenCalledTimes(1);
    pending.resolve({});
    await flush();
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    expect(failures).not.toHaveBeenCalled();
  });

  it('forwards the raw connection failure and lets its caller stop retries', async () => {
    const error = {statusCode: 409, body: {reason: 'consumer-classified-failure'}};
    mockWebSocketManager.initWebSocket.mockRejectedValueOnce(error);
    connectionService.once('reconnectFailed', () => connectionService.stop());
    lose();
    await tick(5000);
    expect(failures).toHaveBeenCalledTimes(1);
    expect(failures).toHaveBeenCalledWith(error);
    expect(mockWebSocketManager.listenerCount('socketClose')).toBe(0);
    await tick(60000);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports an externally restored socket once before ordinary keepalives resume', () => {
    connectionService.stop();
    connectionService.reset(true);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
    mockWebSocketManager.emit('message', JSON.stringify({keepalive: 'true'}));
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isKeepAlive: true});
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(1);
  });

  it('stops reconnecting when the socket asks for closure without retry', async () => {
    mockWebSocketManager.shouldReconnect = false;
    mockWebSocketManager.emit('socketClose', {shouldReconnect: false});
    await tick(60000);
    expect(mockWebSocketManager.initWebSocket).not.toHaveBeenCalled();
    expect(failures).not.toHaveBeenCalled();
    expect(mockWebSocketManager.listenerCount('socketClose')).toBe(0);
  });

  it('does not reconnect while the browser is offline', async () => {
    Object.defineProperty(global, 'navigator', {value: {onLine: false}, configurable: true});
    lose();
    await tick(5000);
    expect(mockWebSocketManager.initWebSocket).not.toHaveBeenCalled();
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    await tick(5000);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
  });

  it.each([50000, 30000])('closes a pending reconnect after the %s ms watchdog', async (timeout) => {
    connectionService.setConnectionProp({lostConnectionRecoveryTimeout: timeout});
    reset();
    const pending = createDeferred<any>();
    mockWebSocketManager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    await tick(timeout - 5000);
    expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'Restore watchdog expired');
    expect(events).toHaveBeenLastCalledWith({...lost, isRestoreFailed: true});
    pending.resolve({});
    await flush();
    await tick(60000);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('accepts a late keepalive on an already admitted quiet socket', async () => {
    await tick(50000);
    expect(events).toHaveBeenLastCalledWith({...lost, isRestoreFailed: true});
    expect(mockWebSocketManager.close).not.toHaveBeenCalled();
    expect(mockWebSocketManager.shouldReconnect).toBe(false);
    mockWebSocketManager.emit('message', JSON.stringify({type: 'AgentStateChange'}));
    expect(events).toHaveBeenLastCalledWith({...lost, isRestoreFailed: true});
    mockWebSocketManager.emit('message', JSON.stringify({keepalive: 'true'}));
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isKeepAlive: true});
    expect(jest.getTimerCount()).toBe(2);
  });

  it.each([true, false])('resets liveness timers after a valid message (keepalive %s)', async (keepalive) => {
    await tick(7000);
    mockWebSocketManager.emit('message', JSON.stringify(keepalive ? {keepalive: 'true'} : {type: 'AgentStateChange'}));
    if (keepalive) {
      expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isKeepAlive: true});
    } else {
      expect(events).not.toHaveBeenCalled();
    }
    await tick(7000);
    expect(events).toHaveBeenCalledTimes(keepalive ? 1 : 0);
    await tick(1000);
    expect(events).toHaveBeenLastCalledWith({...lost, isKeepAlive: keepalive});
  });

  it.each(['not json', 'null', '7'])('ignores malformed liveness payload %s', (message) => {
    mockWebSocketManager.emit('message', message);
    expect(events).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(2);
  });

  it('observes socket loss before Welcome and retries after the pending socket settles', async () => {
    const pending = createDeferred<any>();
    mockWebSocketManager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    lose();
    expect(jest.getTimerCount()).toBe(2);
    pending.resolve({});
    await flush();
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    await tick(5000);
    expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledTimes(2);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
  });
});
