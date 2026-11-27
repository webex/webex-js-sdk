import {EventEmitter} from 'events';
import {ConnectionService} from '../../../../../../src/services/core/websocket/connection-service';
import type {WebSocketManager} from '../../../../../../src/services/core/websocket/WebSocketManager';
import {createDeferred} from '../../../../fixtures/aiSummaryTestUtils';
import LoggerProxy from '../../../../../../src/logger-proxy';

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

const url = 'wss://routing.produs1.cisco.com/notifications';
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
  let service: ConnectionService;
  let manager: SocketManagerDouble;
  let getWebSocketUrl: jest.Mock;
  let isTerminalFailure: jest.Mock;
  let onTerminalFailure: jest.Mock;
  let events: jest.Mock;
  const originalLogger = LoggerProxy.logger;
  const originalNavigator = global.navigator;

  const reset = () => service.reset({getWebSocketUrl, isTerminalFailure, onTerminalFailure});
  const lose = () => {
    manager.usable = false;
    manager.emit('socketClose', {shouldReconnect: true});
  };

  beforeEach(() => {
    jest.useFakeTimers('modern');
    LoggerProxy.initialize({log: jest.fn(), info: jest.fn(), error: jest.fn()} as any);
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    manager = new SocketManagerDouble();
    service = new ConnectionService(manager as unknown as WebSocketManager);
    getWebSocketUrl = jest.fn().mockResolvedValue(url);
    isTerminalFailure = jest.fn().mockReturnValue(false);
    onTerminalFailure = jest.fn();
    events = jest.fn();
    reset();
    service.on('connectionLost', events);
  });

  afterEach(() => {
    service.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(global, 'navigator', {value: originalNavigator, configurable: true});
    LoggerProxy.logger = originalLogger;
  });

  it('monitors an existing socket and resets listeners without reconnecting it', async () => {
    reset();
    expect(manager.listenerCount('message')).toBe(1);
    expect(manager.listenerCount('socketClose')).toBe(1);
    expect(jest.getTimerCount()).toBe(2);
    await tick(7999);
    expect(events).not.toHaveBeenCalled();
    await tick(1);
    expect(events).toHaveBeenLastCalledWith(lost);
    expect(manager.handleConnectionLost).toHaveBeenLastCalledWith(lost);
    expect(getWebSocketUrl).not.toHaveBeenCalled();
    expect(manager.initWebSocket).not.toHaveBeenCalled();
  });

  it('uses the supplied URL callback and waits for Welcome before reporting reconnection', async () => {
    const welcome = createDeferred<any>();
    manager.initWebSocket.mockReturnValueOnce(welcome.promise);
    lose();
    expect(events).toHaveBeenLastCalledWith(lost);
    await tick(4999);
    expect(getWebSocketUrl).not.toHaveBeenCalled();
    await tick(1);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(1);
    expect(manager.initWebSocket).toHaveBeenCalledWith({url});
    expect(events).toHaveBeenCalledTimes(1);
    manager.usable = true;
    welcome.resolve({});
    await flush();
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
    expect(jest.getTimerCount()).toBe(2);
  });

  it.each(['url', 'socket'])('retries a failed %s operation on the next five-second slot', async (phase) => {
    const error = {statusCode: 503};
    if (phase === 'url') getWebSocketUrl.mockRejectedValueOnce(error);
    else manager.initWebSocket.mockRejectedValueOnce(error);
    lose();
    await tick(5000);
    expect(isTerminalFailure).toHaveBeenCalledWith(error);
    expect(onTerminalFailure).not.toHaveBeenCalled();
    await tick(4999);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(2);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
  });

  it.each(['url', 'socket'])('keeps one pending %s operation while retry slots elapse', async (phase) => {
    const pending = createDeferred<any>();
    if (phase === 'url') getWebSocketUrl.mockReturnValueOnce(pending.promise);
    else manager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    await tick(12000);
    manager.emit('message', JSON.stringify({keepalive: 'true'}));
    expect(getWebSocketUrl).toHaveBeenCalledTimes(1);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(phase === 'url' ? 0 : 1);
    pending.reject(new Error('connection unavailable'));
    await flush();
    await tick(2999);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(2);
  });

  it.each(['pause', 'stop'])('clears scheduled reconnects on %s', async (action) => {
    lose();
    service[action]();
    await tick(60000);
    expect(getWebSocketUrl).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    if (action === 'stop') {
      expect(manager.listenerCount('message')).toBe(0);
      expect(manager.listenerCount('socketClose')).toBe(0);
    }
  });

  it.each(['pause', 'stop', 'reset'])('ignores a pending URL after %s', async (action) => {
    const pending = createDeferred<string>();
    getWebSocketUrl.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    if (action === 'reset') {
      manager.usable = true;
      reset();
    } else service[action]();
    expect(manager.close).toHaveBeenCalledTimes(1);
    pending.resolve('wss://old-route.cisco.com');
    await flush();
    expect(manager.initWebSocket).not.toHaveBeenCalled();
    expect(onTerminalFailure).not.toHaveBeenCalled();
  });

  it.each(['url', 'socket'])('forwards a terminal %s failure using the supplied policy', async (phase) => {
    const error = {statusCode: 409, body: {reason: 'consumer-classified-failure'}};
    isTerminalFailure.mockReturnValue(true);
    if (phase === 'url') getWebSocketUrl.mockRejectedValueOnce(error);
    else manager.initWebSocket.mockRejectedValueOnce(error);
    lose();
    await tick(5000);
    expect(isTerminalFailure).toHaveBeenCalledWith(error);
    expect(onTerminalFailure).toHaveBeenCalledTimes(1);
    expect(onTerminalFailure).toHaveBeenCalledWith(error);
    expect(manager.close).toHaveBeenCalledWith(false, 'Terminal admission');
    expect(manager.listenerCount('socketClose')).toBe(0);
    await tick(60000);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops reconnecting when the socket asks for closure without retry', async () => {
    manager.shouldReconnect = false;
    manager.emit('socketClose', {shouldReconnect: false});
    await tick(60000);
    expect(getWebSocketUrl).not.toHaveBeenCalled();
    expect(onTerminalFailure).not.toHaveBeenCalled();
    expect(manager.listenerCount('socketClose')).toBe(0);
  });

  it('does not reconnect while the browser is offline', async () => {
    Object.defineProperty(global, 'navigator', {value: {onLine: false}, configurable: true});
    lose();
    await tick(5000);
    expect(getWebSocketUrl).not.toHaveBeenCalled();
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    await tick(5000);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(1);
  });

  it.each(['url', 'socket'])('closes the reconnect episode after fifty seconds with pending %s', async (phase) => {
    const pending = createDeferred<any>();
    if (phase === 'url') getWebSocketUrl.mockReturnValueOnce(pending.promise);
    else manager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    await tick(45000);
    expect(manager.close).toHaveBeenCalledWith(false, 'Restore watchdog expired');
    expect(events).toHaveBeenLastCalledWith({...lost, isRestoreFailed: true});
    pending.resolve(phase === 'url' ? url : {});
    await flush();
    await tick(60000);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(1);
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('accepts a late keepalive on an already admitted quiet socket', async () => {
    await tick(50000);
    expect(events).toHaveBeenLastCalledWith({...lost, isRestoreFailed: true});
    expect(manager.close).not.toHaveBeenCalled();
    expect(manager.shouldReconnect).toBe(false);
    manager.emit('message', JSON.stringify({keepalive: 'true'}));
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isKeepAlive: true});
    expect(jest.getTimerCount()).toBe(2);
  });

  it.each([true, false])('resets liveness timers after a valid message (keepalive %s)', async (keepalive) => {
    await tick(7000);
    manager.emit('message', JSON.stringify(keepalive ? {keepalive: 'true'} : {type: 'AgentStateChange'}));
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

  it.each(['not json', 'null', '[]', '7'])('ignores malformed liveness payload %s', (message) => {
    manager.emit('message', message);
    expect(events).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(2);
  });

  it('observes socket loss before Welcome and retries after the pending socket settles', async () => {
    const pending = createDeferred<any>();
    manager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    lose();
    manager.usable = true;
    pending.resolve({});
    await flush();
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    await tick(5000);
    expect(getWebSocketUrl).toHaveBeenCalledTimes(2);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
  });
});
