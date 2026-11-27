import {WebSocketManager, parseServingRegion} from '../../../../../../src/services/core/websocket/WebSocketManager';
import type {WebexSDK} from '../../../../../../src/types';
import {SUBSCRIBE_API, RTD_SUBSCRIBE_API, WCC_API_GATEWAY} from '../../../../../../src/services/constants';
import {METHODS, REFERENCE_SERVING_REGIONS, TIMEOUT_REQ} from '../../../../../../src/services/core/constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../../../../src/constants';
import {getSubscriptionMismatchReason, normalizeRecoveryFailure} from '../../../../../../src/services/core/Utils';
import LoggerProxy from '../../../../../../src/logger-proxy';
import {createDeferred} from '../../../../fixtures/aiSummaryTestUtils';

jest.mock('../../../../../../src/logger-proxy', () => ({__esModule: true, default: {
  log: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(), trace: jest.fn(), initialize: jest.fn(),
}}));

class SocketDouble {
  static instances: SocketDouble[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: {data: string}) => void) | null = null;
  send = jest.fn();
  close = jest.fn(() => { this.readyState = 3; });
  constructor(public url: string) { SocketDouble.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({data: typeof data === 'string' ? data : JSON.stringify(data)}); }
  nativeClose() { this.readyState = 3; this.onclose?.(); }
}

const body = {force: true, isKeepAliveEnabled: false, clientType: 'WebexCCSDK', allowMultiLogin: true};
const trustedUrls = [
  'wss://routing.produs1.cisco.com/notifications?signature=first%2Ftoken',
  'wss://routing.prodeu2.ciscoccservice.com/notifications?signature=second%2Btoken',
];
const subscriptionFailures = [
  {
    name: '401 authentication failure',
    phase: 'reject',
    failure: {statusCode: 401, body: {webSocketUrl: trustedUrls[0]}},
    classification: {status: 401},
    mismatch: undefined,
  },
];
const flush = async () => { for (let turn = 0; turn < 8; turn += 1) await Promise.resolve(); };
const regions = ['intgus1', 'qaus1', 'loadus1', 'loadus2', 'produs1', 'produs2', 'prodanz1', 'prodca1', 'prodeu1', 'prodeu2', 'prodin1', 'prodjp1', 'prodsg1'];
const loggerLevels = ['log', 'info', 'warn', 'trace', 'error'] as const;
const signedUrl = 'wss://routing.produs1.cisco.com/?signature=transport-signature-sentinel';
const bearer = 'Bearer transport-bearer-sentinel';
const throwOnDiagnostics = () => loggerLevels.forEach((level) => {
  (LoggerProxy[level] as jest.Mock).mockImplementation(() => { throw new Error('logger'); });
});
const expectSafeDiagnostics = (expectedCalls: unknown[][], throwing = false) => {
  const seen = new Set<unknown>();
  const inspect = (value: unknown) => {
    if (typeof value === 'string') {
      ['transport-signature-sentinel', 'transport-bearer-sentinel', signedUrl, bearer].forEach((secret) => {
        expect(value).not.toContain(secret);
      });
    } else if (value && typeof value === 'object' && !seen.has(value)) {
      seen.add(value);
      // Error messages and stacks are non-enumerable and disappear in JSON.stringify.
      if (value instanceof Error) {
        inspect(value.message);
        inspect(value.stack);
      }
      Object.entries(value).forEach(([key, entry]) => { inspect(key); inspect(entry); });
    }
  };
  loggerLevels.forEach((level) => {
    const {calls, results} = (LoggerProxy[level] as jest.Mock).mock;
    const expected = level === 'log' ? expectedCalls : [];
    inspect(calls);
    expect(calls).toEqual(expected);
    expect(results.map((result) => result.type)).toEqual(expected.map(() => throwing ? 'throw' : 'return'));
  });
  if (expectedCalls.length) expect(LoggerProxy.log).toHaveBeenCalled();
};

describe('WebSocketManager owned admission', () => {
  let manager: WebSocketManager;
  let request: jest.Mock;
  let integration: jest.Mock;
  let org: jest.Mock;
  let updateServices: jest.Mock;
  let workers: Array<{postMessage: jest.Mock; terminate: jest.Mock; onmessage: ((event: any) => void) | null}>;
  const originalSocket = global.WebSocket;
  const originalWorker = global.Worker;
  const originalBlob = global.Blob;
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    [...loggerLevels, 'initialize' as const].forEach((level) => {
      (LoggerProxy[level] as jest.Mock).mockReset();
    });
    jest.useFakeTimers('modern');
    SocketDouble.instances = [];
    workers = [];
    global.WebSocket = SocketDouble as any;
    global.Blob = class BlobDouble {} as any;
    global.Worker = jest.fn(() => {
      const worker = {postMessage: jest.fn(), terminate: jest.fn(), onmessage: null};
      workers.push(worker);
      return worker;
    }) as any;
    URL.createObjectURL = jest.fn(() => `blob:attempt-${workers.length}`);
    URL.revokeObjectURL = jest.fn();
    request = jest.fn().mockResolvedValue({statusCode: 200, body: {webSocketUrl: 'wss://routing.produs1.cisco.com/?signature=private'}});
    integration = jest.fn(() => true);
    org = jest.fn(() => 'org-id');
    updateServices = jest.fn().mockResolvedValue(undefined);
    manager = new WebSocketManager({webex: {request, credentials: {getOrgId: org}, internal: {services: {isIntegrationEnvironment: integration, updateServices}}} as unknown as WebexSDK});
  });

  afterEach(() => {
    manager.close(false);
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.WebSocket = originalSocket;
    global.Worker = originalWorker;
    global.Blob = originalBlob;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
  });

  const start = async (resource = SUBSCRIBE_API, signal?: AbortSignal) => {
    const promise = manager.initWebSocket({body, resource, signal});
    promise.catch(() => undefined);
    await flush();
    return {promise, socket: SocketDouble.instances[SocketDouble.instances.length - 1]};
  };
  const admit = async (resource = SUBSCRIBE_API, signal?: AbortSignal) => {
    const result = await start(resource, signal);
    result.socket.open();
    result.socket.message({type: 'Welcome', data: {}});
    await result.promise;
    return result.socket;
  };
  const observeSettlement = (promise: Promise<unknown>) => {
    const resolved = jest.fn(), rejected = jest.fn();
    return {resolved, rejected, settled: promise.then(resolved, rejected)};
  };
  const captureCallbacks = (socket: SocketDouble) => {
    const {onopen, onmessage, onerror, onclose} = socket;
    const workerMessage = workers[workers.length - 1]?.onmessage;
    return () => {
      onopen!();
      onmessage!({data: JSON.stringify({type: 'Welcome', data: {agentId: 'late-agent'}})});
      onerror!({type: 'error'});
      onclose!();
      workerMessage?.({data: {type: 'keepalive'}});
      workerMessage?.({data: {type: 'closeSocket'}});
    };
  };
  const expectReleasedSocket = (socket: SocketDouble, closeCalls = 1) => {
    expect(socket.close).toHaveBeenCalledTimes(closeCalls);
    expect(socket.onopen).toBeNull(); expect(socket.onmessage).toBeNull();
    expect(socket.onerror).toBeNull(); expect(socket.onclose).toBeNull();
  };
  const expectReleasedWorker = (index = 0) => {
    expect(workers[index].onmessage).toBeNull();
    expect(workers[index].postMessage).toHaveBeenCalledTimes(1);
    expect(workers[index].terminate).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(index + 1, `blob:attempt-${index}`);
  };
  const expectInactive = () => {
    expect(manager.hasUsableSocket()).toBe(false);
    expect(manager.getServingRegion()).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  };

  it.each([SUBSCRIBE_API, RTD_SUBSCRIBE_API])('preservesIntHeaderAndAllowlist / preservesHostAuthentication lazy worker %s', async (resource) => {
    expect(global.Worker).not.toHaveBeenCalled();
    const {promise, socket} = await start(resource);
    expect(global.Worker).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith({service: WCC_API_GATEWAY, resource, method: 'POST', body, headers: {'X-ORGANIZATION-ID': 'org-id'}, timeout: TIMEOUT_REQ});
    socket.open();
    socket.message({type: 'Welcome', data: {}});
    await promise;
    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(org).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([[false, 'org-id'], [true, ''], [undefined, 'org-id']])('preservesIntHeaderAndAllowlist INT-only header policy integration=%s org=%s', async (isInt, orgId) => {
    integration.mockReturnValue(isInt); org.mockReturnValue(orgId);
    if (isInt === undefined) {
      manager = new WebSocketManager({webex: {request, credentials: {getOrgId: org}} as unknown as WebexSDK});
    }
    await admit();
    expect(manager.hasUsableSocket()).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({service: WCC_API_GATEWAY, resource: SUBSCRIBE_API, method: 'POST', body, headers: undefined, timeout: TIMEOUT_REQ});
  });

  it.each(['http://routing.cisco.com', 'ws://routing.cisco.com', 'wss://evil.test/?cisco.com', 'wss://cisco.com.evil.test'])('preservesIntHeaderAndAllowlist rejects unauthorized URL %s', async (url) => {
    request.mockResolvedValue({body: {webSocketUrl: url}});
    await expect(manager.initWebSocket({body, resource: SUBSCRIBE_API})).rejects.toThrow('Rejected webSocketUrl');
    expect(SocketDouble.instances).toHaveLength(0);
  });

  it.each([
    {name: 'insecure URL', response: {statusCode: 200, body: {webSocketUrl: 'ws://routing.prodin1.cisco.com'}}, failure: undefined},
    {name: 'untrusted URL', response: {statusCode: 200, body: {webSocketUrl: 'wss://evil.test/?cisco.com'}}, failure: undefined},
    {name: 'subscription failure', response: undefined, failure: {statusCode: 503}},
  ])('T-003 freshAttemptOwnsUrl after $name', async ({response, failure}) => {
    trustedUrls.forEach((webSocketUrl) => request.mockResolvedValueOnce({statusCode: 200, body: {webSocketUrl}}));
    const first = await admit();
    const replayFirst = captureCallbacks(first);
    const second = await admit();
    expect(SocketDouble.instances.map((socket) => socket.url)).toEqual(trustedUrls);
    expect(request.mock.calls).toEqual(trustedUrls.map(() => [{
      service: WCC_API_GATEWAY, resource: SUBSCRIBE_API, method: 'POST', body,
      headers: {'X-ORGANIZATION-ID': 'org-id'}, timeout: TIMEOUT_REQ,
    }]));
    expectReleasedSocket(first); expectReleasedWorker(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(manager.getServingRegion()).toBe('prodeu2');
    replayFirst();
    expect(manager.hasUsableSocket()).toBe(true);
    expect(manager.getServingRegion()).toBe('prodeu2');
    expect(second.close).not.toHaveBeenCalled();
    expect(workers).toHaveLength(2);

    if (failure) request.mockRejectedValueOnce(failure);
    else request.mockResolvedValueOnce(response);
    const failed = manager.initWebSocket({body, resource: SUBSCRIBE_API});
    if (failure) await expect(failed).rejects.toBe(failure);
    else await expect(failed).rejects.toThrow('Rejected webSocketUrl');

    expect(SocketDouble.instances.map((socket) => socket.url)).toEqual(trustedUrls);
    expect(request).toHaveBeenCalledTimes(3);
    expectReleasedSocket(first); expectReleasedSocket(second);
    expectReleasedWorker(0); expectReleasedWorker(1);
    expect(workers).toHaveLength(2);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expectInactive();
  });

  it.each(subscriptionFailures)('T-003 rejectsSubscribeFailure $phase $name', async ({phase, failure, classification, mismatch}) => {
    if (phase === 'reject') request.mockRejectedValueOnce(failure);
    else request.mockResolvedValueOnce(failure);
    const promise = manager.initWebSocket({body, resource: SUBSCRIBE_API});
    await expect(promise).rejects.toBe(failure);
    expect(normalizeRecoveryFailure(failure)).toEqual(classification);
    expect(getSubscriptionMismatchReason(failure)).toBe(mismatch);
    expect(SocketDouble.instances).toHaveLength(0);
    expect(workers).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
    expectInactive();
  });

  it.each(['resolve', 'reject'])('refreshes U2C and subscribes once through updated service routing after a %s 409', async (phase) => {
    const mismatch = {statusCode: 409, headers: {'X-WXCC-Region-Reason': 'REGION_MISMATCH_NO_OVERRIDE'}};
    let gateway = 'https://api.produs1.ciscoccservice.com';
    const requestedHosts: string[] = [];
    request.mockImplementation(() => {
      requestedHosts.push(gateway);
      if (gateway.includes('produs1')) {
        return phase === 'resolve' ? Promise.resolve(mismatch) : Promise.reject(mismatch);
      }
      return Promise.resolve({statusCode: 200, body: {webSocketUrl: trustedUrls[1]}});
    });
    updateServices.mockImplementation(async () => { gateway = 'https://api.prodeu2.ciscoccservice.com'; });

    const socket = await admit();

    expect(updateServices).toHaveBeenCalledTimes(1);
    expect(updateServices).toHaveBeenCalledWith({forceRefresh: true});
    expect(requestedHosts).toEqual(['https://api.produs1.ciscoccservice.com', 'https://api.prodeu2.ciscoccservice.com']);
    expect(socket.url).toBe(trustedUrls[1]);
    expect(manager.getServingRegion()).toBe('prodeu2');
  });

  it.each([
    {resource: RTD_SUBSCRIBE_API, error: {statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}}},
    {resource: SUBSCRIBE_API, error: {statusCode: 409, body: {reason: 'ANOTHER_CONFLICT'}}},
    {resource: SUBSCRIBE_API, error: {statusCode: 401}},
  ])('preserves ordinary failure handling without refreshing U2C for $resource $error', async ({resource, error}) => {
    request.mockRejectedValueOnce(error);

    await expect(manager.initWebSocket({body, resource})).rejects.toBe(error);

    expect(updateServices).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('propagates a failed U2C refresh without resubscribing', async () => {
    request.mockRejectedValueOnce({statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}});
    const error = {statusCode: 403};
    updateServices.mockRejectedValueOnce(error);

    await expect(manager.initWebSocket({body, resource: SUBSCRIBE_API})).rejects.toBe(error);

    expect(updateServices).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expectInactive();
  });

  it('stops after one catalog refresh when subscribe still reports a region mismatch', async () => {
    const error = {statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}};
    request.mockRejectedValue(error);

    await expect(manager.initWebSocket({body, resource: SUBSCRIBE_API})).rejects.toBe(error);

    expect(updateServices).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
    expectInactive();
  });

  it.each(['close', 'deadline'])('does not resubscribe after %s during a catalog refresh', async (ending) => {
    const refresh = createDeferred<void>();
    request.mockRejectedValueOnce({statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}});
    updateServices.mockReturnValueOnce(refresh.promise);
    const {promise} = await start();
    const rejected = expect(promise).rejects.toThrow(ending === 'close' ? 'RECOVERY_INTERRUPTED' : 'Subscribe deadline');

    if (ending === 'close') manager.close(false);
    else jest.advanceTimersByTime(TIMEOUT_REQ);
    await rejected;
    refresh.resolve();
    await flush();

    expect(request).toHaveBeenCalledTimes(1);
    expect(SocketDouble.instances).toHaveLength(0);
    expectInactive();
  });

  it('T-011 all13ExactLabels', () => {
    expect([...REFERENCE_SERVING_REGIONS]).toEqual(regions);
    for (const region of regions) {
      expect(parseServingRegion(`wss://routing.${region.toUpperCase()}.cisco.com/?not-region=produs2`)).toBe(region);
    }
  });

  it.each([
    'wss://prefix-prodeu2.cisco.com/?region=prodeu2',
    'wss://prodeu2suffix.cisco.com',
    'wss://cisco.com/?region=prodeu2',
    'not a url',
  ])('T-011 ignores non-region URL %s', (url) => {
    expect(parseServingRegion(url)).toBeUndefined();
  });

  it.each([SUBSCRIBE_API, RTD_SUBSCRIBE_API])('T-003 welcomeStructureOnlyForPrimaryAndRtd %s', async (resource) => {
    const {promise, socket} = await start(resource);
    socket.open();
    socket.message({type: 'Welcome', data: {withoutAgentId: true}});
    await expect(promise).resolves.toEqual({withoutAgentId: true});
  });

  it.each([undefined, [], 'agent'])('bounds malformed Welcome data %# without requiring agentId', async (data) => {
    const {promise, socket} = await start();
    socket.open(); socket.message({type: 'Welcome', data});
    jest.advanceTimersByTime(29999); await flush();
    expect(manager.hasUsableSocket()).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow('Welcome deadline');
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });

  it.each(['resolve', 'reject'])('bounds pending subscribe at 20 seconds and observes its late %s', async (lateResult) => {
    const pending = createDeferred<any>(); request.mockReturnValue(pending.promise);
    const promise = manager.initWebSocket({body, resource: SUBSCRIBE_API});
    const settlement = observeSettlement(promise);
    const observed = expect(promise).rejects.toThrow('Subscribe deadline');
    jest.advanceTimersByTime(19999); await flush();
    expect(settlement.rejected).not.toHaveBeenCalled();
    expect(settlement.resolved).not.toHaveBeenCalled();
    expect(SocketDouble.instances).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1); await observed;
    if (lateResult === 'resolve') pending.resolve({statusCode: 200, body: {webSocketUrl: trustedUrls[1]}});
    else pending.reject(Object.assign(new Error('late'), {statusCode: 503}));
    await flush(); await settlement.settled;
    expect(settlement.rejected).toHaveBeenCalledTimes(1);
    expect(settlement.resolved).not.toHaveBeenCalled();
    expect(SocketDouble.instances).toHaveLength(0);
    expect(workers).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
    expectInactive();
  });

  it.each([false, true])('T-003 subscribe20sWelcome30s opened=%s ignores Welcome captured before expiration', async (opened) => {
    const pending = createDeferred<any>(); request.mockReturnValueOnce(pending.promise);
    const {promise} = await start();
    const settlement = observeSettlement(promise);
    const messages = jest.fn(); manager.on('message', messages);
    const socketClose = jest.fn(); manager.on('socketClose', socketClose);
    jest.advanceTimersByTime(19999); await flush();
    expect(SocketDouble.instances).toHaveLength(0);
    pending.resolve({statusCode: 200, body: {webSocketUrl: trustedUrls[0]}});
    await flush();
    const socket = SocketDouble.instances[0];
    // Delay native open so the Welcome deadline cannot accidentally start at open.
    jest.advanceTimersByTime(10000); await flush();
    if (opened) socket.open();
    const replay = captureCallbacks(socket);
    jest.advanceTimersByTime(19999); await flush();
    expect(settlement.rejected).not.toHaveBeenCalled();
    expect(settlement.resolved).not.toHaveBeenCalled();
    expect(manager.hasUsableSocket()).toBe(false);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow('Welcome deadline');
    await settlement.settled;
    expectInactive();
    replay(); jest.advanceTimersByTime(60000); await flush();
    expect(settlement.rejected).toHaveBeenCalledTimes(1);
    expect(settlement.resolved).not.toHaveBeenCalled();
    expect(messages).not.toHaveBeenCalled();
    expect(socketClose).not.toHaveBeenCalled();
    expectReleasedSocket(socket);
    expect(workers).toHaveLength(opened ? 1 : 0);
    expect(socket.send).toHaveBeenCalledTimes(opened ? 1 : 0);
    if (opened) expectReleasedWorker();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(opened ? 1 : 0);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(opened ? 1 : 0);
    expect(SocketDouble.instances.map((instance) => instance.url)).toEqual([trustedUrls[0]]);
    expect(request).toHaveBeenCalledTimes(1);
    expectInactive();
  });

  it.each(['close', 'error'].flatMap((event) => [false, true].map((opened) => ({event, opened}))))('T-003 closeBeforeWelcome $event opened=$opened settles once', async ({event, opened}) => {
    const {promise, socket} = await start();
    const settlement = observeSettlement(promise);
    const socketClose = jest.fn(); manager.on('socketClose', socketClose);
    const messages = jest.fn(); manager.on('message', messages);
    if (opened) socket.open();
    const replay = captureCallbacks(socket);
    if (event === 'close') socket.nativeClose();
    else socket.onerror!({type: 'error'});
    await expect(promise).rejects.toThrow(event === 'close' ? 'WebSocket closed' : 'WebSocket connection failed');
    await settlement.settled;
    expectInactive();
    replay(); manager.close(false);
    jest.advanceTimersByTime(60000); await flush();
    expect(settlement.rejected).toHaveBeenCalledTimes(1);
    expect(settlement.resolved).not.toHaveBeenCalled();
    expect(socketClose).not.toHaveBeenCalled();
    expect(messages).not.toHaveBeenCalled();
    expectReleasedSocket(socket, 0);
    expect(workers).toHaveLength(opened ? 1 : 0);
    expect(socket.send).toHaveBeenCalledTimes(opened ? 1 : 0);
    if (opened) expectReleasedWorker();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(opened ? 1 : 0);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(opened ? 1 : 0);
    expect(SocketDouble.instances).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
    expectInactive();
  });

  it('T-003 usableSocketRequiresCurrentWelcome', async () => {
    expect(manager.hasUsableSocket()).toBe(false);
    const {promise, socket} = await start();
    expect(manager.hasUsableSocket()).toBe(false);
    socket.open(); expect(manager.hasUsableSocket()).toBe(false);
    socket.message({type: 'Welcome', data: {}}); await promise;
    expect(manager.hasUsableSocket()).toBe(true);
    socket.readyState = 3; expect(manager.hasUsableSocket()).toBe(false);
    socket.readyState = 1; manager.close(false); expect(manager.hasUsableSocket()).toBe(false);
  });

  it('T-011 primaryPlacementAccessorAndReset', async () => {
    const socket = await admit();
    expect(manager.getServingRegion()).toBe('produs1');
    manager.clearServingRegion(); manager.clearServingRegion();
    expect(manager.getServingRegion()).toBeUndefined();
    expect(socket.close).not.toHaveBeenCalled();
    socket.message({type: 'Welcome', data: {}});
    expect(manager.getServingRegion()).toBeUndefined();
    const next = await admit();
    const onClose = next.onclose!;
    const regionsAtClose: Array<string | undefined> = [];
    manager.on('socketClose', () => { regionsAtClose.push(manager.getServingRegion()); });
    expect(manager.getServingRegion()).toBe('produs1');
    next.nativeClose();
    expect(regionsAtClose).toEqual([undefined]);
    expect(manager.getServingRegion()).toBeUndefined();
    const replacement = await admit();
    onClose();
    expect(regionsAtClose).toEqual([undefined]);
    expect(manager.getServingRegion()).toBe('produs1');
    expect(replacement.close).not.toHaveBeenCalled();
    manager.close(false); expect(manager.getServingRegion()).toBeUndefined();
    expect(regionsAtClose).toEqual([undefined, undefined]);
  });

  it('T-011 rtdNeverRecordsPlacement', async () => {
    await admit(RTD_SUBSCRIBE_API);
    expect(manager.hasUsableSocket()).toBe(true);
    expect(manager.getServingRegion()).toBeUndefined();
  });

  it.each(['resolve', 'reject'])('T-003 supersededHttpOpenWelcomeInert HTTP=%s', async (settle) => {
    const pending = createDeferred<any>(); request.mockReturnValueOnce(pending.promise);
    const old = manager.initWebSocket({body, resource: SUBSCRIBE_API});
    const observed = expect(old).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
    const replacement = await admit(); await observed;
    if (settle === 'resolve') pending.resolve({body: {webSocketUrl: 'wss://old.prodeu1.cisco.com'}});
    else pending.reject(new Error('late HTTP failure'));
    await flush();
    expect(SocketDouble.instances).toHaveLength(1);
    expect(manager.getServingRegion()).toBe('produs1');
    expect(replacement.close).not.toHaveBeenCalled();
  });

  it('ignores captured stale open/Welcome/close/worker and old abort callbacks', async () => {
    const parent = new AbortController(); const old = await start(SUBSCRIBE_API, parent.signal);
    const observed = expect(old.promise).rejects.toThrow();
    const open = old.socket.onopen!, message = old.socket.onmessage!, close = old.socket.onclose!;
    const current = await admit(); await observed;
    open(); message({data: JSON.stringify({type: 'Welcome', data: {}})}); close(); parent.abort();
    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(current.close).not.toHaveBeenCalled();
    expect(manager.hasUsableSocket()).toBe(true);
  });

  it('disposes the worker and Blob URL on close', async () => {
    const socket = await admit();
    const workerMessage = workers[0].onmessage!;
    expect(manager.hasUsableSocket()).toBe(true);
    workerMessage({data: {type: 'keepalive'}});
    expect(socket.send).toHaveBeenCalledTimes(2);
    manager.close(false); manager.close(false);
    workerMessage({data: {type: 'keepalive'}});
    expect(socket.send).toHaveBeenCalledTimes(2);
    expectReleasedWorker();
  });

  it.each([true, false])('T-003 workerAndBlobOwnership forced close requires connection loss=%s', async (isConnectionLost) => {
    const socket = await admit();
    const replay = captureCallbacks(socket);
    const workerMessage = workers[0].onmessage!;
    const socketClose = jest.fn(); manager.on('socketClose', socketClose);
    const messages = jest.fn(); manager.on('message', messages);
    manager.handleConnectionLost({isConnectionLost, isRestoreFailed: false,
      isSocketReconnected: false, isKeepAlive: false});
    workerMessage({data: {type: 'closeSocket'}});
    if (!isConnectionLost) {
      expect(socket.close).not.toHaveBeenCalled();
      expect(socketClose).not.toHaveBeenCalled();
      expect(workers[0].terminate).not.toHaveBeenCalled();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      expect(manager.hasUsableSocket()).toBe(true);
      expect(manager.getServingRegion()).toBe('produs1');
      manager.close(false);
    }
    expectReleasedSocket(socket); expectReleasedWorker();
    expect(socketClose.mock.calls).toEqual([[{shouldReconnect: isConnectionLost}]]);
    expectInactive();

    manager.handleConnectionLost({isConnectionLost: true, isRestoreFailed: false,
      isSocketReconnected: false, isKeepAlive: false});
    replay(); replay();
    expect(manager.shouldReconnect).toBe(isConnectionLost);
    manager.close(isConnectionLost);
    await flush();
    expectReleasedSocket(socket); expectReleasedWorker();
    expect(socketClose.mock.calls).toEqual([[{shouldReconnect: isConnectionLost}]]);
    expect(manager.shouldReconnect).toBe(isConnectionLost);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(messages).not.toHaveBeenCalled();
    expect(SocketDouble.instances).toHaveLength(1);
    expect(workers).toHaveLength(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expectInactive();
  });

  it('cancels pending socket admission on abort and never admits a pre-aborted parent', async () => {
    const parent = new AbortController(); const old = await start(SUBSCRIBE_API, parent.signal);
    const observed = expect(old.promise).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
    parent.abort(); await observed;
    expect(old.socket.close).toHaveBeenCalledTimes(1);
    await expect(manager.initWebSocket({body, resource: SUBSCRIBE_API, signal: parent.signal})).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    {resource: SUBSCRIBE_API, data: undefined},
    {resource: RTD_SUBSCRIBE_API, data: {type: 'AgentMultiLoginCloseSession', agentSessionId: 'mismatch'}},
  ])('T-012 blanketMultiLoginNoReconnect $resource', async ({resource, data}) => {
    const socket = await admit(resource); const close = socket.onclose!;
    const observations: Array<{closeCalls: number; shouldReconnect: boolean}> = [];
    const listener = jest.fn(() => { observations.push({closeCalls: socket.close.mock.calls.length, shouldReconnect: manager.shouldReconnect}); });
    manager.on('message', listener);
    socket.message({type: 'AGENT_MULTI_LOGIN', data});
    expect(observations).toEqual([{closeCalls: 1, shouldReconnect: false}]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(manager.shouldReconnect).toBe(false);
    close(); jest.advanceTimersByTime(100000); await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(manager.hasUsableSocket()).toBe(false);
  });

  it('delivers a region switch only after Welcoming the socket', async () => {
    const {promise, socket} = await start();
    socket.open();
    const received = jest.fn(() => {
      expect(manager.hasUsableSocket()).toBe(true);
    });
    manager.on('message', received);
    const regionSwitch = JSON.stringify({type: 'SYSTEM_REGION_SWITCH'});
    socket.message(regionSwitch);
    expect(received).not.toHaveBeenCalled();

    socket.message({type: 'Welcome', data: {}});
    await expect(promise).resolves.toEqual({});
    socket.message(regionSwitch);
    expect(received).toHaveBeenLastCalledWith(regionSwitch);
  });

  it('passes the raw payload to message listeners', async () => {
    const {promise, socket} = await start();
    socket.open();
    const raw = jest.fn();
    manager.on('message', raw);
    socket.message('not JSON');
    expect(raw).not.toHaveBeenCalled();

    socket.message({type: 'Welcome', data: {}});
    await promise;
    socket.message('not JSON');
    expect(raw).toHaveBeenLastCalledWith('not JSON');
    socket.message('null');
    expect(raw).toHaveBeenLastCalledWith('null');
  });

  it('releases the socket if the keepalive worker could not start', async () => {
    const error = new Error('Keepalive worker blocked');
    (global.Worker as jest.Mock).mockImplementationOnce(() => { throw error; });
    const {promise, socket} = await start();

    socket.open();

    await expect(promise).rejects.toBe(error);
    expectReleasedSocket(socket);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does not close an observer-created replacement after raw multi-login', async () => {
    const old = await admit(); let replacement: Promise<unknown> | undefined;
    manager.once('message', () => { replacement = manager.initWebSocket({body, resource: SUBSCRIBE_API}); });
    old.message({type: 'AGENT_MULTI_LOGIN'}); await flush();
    const next = SocketDouble.instances[1]; next.open(); next.message({type: 'Welcome', data: {}});
    await replacement;
    expect(old.close).toHaveBeenCalledTimes(1); expect(next.close).not.toHaveBeenCalled();
  });

  describe('T-013 safe transport diagnostics', () => {
    it('preserves subscription rejection without logging signed URLs or raw errors', async () => {
      const failure = Object.assign(new Error(`Subscribe failed ${signedUrl} ${bearer}`), {
        statusCode: 503, request: {url: signedUrl, headers: {Authorization: bearer}},
      });
      request.mockRejectedValueOnce(failure);
      const socketClose = jest.fn(); manager.on('socketClose', socketClose);

      await expect(manager.initWebSocket({body, resource: SUBSCRIBE_API})).rejects.toBe(failure);

      expect(SocketDouble.instances).toHaveLength(0);
      expect(workers).toHaveLength(0);
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.getServingRegion()).toBeUndefined();
      expect(socketClose).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      expectSafeDiagnostics([]);
    });

    it('sanitizes native socket errors and releases the worker', async () => {
      request.mockResolvedValueOnce({body: {webSocketUrl: signedUrl}});
      const {promise, socket} = await start(); socket.open();
      const failure = new Error(`Native socket error ${signedUrl} ${bearer}`);
      const socketClose = jest.fn(); manager.on('socketClose', socketClose);
      const rejected = promise.catch((error) => error);

      expect(() => socket.onerror!({type: 'error', message: failure.message, error: failure, target: socket})).not.toThrow();
      const error = await rejected;

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBe(failure);
      expect(error.message).toBe('WebSocket connection failed');
      expect(socket.url).toBe(signedUrl);
      expect(socket.close).not.toHaveBeenCalled();
      expect(socket.onopen).toBeNull(); expect(socket.onmessage).toBeNull();
      expect(socket.onerror).toBeNull(); expect(socket.onclose).toBeNull();
      expectReleasedWorker();
      expect(manager.hasUsableSocket()).toBe(false);
      expect(socketClose).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      expectSafeDiagnostics([]);
    });

    it('disposes every resource despite throwing cleanup and diagnostics', async () => {
      throwOnDiagnostics();
      request.mockResolvedValueOnce({body: {webSocketUrl: signedUrl}});
      const socket = await admit();
      const failure = new Error(`Disposal failed ${signedUrl} ${bearer}`);
      socket.close.mockImplementationOnce(() => { throw failure; });
      workers[0].terminate.mockImplementationOnce(() => { throw failure; });
      (URL.revokeObjectURL as jest.Mock).mockImplementationOnce(() => { throw failure; });
      const socketClose = jest.fn(); manager.on('socketClose', socketClose);

      expect(() => manager.close(false, `${signedUrl} ${bearer}`)).not.toThrow();
      expect(() => manager.close(false, `${signedUrl} ${bearer}`)).not.toThrow();

      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(socket.onopen).toBeNull(); expect(socket.onmessage).toBeNull();
      expect(socket.onerror).toBeNull(); expect(socket.onclose).toBeNull();
      expect(workers[0].onmessage).toBeNull();
      expect(workers[0].terminate).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attempt-0');
      expect(socketClose.mock.calls).toEqual([[{shouldReconnect: false}]]);
      expect(manager.shouldReconnect).toBe(false);
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.getServingRegion()).toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
      expectSafeDiagnostics([
        ...['Socket disposal failed', 'Worker disposal failed', 'Worker URL disposal failed'].map((message) => [message, {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.DISPOSE_ATTEMPT}]),
        ['WebSocket connection closed', {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CLOSE}],
      ], true);
    });
  });
});
