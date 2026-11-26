import {EventEmitter} from 'events';
import {ConnectionService} from '../../../../../../src/services/core/websocket/connection-service';
import {WebSocketManager} from '../../../../../../src/services/core/websocket/WebSocketManager';
import {SUBSCRIBE_API} from '../../../../../../src/services/constants';
import {CC_EVENTS} from '../../../../../../src/services/config/types';
import {createDeferred} from '../../../../fixtures/aiSummaryTestUtils';
import LoggerProxy from '../../../../../../src/logger-proxy';
import { CONNECTION_SERVICE_FILE } from '../../../../../../src/constants';
import {METHODS} from '../../../../../../src/services/core/constants';

class ManagerDouble extends EventEmitter {
  shouldReconnect = true;
  usable = false;
  initWebSocket = jest.fn(async (_options?: any) => { this.shouldReconnect = true; this.usable = true; return {}; });
  close = jest.fn((reconnect: boolean) => { this.shouldReconnect = reconnect; this.usable = false; });
  handleConnectionLost = jest.fn();
  hasUsableSocket = jest.fn(() => this.usable);
}
const subscribeRequest = {force: true, isKeepAliveEnabled: false, clientType: 'WebexCCSDK', allowMultiLogin: true};
const flush = async () => { for (let turn = 0; turn < 16; turn += 1) await Promise.resolve(); };
const tick = async (duration: number) => { jest.advanceTimersByTime(duration); await flush(); };
const levels = ['log', 'info', 'warn', 'error', 'trace'] as const;
const ordinaryRecords = () => (LoggerProxy.info as jest.Mock).mock.calls
  .filter(([message]) => message === 'Ordinary reconnect attempt settled');
const attemptRecord = (attempt: number, elapsedMs: number, outcome: string, failure = {}) => [
  'Ordinary reconnect attempt settled',
  {module: CONNECTION_SERVICE_FILE, method: METHODS.HANDLE_SOCKET_CLOSE,
    data: {attempt, elapsedMs, outcome, ...failure}},
];
const expectNoLoggedSecrets = (sinks: Array<jest.Mock | jest.SpyInstance>) => {
  expect(JSON.stringify(sinks.flatMap(sink => sink.mock.calls)))
    .not.toMatch(/SECRET|authorization|options|dialNumber|signature=|https?:|wss:/i);
};

describe('ConnectionService single-flight scheduler', () => {
  let service: ConnectionService;
  let manager: ManagerDouble;
  let registration: AbortController;
  let terminal: jest.Mock;
  let events: jest.Mock;
  let logger: Record<string, jest.Mock>;
  const oldLogger = LoggerProxy.logger;
  const oldNavigator = global.navigator;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    logger = Object.fromEntries(levels.map(level => [level, jest.fn()]));
    LoggerProxy.initialize(logger as any);
    levels.forEach(level => jest.spyOn(LoggerProxy, level));
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    manager = new ManagerDouble();
    service = new ConnectionService(manager as unknown as WebSocketManager);
    registration = new AbortController(); terminal = jest.fn(); events = jest.fn();
    manager.usable = true;
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    service.on('connectionLost', events);
  });
  afterEach(() => {
    service.stop(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
    Object.defineProperty(global, 'navigator', {value: oldNavigator, configurable: true});
    LoggerProxy.logger = oldLogger;
  });
  const recover = (overrides: Record<string, any> = {}) => {
    const parent = new AbortController();
    const onScheduled = jest.fn(), afterWelcome = jest.fn().mockResolvedValue(undefined), onAttemptSettled = jest.fn();
    const promise = service.recoverRegion({signal: parent.signal, onScheduled, afterWelcome, onAttemptSettled, ...overrides});
    promise.catch(() => undefined);
    return {promise, parent, onScheduled, afterWelcome, onAttemptSettled};
  };
  const lose = () => { manager.usable = false; manager.emit('socketClose', {shouldReconnect: true}); };
  const expectNoSecrets = () => expectNoLoggedSecrets([
    ...levels.map(level => LoggerProxy[level] as jest.Mock), ...Object.values(logger),
  ]);

  it('T-004 dr100603015WithFreshJitter / repeatFinalDelay', async () => {
    const samples = [0, 0.25, 0.5, 0.75, 0, 0.25, 0.5, 0.75];
    const delays = [100000, 67500, 37500, 20625, 15000, 16875, 18750, 20625];
    const random = Math.random as jest.Mock;
    random.mockReset().mockReturnValue(0);
    samples.forEach(sample => random.mockReturnValueOnce(sample));
    manager.initWebSocket.mockRejectedValue({statusCode: 503});
    const run = recover();
    for (const [index, delay] of delays.entries()) {
      expect(run.onScheduled.mock.calls).toEqual(delays.slice(0, index + 1)
        .map((wait, attempt) => [attempt + 1, wait]));
      expect(random).toHaveBeenCalledTimes(index + 1);
      await tick(delay - 1);
      expect(manager.initWebSocket).toHaveBeenCalledTimes(index);
      await tick(1);
      expect(manager.initWebSocket).toHaveBeenCalledTimes(index + 1);
    }
    expect(run.onScheduled).toHaveBeenLastCalledWith(delays.length + 1, 15000);
    expect(random).toHaveBeenCalledTimes(delays.length + 1);
    service.pause();
    await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    await tick(600000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(delays.length);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['wait', 'subscribe', 'restore'])('T-004 stoppedDriverNeverReopens %s', async phase => {
    const pending = createDeferred<any>();
    if (phase === 'subscribe') manager.initWebSocket.mockReturnValue(pending.promise);
    const run = recover(phase === 'restore' ? {afterWelcome: jest.fn().mockReturnValue(pending.promise)} : {});
    if (phase !== 'wait') await tick(100000);
    service.stop();
    await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    const calls = manager.initWebSocket.mock.calls.length;
    pending.reject(new Error('late work'));
    if (phase === 'wait') pending.promise.catch(() => undefined);
    lose(); manager.emit('message', JSON.stringify({keepalive: 'true'}));
    await tick(600000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(calls);
    expect(manager.listenerCount('message')).toBe(0);
    expect(manager.listenerCount('socketClose')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts stopped and reset installs one listener set without replacing an admitted socket', async () => {
    service.stop();
    service = new ConnectionService(manager as unknown as WebSocketManager);
    expect(manager.listenerCount('message')).toBe(0); expect(manager.listenerCount('socketClose')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    const beforeRegistration = recover();
    await expect(beforeRegistration.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    expect(beforeRegistration.onScheduled).not.toHaveBeenCalled();
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    expect(manager.listenerCount('message')).toBe(1); expect(manager.listenerCount('socketClose')).toBe(1);
    await tick(60000); expect(manager.initWebSocket).not.toHaveBeenCalled();
    service.stop(); expect(manager.listenerCount('message')).toBe(0); expect(manager.listenerCount('socketClose')).toBe(0);
  });

  it.each(['socket close', 'keepalive'])(
    'leaves a reset idle when a connectionLost observer replaces the registration during %s',
    async (source) => {
      const reset = jest.fn(() => {
        manager.usable = true;
        service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
      });
      service.once('connectionLost', reset);

      if (source === 'socket close') lose();
      else {
        manager.usable = true;
        manager.emit('message', JSON.stringify({keepalive: 'true'}));
      }

      expect(reset).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(2);
      await tick(5000);
      expect(manager.initWebSocket).not.toHaveBeenCalled();
      expect(events).toHaveBeenCalledTimes(1);
      expect(terminal).not.toHaveBeenCalled();

      lose();
      await tick(5000);
      expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    }
  );

  it('T-004 noOverlapUnderSlowAttempt / ordinaryReconnectDoesNotEnterDrPolicy five-second slots', async () => {
    const admission = createDeferred<any>(); manager.initWebSocket.mockReturnValueOnce(admission.promise);
    lose(); await tick(4999); expect(manager.initWebSocket).not.toHaveBeenCalled();
    await tick(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(manager.initWebSocket.mock.calls[0][0]).toMatchObject({body: subscribeRequest, resource: SUBSCRIBE_API});
    await tick(7000); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(ordinaryRecords()).toEqual([]);
    admission.reject({statusCode: 503}); await flush();
    await tick(2999); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    await tick(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(2);
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(1);
    expect(terminal).not.toHaveBeenCalled();
    expect(ordinaryRecords()).toEqual([
      attemptRecord(1, 12000, 'retrying', {status: 503}), attemptRecord(2, 15000, 'succeeded'),
    ]);
    lose(); await tick(5000);
    expect(ordinaryRecords().slice(-1)).toEqual([attemptRecord(1, 5000, 'succeeded')]);
  });

  it.each([undefined, 429, 503])('T-012 offline4295xxPacing ordinary status=%s', async (status) => {
    manager.initWebSocket.mockRejectedValue(Object.assign(new Error('MESSAGE_SECRET https://private.invalid/?signature=URL_SECRET'), {
      statusCode: status, id: 'admission-failure',
      headers: {trackingid: 'attempt-id\n', Authorization: 'BEARER_SECRET'},
      body: {reasonCode: '9999', reason: 'REMOTE_SECRET'},
      options: {headers: {authorization: 'LOWER_SECRET'}, body: {dialNumber: 'DN_SECRET'}},
      cause: new Error('CAUSE_SECRET'),
    }));
    lose();
    for (let attempt = 1; attempt <= 4; attempt += 1) { await tick(5000); expect(manager.initWebSocket).toHaveBeenCalledTimes(attempt); }
    expect(terminal).not.toHaveBeenCalled();
    const records = Array.from({length: 4}, (_, index) => attemptRecord(index + 1, (index + 1) * 5000,
      'retrying', {...(status !== undefined ? {status} : {}), reasonCode: 9999,
        id: 'admission-failure', trackingId: 'attempt-id'}));
    expect(ordinaryRecords()).toEqual(records);
    expectNoSecrets();
    service.pause(); await tick(100000); expect(manager.initWebSocket).toHaveBeenCalledTimes(4);
    expect(ordinaryRecords()).toEqual(records);
  });

  it('does not dispatch offline ordinary IO and retries only at five-second slots', async () => {
    Object.defineProperty(global, 'navigator', {value: {onLine: false}, configurable: true});
    lose(); await tick(5000); await tick(5000); expect(manager.initWebSocket).not.toHaveBeenCalled();
    Object.defineProperty(global, 'navigator', {value: {onLine: true}, configurable: true});
    await tick(4999); expect(manager.initWebSocket).not.toHaveBeenCalled();
    await tick(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(ordinaryRecords()).toEqual([
      attemptRecord(1, 5000, 'retrying'), attemptRecord(2, 10000, 'retrying'),
      attemptRecord(3, 15000, 'succeeded'),
    ]);
    expectNoSecrets();
  });

  it.each(['resolve', 'reject'])('T-012 ordinary stale %s cannot report or consume a replacement episode', async completion => {
    const stale = createDeferred<any>(), current = createDeferred<any>();
    manager.initWebSocket.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    lose(); await tick(5000);
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    await tick(5000);
    if (completion === 'resolve') stale.resolve({payload: 'STALE_SECRET'});
    else stale.reject(new Error('STALE_SECRET'));
    await flush(); expect(ordinaryRecords()).toEqual([]);
    await tick(250); current.reject({statusCode: 503}); await flush();
    await tick(4750);
    expect(ordinaryRecords()).toEqual([
      attemptRecord(1, 5250, 'retrying', {status: 503}), attemptRecord(2, 10000, 'succeeded'),
    ]);
    expectNoSecrets();
  });

  it.each(['pause', 'stop', 'abort'])('T-012 ordinary cancellation stays silent on %s', async action => {
    const pending = createDeferred<any>(); manager.initWebSocket.mockReturnValueOnce(pending.promise);
    lose(); await tick(5000);
    if (action === 'pause') service.pause();
    else if (action === 'stop') service.stop();
    else registration.abort();
    pending.reject(new Error('LATE_SECRET')); await flush(); await tick(100000);
    expect(ordinaryRecords()).toEqual([]);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expectNoSecrets();
  });

  it.each([401, 403, 409])('T-012 ordinary terminal diagnostics preserve classification status=%s', async status => {
    manager.initWebSocket.mockRejectedValue({statusCode: status, id: 'terminal-id',
      headers: {trackingid: 'terminal-tracking', Authorization: 'BEARER_SECRET'},
      body: {reason: status === 409 ? 'REGION_MISMATCH_ORG_OVERRIDE' : 'REMOTE_SECRET', reasonCode: '1037'},
      options: {body: {dialNumber: 'DN_SECRET'}}});
    lose(); await tick(5000);
    expect(ordinaryRecords()).toEqual([attemptRecord(1, 5000, 'terminal', {status, reasonCode: 1037,
      ...(status === 409 ? {reason: 'REGION_MISMATCH_ORG_OVERRIDE'} : {}),
      id: 'terminal-id', trackingId: 'terminal-tracking'})]);
    expect(terminal).toHaveBeenCalledTimes(1);
    expect(terminal.mock.calls[0][0].data.kind).toBe(status === 409 ? 'region-mismatch' : 'authentication-failed');
    expect(manager.close).toHaveBeenCalledWith(false, 'Terminal admission');
    await tick(100000); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(ordinaryRecords()).toHaveLength(1);
    expectNoSecrets();
  });

  it.each(['retrying', 'succeeded', 'terminal', 'watchdog'])('T-012 throwing ordinary diagnostic sink preserves %s', async outcome => {
    logger.info.mockImplementation(() => {throw new Error('SINK_SECRET');});
    if (outcome === 'terminal') manager.initWebSocket.mockRejectedValue({statusCode: 401});
    else manager.initWebSocket.mockRejectedValue({statusCode: 503});
    if (outcome === 'succeeded') manager.initWebSocket.mockResolvedValue({});
    lose(); await tick(5000);
    if (outcome === 'watchdog') {
      for (let attempt = 2; attempt <= 9; attempt += 1) await tick(5000);
      await tick(5000);
      expect(ordinaryRecords()).toHaveLength(9);
      expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(1);
      expect(manager.close).toHaveBeenCalledWith(false, 'Restore watchdog expired');
    } else if (outcome === 'terminal') {
      expect(terminal).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } else if (outcome === 'retrying') {
      manager.initWebSocket.mockResolvedValue({});
      await tick(4999); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
      await tick(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(2);
      expect(ordinaryRecords()).toEqual([
        attemptRecord(1, 5000, 'retrying', {status: 503}), attemptRecord(2, 10000, 'succeeded'),
      ]);
    } else expect(ordinaryRecords()).toEqual([attemptRecord(1, 5000, 'succeeded')]);
    if (outcome === 'succeeded' || outcome === 'retrying')
      expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(1);
    expectNoSecrets();
  });

  it.each([
    {payload: '{PAYLOAD_SECRET', throwing: true},
    {payload: 'null', throwing: false},
    {payload: '"PAYLOAD_SECRET"', throwing: false},
    {payload: '[]', throwing: true},
  ])(
    'T-012 malformed ping is ignored safely payload=$payload throwing=$throwing', async ({payload, throwing}) => {
      if (throwing) logger.error.mockImplementation(() => {throw new Error('SINK_SECRET');});
      lose();
      const timers = jest.getTimerCount(), before = events.mock.calls.slice();
      const scheduled = jest.spyOn(global, 'setTimeout');
      expect(() => manager.emit('message', payload)).not.toThrow();
      expect(jest.getTimerCount()).toBe(timers);
      expect(scheduled).not.toHaveBeenCalled();
      scheduled.mockRestore();
      expect(events.mock.calls).toEqual(before);
      expect((LoggerProxy.error as jest.Mock).mock.calls).toEqual([[
        payload.startsWith('{') ? 'onPing failed to parse payload' : 'onPing received non-object payload, ignoring',
        {module: CONNECTION_SERVICE_FILE, method: METHODS.ON_PING},
      ]]);
      expectNoSecrets();
      await tick(5000); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    }
  );

  it('T-004 pauseCancelsAndRequiresExplicitResume', async () => {
    const admission = createDeferred<any>(); manager.initWebSocket.mockReturnValue(admission.promise);
    const run = recover(); await tick(100000);
    const signal = manager.initWebSocket.mock.calls[0][0].signal;
    service.pause(); expect(signal.aborted).toBe(true);
    await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    manager.emit('socketClose', {shouldReconnect: true}); manager.emit('message', JSON.stringify({keepalive: 'true'}));
    await tick(600000); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(events).not.toHaveBeenCalled();
    admission.reject(new Error('late rejection')); await flush();
    expect(jest.getTimerCount()).toBe(0);
    manager.initWebSocket.mockResolvedValue({}); const next = recover(); await tick(100000); await next.promise;
  });

  it('T-004 sameRegistrationResetRestoresOrdinaryRecovery', async () => {
    const run = recover(); service.pause(); await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    manager.shouldReconnect = false;
    manager.usable = false;
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    await tick(4999); expect(manager.initWebSocket).not.toHaveBeenCalled();
    await tick(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(manager.listenerCount('message')).toBe(1); expect(manager.listenerCount('socketClose')).toBe(1);
    expect(run.onScheduled).toHaveBeenCalledTimes(1);
  });

  it('reset and pause retain a usable idle socket without cancellation or a retry', async () => {
    const run = recover(); await tick(100000); await run.promise;
    const signal = manager.initWebSocket.mock.calls[0][0].signal;
    manager.usable = true;
    service.pause(); expect(signal.aborted).toBe(false);
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    expect(signal.aborted).toBe(false); expect(manager.close).not.toHaveBeenCalled();
    expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 429, 503, 409])('T-012 offline4295xxPacing DR status=%s', async (status) => {
    manager.initWebSocket.mockRejectedValue({statusCode: status, body: {reason: 'UNKNOWN_REMOTE', reasonCode: 9999}, headers: {trackingid: 'attempt'}});
    const run = recover();
    for (const [index, delay] of [100000, 60000, 30000, 15000, 15000].entries()) {
      await tick(delay - 1); expect(manager.initWebSocket).toHaveBeenCalledTimes(index);
      await tick(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(index + 1);
      expect(run.onAttemptSettled).toHaveBeenLastCalledWith(index + 1, 'retrying', {...(status !== undefined ? {status} : {}), reasonCode: 9999, trackingId: 'attempt'});
    }
    service.pause(); await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
  });

  it.each([[0, 100000], [0.9999, 149995]])(
    'T-004 noDrWatchdogAt50s / drEntryCancelsArmedOrdinaryTimers random=%s waits %s ms', async (random, wait) => {
      const admission = createDeferred<Record<string, unknown>>();
      manager.initWebSocket.mockReturnValueOnce(admission.promise);
      (Math.random as jest.Mock).mockReturnValue(random);
      expect(jest.getTimerCount()).toBe(2);
      const scheduled = jest.spyOn(global, 'setTimeout');
      lose();
      expect(scheduled.mock.calls).toEqual([[expect.any(Function), 5000]]);
      scheduled.mockRestore();
      expect(jest.getTimerCount()).toBe(2);
      expect(manager.initWebSocket).not.toHaveBeenCalled();
      const lost = {isConnectionLost: true, isRestoreFailed: false,
        isSocketReconnected: false, isKeepAlive: false};
      expect(events.mock.calls).toEqual([[lost]]);
      expect(manager.handleConnectionLost.mock.calls).toEqual([[lost]]);

      const run = recover();
      expect(run.onScheduled.mock.calls).toEqual([[1, wait]]);
      expect(jest.getTimerCount()).toBe(1);
      // Cross the cancelled ordinary retry, its watchdog, then reach DR's final millisecond.
      for (const elapsed of [5000, 45000, wait - 50001]) {
        await tick(elapsed);
        expect(jest.getTimerCount()).toBe(1);
        expect(manager.initWebSocket).not.toHaveBeenCalled();
        expect(events.mock.calls).toEqual([[lost]]);
        expect(manager.handleConnectionLost.mock.calls).toEqual([[lost]]);
        expect(manager.close).not.toHaveBeenCalled();
        expect(terminal).not.toHaveBeenCalled();
      }
      await tick(1);
      expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
      expect(run.onScheduled.mock.calls).toEqual([[1, wait]]);
      expect(run.afterWelcome).not.toHaveBeenCalled();
      expect(run.onAttemptSettled).not.toHaveBeenCalled();

      const signal = manager.initWebSocket.mock.calls[0][0].signal;
      service.pause();
      expect(signal.aborted).toBe(true);
      await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
      admission.resolve({}); await flush();
      expect(run.afterWelcome).not.toHaveBeenCalled();
      expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it.each([0, 4])('checks live ownership after regional wait %s before admission', async (waitIndex) => {
    const delays = [100000, 60000, 30000, 15000, 15000];
    const canAttempt = jest.fn(() => true);
    const parent = new AbortController();
    const add = jest.spyOn(parent.signal, 'addEventListener');
    const remove = jest.spyOn(parent.signal, 'removeEventListener');
    manager.initWebSocket.mockRejectedValue({statusCode: 503});
    const run = recover({signal: parent.signal, canAttempt});
    for (const delay of delays.slice(0, waitIndex)) await tick(delay);
    await tick(delays[waitIndex] - 1);
    expect(canAttempt).toHaveBeenCalledTimes(waitIndex);
    canAttempt.mockReturnValue(false);
    await tick(1);
    expect(canAttempt).toHaveBeenCalledTimes(waitIndex + 1);
    await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    expect(manager.initWebSocket).toHaveBeenCalledTimes(waitIndex);
    expect(run.afterWelcome).not.toHaveBeenCalled();
    expect(run.onAttemptSettled).toHaveBeenCalledTimes(waitIndex);
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
    expect(manager.listenerCount('message')).toBe(0);
    expect(manager.listenerCount('socketClose')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    manager.emit('socketClose', {shouldReconnect: true});
    await tick(600000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(waitIndex);
    expect(run.onScheduled).toHaveBeenCalledTimes(waitIndex + 1);
    expect(terminal).not.toHaveBeenCalled();
  });

  it.each([['pause', true], ['stop', false], ['abort', false], ['reset', true], ['replace', true]])
    ('rechecks scheduler ownership after a reentrant predicate %s returning %s', async (action, allowed) => {
      const parent = new AbortController();
      let next: ReturnType<typeof recover>;
      const canAttempt = jest.fn(() => {
        if (action === 'pause') service.pause();
        if (action === 'stop') service.stop();
        if (action === 'abort') parent.abort();
        if (action === 'reset') {
          manager.usable = false;
          service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
        }
        if (action === 'replace') next = recover();
        return allowed;
      });
      const run = recover({signal: parent.signal, canAttempt});
      await tick(100000);
      expect(canAttempt).toHaveBeenCalledTimes(1);
      await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
      expect(manager.initWebSocket).not.toHaveBeenCalled();
      expect(manager.close).not.toHaveBeenCalled();
      expect(run.afterWelcome).not.toHaveBeenCalled();
      expect(run.onAttemptSettled).not.toHaveBeenCalled();
      parent.abort();
      if (action === 'replace' || action === 'reset') {
        const delay = action === 'replace' ? 100000 : 5000;
        await tick(delay - 1); expect(manager.initWebSocket).not.toHaveBeenCalled();
        await tick(1);
        if (next) await expect(next.promise).resolves.toBeUndefined();
        expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
        expect(manager.initWebSocket.mock.calls[0][0].signal.aborted).toBe(false);
        expect(manager.listenerCount('message')).toBe(1);
        expect(manager.listenerCount('socketClose')).toBe(1);
      } else {
        await tick(600000);
        expect(manager.initWebSocket).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      }
    });

  it('cancels admission when the live ownership predicate throws', async () => {
    const run = recover({canAttempt: () => {throw new Error('identity unavailable');}});
    await tick(100000);
    expect(manager.initWebSocket).not.toHaveBeenCalled();
    await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    expect(run.onAttemptSettled).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([401, 403])('T-012 stops regional admission after an authentication failure (%s)', async (status) => {
    manager.initWebSocket.mockRejectedValue({statusCode: status, body: {reason: 'AUTH_TEXT', reasonCode: 9999}, headers: {trackingid: 'auth-id'}});
    const run = recover(); await tick(100000);
    await expect(run.promise).rejects.toMatchObject({data: {kind: 'authentication-failed', status, reasonCode: 9999, trackingId: 'auth-id'}});
    expect(manager.close).toHaveBeenCalledWith(false, 'Terminal recovery');
    await tick(200000); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(terminal).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('policy failed'), {}],
    [Object.assign(new Error('not owned'), {name: 'AbortError'}), {}],
    [{statusCode: 503}, {status: 503}],
    [{statusCode: 409, headers: {'x-wxcc-region-reason': 'REGION_MISMATCH_NO_OVERRIDE'}},
      {status: 409}],
  ])('T-004 afterWelcomeExceptionStopsWithoutReadmission %#', async (error, failure) => {
    const run = recover({afterWelcome: jest.fn().mockRejectedValue(error)}); await tick(100000);
    await expect(run.promise).rejects.toHaveProperty('data', {...failure, kind: 'after-welcome-failed'});
    await tick(600000); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(run.onAttemptSettled.mock.calls).toEqual([[1, 'terminal', failure]]);
    expect(manager.close.mock.calls).toEqual([[false, 'Terminal recovery']]);
    expect(terminal).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('T-004 recoverRegionResolveRejectContract and explicit stopped/aborted admission', async () => {
    const run = recover(); await tick(100000); await expect(run.promise).resolves.toBeUndefined();
    expect(run.onAttemptSettled).not.toHaveBeenCalled();
    service.stop(); const stopped = recover(); await expect(stopped.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    expect(stopped.onScheduled).not.toHaveBeenCalled();
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    const parent = new AbortController(); parent.abort(); const aborted = recover({signal: parent.signal});
    await expect(aborted.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    expect(aborted.onScheduled).not.toHaveBeenCalled();
  });

  it('T-004 restoreSocketLossReschedules aborts child work and retries in the same driver', async () => {
    const restore = createDeferred<void>(); const after = jest.fn().mockReturnValueOnce(restore.promise).mockResolvedValue(undefined);
    const run = recover({afterWelcome: after}); await tick(100000);
    const signal = after.mock.calls[0][1];
    lose(); await flush(); expect(signal.aborted).toBe(true);
    expect(run.onScheduled).toHaveBeenLastCalledWith(2, 60000);
    restore.reject(new Error('late restore rejection')); await flush();
    await tick(60000); await run.promise; expect(after).toHaveBeenCalledTimes(2);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(2);
  });

  it('T-004 drMessagesDoNotArmOrdinaryTimers', async () => {
    const restore = createDeferred<void>(); const run = recover({afterWelcome: jest.fn().mockReturnValue(restore.promise)});
    await tick(100000); const calls = events.mock.calls.length;
    for (const message of [{keepalive: 'true'}, {type: 'Welcome', data: {}}, {type: 'ordinary'}]) manager.emit('message', JSON.stringify(message));
    await tick(60000); expect(events).toHaveBeenCalledTimes(calls); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    restore.resolve(); await flush(); await run.promise;
  });

  it('T-004 ordinaryFiveSecondSlots50sWatchdog', async () => {
    const pending = createDeferred<any>(); manager.initWebSocket.mockRejectedValue({statusCode: 503});
    lose();
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      if (attempt === 9) manager.initWebSocket.mockReturnValueOnce(pending.promise);
      await tick(4999); expect(manager.initWebSocket).toHaveBeenCalledTimes(attempt - 1);
      await tick(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(attempt);
    }
    const signal = manager.initWebSocket.mock.calls[8][0].signal;
    const records = Array.from({length: 8}, (_, index) =>
      attemptRecord(index + 1, (index + 1) * 5000, 'retrying', {status: 503}));
    await tick(4999);
    expect(signal.aborted).toBe(false);
    expect(ordinaryRecords()).toEqual(records);
    expect(manager.close).not.toHaveBeenCalled();
    expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(0);
    await tick(1);
    expect(signal.aborted).toBe(true);
    expect(manager.close.mock.calls).toEqual([[false, 'Restore watchdog expired']]);
    expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(1);
    pending.resolve({}); await flush(); await tick(600000);
    expect(manager.initWebSocket).toHaveBeenCalledTimes(9);
    expect(ordinaryRecords()).toEqual(records);
    expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(1);
    expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
    expect(manager.close).toHaveBeenCalledTimes(1);
    expect(terminal).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('T-004 ordinaryMismatchStopsAndNotifiesOnce', async () => {
    manager.initWebSocket.mockRejectedValue({statusCode: 409, headers: {'X-WXCC-Region-Reason': 'REGION_MISMATCH_NO_OVERRIDE', trackingid: 'mismatch-id'}});
    const closeCallsAtTerminal: unknown[][][] = [];
    terminal.mockImplementation(() => {
      closeCallsAtTerminal.push(manager.close.mock.calls.map((args) => [...args]));
      throw new Error('host');
    });
    lose(); await tick(5000);
    expect(closeCallsAtTerminal).toEqual([[[false, 'Terminal admission']]]);
    expect(terminal).toHaveBeenCalledTimes(1);
    expect(terminal.mock.calls[0][0].data).toEqual({kind: 'region-mismatch', status: 409, reason: 'REGION_MISMATCH_NO_OVERRIDE', trackingId: 'mismatch-id'});
    manager.emit('socketClose', {shouldReconnect: true}); await tick(100000);
    expect(terminal).toHaveBeenCalledTimes(1); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
    expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(0);
  });

  it('T-004 attemptSettledCarriesSafeFailureOnce', async () => {
    const error = {statusCode: 503, id: 'Service.aqm.reqs.Timeout', body: {reason: 'INTERNAL_ERROR', reasonCode: '1037'}, headers: {trackingid: 'safe-id', authorization: 'secret'}, options: {body: {dialNumber: 'secret-dn'}}, url: 'signed-url'};
    manager.initWebSocket.mockRejectedValueOnce(error).mockRejectedValueOnce({statusCode: 401});
    const order: string[] = [];
    const settlements: Array<{attempt: number; outcome: string; failure: Record<string, unknown>}> = [];
    const run = recover({onScheduled: (attempt) => order.push(`scheduled-${attempt}`), onAttemptSettled: (attempt, outcome, failure) => {
      order.push(`settled-${attempt}-${outcome}`);
      settlements.push({attempt, outcome, failure: {...failure}});
    }});
    await tick(100000); await tick(60000); await expect(run.promise).rejects.toMatchObject({data: {kind: 'authentication-failed'}});
    expect(settlements).toEqual([
      {attempt: 1, outcome: 'retrying', failure: {status: 503, id: 'Service.aqm.reqs.Timeout', reason: 'INTERNAL_ERROR', reasonCode: 1037, trackingId: 'safe-id'}},
      {attempt: 2, outcome: 'terminal', failure: {status: 401}},
    ]);
    expect(order).toEqual(['scheduled-1', 'settled-1-retrying', 'scheduled-2', 'settled-2-terminal']);
    expect(JSON.stringify(settlements)).not.toContain('secret');
  });

  it.each(['throw', 'mutate', 'pause'])('T-004 throwingAttemptSettledCannotChangeRecovery %s', async (action) => {
    manager.initWebSocket.mockRejectedValue({statusCode: 503, body: {reason: 'INTERNAL_ERROR'}});
    const hook = jest.fn((_attempt, _outcome, failure) => {
      if (action === 'throw') throw new Error('sink');
      if (action === 'mutate') { failure.status = 401; failure.reason = 'REGION_MISMATCH_NO_OVERRIDE'; }
      if (action === 'pause') service.pause();
    });
    const run = recover({onAttemptSettled: hook}); await tick(100000);
    expect(hook).toHaveBeenCalledTimes(1);
    if (action === 'pause') {
      await expect(run.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
      expect(run.onScheduled).toHaveBeenCalledTimes(1);
    } else {
      expect(run.onScheduled).toHaveBeenLastCalledWith(2, 60000);
      await tick(60000); expect(hook).toHaveBeenCalledTimes(2);
    }
  });

  it.each([
    {name: 'auth401', error: {statusCode: 401}, kind: 'authentication-failed', failure: {status: 401},
      action: 'recoverRegion', throwing: false},
    {name: 'auth403', error: {statusCode: 403}, kind: 'authentication-failed', failure: {status: 403},
      action: 'pause', throwing: true},
    {name: 'auth401', error: {statusCode: 401}, kind: 'authentication-failed', failure: {status: 401},
      action: 'stop', throwing: false},
    {name: 'mismatch', error: {statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}},
      kind: 'region-mismatch', failure: {status: 409, reason: 'REGION_MISMATCH_NO_OVERRIDE'},
      action: 'reset', throwing: false},
    {name: 'afterWelcome', error: new Error('policy failed'), kind: 'after-welcome-failed', failure: {},
      action: 'resetRegion', throwing: true},
  ])
    ('T-004 terminalSettlementCommittedBeforeHook $name $action throwing=$throwing',
      async ({name, error, kind, failure, action, throwing}) => {
        const parent = new AbortController(), nextRegistration = new AbortController();
        const add = jest.spyOn(parent.signal, 'addEventListener');
        const remove = jest.spyOn(parent.signal, 'removeEventListener');
        const nextRequest = {...subscribeRequest, force: false};
        const nextTerminal = jest.fn(), rejected = jest.fn(), order: string[] = [];
        const snapshots: unknown[] = [];
        let next: ReturnType<typeof recover>;
        const afterWelcome = jest.fn().mockResolvedValue(undefined);
        if (name === 'afterWelcome') afterWelcome.mockRejectedValueOnce(error);
        else manager.initWebSocket.mockRejectedValueOnce(error);
        const hook = jest.fn((_attempt, _outcome, reported) => {
          order.push('hook');
          snapshots.push({
            closed: manager.close.mock.calls.map(args => [...args]),
            reconnect: manager.shouldReconnect,
            flightAborted: manager.initWebSocket.mock.calls[0][0].signal.aborted,
            invocationDetached: remove.mock.calls.some(([type, listener]) =>
              type === 'abort' && listener === add.mock.calls[0][1]),
            messages: manager.listenerCount('message'),
            closes: manager.listenerCount('socketClose'),
            timers: jest.getTimerCount(),
          });
          if (action === 'recoverRegion') next = recover();
          if (action === 'pause') service.pause();
          if (action === 'stop') service.stop();
          if (action === 'reset' || action === 'resetRegion') {
            service.reset({subscribeRequest: nextRequest, signal: nextRegistration.signal,
              onTerminalFailure: nextTerminal});
            if (action === 'resetRegion') next = recover();
          }
          parent.abort(); registration.abort();
          // The observer's copy cannot replace the captured terminal error's data.
          reported.status = 418; reported.reason = 'observer mutation';
          if (throwing) throw new Error('observer failed');
        });
        const run = recover({signal: parent.signal, afterWelcome, onAttemptSettled: hook});
        const observed = run.promise.catch(error => { order.push('rejected'); rejected(error); });
        await tick(100000); await observed;
        expect(rejected.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(rejected.mock.calls[0][0].data).toEqual({...failure, kind});
        expect(order).toEqual(['hook', 'rejected']);
        expect(hook.mock.calls[0].slice(0, 2)).toEqual([1, 'terminal']);
        expect(snapshots).toEqual([{
          closed: [[false, 'Terminal recovery']], reconnect: false, flightAborted: true,
          invocationDetached: true, messages: 0, closes: 0, timers: 0,
        }]);
        expect(run.onScheduled.mock.calls).toEqual([[1, 100000]]);
        expect(manager.close.mock.calls).toEqual([[false, 'Terminal recovery']]);
        expect(terminal).not.toHaveBeenCalled();

        if (action === 'reset' || action === 'resetRegion') {
          expect(manager.shouldReconnect).toBe(true);
          expect(manager.listenerCount('message')).toBe(1);
          expect(manager.listenerCount('socketClose')).toBe(1);
          const delay = action === 'reset' ? 5000 : 100000;
          await tick(delay - 1); expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
          await tick(1);
          if (next) await expect(next.promise).resolves.toBeUndefined();
          expect(manager.initWebSocket).toHaveBeenCalledTimes(2);
          expect(manager.initWebSocket.mock.calls[1][0].body).toEqual(nextRequest);
          const signal = manager.initWebSocket.mock.calls[1][0].signal;
          expect(signal.aborted).toBe(false);
          expect(manager.usable).toBe(true);
          expect(manager.close).toHaveBeenCalledTimes(1);
          expect(nextTerminal).not.toHaveBeenCalled();
          nextRegistration.abort(); expect(signal.aborted).toBe(true);
        } else {
          if (next) {
            await expect(next.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
            expect(next.onScheduled).not.toHaveBeenCalled();
          }
          const stopped = recover();
          await expect(stopped.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
          expect(stopped.onScheduled).not.toHaveBeenCalled();
          lose(); manager.emit('message', JSON.stringify({keepalive: 'true'}));
          await tick(600000);
          expect(manager.initWebSocket).toHaveBeenCalledTimes(1);
          expect(manager.listenerCount('message')).toBe(0);
          expect(manager.listenerCount('socketClose')).toBe(0);
        }
        expect(jest.getTimerCount()).toBe(0);
        expect(hook).toHaveBeenCalledTimes(1);
        expect(rejected).toHaveBeenCalledTimes(1);
      });

  it('cancellation and supersession are silent to failed-attempt hooks and old results', async () => {
    const pending = createDeferred<any>(); manager.initWebSocket.mockReturnValueOnce(pending.promise);
    const old = recover(); await tick(100000); const next = recover();
    await expect(old.promise).rejects.toMatchObject({data: {kind: 'cancelled'}});
    pending.reject({statusCode: 503}); await flush();
    expect(old.onAttemptSettled).not.toHaveBeenCalled();
    await tick(100000); await next.promise;
    expect(next.onAttemptSettled).not.toHaveBeenCalled();
  });
});

describe('ConnectionService with actual WebSocketManager', () => {
  const saved = {socket: global.WebSocket, worker: global.Worker, blob: global.Blob,
    create: URL.createObjectURL, revoke: URL.revokeObjectURL};
  class Socket {
    static instances: Socket[] = [];
    readyState = 0;
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (event: {data: string}) => void;
    onerror?: () => void;
    close = jest.fn(() => { this.readyState = 3; });
    send = jest.fn();
    constructor() { Socket.instances.push(this); }
    message(frame: unknown) { this.onmessage?.({data: JSON.stringify(frame)}); }
    welcome() {
      this.readyState = 1; this.onopen?.();
      this.message({type: CC_EVENTS.WELCOME, data: {}});
    }
  }
  let service: ConnectionService;
  let manager: WebSocketManager;
  let registration: AbortController;
  let request: jest.Mock;
  let terminal: jest.Mock;
  let events: jest.Mock;
  const startRecovery = (overrides: Record<string, any> = {}) => {
    const parent = new AbortController();
    const onScheduled = jest.fn(), afterWelcome = jest.fn().mockResolvedValue(undefined), onAttemptSettled = jest.fn();
    const promise = service.recoverRegion({signal: parent.signal, onScheduled,
      afterWelcome, onAttemptSettled, ...overrides});
    promise.catch(() => undefined);

    return {promise, parent, onScheduled, afterWelcome, onAttemptSettled};
  };
  const recover = async () => {
    const run = startRecovery();
    await tick(100000);
    Socket.instances[0].welcome(); await flush(); await run.promise;

    return run.parent;
  };

  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    Socket.instances = [];
    global.WebSocket = Socket as any;
    global.Blob = class BlobDouble {} as any;
    global.Worker = jest.fn(() => ({postMessage: jest.fn(), terminate: jest.fn()})) as any;
    URL.createObjectURL = jest.fn(() => 'blob:ownership'); URL.revokeObjectURL = jest.fn();
    request = jest.fn().mockResolvedValue({statusCode: 200,
      body: {webSocketUrl: 'wss://routing.produs1.cisco.com'}});
    manager = new WebSocketManager({webex: {request, credentials: {getOrgId: () => 'org'},
      internal: {services: {isIntegrationEnvironment: () => false}}} as any});
    service = new ConnectionService(manager);
    registration = new AbortController(); terminal = jest.fn(); events = jest.fn();
    service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
    service.on('connectionLost', events);
  });
  afterEach(() => {
    service.stop(); manager.close(false);
    global.WebSocket = saved.socket; global.Worker = saved.worker; global.Blob = saved.blob;
    URL.createObjectURL = saved.create; URL.revokeObjectURL = saved.revoke;
    jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
  });

  it.each(['subscribe', 'open', 'Welcome'])(
    'T-004 watchdogAbortsSubscribeOpenAndWelcome %s with actual WebSocketManager', async (phase) => {
      const sinks = levels.map(level => jest.spyOn(LoggerProxy, level).mockImplementation(() => undefined));
      const pending: ReturnType<typeof createDeferred<any>>[] = [];
      if (phase === 'subscribe') {
        request.mockImplementation(() => {
          const deferred = createDeferred<any>();
          pending.push(deferred);

          return deferred.promise;
        });
      }
      const init = jest.spyOn(manager, 'initWebSocket');
      for (let elapsed = 0; elapsed < 45000; elapsed += 5000) {
        await tick(5000);
        const socket = Socket.instances[Socket.instances.length - 1];
        if (phase === 'Welcome' && socket?.readyState === 0) {
          socket.readyState = 1;
          socket.onopen?.();
        }
      }
      const settled = [attemptRecord(1, phase === 'subscribe' ? 25000 : 35000, 'retrying')];
      expect(ordinaryRecords()).toEqual(settled);
      expectNoLoggedSecrets(sinks);
      const activeSignal = init.mock.calls[init.mock.calls.length - 1][0].signal!;
      const lateCallbacks = Socket.instances.map(({onopen, onmessage}) => ({onopen, onmessage}));
      await tick(5000);
      expect(activeSignal.aborted).toBe(true);
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.getServingRegion()).toBeUndefined();
      expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(1);

      const calls = init.mock.calls.length;
      pending.forEach(deferred => deferred.resolve({statusCode: 200, body: {webSocketUrl: 'wss://late.prodeu1.cisco.com'}}));
      lateCallbacks.forEach(({onopen, onmessage}) => {
        onopen?.();
        onmessage?.({data: JSON.stringify({type: CC_EVENTS.WELCOME, data: {}})});
      });
      await flush(); await tick(100000);
      expect(init).toHaveBeenCalledTimes(calls);
      expect(events.mock.calls.filter(([event]) => event.isSocketReconnected)).toHaveLength(0);
      expect(terminal).not.toHaveBeenCalled();
      expect(ordinaryRecords()).toEqual(settled);
    }
  );

  it.each(['subscribe', 'Welcome'])(
    'T-003/T-004 regional %s deadline settles once and preserves the retry slot', async (phase) => {
      const pending = createDeferred<any>();
      if (phase === 'subscribe') request.mockReturnValueOnce(pending.promise);
      const init = jest.spyOn(manager, 'initWebSocket');
      const run = startRecovery();
      const resolved = jest.fn(), rejected = jest.fn();
      const observed = run.promise.then(resolved, rejected);
      expect(run.onScheduled.mock.calls).toEqual([[1, 100000]]);
      await tick(99999); expect(request).not.toHaveBeenCalled();
      await tick(1); expect(request).toHaveBeenCalledTimes(1);

      const expiredSocket = Socket.instances[0];
      const open = expiredSocket?.onopen, message = expiredSocket?.onmessage;
      if (phase === 'Welcome') {
        expiredSocket.readyState = 1; open!();
      }
      const socketCount = phase === 'subscribe' ? 0 : 1;
      expect(Socket.instances).toHaveLength(socketCount);
      const deadline = phase === 'subscribe' ? 20000 : 30000;
      await tick(deadline - 1);
      expect(run.onAttemptSettled).not.toHaveBeenCalled();
      expect(run.onScheduled.mock.calls).toEqual([[1, 100000]]);
      expect(resolved).not.toHaveBeenCalled(); expect(rejected).not.toHaveBeenCalled();
      expect(request).toHaveBeenCalledTimes(1);
      await tick(1);
      expect(run.onAttemptSettled.mock.calls).toEqual([[1, 'retrying', {}]]);
      expect(run.onScheduled.mock.calls).toEqual([[1, 100000], [2, 60000]]);
      expect(run.onAttemptSettled.mock.invocationCallOrder[0])
        .toBeLessThan(run.onScheduled.mock.invocationCallOrder[1]);
      expect(init.mock.calls[0][0].signal!.aborted).toBe(true);
      if (phase === 'Welcome') {
        expect(expiredSocket.close).toHaveBeenCalledTimes(1);
        expect(expiredSocket.onopen).toBeNull(); expect(expiredSocket.onmessage).toBeNull();
      }

      // Replay work captured while the expired attempt still owned the transport.
      if (phase === 'subscribe') {
        pending.resolve({statusCode: 200, body: {webSocketUrl: 'wss://late.prodeu1.cisco.com'}});
      } else {
        open!(); message!({data: JSON.stringify({type: CC_EVENTS.WELCOME, data: {}})});
      }
      await flush();
      expect(run.afterWelcome).not.toHaveBeenCalled();
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.getServingRegion()).toBeUndefined();
      expect(Socket.instances).toHaveLength(socketCount);
      await tick(59999);
      expect(resolved).not.toHaveBeenCalled(); expect(rejected).not.toHaveBeenCalled();
      expect(run.afterWelcome).not.toHaveBeenCalled();
      expect(run.onAttemptSettled.mock.calls).toEqual([[1, 'retrying', {}]]);
      expect(run.onScheduled.mock.calls).toEqual([[1, 100000], [2, 60000]]);
      expect(request).toHaveBeenCalledTimes(1);
      expect(Socket.instances).toHaveLength(socketCount);
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.getServingRegion()).toBeUndefined();

      await tick(1);
      expect(request).toHaveBeenCalledTimes(2);
      expect(init).toHaveBeenCalledTimes(2);
      expect(init.mock.calls[1][0].signal).not.toBe(init.mock.calls[0][0].signal);
      expect(init.mock.calls[1][0].signal!.aborted).toBe(false);
      expect(Socket.instances).toHaveLength(socketCount + 1);
      run.parent.abort();
      await expect(run.promise).rejects.toHaveProperty('data', {kind: 'cancelled'});
      await observed; await tick(600000);
      expect(rejected).toHaveBeenCalledTimes(1); expect(resolved).not.toHaveBeenCalled();
      expect(init.mock.calls[1][0].signal!.aborted).toBe(true);
      expect(Socket.instances[socketCount].close).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(2);
      expect(Socket.instances).toHaveLength(socketCount + 1);
      expect(run.afterWelcome).not.toHaveBeenCalled();
      expect(run.onAttemptSettled.mock.calls).toEqual([[1, 'retrying', {}]]);
      expect(run.onScheduled.mock.calls).toEqual([[1, 100000], [2, 60000]]);
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.getServingRegion()).toBeUndefined();
      expect(terminal).not.toHaveBeenCalled(); expect(events).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it.each(['multi-login', 'pause'])(
    'T-004 recoverRegionResolveRejectContract %s during pending afterWelcome', async (action) => {
      const restore = createDeferred<void>();
      const afterWelcome = jest.fn().mockReturnValue(restore.promise);
      const init = jest.spyOn(manager, 'initWebSocket');
      const run = startRecovery({afterWelcome});
      await tick(100000);
      const socket = Socket.instances[0];
      socket.welcome(); await flush();
      const signal = init.mock.calls[0][0].signal!;
      expect(afterWelcome.mock.calls).toEqual([[{}, signal]]);
      expect(signal).not.toBe(run.parent.signal);
      expect(signal).not.toBe(registration.signal);
      expect(signal.aborted).toBe(false);
      expect(manager.hasUsableSocket()).toBe(true);
      expect(jest.getTimerCount()).toBe(0);

      if (action === 'multi-login') socket.message({type: CC_EVENTS.AGENT_MULTI_LOGIN});
      else service.pause();
      expect(signal.aborted).toBe(true);
      await expect(run.promise).rejects.toHaveProperty('data', {kind: 'cancelled'});
      expect(run.parent.signal.aborted).toBe(false);
      expect(registration.signal.aborted).toBe(false);
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.getServingRegion()).toBeUndefined();
      expect(run.onAttemptSettled).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);

      // Even a successful abandoned restore and subsequent transport events cannot resume it.
      restore.resolve(); await flush();
      manager.emit('socketClose', {shouldReconnect: true});
      manager.emit('message', JSON.stringify({keepalive: 'true'}));
      await tick(600000);
      expect(request).toHaveBeenCalledTimes(1);
      expect(init).toHaveBeenCalledTimes(1);
      expect(afterWelcome).toHaveBeenCalledTimes(1);
      expect(run.onScheduled.mock.calls).toEqual([[1, 100000]]);
      expect(run.onAttemptSettled).not.toHaveBeenCalled();
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(events).not.toHaveBeenCalled();
      expect(terminal).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it('T-004 afterWelcomeCompletionStartsFreshOrdinaryTimers', async () => {
    const restore = createDeferred<void>();
    const afterWelcome = jest.fn().mockReturnValue(restore.promise);
    const init = jest.spyOn(manager, 'initWebSocket');
    // DR must retire this episode's retry and watchdog before starting its own wait.
    manager.emit('socketClose', {shouldReconnect: true});
    expect(jest.getTimerCount()).toBe(2);
    const before = events.mock.calls.slice();
    const run = startRecovery({afterWelcome});
    await tick(100000);
    const socket = Socket.instances[0];
    socket.welcome(); await flush();
    const signal = init.mock.calls[0][0].signal!;
    expect(afterWelcome.mock.calls).toEqual([[{}, signal]]);
    await tick(60000);
    expect(jest.getTimerCount()).toBe(0);
    expect(events.mock.calls).toEqual(before);
    expect(socket.close).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);

    restore.resolve(); await flush(); await expect(run.promise).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(2);
    expect(signal.aborted).toBe(false);
    expect(manager.hasUsableSocket()).toBe(true);
    await tick(7999);
    expect(events.mock.calls).toEqual(before);
    await tick(1);
    const lost = {isConnectionLost: true, isRestoreFailed: false,
      isSocketReconnected: false, isKeepAlive: false};
    expect(events.mock.calls).toEqual([...before, [lost]]);
    expect(socket.close).not.toHaveBeenCalled();

    await tick(41999);
    expect(events.mock.calls).toEqual([...before, [lost]]);
    expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(0);
    expect(socket.close).not.toHaveBeenCalled();
    expect(signal.aborted).toBe(false);
    await tick(1);
    expect(events.mock.calls).toEqual([...before, [lost], [{...lost, isRestoreFailed: true}]]);
    expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(1);
    expect(socket.close).not.toHaveBeenCalled();
    expect(signal.aborted).toBe(false);
    expect(manager.hasUsableSocket()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    const worker = (global.Worker as jest.Mock).mock.results[0].value;
    worker.onmessage({data: {type: 'closeSocket'}});
    expect(socket.close).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    socket.message({keepalive: 'true'});
    expect(events).toHaveBeenLastCalledWith({...lost, isConnectionLost: false, isKeepAlive: true});
    expect(manager.hasUsableSocket()).toBe(true);
    expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(run.onScheduled.mock.calls).toEqual([[1, 100000]]);
    expect(run.onAttemptSettled).not.toHaveBeenCalled();
    expect(terminal).not.toHaveBeenCalled();
  });

  it.each(['UNKNOWN', 'REGION_MISMATCH_ORG_NOT_ELIGIBLE'])(
    'T-012 offline4295xxPacing ordinary 409 reason=%s', async (reason) => {
      request.mockRejectedValue({statusCode: 409, body: {reason}});
      manager.emit('socketClose', {shouldReconnect: true});
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await tick(4999); expect(request).toHaveBeenCalledTimes(attempt - 1);
        await tick(1); expect(request).toHaveBeenCalledTimes(attempt);
        expect(request.mock.calls[attempt - 1][0].resource).toBe(SUBSCRIBE_API);
        expect(terminal).not.toHaveBeenCalled();
      }
      expect(Socket.instances).toHaveLength(0);
      expect(events.mock.calls.filter(([event]) => event.isRestoreFailed)).toHaveLength(0);
      service.pause(); await tick(600000);
      expect(request).toHaveBeenCalledTimes(4);
      expect(terminal).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it('T-005 drRecognizedMismatchRejectsRegionMismatch at the subscription boundary', async () => {
    const failure = {status: 409, reason: 'REGION_MISMATCH_NO_OVERRIDE', trackingId: 'dr-mismatch'};
    request.mockRejectedValue({statusCode: 409,
      headers: {'X-WXCC-Region-Reason': failure.reason, trackingid: failure.trackingId}});
    const init = jest.spyOn(manager, 'initWebSocket');
    const close = jest.spyOn(manager, 'close');
    const parent = new AbortController();
    const onScheduled = jest.fn(), afterWelcome = jest.fn(), onAttemptSettled = jest.fn();
    const rejected = jest.fn();
    const promise = service.recoverRegion({signal: parent.signal, onScheduled, afterWelcome, onAttemptSettled});
    const observed = promise.catch(rejected);

    expect(onScheduled.mock.calls).toEqual([[1, 100000]]);
    await tick(99999); expect(request).not.toHaveBeenCalled();
    await tick(1);
    await expect(promise).rejects.toHaveProperty('data', {...failure, kind: 'region-mismatch'});
    await observed;
    expect(request.mock.calls.map(([options]) => options.resource)).toEqual([SUBSCRIBE_API]);
    expect(onAttemptSettled.mock.calls).toEqual([[1, 'terminal', failure]]);
    expect(close.mock.calls).toEqual([[false, 'Terminal recovery']]);
    expect(init.mock.calls[0][0].signal.aborted).toBe(true);
    expect(manager.shouldReconnect).toBe(false);
    expect(manager.hasUsableSocket()).toBe(false);
    expect(manager.listenerCount('socketClose')).toBe(0);
    expect(manager.listenerCount('message')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);

    for (const delay of [5000, 45000, 60000, 600000]) {
      manager.emit('socketClose', {shouldReconnect: true});
      manager.emit('message', JSON.stringify({keepalive: 'true'}));
      await tick(delay);
    }
    parent.abort(); await flush();
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(afterWelcome).not.toHaveBeenCalled();
    expect(terminal).not.toHaveBeenCalled();
    expect(events).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
    expect(onScheduled.mock.calls).toEqual([[1, 100000]]);
    expect(onAttemptSettled.mock.calls).toEqual([[1, 'terminal', failure]]);
    expect(close.mock.calls).toEqual([[false, 'Terminal recovery']]);
    expect(Socket.instances).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps a completed regional socket usable after its settled parent aborts', async () => {
    const parent = await recover();
    parent.abort();
    expect(manager.hasUsableSocket()).toBe(true);
    expect(Socket.instances[0].close).not.toHaveBeenCalled();
    for (let elapsed = 0; elapsed < 60000; elapsed += 5000) {
      Socket.instances[0].message({keepalive: 'true'}); await tick(5000);
    }
    expect(manager.hasUsableSocket()).toBe(true);
    expect(manager.getServingRegion()).toBe('produs1');
    expect(request).toHaveBeenCalledTimes(1);
    expect(events.mock.calls.filter(([event]) =>
      event.isConnectionLost || event.isRestoreFailed || event.isSocketReconnected)).toEqual([]);
    expect(terminal).not.toHaveBeenCalled();
  });

  it.each(['registration abort', 'explicit stop'])(
    'disposes a completed regional socket on %s', async (action) => {
      await recover();
      if (action === 'registration abort') registration.abort();
      else service.stop();
      expect(manager.hasUsableSocket()).toBe(false);
      expect(Socket.instances[0].close).toHaveBeenCalledTimes(1);
      expect(manager.getServingRegion()).toBeUndefined();
      expect(manager.listenerCount('message')).toBe(0);
      expect(manager.listenerCount('socketClose')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
      await tick(60000);
      expect(request).toHaveBeenCalledTimes(1);
      expect(events).not.toHaveBeenCalled();
      expect(terminal).not.toHaveBeenCalled();
    }
  );

  it('rebinds a retained socket to the new registration on reset', async () => {
    const parent = await recover();
    const next = new AbortController();
    service.reset({subscribeRequest, signal: next.signal, onTerminalFailure: terminal});
    parent.abort(); registration.abort();
    expect(manager.hasUsableSocket()).toBe(true);
    expect(Socket.instances[0].close).not.toHaveBeenCalled();
    next.abort();
    expect(manager.hasUsableSocket()).toBe(false);
    expect(Socket.instances[0].close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['stop', 'reset'] as const)(
    'abandons the old native close when an adopted socket abort reenters %s', async (action) => {
      const init = jest.spyOn(manager, 'initWebSocket');
      await recover();
      const {signal} = init.mock.calls[0][0];
      const onAbort = jest.fn(() => {
        if (action === 'stop') service.stop();
        else service.reset({subscribeRequest, signal: registration.signal, onTerminalFailure: terminal});
      });
      signal.addEventListener('abort', onAbort, {once: true});
      const socket = Socket.instances[0];

      socket.readyState = 3;
      socket.onclose?.();

      expect(onAbort).toHaveBeenCalledTimes(1);
      expect(events).toHaveBeenCalledTimes(action === 'reset' ? 1 : 0);
      expect(jest.getTimerCount()).toBe(action === 'reset' ? 2 : 0);
      await tick(action === 'reset' ? 4999 : 60000);
      expect(request).toHaveBeenCalledTimes(1);
      if (action === 'reset') {
        await tick(1);
        expect(request).toHaveBeenCalledTimes(2);
        Socket.instances[1].welcome(); await flush();
        expect(events).toHaveBeenCalledTimes(2);
        expect(events).toHaveBeenLastCalledWith(expect.objectContaining({isSocketReconnected: true}));
      }
      expect(terminal).not.toHaveBeenCalled();
    }
  );

  it.each(['multi-login', 'close(false)'])(
    'stops silently for %s before ordinary Welcome', async (action) => {
      manager.emit('socketClose', {shouldReconnect: true});
      await tick(5000);
      const socket = Socket.instances[0];
      const lateWelcome = socket.onmessage;
      socket.readyState = 1; socket.onopen?.();
      if (action === 'multi-login') socket.message({type: CC_EVENTS.AGENT_MULTI_LOGIN});
      else manager.close(false);
      await flush();
      const notifications = events.mock.calls.length;
      lateWelcome?.({data: JSON.stringify({type: CC_EVENTS.WELCOME, data: {}})});
      await tick(60000);
      expect(request).toHaveBeenCalledTimes(1);
      expect(manager.shouldReconnect).toBe(false);
      expect(manager.hasUsableSocket()).toBe(false);
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(manager.listenerCount('message')).toBe(0);
      expect(manager.listenerCount('socketClose')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
      expect(events).toHaveBeenCalledTimes(notifications);
      expect(terminal).not.toHaveBeenCalled();
    }
  );

  it.each(['ordinary', 'regional'] as const)(
    'retries a %s close(true) before Welcome without a backend failure', async (mode) => {
      const info = jest.spyOn(LoggerProxy, 'info').mockImplementation(() => undefined);
      const run = mode === 'regional' ? startRecovery() : undefined;
      if (!run) manager.emit('socketClose', {shouldReconnect: true});
      await tick(run ? 100000 : 5000);
      const socket = Socket.instances[0];

      manager.close(true);
      await flush();

      expect(socket.close).toHaveBeenCalledTimes(1);
      if (run) {
        expect(run.onAttemptSettled.mock.calls).toEqual([[1, 'retrying', {}]]);
        expect(run.afterWelcome).not.toHaveBeenCalled();
      } else {
        expect(info).toHaveBeenCalledWith('Ordinary reconnect attempt settled', {
          module: CONNECTION_SERVICE_FILE, method: METHODS.HANDLE_SOCKET_CLOSE,
          data: {attempt: 1, elapsedMs: 5000, outcome: 'retrying'},
        });
      }

      await tick(run ? 59999 : 4999);
      expect(request).toHaveBeenCalledTimes(1);
      await tick(1);
      expect(request).toHaveBeenCalledTimes(2);
      expect(terminal).not.toHaveBeenCalled();
    }
  );

  it.each([
    {statusCode: 401}, {statusCode: 403},
    {statusCode: 409, headers: {'X-WXCC-Region-Reason': 'REGION_MISMATCH_NO_OVERRIDE'}},
  ])('honors the manager no-reconnect latch before classifying %j', async (failure) => {
    const admission = createDeferred<any>(); request.mockReturnValueOnce(admission.promise);
    manager.emit('socketClose', {shouldReconnect: true}); await tick(5000);
    manager.shouldReconnect = false; admission.reject(failure); await flush();
    await tick(60000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(terminal).not.toHaveBeenCalled();
    expect(manager.listenerCount('socketClose')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
