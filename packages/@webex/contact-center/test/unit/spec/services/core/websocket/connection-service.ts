import {EventEmitter} from 'events';
import {ConnectionService} from '../../../../../../src/services/core/websocket/connection-service';
import type {WebSocketManager} from '../../../../../../src/services/core/websocket/WebSocketManager';
import type {RegionRecoveryState, SubscribeRequest, WebexSDK} from '../../../../../../src/types';
import {SUBSCRIBE_API} from '../../../../../../src/services/constants';
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
  getUrl = jest.fn(() => 'wss://routing.produs2.cisco.com');
}

const subscribeRequest: SubscribeRequest = {
  force: true,
  isKeepAliveEnabled: false,
  clientType: 'WebexCCSDK',
  allowMultiLogin: true,
};
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
  let failures: jest.Mock;
  let events: jest.Mock;
  const originalLogger = LoggerProxy.logger;
  const originalNavigator = global.navigator;

  const reset = () => service.reset();
  const lose = () => {
    manager.usable = false;
    manager.emit('socketClose', {shouldReconnect: true});
  };

  beforeEach(() => {
    jest.useFakeTimers('modern');
    LoggerProxy.initialize({log: jest.fn(), info: jest.fn(), error: jest.fn()} as any);
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    manager = new SocketManagerDouble();
    service = new ConnectionService({
      webex: {
        credentials: {getOrgId: () => 'org'},
        internal: {services: {updateServices: jest.fn()}},
      } as unknown as WebexSDK,
      webSocketManager: manager as unknown as WebSocketManager,
      subscribeRequest,
    });
    failures = jest.fn();
    events = jest.fn();
    reset();
    service.on('connectionLost', events);
    service.on('reconnectFailed', failures);
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
    expect(manager.initWebSocket).not.toHaveBeenCalled();
  });

  it.each([
    {title: 'the station is restored', outcome: {status: 'ready', reason: 'region-switch'}},
    {
      title: 'station login is required',
      outcome: {status: 'stationLoginRequired', reason: 'session-restore-failed'},
    },
    {title: 'restoration rejects expired credentials', failure: {statusCode: 401}},
  ])('awaits application recovery after Welcome when $title', async ({outcome, failure}) => {
    const recovery = createDeferred<RegionRecoveryState>();
    const recoverSession = jest.fn(() => recovery.promise);
    const onConnectionChange = jest.fn();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    service.setSessionRecoveryHandler(recoverSession);
    service.on('recoveryConnectionChange', onConnectionChange);
    service.setMultiRegionSettings({multiRegionEnabled: true, homeRegion: 'produs1'});
    service.handleRegionSwitch({
      type: 'SYSTEM_REGION_SWITCH',
      orgId: 'org',
      trackingId: 'region-switch',
      data: {operation: 'FAILOVER', scope: 'ORG'},
    });
    await tick(100000);

    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(manager.initWebSocket).toHaveBeenCalledWith({
      body: subscribeRequest, resource: SUBSCRIBE_API,
    });
    expect(recoverSession).toHaveBeenCalledTimes(1);
    expect(service.regionState.status).toBe('recovering');
    expect(onConnectionChange.mock.calls).toEqual([[false]]);

    if (failure) recovery.reject(failure);
    else recovery.resolve(outcome as RegionRecoveryState);
    await flush();

    expect(service.isRecovering).toBe(false);
    if (failure) {
      expect(failures.mock.calls).toEqual([[failure]]);
      expect(service.regionState).toMatchObject({
        status: 'unavailable',
        reason: 'authentication-failed',
      });
      expect(onConnectionChange.mock.calls.some(([connected]) => connected)).toBe(false);
    } else {
      expect(service.regionState).toMatchObject(outcome);
      expect(onConnectionChange.mock.calls).toEqual([[false], [true]]);
    }
  });

  it('reuses subscribe-and-connect and waits for Welcome before reporting reconnection', async () => {
    const welcome = createDeferred<any>();
    manager.initWebSocket.mockReturnValueOnce(welcome.promise);
    lose();
    expect(events).toHaveBeenLastCalledWith(lost);
    await tick(4999);
    expect(manager.initWebSocket).not.toHaveBeenCalled();
    await tick(1);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(manager.initWebSocket).toHaveBeenCalledWith({body: subscribeRequest, resource: SUBSCRIBE_API});
    expect(events).toHaveBeenCalledTimes(1);
    manager.usable = true;
    welcome.resolve({});
    await flush();
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
    expect(jest.getTimerCount()).toBe(2);
  });

  it('retries a failed connection on the next five-second slot', async () => {
    const error = {statusCode: 503};
    manager.initWebSocket.mockRejectedValueOnce(error);
    lose();
    await tick(5000);
    expect(failures).toHaveBeenCalledTimes(1);
    expect(failures).toHaveBeenCalledWith(error);
    await tick(4999);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(2);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
  });

  it('keeps one pending connection while retry slots elapse', async () => {
    const pending = createDeferred<any>();
    manager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    await tick(12000);
    manager.emit('message', JSON.stringify({keepalive: 'true'}));
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    pending.reject(new Error('connection unavailable'));
    await flush();
    await tick(2999);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(2);
  });

  it('clears scheduled reconnects and socket listeners on stop', async () => {
    lose();
    service.stop();
    await tick(60000);
    expect(manager.initWebSocket).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(manager.listenerCount('message')).toBe(0);
    expect(manager.listenerCount('socketClose')).toBe(0);
    expect(service.listenerCount('connectionLost')).toBe(1);
  });

  it.each(['stop', 'reset'])('ignores a pending connection after %s', async (action) => {
    const pending = createDeferred<any>();
    manager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    if (action === 'reset') {
      manager.usable = true;
      reset();
    } else service[action]();
    expect(manager.close).toHaveBeenCalledTimes(1);
    pending.resolve({});
    await flush();
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    expect(failures).not.toHaveBeenCalled();
  });

  it('forwards the raw connection failure and lets its caller stop retries', async () => {
    const error = {statusCode: 409, body: {reason: 'consumer-classified-failure'}};
    manager.initWebSocket.mockRejectedValueOnce(error);
    service.once('reconnectFailed', () => service.stop());
    lose();
    await tick(5000);
    expect(failures).toHaveBeenCalledTimes(1);
    expect(failures).toHaveBeenCalledWith(error);
    expect(manager.listenerCount('socketClose')).toBe(0);
    await tick(60000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports an externally restored socket once before ordinary keepalives resume', () => {
    service.stop();
    service.reset(true);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
    manager.emit('message', JSON.stringify({keepalive: 'true'}));
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isKeepAlive: true});
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(1);
  });

  it('stops reconnecting when the socket asks for closure without retry', async () => {
    manager.shouldReconnect = false;
    manager.emit('socketClose', {shouldReconnect: false});
    await tick(60000);
    expect(manager.initWebSocket).not.toHaveBeenCalled();
    expect(failures).not.toHaveBeenCalled();
    expect(manager.listenerCount('socketClose')).toBe(0);
  });

  it('does not reconnect while the browser is offline', async () => {
    Object.defineProperty(global, 'navigator', {value: {onLine: false}, configurable: true});
    lose();
    await tick(5000);
    expect(manager.initWebSocket).not.toHaveBeenCalled();
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    await tick(5000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
  });

  it.each([50000, 30000])('closes a pending reconnect after the %s ms watchdog', async (timeout) => {
    service.setConnectionProp({lostConnectionRecoveryTimeout: timeout});
    reset();
    const pending = createDeferred<any>();
    manager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose();
    await tick(5000);
    await tick(timeout - 5000);
    expect(manager.close).toHaveBeenCalledWith(false, 'Restore watchdog expired');
    expect(events).toHaveBeenLastCalledWith({...lost, isRestoreFailed: true});
    pending.resolve({});
    await flush();
    await tick(60000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
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
    expect(jest.getTimerCount()).toBe(2);
    pending.resolve({});
    await flush();
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    await tick(5000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(2);
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isSocketReconnected: true});
  });
});
