import {WebSocketManager} from '../../../../../../src/services/core/websocket/WebSocketManager';
import {
  CLOSE_SOCKET_TIMEOUT,
  KEEPALIVE_WORKER_INTERVAL,
  TIMEOUT_REQ,
  METHODS,
  WELCOME_TIMEOUT,
} from '../../../../../../src/services/core/constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../../../../src/constants';
import LoggerProxy from '../../../../../../src/logger-proxy';
import {SubscribeRequest, WebexSDK} from '../../../../../../src/types';
import {SUBSCRIBE_API, WCC_API_GATEWAY} from '../../../../../../src/services/constants';
import {createDeferred} from '../../../../fixtures/aiSummaryTestUtils';

jest.mock('../../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {log: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn()},
}));

class SocketDouble {
  static instances: SocketDouble[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: {data: string}) => void) | null = null;
  send = jest.fn();
  close = jest.fn(() => { this.readyState = 3; });

  constructor(public url: string) { SocketDouble.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data: unknown) {
    this.onmessage?.({data: typeof data === 'string' ? data : JSON.stringify(data)});
  }
  nativeClose() { this.readyState = 3; this.onclose?.(); }
}

const url = 'wss://routing.produs1.cisco.com/notifications?signature=private-sentinel';
const otherUrl = 'wss://routing.prodeu2.ciscoccservice.com/notifications';
const body: SubscribeRequest = {
  force: true,
  isKeepAliveEnabled: false,
  clientType: 'WebexCCSDK',
  allowMultiLogin: true,
};
const flush = async () => { for (let turn = 0; turn < 5; turn += 1) await Promise.resolve(); };

describe('WebSocketManager subscription and connection', () => {
  let manager: WebSocketManager;
  let webex: WebexSDK;
  let request: jest.Mock;
  let workers: Array<{
    onmessage: ((event: any) => void) | null;
    postMessage: jest.Mock;
  }>;
  const originalSocket = global.WebSocket;
  const originalWorker = global.Worker;
  const originalBlob = global.Blob;
  const originalNavigator = global.navigator;
  const createUrl = URL.createObjectURL;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.clearAllMocks();
    SocketDouble.instances = [];
    workers = [];
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    global.WebSocket = SocketDouble as any;
    global.Blob = class BlobDouble {} as any;
    global.Worker = jest.fn(() => {
      const worker = {onmessage: null, postMessage: jest.fn()};
      workers.push(worker);
      return worker;
    }) as any;
    URL.createObjectURL = jest.fn(() => 'blob:socket-' + workers.length);
    request = jest.fn().mockResolvedValue({body: {webSocketUrl: url}});
    webex = {
      request,
      credentials: {getOrgId: jest.fn(() => 'org')},
      internal: {services: {isIntegrationEnvironment: jest.fn(() => true)}},
    } as unknown as WebexSDK;
    manager = new WebSocketManager({webex});
  });

  afterEach(() => {
    manager.close(false);
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.WebSocket = originalSocket;
    global.Worker = originalWorker;
    global.Blob = originalBlob;
    Object.defineProperty(global, 'navigator', {value: originalNavigator, configurable: true});
    URL.createObjectURL = createUrl;
  });

  const initialize = () => manager.initWebSocket({body, resource: SUBSCRIBE_API});
  const start = async (connectionUrl = url) => {
    request.mockResolvedValueOnce({body: {webSocketUrl: connectionUrl}});
    const promise = initialize();
    promise.catch(() => undefined);
    await flush();

    return {promise, socket: SocketDouble.instances.at(-1)!};
  };
  const admit = async (connectionUrl = url) => {
    const result = await start(connectionUrl);
    result.socket.open();
    result.socket.message({type: 'Welcome', data: {agentId: 'agent'}});
    await result.promise;

    return result.socket;
  };
  const expectReleased = (socket: SocketDouble, closeCalls = 1) => {
    expect(socket.close).toHaveBeenCalledTimes(closeCalls);
    expect(socket.onopen).toBeNull();
    expect(socket.onmessage).toBeNull();
    expect(socket.onerror).toBeNull();
    expect(socket.onclose).toBeNull();
    expect(manager.hasUsableSocket()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(workers[0].onmessage).toBeNull();
    expect(workers[0].postMessage).toHaveBeenLastCalledWith({type: 'terminate'});
  };

  it('subscribes and waits for Welcome before admitting messages', async () => {
    const message = jest.fn();
    manager.on('message', message);
    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(workers[0].postMessage).not.toHaveBeenCalled();
    const {promise, socket} = await start();
    expect(socket.url).toBe(url);
    expect(manager.getUrl()).toBe(url);
    expect(request).toHaveBeenCalledWith({
      service: WCC_API_GATEWAY,
      resource: SUBSCRIBE_API,
      method: 'POST',
      body,
      headers: {'X-ORGANIZATION-ID': 'org'},
      timeout: TIMEOUT_REQ,
    });
    expect(manager.hasUsableSocket()).toBe(false);
    expect(global.Worker).toHaveBeenCalledTimes(1);
    socket.open();
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({keepalive: 'true'}));
    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(workers[0].postMessage).toHaveBeenLastCalledWith({
      type: 'start',
      intervalDuration: KEEPALIVE_WORKER_INTERVAL,
      isSocketClosed: false,
      closeSocketTimeout: CLOSE_SOCKET_TIMEOUT,
    });
    socket.message({type: 'server-event', data: {value: 1}});
    expect(message).not.toHaveBeenCalled();

    socket.message({type: 'Welcome', data: {agentId: 'agent'}});
    await expect(promise).resolves.toEqual({agentId: 'agent'});
    expect(manager.hasUsableSocket()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    socket.message({type: 'server-event', data: {value: 2}});
    expect(message).toHaveBeenLastCalledWith(JSON.stringify({
      type: 'server-event', data: {value: 2},
    }));
  });

  it.each([
    {integration: false, orgId: 'org'},
    {integration: true, orgId: undefined},
    {integration: undefined, orgId: 'org'},
  ])('omits the org header for integration=$integration org=$orgId', async ({integration, orgId}) => {
    if (integration === undefined) Reflect.deleteProperty(webex, 'internal');
    else (webex.internal.services.isIntegrationEnvironment as jest.Mock).mockReturnValue(integration);
    (webex.credentials.getOrgId as jest.Mock).mockReturnValue(orgId);
    await admit();
    expect(request).toHaveBeenCalledWith({
      service: WCC_API_GATEWAY,
      resource: SUBSCRIBE_API,
      method: 'POST',
      body,
      headers: undefined,
      timeout: TIMEOUT_REQ,
    });
  });

  it.each([401, 409, 503])('preserves a subscribe HTTP %s failure for its caller', async (statusCode) => {
    const failure = {statusCode, headers: {'x-wxcc-region-reason': 'REGION_MISMATCH_NO_OVERRIDE'}};
    request.mockRejectedValueOnce(failure);
    await expect(initialize()).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
    expect(SocketDouble.instances).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves an explicit non-2xx subscribe response instead of opening a socket', async () => {
    const failure = {statusCode: 409, body: {webSocketUrl: url}};
    request.mockResolvedValueOnce(failure);
    await expect(initialize()).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
    expect(SocketDouble.instances).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts the Welcome deadline after subscription completes', async () => {
    const subscribed = createDeferred<{body: {webSocketUrl: string}}>();
    request.mockReturnValueOnce(subscribed.promise);
    const promise = initialize();
    promise.catch(() => undefined);
    await flush();
    jest.advanceTimersByTime(19000);
    expect(SocketDouble.instances).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
    subscribed.resolve({body: {webSocketUrl: url}});
    await flush();
    const socket = SocketDouble.instances.at(-1)!;
    socket.open();
    jest.advanceTimersByTime(WELCOME_TIMEOUT - 1);
    expect(manager.hasUsableSocket()).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow('Welcome deadline');
    expectReleased(socket);
  });

  it.each([
    'ws://routing.produs1.cisco.com/notifications',
    'https://routing.produs1.cisco.com/notifications',
    'wss://cisco.com.attacker.example/notifications',
    'wss://untrusted.example/notifications',
    'not a url',
    '',
  ])('rejects an insecure or untrusted socket URL %s', async (connectionUrl) => {
    request.mockResolvedValueOnce({body: {webSocketUrl: connectionUrl}});
    await expect(initialize()).rejects.toThrow('not allow-listed');
    expect(SocketDouble.instances).toHaveLength(0);
    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([undefined, [], 'agent'])('rejects malformed Welcome data %# at its deadline', async (data) => {
    const {promise, socket} = await start();
    socket.open();
    socket.message({type: 'Welcome', data});
    jest.advanceTimersByTime(WELCOME_TIMEOUT - 1);
    await flush();
    expect(manager.hasUsableSocket()).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow('Welcome deadline');
    expectReleased(socket);
  });

  it.each([false, true])('bounds Welcome from connect even when native open is delayed (%s)', async (opened) => {
    const {promise, socket} = await start();
    const oldMessage = socket.onmessage!;
    jest.advanceTimersByTime(10000);
    if (opened) socket.open();
    jest.advanceTimersByTime(WELCOME_TIMEOUT - 10001);
    await flush();
    expect(manager.hasUsableSocket()).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow('Welcome deadline');
    oldMessage({data: JSON.stringify({type: 'Welcome', data: {agentId: 'late'}})});
    expectReleased(socket);
    expect(workers).toHaveLength(1);
  });

  it.each(['close', 'error'])('settles %s before Welcome and releases callbacks', async (event) => {
    const {promise, socket} = await start();
    socket.open();
    const closed = jest.fn();
    manager.on('socketClose', closed);
    if (event === 'close') socket.nativeClose();
    else socket.onerror?.();
    await expect(promise).rejects.toThrow(
      event === 'close' ? 'WebSocket closed' : 'WebSocket connection failed'
    );
    expectReleased(socket, 0);
    expect(closed).not.toHaveBeenCalled();
  });

  it.each([
    {event: 'close', online: false},
    {event: 'error', online: true},
  ])('reports an admitted socket $event for the reconnect scheduler', async ({event, online}) => {
    const socket = await admit();
    Object.assign(navigator, {onLine: online});
    const closed = jest.fn();
    manager.on('socketClose', closed);
    if (event === 'close') socket.nativeClose();
    else socket.onerror?.();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledWith({shouldReconnect: true});
    expectReleased(socket, 0);
    expect(LoggerProxy.error).toHaveBeenCalledWith(
      `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: ${online
        ? 'missing keepalive from either desktop or notif service' : 'network issue'}`,
      {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.WEB_SOCKET_ON_CLOSE_HANDLER}
    );
  });

  it('supersedes pending and accepted sockets without admitting stale callbacks', async () => {
    const first = await start();
    const observed = expect(first.promise).rejects.toMatchObject({name: 'AbortError'});
    const oldOpen = first.socket.onopen!;
    const oldMessage = first.socket.onmessage!;
    const oldClose = first.socket.onclose!;
    const second = await admit(otherUrl);
    await observed;
    expect(first.socket.close).toHaveBeenCalledTimes(1);
    oldOpen();
    oldMessage({data: JSON.stringify({type: 'Welcome', data: {agentId: 'late'}})});
    oldClose();
    expect(second.close).not.toHaveBeenCalled();
    expect(manager.hasUsableSocket()).toBe(true);

    const previousWorkerMessage = workers[0].onmessage;
    workers[0].postMessage.mockClear();
    await admit();
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(workers[0].onmessage).not.toBe(previousWorkerMessage);
    expect(workers[0].postMessage.mock.calls).toEqual([
      [{type: 'terminate'}],
      [{type: 'start', intervalDuration: KEEPALIVE_WORKER_INTERVAL,
        isSocketClosed: false, closeSocketTimeout: CLOSE_SOCKET_TIMEOUT}],
    ]);
  });

  it.each(['close', 'replace'])('does not open a late subscription after %s', async (action) => {
    const subscribed = createDeferred<{body: {webSocketUrl: string}}>();
    request.mockReturnValueOnce(subscribed.promise);
    const promise = initialize();
    const observed = expect(promise).rejects.toMatchObject({name: 'AbortError'});
    await flush();
    expect(SocketDouble.instances).toHaveLength(0);
    if (action === 'close') manager.close(false);
    else await admit(otherUrl);
    await observed;
    subscribed.resolve({body: {webSocketUrl: url}});
    await flush();
    expect(SocketDouble.instances).toHaveLength(action === 'close' ? 0 : 1);
    expect(manager.hasUsableSocket()).toBe(action === 'replace');
    expect(jest.getTimerCount()).toBe(0);
    if (action === 'replace') expect(manager.getUrl()).toBe(otherUrl);
  });

  it('rejects a closed connection before Welcome and stops its worker', async () => {
    const {promise, socket} = await start();
    const observed = expect(promise).rejects.toMatchObject({name: 'AbortError'});
    socket.open();
    const oldWorkerMessage = workers[0].onmessage!;
    manager.close(false);
    await observed;
    oldWorkerMessage({data: {type: 'keepalive'}});
    expect(socket.send).toHaveBeenCalledTimes(1);
    expectReleased(socket);
  });

  it.each([true, false])('closes once with reconnect choice %s', async (reconnect) => {
    const socket = await admit();
    const closed = jest.fn();
    manager.on('socketClose', closed);
    manager.close(reconnect);
    manager.close(reconnect);
    expect(closed.mock.calls).toEqual([[{shouldReconnect: reconnect}]]);
    expect(manager.shouldReconnect).toBe(reconnect);
    expectReleased(socket);
  });

  it.each([false, true])('forces a worker close only after connection loss (%s)', async (isConnectionLost) => {
    const socket = await admit();
    const message = workers[0].onmessage!;
    message({data: {type: 'keepalive'}});
    expect(socket.send).toHaveBeenCalledTimes(2);
    socket.readyState = 3;
    message({data: {type: 'keepalive'}});
    expect(socket.send).toHaveBeenCalledTimes(2);
    socket.readyState = 1;
    manager.handleConnectionLost({isConnectionLost, isKeepAlive: false,
      isSocketReconnected: false, isRestoreFailed: false});
    message({data: {type: 'closeSocket'}});
    expect(socket.close).toHaveBeenCalledTimes(isConnectionLost ? 1 : 0);
    expect(manager.hasUsableSocket()).toBe(!isConnectionLost);
  });

  it('closes on multi-login before notifying listeners and keeps replacements independent', async () => {
    const socket = await admit();
    const oldClose = socket.onclose!;
    const oldWorker = workers[0].onmessage!;
    let replacement: ReturnType<typeof start> | undefined;
    manager.once('message', () => {
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(manager.shouldReconnect).toBe(false);
      replacement = start(otherUrl);
    });
    socket.message({type: 'AGENT_MULTI_LOGIN'});
    const next = await replacement!;
    next.socket.open();
    next.socket.message({type: 'Welcome', data: {}});
    await next.promise;
    oldClose();
    oldWorker({data: {type: 'closeSocket'}});
    expect(next.socket.close).not.toHaveBeenCalled();
    expect(manager.hasUsableSocket()).toBe(true);
  });

  it('passes malformed payloads to consumers only after Welcome', async () => {
    const {promise, socket} = await start();
    const received = jest.fn();
    manager.on('message', received);
    socket.message('not JSON');
    expect(received).not.toHaveBeenCalled();
    socket.open();
    socket.message({type: 'Welcome', data: {}});
    await promise;
    socket.message('not JSON');
    expect(received).toHaveBeenLastCalledWith('not JSON');
    socket.message('null');
    expect(received).toHaveBeenLastCalledWith('null');
  });

  it('rejects a socket construction failure and clears the Welcome deadline', async () => {
    const failure = new Error('Socket construction failed');
    global.WebSocket = jest.fn(() => { throw failure; }) as any;
    await expect(initialize()).rejects.toBe(failure);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps signed URLs out of socket-close diagnostics', async () => {
    const socket = await admit();

    manager.close(false, url);
    expectReleased(socket);
    const calls = (LoggerProxy.log as jest.Mock).mock.calls;
    expect(calls).toContainEqual(['WebSocket connection closed', {
      module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CLOSE,
    }]);
    expect(JSON.stringify(calls)).not.toContain('private-sentinel');
  });
});
