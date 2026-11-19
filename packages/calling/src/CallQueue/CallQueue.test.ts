import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {EventEmitter} from 'events';
import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {CALLING_BACKEND, HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {COMMON_EVENT_KEYS, MOBIUS_EVENT_KEYS} from '../Events/types';
import * as utils from '../common/Utils';
import SDKConnector from '../SDKConnector';
import {createCallQueueClient as createQueueClient} from './CallQueue';
import {ACD_STATE, ICallQueue} from './types';

jest.mock('../SDKConnector', () => ({
  __esModule: true,
  default: {getWebex: jest.fn(), setWebex: jest.fn()},
}));

const createCallQueueClient = (...args: Parameters<typeof createQueueClient>) => {
  jest.mocked(SDKConnector.getWebex).mockReturnValue(args[0]);

  return createQueueClient(...args);
};

const webex = getTestUtilsWebex();
const WEBEX_API_INT = 'https://integration.webexapis.com/v1/';
const TEST_OPTIONS = {webexApiBaseUrl: 'https://integration.webexapis.com'};
const client = createCallQueueClient(webex, {level: LOGGER.INFO}, TEST_OPTIONS);
const mercuryHandlers = new Map<string, (event?: unknown) => void>(
  (webex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
);

function deferredResponse() {
  let resolve!: (value: WebexRequestPayload) => void;
  const promise = new Promise<WebexRequestPayload>((done) => {
    resolve = done;
  });

  return {promise, resolve};
}

describe('CallQueue client', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'uploadLogs').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers Mercury listeners for telephony agent sync, state, and join', () => {
    expect(Array.from(mercuryHandlers.keys())).toEqual(
      expect.arrayContaining([
        'event:telephony_agents.sync',
        'event:telephony_agents.state',
        'event:telephony_agents.join',
        'event:telephony_agent.sync',
      ])
    );
  });

  it('rolls back partially registered Mercury listeners if initialization fails', () => {
    const failedWebex = getTestUtilsWebex();
    const mercury = new EventEmitter();
    const existingSubscriber = jest.fn();
    mercury.on(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC, existingSubscriber);
    let registrations = 0;
    failedWebex.internal.mercury.on.mockImplementation((event, listener) => {
      mercury.on(event, listener);
      registrations += 1;
      if (registrations === 2) throw new Error('Mercury registration failed');
    });
    failedWebex.internal.mercury.off.mockImplementation((event, listener) => {
      mercury.off(event, listener);
    });

    expect(() => createCallQueueClient(failedWebex, {level: LOGGER.INFO}, TEST_OPTIONS)).toThrow(
      'Mercury registration failed'
    );
    expect(mercury.listeners(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC)).toEqual([existingSubscriber]);
    expect(mercury.listenerCount(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)).toBe(0);
  });

  it('loads primary-line queue settings', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      headers: {trackingid: 'tracking-1'},
      body: {
        agentACDState: 'SIGN_OUT',
        queues: [{id: 'queue-1', name: 'Sales', available: false, allowLogOffEnabled: true}],
      },
    }));

    const response = await client.getCallQueueSettings();

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(response.statusCode).toBe(200);
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.SIGN_OUT);
    expect(response.data.callQueue?.queues[0].id).toBe('queue-1');
  });

  it.each([
    ['Integration', 'https://integration.webexapis.com'],
    ['Production', 'https://webexapis.com'],
    ['FedRAMP', 'https://api-usgov.webex.com'],
  ])('routes queue reads, catalog, writes, and sync to the supplied %s API', async (_, baseUrl) => {
    const otherWebex = getTestUtilsWebex();
    const queueClient = createCallQueueClient(
      otherWebex,
      {level: LOGGER.INFO},
      {webexApiBaseUrl: baseUrl}
    );
    otherWebex.request.mockImplementation(
      async ({uri}: {uri: string}) => <WebexRequestPayload>(<unknown>{
          statusCode: 200,
          body: uri.endsWith('/telephony/config/queues')
            ? {queues: [{id: 'queue-1', name: 'Sales'}]}
            : {agentACDState: 'AVAILABLE', queues: [{id: 'queue-1', available: true}]},
        })
    );

    expect((await queueClient.getCallQueueSettings()).statusCode).toBe(200);
    expect(
      (await queueClient.updateCallQueueSettings({agentACDState: ACD_STATE.UNAVAILABLE})).statusCode
    ).toBe(200);
    expect((await queueClient.syncTelephonyCalls()).statusCode).toBe(200);
    expect(otherWebex.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        uri: `${baseUrl}/v1/telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      })
    );
    expect(otherWebex.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        uri: `${baseUrl}/v1/telephony/config/queues`,
        method: HTTP_METHODS.GET,
      })
    );
    expect(otherWebex.request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        uri: `${baseUrl}/v1/telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.PUT,
      })
    );
    expect(otherWebex.request).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        uri: `${baseUrl}/v1/telephony/calls/sync/invoke`,
        method: HTTP_METHODS.POST,
      })
    );
    queueClient.dispose();
  });

  it('accepts one trailing slash without duplicating the version segment', async () => {
    const otherWebex = getTestUtilsWebex();
    const queueClient = createCallQueueClient(
      otherWebex,
      {level: LOGGER.INFO},
      {
        webexApiBaseUrl: 'https://integration.webexapis.com/',
      }
    );
    otherWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    await queueClient.getCallQueueSettings();
    expect(otherWebex.request).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      })
    );
    queueClient.dispose();
  });

  it.each([
    '',
    'http://webexapis.com',
    'https://webexapis.com.evil.example',
    'https://webexapis.com@evil.example',
    'https://user@webexapis.com',
    'https://webexapis.com:443',
    'https://webexapis.com/v1',
    'https://webexapis.com?foo=bar',
    'https://webexapis.com#fragment',
    'https://webexapis.com//',
  ])('rejects an invalid API base %s before sending requests', async (baseUrl) => {
    const otherWebex = getTestUtilsWebex();
    const queueClient = createCallQueueClient(
      otherWebex,
      {level: LOGGER.INFO},
      {webexApiBaseUrl: baseUrl}
    );
    expect((await queueClient.getCallQueueSettings()).statusCode).toBe(400);
    expect(
      (await queueClient.updateCallQueueSettings({agentACDState: ACD_STATE.AVAILABLE})).statusCode
    ).toBe(400);
    expect((await queueClient.syncTelephonyCalls()).statusCode).toBe(400);
    const syncListener = otherWebex.internal.mercury.on.mock.calls.find(
      ([event]) => event === MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC
    )?.[1];
    syncListener?.({data: {agentACDState: 'AVAILABLE'}});
    await Promise.resolve();
    expect(otherWebex.request).not.toHaveBeenCalled();
    queueClient.dispose();
  });

  it('fails closed when JavaScript callers omit options', async () => {
    const otherWebex = getTestUtilsWebex();
    // @ts-expect-error Exercise a JavaScript caller that omits the required options.
    const queueClient = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    expect((await queueClient.getCallQueueSettings()).statusCode).toBe(400);
    expect(otherWebex.request).not.toHaveBeenCalled();
    queueClient.dispose();
  });

  it.each(['device', 'features', 'entitlement', 'models'])(
    'starts accepting requests after delayed registration when %s is initially missing',
    async (missing) => {
      const lateWebex = getTestUtilsWebex();
      const device = lateWebex.internal.device;
      const {features} = device;
      const {entitlement} = features;
      const {models} = entitlement;
      const missingFields = {
        device: [lateWebex.internal, 'device'],
        features: [device, 'features'],
        entitlement: [features, 'entitlement'],
        models: [entitlement, 'models'],
      } as const;
      const [target, field] = missingFields[missing as keyof typeof missingFields];
      Reflect.deleteProperty(target, field);
      const earlyClient = createCallQueueClient(lateWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
      expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(501);
      expect(lateWebex.request).not.toHaveBeenCalled();
      expect(lateWebex.internal.mercury.on).not.toHaveBeenCalled();

      lateWebex.internal.device = device;
      device.features = features;
      features.entitlement = entitlement;
      entitlement.models = models;
      lateWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));
      expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(200);
      expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(200);
      expect(lateWebex.internal.mercury.on).toHaveBeenCalledWith(
        MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC,
        expect.any(Function)
      );
      expect(lateWebex.internal.mercury.on).toHaveBeenCalledTimes(6);
      earlyClient.dispose();
    }
  );

  it('prepares an early client for reuse after registration without duplicate listeners or requests', () => {
    const lateWebex = getTestUtilsWebex();
    const features = lateWebex.internal.device.features;
    Reflect.deleteProperty(lateWebex.internal.device, 'features');
    const earlyClient = createCallQueueClient(lateWebex, {level: LOGGER.INFO}, TEST_OPTIONS);

    assert.isTrue(earlyClient.prepareForReuse());
    assert.lengthOf(lateWebex.internal.mercury.on.mock.calls, 0);
    lateWebex.internal.device.features = features;
    assert.isTrue(earlyClient.prepareForReuse());
    assert.lengthOf(lateWebex.internal.mercury.on.mock.calls, 6);
    assert.isTrue(earlyClient.prepareForReuse());
    assert.lengthOf(lateWebex.internal.mercury.on.mock.calls, 6);
    assert.lengthOf(lateWebex.request.mock.calls, 0);
    earlyClient.dispose();
  });

  it('reuses a compatible client in the factory without duplicating listeners', () => {
    const boundWebex = getTestUtilsWebex();
    const first = createCallQueueClient(boundWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const reused = createCallQueueClient(boundWebex, {level: LOGGER.INFO}, TEST_OPTIONS, first);

    assert.strictEqual(reused, first);
    assert.lengthOf(boundWebex.internal.mercury.on.mock.calls, 6);
    assert.lengthOf(boundWebex.internal.mercury.off.mock.calls, 0);
    reused.dispose();
  });

  it.each(['apiBaseUrl', 'logger', 'account'])(
    'replaces and cleans up a prior client when %s changes',
    (changed) => {
      const boundWebex = getTestUtilsWebex();
      const first = createCallQueueClient(boundWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
      const logger = {level: changed === 'logger' ? LOGGER.TRACE : LOGGER.INFO};
      const options =
        changed === 'apiBaseUrl' ? {webexApiBaseUrl: 'https://webexapis.com'} : TEST_OPTIONS;
      if (changed === 'account') boundWebex.internal.device.userId = 'another-user';

      const replacement = createCallQueueClient(boundWebex, logger, options, first);

      assert.notStrictEqual(replacement, first);
      assert.lengthOf(boundWebex.internal.mercury.off.mock.calls, 6);
      assert.lengthOf(boundWebex.internal.mercury.on.mock.calls, 12);
      replacement.dispose();
    }
  );

  it('disposes a prior client when reuse readiness throws', () => {
    const boundWebex = getTestUtilsWebex();
    const first = createCallQueueClient(boundWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    jest.spyOn(first, 'prepareForReuse').mockImplementation(() => {
      throw new Error('Backend failed');
    });

    expect(() =>
      createCallQueueClient(boundWebex, {level: LOGGER.INFO}, TEST_OPTIONS, first)
    ).toThrow('Backend failed');
    assert.lengthOf(boundWebex.internal.mercury.off.mock.calls, 6);
  });

  it('rejects reuse and requests after disposal', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    other.dispose();

    assert.isFalse(other.prepareForReuse());
    assert.lengthOf(otherWebex.internal.mercury.on.mock.calls, 6);
    assert.equal((await other.getCallQueueSettings()).statusCode, 400);
    assert.lengthOf(otherWebex.request.mock.calls, 0);
  });

  it('reloads queue membership policy after a client is prepared for reuse', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const status = (allowLogOffEnabled: boolean) => <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {
          agentACDState: 'AVAILABLE',
          queues: [{id: 'q1', name: 'Sales', available: true, allowLogOffEnabled}],
        },
      });
    otherWebex.request
      .mockResolvedValueOnce(status(false))
      .mockResolvedValueOnce(status(true))
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));

    await other.getCallQueueSettings();
    assert.isTrue(other.prepareForReuse());
    const updated = await other.updateCallQueueSettings({queues: [{id: 'q1', available: false}]});

    assert.equal(updated.statusCode, 204);
    assert.lengthOf(otherWebex.request.mock.calls, 3);
    assert.deepEqual(otherWebex.request.mock.calls[2][0].body, {
      queues: [{id: 'q1', available: false}],
    });
    other.dispose();
  });

  it.each(['GET', 'PUT'])(
    'does not commit a %s response from before reinitialization',
    async (method) => {
      const otherWebex = getTestUtilsWebex();
      const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
      const oldRequest = deferredResponse();
      otherWebex.request
        .mockReturnValueOnce(oldRequest.promise)
        .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
          statusCode: 200,
          body: {agentACDState: 'UNAVAILABLE', queues: []},
        }))
        .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));
      const pending =
        method === 'GET'
          ? other.getCallQueueSettings()
          : other.updateCallQueueSettings({agentACDState: ACD_STATE.AVAILABLE});

      assert.isTrue(other.prepareForReuse());
      assert.equal(
        (await other.getCallQueueSettings()).data.callQueue?.acdState,
        ACD_STATE.UNAVAILABLE
      );
      oldRequest.resolve(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));
      const staleResponse = await pending;
      assert.equal(staleResponse.statusCode, 409);
      if (method === 'PUT') {
        assert.include(staleResponse.data.error, 'request may have completed');
        assert.include(staleResponse.data.error, 'refresh settings before retrying');
      }
      assert.equal(
        (await other.syncTelephonyCalls()).data.callQueue?.acdState,
        ACD_STATE.UNAVAILABLE
      );
      assert.lengthOf(otherWebex.request.mock.calls, 3);
      other.dispose();
    }
  );

  it('does not send a membership update after its policy read is superseded', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const policy = deferredResponse();
    otherWebex.request.mockReturnValueOnce(policy.promise);
    const update = other.updateCallQueueSettings({queues: [{id: 'q1', available: false}]});

    assert.isTrue(other.prepareForReuse());
    policy.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [{id: 'q1', name: 'Sales', available: true, allowLogOffEnabled: true}],
      },
    }));

    const response = await update;
    assert.equal(response.statusCode, 409);
    assert.notInclude(response.data.error, 'request may have completed');
    assert.lengthOf(otherWebex.request.mock.calls, 1);
    other.dispose();
  });

  it.each(['GET', 'PUT'])(
    'returns a lifecycle conflict if reinitialized during %s diagnostic upload',
    async (method) => {
      const otherWebex = getTestUtilsWebex();
      const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
      let finishUpload!: () => void;
      const upload = new Promise<void>((resolve) => {
        finishUpload = resolve;
      });
      (utils.uploadLogs as jest.Mock).mockReturnValueOnce(upload);
      otherWebex.request.mockRejectedValueOnce({statusCode: 500});
      const pending =
        method === 'GET'
          ? other.getCallQueueSettings()
          : other.updateCallQueueSettings({agentACDState: ACD_STATE.AVAILABLE});
      await Promise.resolve();
      assert.lengthOf((utils.uploadLogs as jest.Mock).mock.calls, 1);

      assert.isTrue(other.prepareForReuse());
      finishUpload();
      const response = await pending;

      assert.equal(response.statusCode, 409);
      if (method === 'PUT') assert.include(response.data.error, 'request may have completed');
      assert.lengthOf(otherWebex.request.mock.calls, 1);
      other.dispose();
    }
  );

  it('rejects a sync response from an earlier lifecycle', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const oldSync = deferredResponse();
    otherWebex.request.mockReturnValueOnce(oldSync.promise);
    const sync = other.syncTelephonyCalls();

    assert.isTrue(other.prepareForReuse());
    oldSync.resolve(<WebexRequestPayload>(<unknown>{statusCode: 204}));

    assert.equal((await sync).statusCode, 409);
    assert.lengthOf(otherWebex.request.mock.calls, 1);
    other.dispose();
  });

  it('does not commit an event refresh started before reinitialization', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const listener = sinon.spy();
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const oldRefresh = deferredResponse();
    const newRefresh = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(oldRefresh.promise)
      .mockReturnValueOnce(newRefresh.promise);
    const handler = otherWebex.internal.mercury.on.mock.calls.find(
      ([event]) => event === MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE
    )?.[1];
    handler({data: {state: 'available'}});
    assert.isTrue(other.prepareForReuse());
    handler({data: {state: 'unavailable'}});

    oldRefresh.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    assert.notCalled(listener);
    newRefresh.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'UNAVAILABLE', queues: []},
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    assert.calledOnceWithExactly(listener, {acdState: ACD_STATE.UNAVAILABLE, queues: []});
    other.dispose();
  });

  it('does not fetch queue names when an event listener reinitializes the client', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    await other.getCallQueueSettings();
    const listener = sinon.spy(() => other.prepareForReuse());
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const handler = otherWebex.internal.mercury.on.mock.calls.find(
      ([event]) => event === MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN
    )?.[1];

    handler({data: {joinInfo: [{queueId: 'q1', status: 'joined'}]}});

    assert.calledOnce(listener);
    assert.lengthOf(otherWebex.request.mock.calls, 1);
    other.dispose();
  });

  it('ignores an already-dispatched Mercury callback after disposal', () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const handler = otherWebex.internal.mercury.on.mock.calls.find(
      ([event]) => event === MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE
    )?.[1];
    other.dispose();

    handler({data: {state: 'available'}});

    assert.lengthOf(otherWebex.request.mock.calls, 0);
  });

  it('does not retain catalog names from a request made before reinitialization', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const oldCatalog = deferredResponse();
    const status = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: 'q1', available: true}]},
    });
    otherWebex.request
      .mockResolvedValueOnce(status)
      .mockReturnValueOnce(oldCatalog.promise)
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {queues: [{id: 'q1', name: 'Current'}]},
      }))
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));
    const pending = other.getCallQueueSettings();
    await Promise.resolve();
    assert.lengthOf(otherWebex.request.mock.calls, 2);
    assert.isTrue(other.prepareForReuse());
    assert.equal((await other.getCallQueueSettings()).data.callQueue?.queues[0].name, 'Current');
    oldCatalog.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {queues: [{id: 'q1', name: 'Old'}]},
    }));
    assert.equal((await pending).statusCode, 409);
    const result = await other.updateCallQueueSettings({agentACDState: ACD_STATE.UNAVAILABLE});
    assert.equal(result.data.callQueue?.queues[0].name, 'Current');
    other.dispose();
  });

  it.each([
    ['UCM', 'NATIVE_SIP_CALL_TO_UCM', 'bc-sp-standard'],
    ['BroadWorks', 'NATIVE_WEBEX_TEAMS_CALLING', 'broadworks-connector'],
  ])('requires replacement if a listening client changes to %s', (_, behavior, entitlement) => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    otherWebex.internal.device.callingBehavior = behavior;
    otherWebex.internal.device.features.entitlement.models[0]._values.key = entitlement;

    assert.isFalse(other.prepareForReuse());
    assert.lengthOf(otherWebex.internal.mercury.on.mock.calls, 6);
    assert.lengthOf(otherWebex.request.mock.calls, 0);
    other.dispose();
  });

  it.each([
    ['non-array models', {}],
    ['null model', [null]],
    ['missing values', [{}]],
    ['null values', [{_values: null}]],
    ['missing key', [{_values: {}}]],
    ['non-string key', [{_values: {key: null}}]],
    ['partially populated array', [{_values: {key: 'bc-sp-standard'}}, {}]],
  ])('defers backend detection for %s until data is complete', async (_, incompleteModels) => {
    const lateWebex = getTestUtilsWebex();
    const entitlement = lateWebex.internal.device.features.entitlement;
    const {models} = entitlement;
    entitlement.models = incompleteModels as typeof models;
    const earlyClient = createCallQueueClient(lateWebex, {level: LOGGER.INFO}, TEST_OPTIONS);

    expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(501);
    expect(lateWebex.request).not.toHaveBeenCalled();
    expect(lateWebex.internal.mercury.on).not.toHaveBeenCalled();

    entitlement.models = models;
    lateWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(200);
    expect(lateWebex.internal.mercury.on).toHaveBeenCalledTimes(6);
    earlyClient.dispose();
  });

  it.each([
    ['UCM', 'NATIVE_SIP_CALL_TO_UCM', 'bc-sp-standard'],
    ['BroadWorks', 'NATIVE_WEBEX_TEAMS_CALLING', 'broadworks-connector'],
  ])('does not start queue requests or listeners for %s', async (_, behavior, entitlement) => {
    const otherWebex = getTestUtilsWebex();
    otherWebex.internal.device.callingBehavior = behavior;
    otherWebex.internal.device.features.entitlement.models[0]._values.key = entitlement;
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);

    expect((await other.getCallQueueSettings()).statusCode).toBe(501);
    expect(otherWebex.request).not.toHaveBeenCalled();
    expect(otherWebex.internal.mercury.on).not.toHaveBeenCalled();
    other.dispose();
  });

  it('does not hide unexpected backend detection errors', () => {
    const backend = sinon
      .stub(utils, 'getCallingBackEnd')
      .throws(new Error('Unexpected backend error'));

    try {
      expect(() => createCallQueueClient(webex, {level: LOGGER.INFO}, TEST_OPTIONS)).toThrow(
        'Unexpected backend error'
      );
    } finally {
      backend.restore();
    }
  });

  it('fills a missing display name from the queue catalog', async () => {
    const queueId =
      'Y2lzY29zcGFyazovL3VzL0NBTExfUVVFVUUvNGFiNmJkZGEtYzY4NC00OGYzLTkyMTctNjBmZGJiODA0OWIz';
    const gatewayQueueId = '4ab6bdda-c684-48f3-9217-60fdbb8049b3';
    webex.request.mockImplementation(async (options: {uri: string}) => {
      if (options.uri.endsWith('telephony/config/queues')) {
        return {
          statusCode: 200,
          body: {
            queues: [{id: queueId, name: 'TestQueue', extension: '4000', enabled: true}],
          },
        };
      }

      return {
        statusCode: 200,
        body: {
          agentACDState: 'SIGN_OUT',
          queues: [
            {id: gatewayQueueId, available: true, extension: '4000', allowLogOffEnabled: false},
          ],
        },
      };
    });

    const response = await client.getCallQueueSettings();

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(response.data.callQueue?.queues[0].name).toBe('TestQueue');
    expect(response.data.callQueue?.queues[0].id).toBe(gatewayQueueId);
    expect(response.data.callQueue?.queues[0].allowLogOffEnabled).toBe(false);
  });

  it('follows same-catalog Link headers to find queue names', async () => {
    const catalogClient = createCallQueueClient(webex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const next = `${WEBEX_API_INT}telephony/config/queues?start=1`;
    webex.request.mockImplementation(async (options: {uri: string}) => {
      if (options.uri === next) {
        return {statusCode: 200, body: {queues: [{id: 'queue-next', name: 'Next queue'}]}};
      }
      if (options.uri.endsWith('/telephony/config/queues')) {
        return {statusCode: 200, body: {queues: []}, headers: {link: `<${next}>; rel="next"`}};
      }

      return {statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-next'}]}};
    });

    const response = await catalogClient.getCallQueueSettings();

    expect(response.data.callQueue?.queues[0].name).toBe('Next queue');
    expect(webex.request).toHaveBeenCalledWith({uri: next, method: HTTP_METHODS.GET});
  });

  it('does not follow a catalog Link to another origin', async () => {
    const catalogClient = createCallQueueClient(webex, {level: LOGGER.INFO}, TEST_OPTIONS);
    webex.request
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-next'}]},
      }))
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {queues: []},
        headers: {link: '<https://example.com/v1/telephony/config/queues?start=1>; rel="next"'},
      }));

    await catalogClient.getCallQueueSettings();

    expect(webex.request).toHaveBeenCalledTimes(2);
  });

  it('loads a secondary line when the line id is safe', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));

    await client.getCallQueueSettings('line-owner-1');

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/line-owner-1/queues`,
      method: HTTP_METHODS.GET,
    });
  });

  it('encodes a raw virtual-line UUID in public API requests', async () => {
    const lineId = '36d87d6c-7531-4b2f-a4ef-d71e6aacb86f';
    const encodedLine = btoa(`ciscospark://us/VIRTUAL_LINE/${lineId}`).replace(/=+$/, '');
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));

    await client.getCallQueueSettings(lineId);

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/${encodedLine}/queues`,
      method: HTTP_METHODS.GET,
    });
  });

  it('encodes a raw queue UUID in a public membership update', async () => {
    const queueId = '4ab6bdda-c684-48f3-9217-60fdbb8049b3';
    const encodedQueue = btoa(`ciscospark://us/CALL_QUEUE/${queueId}`).replace(/=+$/, '');
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: encodedQueue, available: true}]},
    }));

    await client.updateCallQueueSettings({queues: [{id: queueId, available: true}]});

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PUT,
      body: {queues: [{id: encodedQueue, available: true}]},
    });
  });

  it('does not request settings for a line id that could change the path', async () => {
    const response = await client.getCallQueueSettings('../other');

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });

  it('patches ACD state and queue join', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [{id: 'queue-1', available: true, allowLogOffEnabled: true}],
      },
    }));

    const response = await client.updateCallQueueSettings({
      agentACDState: ACD_STATE.AVAILABLE,
      queues: [{id: 'queue-1', available: true}],
    });

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PUT,
      body: {
        agentACDState: ACD_STATE.AVAILABLE,
        queues: [{id: 'queue-1', available: true}],
      },
    });
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.AVAILABLE);
  });

  it('keeps a queue joined when the agent is not allowed to log off', async () => {
    webex.request.mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [{id: 'locked', name: 'Overnight', available: true, allowLogOffEnabled: false}],
      },
    }));
    await client.getCallQueueSettings();
    webex.request.mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));

    await client.updateCallQueueSettings({
      queues: [{id: 'locked', available: false}],
    });

    expect(webex.request).toHaveBeenLastCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PUT,
      body: {
        queues: [{id: 'locked', available: true}],
      },
    });
  });

  it('uses the target line settings when a queue is updated', async () => {
    const lineAwareClient = createCallQueueClient(webex, {level: LOGGER.INFO}, TEST_OPTIONS);
    webex.request.mockImplementation(async (options: {uri: string; method?: string}) => {
      if (options.method === HTTP_METHODS.PUT) {
        return <WebexRequestPayload>(<unknown>{statusCode: 204});
      }

      const isSecondaryLine = options.uri.includes('/secondaryLines/line-owner-2/');

      return <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {
          agentACDState: 'AVAILABLE',
          queues: [
            {
              id: 'shared-queue',
              name: 'Shared queue',
              available: true,
              allowLogOffEnabled: !isSecondaryLine,
            },
          ],
        },
      });
    });

    await lineAwareClient.getCallQueueSettings();
    await lineAwareClient.updateCallQueueSettings(
      {queues: [{id: 'shared-queue', available: false}]},
      'line-owner-2'
    );

    expect(webex.request).toHaveBeenNthCalledWith(1, {
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(webex.request).toHaveBeenNthCalledWith(2, {
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/line-owner-2/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(webex.request).toHaveBeenNthCalledWith(3, {
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/line-owner-2/queues`,
      method: HTTP_METHODS.PUT,
      body: {queues: [{id: 'shared-queue', available: true}]},
    });
  });

  it('rejects an update that sets nothing', async () => {
    const response = await client.updateCallQueueSettings({});

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });

  it('rejects an empty queue update', async () => {
    const response = await client.updateCallQueueSettings({queues: []});

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(response.data.error).toBe('queues must include at least one queue update');
  });

  it.each([
    ['null request', null],
    ['missing request', undefined],
    ['array request', []],
    ['string request', 'invalid'],
    ['null queues', {queues: null}],
    ['object queues', {queues: {}}],
    ['string queues', {queues: 'invalid'}],
    ['numeric queues', {queues: 1}],
  ])('rejects %s from JavaScript callers without making a request', async (_, request) => {
    const response = await client.updateCallQueueSettings(
      request as Parameters<ICallQueue['updateCallQueueSettings']>[0]
    );

    expect(response.statusCode).toBe(400);
    expect(webex.request).not.toHaveBeenCalled();
  });

  it('rejects an unsupported ACD state', async () => {
    const response = await client.updateCallQueueSettings({
      agentACDState: 'LUNCH' as ACD_STATE,
    });

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });

  it('does not call the network when the user is not on Webex Calling cloud', async () => {
    const backend = jest.spyOn(utils, 'getCallingBackEnd').mockReturnValue(CALLING_BACKEND.UCM);
    const other = createCallQueueClient(webex, {level: LOGGER.INFO}, TEST_OPTIONS);

    const response = await other.getCallQueueSettings();
    backend.mockRestore();

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(501);
  });

  it('posts telephony sync', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{statusCode: 204}));

    const response = await client.syncTelephonyCalls();

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/calls/sync/invoke`,
      method: HTTP_METHODS.POST,
      body: {
        wdmUrl: webex.internal.device.url,
        resources: [{resource: 'telephony_agents'}],
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.message).toBe('SUCCESS');
  });

  it('rejects sync without a registered device URL', async () => {
    const original = webex.internal.device.url;
    try {
      webex.internal.device.url = '';
      const response = await client.syncTelephonyCalls();
      expect(response.statusCode).toBe(400);
      expect(webex.request).not.toHaveBeenCalled();
    } finally {
      webex.internal.device.url = original;
    }
  });

  it('scopes virtual-line events and ignores events for another person', async () => {
    const lineId = '36d87d6c-7531-4b2f-a4ef-d71e6aacb86f';
    const scoped = createCallQueueClient(webex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const listener = jest.fn();
    scoped.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-1', name: 'Sales', available: true}]},
    }));
    await scoped.getCallQueueSettings(lineId);
    const handlers = new Map<string, (event?: unknown) => void>(
      (webex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    const join = handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN);
    join?.({
      data: {
        actorType: 'PERSON',
        actorId: 'a-different-person',
        joinInfo: [{queueId: 'queue-1', status: 'unjoined'}],
      },
    });
    join?.({
      data: {
        actorType: 'PLACE',
        actorId: lineId,
        joinInfo: [{queueId: 'queue-1', status: 'unjoined'}],
      },
    });
    expect(listener).not.toHaveBeenCalled();
    join?.({
      data: {
        actorType: 'VIRTUAL_LINE',
        actorId: btoa(`ciscospark://us/VIRTUAL_LINE/${lineId}`),
        joinInfo: [{queueId: 'queue-1', status: 'unjoined'}],
      },
    });
    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.AVAILABLE,
      queues: [{id: 'queue-1', name: 'Sales', available: false}],
      lineOwnerId: lineId,
    });
    scoped.dispose();
  });

  it('refreshes the actual state when a join event arrives before settings have loaded', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const listener = jest.fn();
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    otherWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-1', name: 'Sales', available: true}]},
    }));
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN)?.({
      data: {
        actorType: 'PERSON',
        actorId: btoa(`ciscospark://us/PEOPLE/${otherWebex.internal.device.userId}`),
        joinInfo: [{queueId: 'queue-1', status: 'joined'}],
      },
    });
    expect(listener).not.toHaveBeenCalled();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(otherWebex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.AVAILABLE,
      queues: [{id: 'queue-1', name: 'Sales', available: true}],
    });
    other.dispose();
  });

  it('refreshes again when an uncached join event is followed by a state event', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const listener = jest.fn();
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const first = deferredResponse();
    const second = deferredResponse();
    otherWebex.request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    const actorId = otherWebex.internal.device.userId;
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN)?.({
      data: {actorType: 'PERSON', actorId, joinInfo: [{queueId: 'queue-1', status: 'joined'}]},
    });
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId, acdStateInfo: {state: 'unavailable'}},
    });
    first.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-1', name: 'Sales', available: true}]},
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(listener).not.toHaveBeenCalled();
    second.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'UNAVAILABLE',
        queues: [{id: 'queue-1', name: 'Sales', available: true}],
      },
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.UNAVAILABLE,
      queues: [{id: 'queue-1', name: 'Sales', available: true}],
    });
    other.dispose();
  });

  it('does not overwrite a newer Mercury state with an older in-flight GET', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const body = {
      agentACDState: 'AVAILABLE',
      queues: [{id: 'queue-1', name: 'Sales', available: true}],
    };
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body})
    ));
    await other.getCallQueueSettings();
    const oldGet = deferredResponse();
    otherWebex.request.mockReturnValueOnce(oldGet.promise);
    const read = other.getCallQueueSettings();
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId: otherWebex.internal.device.userId, state: 'unavailable'},
    });
    oldGet.resolve(<WebexRequestPayload>(<unknown>{statusCode: 200, body}));
    const response = await read;
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    expect(response.data.callQueue?.queues).toEqual(body.queues);
    other.dispose();
  });

  it('waits for the latest replacement event refresh while a GET is pending', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const original = deferredResponse();
    const first = deferredResponse();
    const second = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(original.promise)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let settled = false;
    const read = other.getCallQueueSettings().then((result) => {
      settled = true;

      return result;
    });
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    const actorId = otherWebex.internal.device.userId;
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN)?.({
      data: {actorType: 'PERSON', actorId, joinInfo: [{queueId: 'q1', status: 'joined'}]},
    });
    original.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [],
      },
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId, state: 'unavailable'},
    });
    first.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [],
      },
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(settled).toBe(false);
    second.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'UNAVAILABLE',
        queues: [],
      },
    }));
    const response = await read;
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('does not let an older event refresh overwrite a later GET', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const listener = jest.fn();
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const oldGet = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(oldGet.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(
        (<unknown>{statusCode: 200, body: {agentACDState: 'UNAVAILABLE', queues: []}})
      ));
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId: otherWebex.internal.device.userId, state: 'available'},
    });
    await other.getCallQueueSettings();
    oldGet.resolve(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: []}})
    ));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(listener).not.toHaveBeenCalled();
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));
    const updated = await other.updateCallQueueSettings({queues: [{id: 'q1', available: true}]});
    expect(updated.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('does not let an older GET overwrite a successful update', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const initial = {agentACDState: 'AVAILABLE', queues: []};
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: initial})
    ));
    await other.getCallQueueSettings();
    const oldGet = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(oldGet.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));
    const read = other.getCallQueueSettings();
    await other.updateCallQueueSettings({agentACDState: ACD_STATE.UNAVAILABLE});
    oldGet.resolve(<WebexRequestPayload>(<unknown>{statusCode: 200, body: initial}));
    expect((await read).data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('does not let an older GET overwrite a later completed GET', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const oldGet = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(oldGet.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(
        (<unknown>{statusCode: 200, body: {agentACDState: 'UNAVAILABLE', queues: []}})
      ));
    const read = other.getCallQueueSettings();
    await other.getCallQueueSettings();
    oldGet.resolve(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: []}})
    ));
    expect((await read).data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('refreshes after an update overlaps a Mercury event', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: []}})
    ));
    await other.getCallQueueSettings();
    const patch = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(patch.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(
        (<unknown>{statusCode: 200, body: {agentACDState: 'WRAP_UP', queues: []}})
      ));
    const update = other.updateCallQueueSettings({agentACDState: ACD_STATE.WRAP_UP});
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId: otherWebex.internal.device.userId, state: 'unavailable'},
    });
    patch.resolve(<WebexRequestPayload>(<unknown>{statusCode: 204}));
    const response = await update;
    expect(response.statusCode).toBe(204);
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.WRAP_UP);
    expect(otherWebex.request).toHaveBeenCalledTimes(3);
    other.dispose();
  });

  it('fails safely when the first GET has no agent state', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {queues: [{id: 'q1', name: 'Sales', available: true}]}})
    ));
    const response = await other.getCallQueueSettings();
    expect(response.statusCode).toBe(502);
    expect(response.data.callQueue).toBeUndefined();
    other.dispose();
  });

  it('loads settings after a queue-only update with no cached state', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    otherWebex.request
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}))
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {
          agentACDState: 'UNAVAILABLE',
          queues: [{id: 'q1', name: 'Sales', available: true}],
        },
      }));
    const response = await other.updateCallQueueSettings({queues: [{id: 'q1', available: true}]});
    expect(response.statusCode).toBe(204);
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    expect(otherWebex.request).toHaveBeenCalledTimes(2);
    other.dispose();
  });

  it('uses the bound Webex instance and unregisters only its queue listeners on disposal', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    otherWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    await other.getCallQueueSettings();
    expect(otherWebex.request).toHaveBeenCalledTimes(1);
    expect(webex.request).not.toHaveBeenCalled();
    other.dispose();
    expect(otherWebex.internal.mercury.off.mock.calls).toEqual(
      otherWebex.internal.mercury.on.mock.calls
    );
    expect(webex.internal.mercury.off).not.toHaveBeenCalled();
  });

  it('rejects a Webex instance different from the one bound to SDKConnector', () => {
    jest.mocked(SDKConnector.getWebex).mockReturnValue(webex);
    expect(() =>
      createQueueClient(getTestUtilsWebex(), {level: LOGGER.INFO}, TEST_OPTIONS)
    ).toThrow('Call queue Webex instance must match the SDKConnector instance');
  });

  it('keeps other subscribers receiving events when one queue client is disposed', async () => {
    const boundWebex = getTestUtilsWebex();
    const mercury = new EventEmitter();
    boundWebex.internal.mercury.on.mockImplementation((event, handler) => {
      mercury.on(event, handler);
    });
    boundWebex.internal.mercury.off.mockImplementation((event, handler) => {
      mercury.off(event, handler);
    });
    const first = createCallQueueClient(boundWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    const second = createCallQueueClient(boundWebex, {level: LOGGER.INFO}, TEST_OPTIONS);
    boundWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'UNAVAILABLE', queues: []},
    }));
    await second.getCallQueueSettings();
    const unrelated = jest.fn();
    const observed = jest.fn();
    mercury.on(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE, unrelated);
    second.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, observed);

    first.dispose();
    mercury.emit(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE, {
      data: {agentACDState: 'AVAILABLE', queues: []},
    });

    expect(unrelated).toHaveBeenCalledTimes(1);
    expect(observed).toHaveBeenCalledTimes(1);
    second.dispose();
  });

  it('emits the merged status when a Mercury state event arrives', () => {
    const publicClient: ICallQueue = client;
    const listener = jest.fn();
    publicClient.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const stateHandler = mercuryHandlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE);

    stateHandler?.({data: {acdStateInfo: {state: 'unavailable'}}});

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({acdState: ACD_STATE.UNAVAILABLE})
    );
    publicClient.off(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    listener.mockClear();
    stateHandler?.({data: {acdStateInfo: {state: 'available'}}});
    expect(listener).not.toHaveBeenCalled();
  });

  it('emits the full queue snapshot when a Mercury sync event arrives', () => {
    const listener = jest.fn();
    client.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const syncHandler = mercuryHandlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC);

    syncHandler?.({
      data: {
        agentACDState: 'available',
        queues: [{id: 'sync-queue', name: 'Sync queue', available: true}],
      },
    });

    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.AVAILABLE,
      queues: [{id: 'sync-queue', name: 'Sync queue', available: true}],
    });
    client.off(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
  });

  it('emits the queue membership change when a Mercury join event arrives', () => {
    const listener = jest.fn();
    client.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const joinHandler = mercuryHandlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN);

    joinHandler?.({data: {queues: [{id: 'joined-queue', name: 'Joined queue', available: true}]}});

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        queues: expect.arrayContaining([
          expect.objectContaining({id: 'joined-queue', name: 'Joined queue', available: true}),
        ]),
      })
    );
    client.off(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
  });

  it('returns the service error when the settings request fails', async () => {
    webex.request.mockRejectedValue({statusCode: 401});

    const response = await client.getCallQueueSettings();

    expect(response.statusCode).toBe(401);
    expect(response.message).toBe('FAILURE');
  });

  it.each([
    ['read settings', () => client.getCallQueueSettings()],
    ['update settings', () => client.updateCallQueueSettings({agentACDState: ACD_STATE.AVAILABLE})],
    ['sync events', () => client.syncTelephonyCalls()],
  ])('returns the original service failure when log upload fails during %s', async (_, request) => {
    webex.request.mockRejectedValue({statusCode: 401});
    jest.spyOn(utils, 'uploadLogs').mockRejectedValueOnce(new Error('Log upload failed'));

    const response = await request();

    expect(webex.request).toHaveBeenCalledTimes(1);
    expect(utils.uploadLogs).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      statusCode: 401,
      data: {error: 'User is unauthorised, possible token expiry'},
      message: 'FAILURE',
    });
  });

  it('returns a failure when a request rejects without an error', async () => {
    webex.request.mockRejectedValue(undefined);
    jest.spyOn(utils, 'uploadLogs').mockRejectedValueOnce(new Error('Log upload failed'));

    const response = await client.getCallQueueSettings();

    expect(response).toEqual({
      statusCode: 422,
      data: {error: '422 Exception has occurred'},
      message: 'FAILURE',
    });
  });
});
