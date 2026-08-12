import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {CONTROL_TOPIC, DEFAULT_CHANNEL} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import type {JsonValue} from '../../../../src/core/json';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../../../../src/core/protocol';
import type {Envelope} from '../../../../src/core/protocol';
import {createExtensionBridgeWith} from '../../../../src/extension/background';
import {ClientCommand, RelayKind} from '../../../../src/extension/messages';
import type {RelayRequest, RelayResult} from '../../../../src/extension/messages';
import type {ChromeSender} from '../../../../src/extension/platform';
import type {ExtensionBridge, ExtensionBridgeOptions, PushMeta} from '../../../../src/types';
import {createFakeExtensionWorld} from '../../lib/fakeChrome';
import type {FakeExtensionWorld} from '../../lib/fakeChrome';
import {createLogCapture, runtimeOutcome, tick} from '../../lib/wire';

const ORIGIN = 'https://app.example.com';
const SESSION = 'relay-session-token';

describe('extension/background', () => {
  let world: FakeExtensionWorld;
  let bridge: ExtensionBridge;
  let log: ReturnType<typeof createLogCapture>;
  let idCounter = 0;

  const create = (options: ExtensionBridgeOptions = {}): ExtensionBridge =>
    createExtensionBridgeWith(world.backgroundChrome, {logSink: log.sink, ...options});

  /**
   * Start over with a fresh world and bridge. Tests that need non-default options call
   * this again, so a discarded bridge's runtime listeners can never double-handle the
   * next test's messages.
   */
  const setup = (options: ExtensionBridgeOptions = {}): void => {
    world = createFakeExtensionWorld({origin: ORIGIN});
    log = createLogCapture();
    bridge = create(options);
  };

  const relayMessage = (
    kind: RelayKind,
    extra: {envelope?: Envelope; reason?: string; session?: string} = {}
  ) => ({
    __webexBridgeRelay: true,
    channel: DEFAULT_CHANNEL,
    kind,
    session: SESSION,
    ...extra,
  });

  /** Deliver as a content script would, tolerating the worker's silent acknowledgement. */
  const fromContent = (message: unknown, sender?: Partial<ChromeSender>): Promise<unknown> =>
    runtimeOutcome(world.sendAsContentScript(message, sender));

  const pushEnvelope = (topic: string, payload?: JsonValue, session = SESSION): Envelope => {
    idCounter += 1;

    return createEnvelope({
      channel: DEFAULT_CHANNEL,
      kind: EnvelopeKind.PUSH,
      source: EnvelopeSource.PAGE,
      topic,
      id: `push-${idCounter}`,
      session,
      ...(payload === undefined ? {} : {payload}),
    });
  };

  /** Drain the worker's asynchronous storage round trips. */
  const drain = async (): Promise<void> => {
    for (let round = 0; round < 6; round += 1) {
      // eslint-disable-next-line no-await-in-loop
      await tick();
    }
  };

  const attach = async (session = SESSION, sender?: Partial<ChromeSender>): Promise<void> => {
    await fromContent(relayMessage(RelayKind.CONNECT, {session}), sender);
    await drain();
  };

  const push = async (
    topic: string,
    payload?: JsonValue,
    session = SESSION,
    sender?: Partial<ChromeSender>
  ): Promise<void> => {
    await fromContent(
      relayMessage(RelayKind.PUSH, {envelope: pushEnvelope(topic, payload, session), session}),
      sender
    );
    await drain();
  };

  /** Stand in for the content relay, answering whatever the test decides. */
  const relayAnswers = (make: (envelope: Envelope) => unknown): void => {
    world.contentChrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const request = message as RelayRequest;

      sendResponse(make(request.envelope));

      return true;
    });
  };

  /** A relay that accepts the request and then never answers, like a wedged page. */
  const relayGoesQuiet = (): void => {
    world.contentChrome.runtime.onMessage.addListener(() => true);
  };

  const answerOk = (payload: JsonValue, session = SESSION): void => {
    relayAnswers(
      (envelope): RelayResult => ({
        ok: true,
        envelope: createEnvelope({
          channel: DEFAULT_CHANNEL,
          kind: EnvelopeKind.RESPONSE,
          source: EnvelopeSource.PAGE,
          topic: envelope.topic,
          id: `resp-${envelope.id}`,
          session,
          correlationId: envelope.id,
          ok: true,
          payload,
        }),
      })
    );
  };

  const rejection = async (promise: Promise<unknown>): Promise<BridgeError> =>
    promise.then(
      (value) => {
        throw new Error(`expected a rejection, got ${JSON.stringify(value)}`);
      },
      (error: BridgeError) => error
    );

  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('configuration', () => {
    it('refuses a channel outside the allowed charset', () => {
      assert.throws(() => create({channel: 'not a channel'}), /channel must match/);
    });

    const badOrigins: [string, string[]][] = [
      ['a wildcard', ['*']],
      ['a wildcard subdomain', ['https://*.example.com']],
      ['an empty list', []],
      ['an origin with a path', ['https://app.example.com/app']],
      ['a non-http scheme', ['file:///etc/passwd']],
    ];

    badOrigins.forEach(([why, allowedOrigins]) => {
      it(`refuses ${why} in allowedOrigins`, () => {
        try {
          create({allowedOrigins});
          assert.fail('expected INSECURE_CONFIG');
        } catch (error) {
          assert.instanceOf(error, BridgeError);
          assert.equal((error as BridgeError).code, 'INSECURE_CONFIG');
        }
      });
    });

    it('refuses to run without chrome.tabs, which means it is not in the worker', () => {
      assert.throws(
        () => createExtensionBridgeWith({runtime: world.backgroundChrome.runtime}),
        /chrome\.tabs is unavailable/
      );
    });

    it('refuses to run without chrome.storage.session', () => {
      assert.throws(
        () =>
          createExtensionBridgeWith({
            runtime: world.backgroundChrome.runtime,
            tabs: world.backgroundChrome.tabs,
          }),
        /chrome\.storage\.session is unavailable/
      );
    });
  });

  describe('connection registry', () => {
    it('registers an attaching tab with its origin and url', async () => {
      await attach();

      const connections = await bridge.listConnections();

      assert.lengthOf(connections, 1);
      assert.equal(connections[0].tabId, world.tabId);
      assert.equal(connections[0].origin, ORIGIN);
      assert.equal(connections[0].url, 'https://app.example.com/index.html');
      assert.isNumber(connections[0].connectedAt);
    });

    it('never exposes the session token to a caller', async () => {
      await attach();

      const connections = await bridge.listConnections();

      assert.notInclude(JSON.stringify(connections), SESSION);
      assert.notProperty(connections[0], 'session');
    });

    it('replaces the record when a tab reloads, rather than accumulating', async () => {
      await attach();
      await attach('a-second-session');

      assert.lengthOf(await bridge.listConnections(), 1);
    });

    it('derives the origin from the tab url when the platform omits it', async () => {
      await attach(SESSION, {origin: undefined});

      const connections = await bridge.listConnections();

      assert.equal(connections[0].origin, ORIGIN);
    });

    const detachCases: [string, (world: FakeExtensionWorld) => Promise<void> | void][] = [
      [
        'a relayed BYE',
        (fake) =>
          runtimeOutcome(
            fake.sendAsContentScript(relayMessage(RelayKind.DISCONNECT, {reason: 'bye'}))
          ).then(() => undefined),
      ],
      ['the tab closing', (fake) => fake.fireTabRemoved(fake.tabId)],
      ['the tab navigating', (fake) => fake.fireTabUpdated(fake.tabId, {status: 'loading'})],
      [
        'the tab changing url',
        (fake) => fake.fireTabUpdated(fake.tabId, {url: 'https://elsewhere.example.com/'}),
      ],
    ];

    detachCases.forEach(([why, detach]) => {
      it(`drops the connection on ${why}`, async () => {
        await attach();
        await detach(world);
        await drain();

        assert.lengthOf(await bridge.listConnections(), 0);
      });
    });

    it('keeps the connection when an unrelated tab closes', async () => {
      await attach();
      world.fireTabRemoved(world.tabId + 1);
      await drain();

      assert.lengthOf(await bridge.listConnections(), 1);
    });

    it('ignores a completed navigation with no url change', async () => {
      await attach();
      world.fireTabUpdated(world.tabId, {status: 'complete'});
      await drain();

      assert.lengthOf(await bridge.listConnections(), 1);
    });
  });

  describe('sender verification', () => {
    const counterOf = async (key: string): Promise<number | undefined> =>
      (await bridge.getCounters())[key];

    it('drops a relay message from a different extension', async () => {
      await runtimeOutcome(world.sendAsForeignExtension(relayMessage(RelayKind.CONNECT)));
      await drain();

      assert.lengthOf(await bridge.listConnections(), 0);
      assert.equal(await counterOf('dropped.FOREIGN_SENDER'), 1);
    });

    it('drops a relay message that did not come from a tab', async () => {
      await runtimeOutcome(world.sendAsExtensionPage(relayMessage(RelayKind.CONNECT)));
      await drain();

      assert.lengthOf(await bridge.listConnections(), 0);
      assert.equal(await counterOf('dropped.NOT_A_CONTENT_SCRIPT'), 1);
    });

    it('drops a relay message from an origin outside the allow-list', async () => {
      setup({allowedOrigins: [ORIGIN]});

      await fromContent(relayMessage(RelayKind.CONNECT), {origin: 'https://evil.example.com'});
      await drain();

      assert.lengthOf(await bridge.listConnections(), 0);
      assert.equal(await counterOf('dropped.ORIGIN_NOT_ALLOWED'), 1);
      assert.include(log.messages('warn').join(' '), 'disallowed origin');
    });

    it('accepts an allow-listed origin', async () => {
      setup({allowedOrigins: [ORIGIN]});

      await attach();

      assert.lengthOf(await bridge.listConnections(), 1);
    });

    it('ignores a message that is neither a relay message nor a command', async () => {
      assert.equal(await fromContent({hello: 'there'}), 'Could not establish connection. Receiving end does not exist.');
    });
  });

  describe('receiving pushes', () => {
    let received: {topic: string; payload: JsonValue; meta: PushMeta}[];

    beforeEach(async () => {
      received = [];
      bridge.subscribe((topic, payload, meta) => received.push({topic, payload, meta}));
      await attach();
    });

    it('delivers a push with metadata the host can act on', async () => {
      await push('demo.topic', {count: 1});

      assert.lengthOf(received, 1);
      assert.equal(received[0].topic, 'demo.topic');
      assert.deepEqual(received[0].payload, {count: 1});
      assert.equal(received[0].meta.tabId, world.tabId);
      assert.equal(received[0].meta.origin, ORIGIN);
      assert.isNumber(received[0].meta.receivedAt);
      assert.isString(received[0].meta.messageId);
    });

    it('never puts the session token in the metadata', async () => {
      await push('demo.topic', 'value');

      assert.notInclude(JSON.stringify(received[0].meta), SESSION);
    });

    it('substitutes null for an absent payload', async () => {
      await push('demo.topic');

      assert.isNull(received[0].payload);
    });

    it('filters by topic for subscribeTopic', async () => {
      const onTopic = sinon.spy();

      bridge.subscribeTopic('wanted.topic', onTopic);

      await push('unwanted.topic', 1);
      await push('wanted.topic', 2);

      assert.calledOnceWithExactly(onTopic, 2, received[1].meta);
    });

    it('stops delivering after unsubscribe', async () => {
      const listener = sinon.spy();
      const off = bridge.subscribe(listener);

      off();
      await push('demo.topic', 1);

      assert.notCalled(listener);
    });

    it('keeps delivering to the other listeners when one throws', async () => {
      const after = sinon.spy();

      bridge.subscribe(() => {
        throw new Error('listener blew up');
      });
      bridge.subscribe(after);

      await push('demo.topic', 1);

      assert.called(after);
      assert.include(log.messages('warn').join(' '), 'push listener threw');
    });

    it('broadcasts the push to open extension pages', async () => {
      await push('demo.topic', 'shared');

      const broadcast = world.broadcasts.find(
        (message) => (message as {event?: string}).event === 'push'
      ) as {topic: string; payload: JsonValue; channel: string} | undefined;

      assert.isDefined(broadcast);
      assert.equal(broadcast?.topic, 'demo.topic');
      assert.equal(broadcast?.payload, 'shared');
      assert.equal(broadcast?.channel, DEFAULT_CHANNEL);
    });

    const dropped: [string, () => Envelope, string][] = [
      [
        'a stale session token from a previous document',
        () => pushEnvelope('demo.topic', 1, 'an-old-session'),
        'SESSION_MISMATCH',
      ],
      [
        'a REQUEST smuggled in as a push',
        () =>
          createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.REQUEST,
            source: EnvelopeSource.PAGE,
            topic: 'demo.topic',
            id: 'smuggled-request',
            session: SESSION,
          }),
        'KIND_NOT_ALLOWED',
      ],
      [
        'an envelope claiming to be from the extension',
        () =>
          createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.EXTENSION,
            topic: 'demo.topic',
            id: 'wrong-source',
            session: SESSION,
          }),
        'INVALID_SOURCE',
      ],
      [
        'an envelope for another channel',
        () =>
          createEnvelope({
            channel: 'another-channel',
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.PAGE,
            topic: 'demo.topic',
            id: 'wrong-channel',
            session: SESSION,
          }),
        'CHANNEL_MISMATCH',
      ],
    ];

    dropped.forEach(([why, envelope, reason]) => {
      it(`drops ${why} and counts it as ${reason}`, async () => {
        await fromContent(relayMessage(RelayKind.PUSH, {envelope: envelope()}));
        await drain();

        assert.lengthOf(received, 0);
        assert.equal((await bridge.getCounters())[`dropped.${reason}`], 1);
      });
    });

    it('drops a push from a tab that never attached', async () => {
      world.fireTabRemoved(world.tabId);
      await drain();
      await push('demo.topic', 1);

      assert.lengthOf(received, 0);
      assert.equal((await bridge.getCounters())['dropped.SESSION_MISMATCH'], 1);
    });

    it('drops a replayed push', async () => {
      const envelope = pushEnvelope('demo.topic', 1);

      await fromContent(relayMessage(RelayKind.PUSH, {envelope}));
      await drain();
      await fromContent(relayMessage(RelayKind.PUSH, {envelope}));
      await drain();

      assert.lengthOf(received, 1);
      assert.equal((await bridge.getCounters())['dropped.REPLAYED_ID'], 1);
    });

    it('rate limits a flood before it reaches storage', async () => {
      setup({rateLimit: {pushesPerSecond: 2}});
      bridge.subscribe((topic, payload, meta) => received.push({topic, payload, meta}));
      await attach();

      for (let index = 0; index < 8; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await push('flood.topic', index);
      }

      assert.lengthOf(received, 2);
      assert.equal((await bridge.getCounters())['rateLimited.flood.topic'], 6);
    });

    it('counts what it received', async () => {
      await push('demo.topic', 1);

      assert.equal((await bridge.getCounters())['pushReceived.demo.topic'], 1);
    });
  });

  describe('buffered messages', () => {
    beforeEach(() => attach());

    it('replays pushes that arrived while no UI was open', async () => {
      await push('demo.topic', 'first');
      await push('demo.topic', 'second');

      const buffered = await bridge.getBufferedMessages();

      assert.lengthOf(buffered, 2);
      assert.deepEqual(
        buffered.map((entry) => entry.payload),
        ['first', 'second']
      );
    });

    it('filters by topic', async () => {
      await push('a.topic', 1);
      await push('b.topic', 2);

      const buffered = await bridge.getBufferedMessages({topic: 'b.topic'});

      assert.lengthOf(buffered, 1);
      assert.equal(buffered[0].payload, 2);
    });

    it('returns the newest entries for a limit', async () => {
      await push('demo.topic', 1);
      await push('demo.topic', 2);
      await push('demo.topic', 3);

      const buffered = await bridge.getBufferedMessages({limit: 2});

      assert.deepEqual(
        buffered.map((entry) => entry.payload),
        [2, 3]
      );
    });

    it('evicts the oldest entry once the cap is reached', async () => {
      setup({buffer: {maxEntries: 2}});
      await attach();

      await push('demo.topic', 1);
      await push('demo.topic', 2);
      await push('demo.topic', 3);

      const buffered = await bridge.getBufferedMessages();

      assert.deepEqual(
        buffered.map((entry) => entry.payload),
        [2, 3]
      );
    });

    it('does not return entries past their ttl', async () => {
      const clock = sinon.useFakeTimers({toFake: ['Date'], now: Date.now()});

      try {
        setup({buffer: {ttlMs: 1000}});
        await attach();
        await push('demo.topic', 'stale');

        assert.lengthOf(await bridge.getBufferedMessages(), 1);

        clock.tick(1001);

        assert.lengthOf(await bridge.getBufferedMessages(), 0);
      } finally {
        clock.restore();
      }
    });

    it('caps the requested limit at the buffer size', async () => {
      setup({buffer: {maxEntries: 1}});
      await attach();
      await push('demo.topic', 1);
      await push('demo.topic', 2);

      assert.lengthOf(await bridge.getBufferedMessages({limit: 1000}), 1);
    });
  });

  describe('requesting from the page', () => {
    beforeEach(() => attach());

    it('resolves with what the page handler returned', async () => {
      answerOk({answer: 42});

      assert.deepEqual(await bridge.request('demo.topic', {ask: true}), {answer: 42});
    });

    it('sends the request to the resolved active tab', async () => {
      answerOk('ok');
      await bridge.request('demo.topic');

      const sent = world.tabMessages[world.tabMessages.length - 1];

      assert.equal(sent.tabId, world.tabId);
      assert.equal((sent.message as RelayRequest).kind, RelayKind.REQUEST);
      assert.equal((sent.message as RelayRequest).envelope.session, SESSION);
    });

    it('honours an explicit tabId', async () => {
      answerOk('ok');
      await bridge.request('demo.topic', undefined, {tabId: world.tabId});

      assert.equal(world.tabMessages[world.tabMessages.length - 1].tabId, world.tabId);
    });

    it('rejects with NO_TAB when there is no active tab', async () => {
      world.activeTabs.length = 0;

      const error = await rejection(bridge.request('demo.topic'));

      assert.equal(error.code, 'NO_TAB');
    });

    it('rejects with NOT_CONNECTED for a tab with no bridge', async () => {
      const error = await rejection(bridge.request('demo.topic', undefined, {tabId: 4242}));

      assert.equal(error.code, 'NOT_CONNECTED');
    });

    it('rejects with NOT_CONNECTED when the content script has gone', async () => {
      // Nothing is listening in the tab, which is what an unloaded page looks like.
      const error = await rejection(bridge.request('demo.topic'));

      assert.equal(error.code, 'NOT_CONNECTED');
    });

    it('surfaces a coded error from the page side', async () => {
      relayAnswers(
        (): RelayResult => ({ok: false, error: {code: 'HANDLER_ERROR', message: 'The handler failed'}})
      );

      const error = await rejection(bridge.request('demo.topic'));

      assert.equal(error.code, 'HANDLER_ERROR');
      assert.equal(error.topic, 'demo.topic');
    });

    it('surfaces a handler failure reported inside the envelope', async () => {
      relayAnswers(
        (envelope): RelayResult => ({
          ok: true,
          envelope: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.RESPONSE,
            source: EnvelopeSource.PAGE,
            topic: envelope.topic,
            id: `resp-${envelope.id}`,
            session: SESSION,
            correlationId: envelope.id,
            ok: false,
            error: {code: 'NO_HANDLER', message: 'No handler is registered for this topic'},
          }),
        })
      );

      const error = await rejection(bridge.request('demo.topic'));

      assert.equal(error.code, 'NO_HANDLER');
    });

    it('rejects a response whose session token does not match the connection', async () => {
      answerOk('ok', 'a-forged-session');

      const error = await rejection(bridge.request('demo.topic'));

      assert.equal(error.code, 'HANDLER_ERROR');
      assert.include(log.messages('warn').join(' '), 'dropped inbound response');
    });

    it('will not let a response settle a request it was not for', async () => {
      const clock = sinon.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});

      try {
        relayAnswers(
          (envelope): RelayResult => ({
            ok: true,
            envelope: createEnvelope({
              channel: DEFAULT_CHANNEL,
              kind: EnvelopeKind.RESPONSE,
              source: EnvelopeSource.PAGE,
              topic: envelope.topic,
              id: `resp-${envelope.id}`,
              session: SESSION,
              correlationId: 'some-other-request',
              ok: true,
              payload: 'stolen',
            }),
          })
        );

        const settled = rejection(bridge.request('demo.topic', undefined, {timeoutMs: 500}));

        await tick();
        clock.tick(500);

        assert.equal((await settled).code, 'TIMEOUT');
        assert.include(log.messages('warn').join(' '), 'mismatched correlation');
      } finally {
        clock.restore();
      }
    });

    it('rejects beyond the per-tab concurrency cap rather than queueing', async () => {
      setup({rateLimit: {maxInFlightPerTab: 1}});
      await attach();
      relayGoesQuiet();

      const first = rejection(bridge.request('demo.topic'));

      await tick();

      const error = await rejection(bridge.request('demo.topic'));

      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal((await bridge.getCounters())['rateLimited.demo.topic'], 1);

      // Let the held request settle, so nothing is left pending past the test.
      world.fireTabRemoved(world.tabId);
      assert.equal((await first).code, 'DISCONNECTED');
    });

    it('settles an in-flight request when the tab goes away', async () => {
      relayGoesQuiet();

      const settled = rejection(bridge.request('demo.topic'));

      await tick();
      world.fireTabRemoved(world.tabId);

      assert.equal((await settled).code, 'DISCONNECTED');
    });

    it('releases the concurrency slot after a request settles', async () => {
      setup({rateLimit: {maxInFlightPerTab: 1}});
      await attach();
      answerOk('ok');

      assert.equal(await bridge.request('demo.topic'), 'ok');
      assert.equal(await bridge.request('demo.topic'), 'ok');
    });

    const badInputs: [string, string, () => Promise<unknown>][] = [
      ['an invalid topic', 'INVALID_TOPIC', () => bridge.request('not a topic')],
      [
        'a payload over the cap',
        'INVALID_PAYLOAD',
        () => bridge.request('demo.topic', 'x'.repeat(2000)),
      ],
    ];

    badInputs.forEach(([why, code, act]) => {
      it(`rejects ${why} before touching the tab`, async () => {
        setup({maxPayloadBytes: 100});
        await attach();

        const before = world.tabMessages.length;
        const error = await rejection(act());

        assert.equal(error.code, code);
        assert.lengthOf(world.tabMessages, before);
      });
    });

    it('counts issued and failed requests, including failures with no tab', async () => {
      answerOk('ok');
      await bridge.request('demo.topic');
      await rejection(bridge.request('demo.topic', undefined, {tabId: 4242}));

      const counters = await bridge.getCounters();

      assert.equal(counters['requestIssued.demo.topic'], 1);
      assert.equal(counters['requestFailed.NOT_CONNECTED'], 1);
    });
  });

  describe('the client command surface', () => {
    const command = (message: Record<string, unknown>, sender?: Partial<ChromeSender>) =>
      runtimeOutcome(
        sender === undefined
          ? world.sendAsExtensionPage({__webexBridgeClient: true, channel: DEFAULT_CHANNEL, ...message})
          : world.sendAsContentScript(
              {__webexBridgeClient: true, channel: DEFAULT_CHANNEL, ...message},
              sender
            )
      );

    beforeEach(() => attach());

    it('lists connections for an extension page', async () => {
      const result = (await command({command: ClientCommand.LIST_CONNECTIONS})) as {
        ok: boolean;
        value: unknown[];
      };

      assert.isTrue(result.ok);
      assert.lengthOf(result.value, 1);
    });

    it('returns buffered messages', async () => {
      await push('demo.topic', 'buffered');

      const result = (await command({command: ClientCommand.GET_BUFFERED, limit: 1})) as {
        ok: boolean;
        value: {payload: JsonValue}[];
      };

      assert.isTrue(result.ok);
      assert.equal(result.value[0].payload, 'buffered');
    });

    it('returns counters', async () => {
      await push('demo.topic', 1);

      const result = (await command({command: ClientCommand.GET_COUNTERS})) as {
        ok: boolean;
        value: Record<string, number>;
      };

      assert.isTrue(result.ok);
      assert.equal(result.value['pushReceived.demo.topic'], 1);
    });

    it('performs a request on behalf of the page', async () => {
      answerOk('from the page');

      const result = (await command({
        command: ClientCommand.REQUEST,
        topic: 'demo.topic',
        payload: {ask: true},
      })) as {ok: boolean; value: JsonValue};

      assert.isTrue(result.ok);
      assert.equal(result.value, 'from the page');
    });

    it('reports a failed request as a coded error rather than throwing', async () => {
      const result = (await command({
        command: ClientCommand.REQUEST,
        topic: 'demo.topic',
        tabId: 4242,
      })) as {ok: boolean; error: {code: string}};

      assert.isFalse(result.ok);
      assert.equal(result.error.code, 'NOT_CONNECTED');
    });

    it('rejects an invalid topic', async () => {
      const result = (await command({
        command: ClientCommand.REQUEST,
        topic: 'not a topic',
      })) as {ok: boolean; error: {code: string}};

      assert.isFalse(result.ok);
      assert.equal(result.error.code, 'INVALID_TOPIC');
    });

    const refused: [string, Partial<ChromeSender>][] = [
      ['a content script', {tab: {id: 7}}],
      ['a content script claiming a different tab', {tab: {id: 99}}],
    ];

    refused.forEach(([why, sender]) => {
      it(`refuses a command from ${why}`, async () => {
        const outcome = await command({command: ClientCommand.LIST_CONNECTIONS}, sender);

        assert.equal(outcome, 'Could not establish connection. Receiving end does not exist.');
      });
    });

    it('refuses a command from a different extension', async () => {
      const outcome = await runtimeOutcome(
        world.sendAsForeignExtension({
          __webexBridgeClient: true,
          channel: DEFAULT_CHANNEL,
          command: ClientCommand.LIST_CONNECTIONS,
        })
      );

      assert.equal(outcome, 'Could not establish connection. Receiving end does not exist.');
    });

    it('ignores an unknown command', async () => {
      const outcome = await command({command: 'wipeEverything'});

      assert.equal(outcome, 'Could not establish connection. Receiving end does not exist.');
    });

    it('ignores a command for another channel', async () => {
      const outcome = await runtimeOutcome(
        world.sendAsExtensionPage({
          __webexBridgeClient: true,
          channel: 'another-channel',
          command: ClientCommand.LIST_CONNECTIONS,
        })
      );

      assert.equal(outcome, 'Could not establish connection. Receiving end does not exist.');
    });
  });

  describe('channel isolation', () => {
    it('ignores relay traffic for a channel it does not serve', async () => {
      setup({channel: 'other-channel'});

      await fromContent(relayMessage(RelayKind.CONNECT));
      await drain();

      assert.lengthOf(await bridge.listConnections(), 0);
    });

    it('namespaces its stored state per channel (FR7)', async () => {
      const other = create({channel: 'other-channel'});

      await attach();
      await fromContent({
        __webexBridgeRelay: true,
        channel: 'other-channel',
        kind: RelayKind.CONNECT,
        session: 'other-session',
      });
      await drain();

      assert.lengthOf(await bridge.listConnections(), 1);
      assert.lengthOf(await other.listConnections(), 1);
      assert.includeMembers(
        [...world.storageData.keys()],
        [`webex-bridge:${DEFAULT_CHANNEL}:connections`, 'webex-bridge:other-channel:connections']
      );
    });
  });

  describe('control topic', () => {
    it('carries no privilege of its own', async () => {
      const listener = sinon.spy();

      bridge.subscribe(listener);
      await attach();
      await push(CONTROL_TOPIC, 'anything');

      assert.called(listener);
    });
  });
});
