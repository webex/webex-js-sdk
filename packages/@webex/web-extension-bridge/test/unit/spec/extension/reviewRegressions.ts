import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {CONTROL_TOPIC, DEFAULT_CHANNEL} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import type {JsonValue} from '../../../../src/core/json';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../../../../src/core/protocol';
import type {Envelope} from '../../../../src/core/protocol';
import {createExtensionBridgeWith} from '../../../../src/extension/background';
import {createExtensionClientWith} from '../../../../src/extension/client';
import {
  createContentRelay,
  startContentRelay,
} from '../../../../src/extension/content';
import type {ContentRelay} from '../../../../src/extension/content';
import {ClientCommand, RelayKind} from '../../../../src/extension/messages';
import type {RelayToWorker} from '../../../../src/extension/messages';
import type {ChromeSender} from '../../../../src/extension/platform';
import type {ExtensionBridge} from '../../../../src/types';
import {NO_RECEIVER, createFakeExtensionWorld} from '../../lib/fakeChrome';
import type {FakeExtensionWorld} from '../../lib/fakeChrome';
import {createFakeWindow} from '../../lib/fakeWindow';
import {createLogCapture, runtimeOutcome, tick} from '../../lib/wire';

const ORIGIN = 'https://app.example.com';
const SESSION = 'relay-session-token';

/**
 * Regressions for the extension-side defects raised in PR review.
 *
 * Each `it` here corresponds to one review thread. The comment above it says what used
 * to happen, because "this test asserts the fix" is much easier to keep true over time
 * than "this test asserts the bug is gone".
 */
describe('extension review regressions', () => {
  let world: FakeExtensionWorld;
  let bridge: ExtensionBridge;
  let log: ReturnType<typeof createLogCapture>;
  let idCounter = 0;

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

  const drain = async (): Promise<void> => {
    for (let round = 0; round < 6; round += 1) {
      // eslint-disable-next-line no-await-in-loop
      await tick();
    }
  };

  const attach = async (session = SESSION): Promise<void> => {
    await fromContent(relayMessage(RelayKind.CONNECT, {session}));
    await drain();
  };

  const push = async (topic: string, payload?: JsonValue, session = SESSION): Promise<void> => {
    await fromContent(
      relayMessage(RelayKind.PUSH, {envelope: pushEnvelope(topic, payload, session), session})
    );
    await drain();
  };

  beforeEach(() => {
    world = createFakeExtensionWorld({origin: ORIGIN});
    log = createLogCapture();
    bridge = createExtensionBridgeWith(world.backgroundChrome, {
      logSink: log.sink,
      allowedOrigins: [ORIGIN],
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('the runtime origin allow-list is mandatory', () => {
    it('refuses to construct without one', () => {
      // Previously `allowedOrigins` was optional and an absent list made the worker's
      // own origin check pass unconditionally, deferring entirely to manifest matches.
      assert.throws(
        () =>
          createExtensionBridgeWith(world.backgroundChrome, {
            allowedOrigins: undefined as unknown as string[],
          }),
        /allowedOrigins is required/
      );
    });

    it('refuses to construct with an empty one', () => {
      assert.throws(
        () => createExtensionBridgeWith(world.backgroundChrome, {allowedOrigins: []}),
        /allowedOrigins is required/
      );
    });

    it('refuses to construct with no options at all', () => {
      assert.throws(
        () =>
          createExtensionBridgeWith(
            world.backgroundChrome,
            undefined as unknown as {allowedOrigins: string[]}
          ),
        /allowedOrigins are required/
      );
    });

    it('drops a relay from an origin that is not on the list', async () => {
      const other = createFakeExtensionWorld({origin: 'https://evil.example.com'});
      const guarded = createExtensionBridgeWith(other.backgroundChrome, {
        allowedOrigins: [ORIGIN],
      });

      await runtimeOutcome(
        other.sendAsContentScript(relayMessage(RelayKind.CONNECT, {session: SESSION}))
      );
      await drain();

      assert.lengthOf(await guarded.listConnections(), 0);
    });
  });

  describe('numeric configuration is validated, not clamped', () => {
    const badNumbers: [string, unknown][] = [
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['zero', 0],
      ['a negative', -5],
      ['a fraction', 1.5],
    ];

    badNumbers.forEach(([why, value]) => {
      it(`refuses ${why} for pushesPerSecond`, () => {
        assert.throws(() =>
          createExtensionBridgeWith(world.backgroundChrome, {
            allowedOrigins: [ORIGIN],
            rateLimit: {pushesPerSecond: value as number},
          })
        );
      });
    });

    it('refuses a NaN buffer size', () => {
      assert.throws(() =>
        createExtensionBridgeWith(world.backgroundChrome, {
          allowedOrigins: [ORIGIN],
          buffer: {maxEntries: Number.NaN},
        })
      );
    });

    it('still accepts sensible values', () => {
      assert.doesNotThrow(() =>
        createExtensionBridgeWith(world.backgroundChrome, {
          allowedOrigins: [ORIGIN],
          rateLimit: {pushesPerSecond: 30, aggregatePushesPerSecond: 60, maxInFlightPerTab: 8},
          buffer: {maxEntries: 50, ttlMs: 60000, maxBytes: 65536},
        })
      );
    });
  });

  describe('the replay buffer is bounded in bytes as well as entries', () => {
    it('evicts oldest-first to stay inside the byte budget', async () => {
      const bounded = createExtensionBridgeWith(world.backgroundChrome, {
        allowedOrigins: [ORIGIN],
        logSink: log.sink,
        // Room for roughly two of the payloads below, not ten.
        buffer: {maxEntries: 200, maxBytes: 2048},
        rateLimit: {pushesPerSecond: 1000, aggregatePushesPerSecond: 1000},
      });

      await attach();

      const chunk = 'x'.repeat(900);

      for (let index = 0; index < 10; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await push('demo.topic', {index, chunk});
      }

      const buffered = await bounded.getBufferedMessages();
      const totalBytes = JSON.stringify(buffered).length;

      // Before the fix only `maxEntries` applied, so all ten were retained and, at the
      // 1 MiB payload ceiling, 200 entries could exceed the storage quota outright.
      assert.isAtMost(buffered.length, 3);
      assert.isBelow(totalBytes, 4096);
      // Newest survive.
      assert.equal((buffered[buffered.length - 1].payload as {index: number}).index, 9);
    });

    it('keeps a single entry larger than the whole budget', async () => {
      const bounded = createExtensionBridgeWith(world.backgroundChrome, {
        allowedOrigins: [ORIGIN],
        logSink: log.sink,
        buffer: {maxBytes: 1024},
      });

      await attach();
      await push('demo.topic', {chunk: 'y'.repeat(4000)});

      assert.lengthOf(await bounded.getBufferedMessages(), 1);
    });
  });

  describe('buffered messages are filtered by topic in the worker', () => {
    it('returns the requested topic even when newer pushes fill the limit', async () => {
      await attach();
      await push('wanted.topic', {n: 1});

      for (let index = 0; index < 20; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await push('noise.topic', {index});
      }

      const client = createExtensionClientWith(world.uiChrome, {logSink: log.sink});
      const found = await client.getBufferedMessages({topic: 'wanted.topic', limit: 5});

      // Before the fix the client sent only `limit`, the worker trimmed to the newest
      // five across *all* topics, and this filter then found nothing.
      assert.lengthOf(found, 1);
      assert.equal(found[0].topic, 'wanted.topic');
    });

    it('still honours the limit within a topic', async () => {
      await attach();

      for (let index = 0; index < 8; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await push('wanted.topic', {index});
      }

      const client = createExtensionClientWith(world.uiChrome, {logSink: log.sink});
      const found = await client.getBufferedMessages({topic: 'wanted.topic', limit: 3});

      assert.lengthOf(found, 3);
      assert.equal((found[2].payload as {index: number}).index, 7);
    });

    it('refuses a malformed topic rather than passing it to the worker', async () => {
      const client = createExtensionClientWith(world.uiChrome, {logSink: log.sink});

      try {
        await client.getBufferedMessages({topic: 'not a topic'});
        assert.fail('expected INVALID_TOPIC');
      } catch (error) {
        assert.instanceOf(error, BridgeError);
        assert.equal((error as BridgeError).code, 'INVALID_TOPIC');
      }
    });
  });

  describe('a dead tab connection is dropped when sendMessage fails', () => {
    it('stops advertising a tab whose content script has gone', async () => {
      await attach();

      assert.lengthOf(await bridge.listConnections(), 1);

      // Nothing is listening in the tab, which is what an unloaded or reloaded content
      // script looks like: `tabs.sendMessage` rejects with "receiving end does not
      // exist".
      const error: BridgeError = await bridge
        .request('demo.topic', undefined, {tabId: world.tabId})
        .then(
          () => {
            throw new Error('expected a rejection');
          },
          (reason: BridgeError) => reason
        );

      assert.equal(error.code, 'NOT_CONNECTED');

      await drain();

      // Before the fix the record survived, so `listConnections()` and default
      // active-tab targeting kept pointing at a tab that could not receive anything.
      assert.lengthOf(await bridge.listConnections(), 0);
    });
  });

  describe('a stale disconnect cannot tear down the session that replaced it', () => {
    it('ignores a DISCONNECT carrying an older session token', async () => {
      await attach('session-a');
      await attach('session-b');

      assert.lengthOf(await bridge.listConnections(), 1);

      await fromContent(relayMessage(RelayKind.DISCONNECT, {session: 'session-a', reason: 'bye'}));
      await drain();

      // Before the fix the removal matched on `tabId` alone, so session A's late
      // goodbye deleted session B's live connection.
      assert.lengthOf(await bridge.listConnections(), 1);
    });

    it('still honours a DISCONNECT from the current session', async () => {
      await attach('session-b');
      await fromContent(relayMessage(RelayKind.DISCONNECT, {session: 'session-b', reason: 'bye'}));
      await drain();

      assert.lengthOf(await bridge.listConnections(), 0);
    });
  });

  describe('relay handling holds the message channel open', () => {
    it('answers a relay message only once its state has been persisted', async () => {
      // The worker returns `true` and responds after the storage write settles, so an
      // MV3 suspension cannot land between the handler returning and the write.
      const answer = await fromContent(relayMessage(RelayKind.CONNECT, {session: SESSION}));

      assert.deepEqual(answer, {ok: true});

      // No extra draining: the acknowledgement itself is the guarantee the write is
      // already visible.
      assert.lengthOf(await bridge.listConnections(), 1);
    });

    it('acknowledges a buffered push after it is stored', async () => {
      await attach();

      const answer = await fromContent(
        relayMessage(RelayKind.PUSH, {envelope: pushEnvelope('demo.topic', {n: 1})})
      );

      assert.deepEqual(answer, {ok: true});
      assert.lengthOf(await bridge.getBufferedMessages({topic: 'demo.topic'}), 1);
    });
  });

  describe('the content relay reports what it drops', () => {
    it('counts a push refused by its own rate limiter', () => {
      const win = createFakeWindow(ORIGIN);
      const relayWorld = createFakeExtensionWorld({origin: ORIGIN});
      const relay = createContentRelay(win, relayWorld.contentChrome, {
        pushesPerSecond: 1,
        aggregatePushesPerSecond: 1,
        logSink: log.sink,
      });
      const toWorker = sinon.spy(relayWorld.contentChrome.runtime, 'sendMessage');

      const send = (topic: string): void => {
        idCounter += 1;
        win.inject({
          data: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.PAGE,
            topic,
            id: `p-${idCounter}`,
            session: relay.session,
          }),
          origin: ORIGIN,
          source: win,
        });
      };

      // Handshake, so pushes are forwarded rather than ignored.
      win.inject({
        data: createEnvelope({
          channel: DEFAULT_CHANNEL,
          kind: EnvelopeKind.HELLO,
          source: EnvelopeSource.PAGE,
          topic: CONTROL_TOPIC,
          id: 'hello-1',
          session: '',
        }),
        origin: ORIGIN,
        source: win,
      });

      send('demo.topic');
      send('demo.topic');
      send('demo.topic');

      const forwarded = toWorker.args
        .map(([message]) => message as RelayToWorker)
        .filter((message) => message?.kind === RelayKind.PUSH);

      assert.lengthOf(forwarded, 1);

      // Before the fix this hop dropped silently with only a log line, so neither the
      // page nor the worker's counters could tell a throttled page from a quiet one.
      assert.equal(relay.getCounters()['relayDropped.RATE_LIMITED'], 2);

      relay.destroy();
    });

    it('counts a failed worker notification and eventually gives up', async () => {
      const win = createFakeWindow(ORIGIN);
      const relayWorld = createFakeExtensionWorld({origin: ORIGIN});

      sinon
        .stub(relayWorld.contentChrome.runtime, 'sendMessage')
        .rejects(new Error(NO_RECEIVER));

      const relay = createContentRelay(win, relayWorld.contentChrome, {logSink: log.sink});

      win.inject({
        data: createEnvelope({
          channel: DEFAULT_CHANNEL,
          kind: EnvelopeKind.HELLO,
          source: EnvelopeSource.PAGE,
          topic: CONTROL_TOPIC,
          id: 'hello-1',
          session: '',
        }),
        origin: ORIGIN,
        source: win,
      });

      await drain();

      for (let index = 0; index < 4; index += 1) {
        idCounter += 1;
        win.inject({
          data: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.PAGE,
            topic: 'demo.topic',
            id: `p-${idCounter}`,
            session: relay.session,
          }),
          origin: ORIGIN,
          source: win,
        });
        // eslint-disable-next-line no-await-in-loop
        await drain();
      }

      const counters = relay.getCounters();
      const failures = Object.entries(counters)
        .filter(([key]) => key.startsWith('relaySendFailed'))
        .reduce((total, [, value]) => total + value, 0);

      // Before the fix every one of these rejections was swallowed, so the page could
      // sit "connected" for ever while nothing it published reached the worker.
      assert.isAbove(failures, 0);

      // And after enough consecutive failures the page is told it is disconnected.
      const byes = win.posted.filter(
        ({message}) => (message as Envelope)?.kind === EnvelopeKind.BYE
      );

      assert.isAtLeast(byes.length, 1);

      relay.destroy();
    });
  });

  describe('a destroyed relay is not handed back on restart', () => {
    it('builds a fresh relay after destroy', () => {
      const win = createFakeWindow(ORIGIN);
      const relayWorld = createFakeExtensionWorld({origin: ORIGIN});

      // `startContentRelay` reads the ambient globals, so they are stood up here for
      // the duration of the test and removed afterwards.
      const globals = globalThis as {window?: unknown; chrome?: unknown};
      const priorWindow = globals.window;
      const priorChrome = globals.chrome;

      globals.window = win;
      globals.chrome = relayWorld.contentChrome;

      try {
        const first: ContentRelay = startContentRelay({channel: 'restart.channel'});

        assert.strictEqual(startContentRelay({channel: 'restart.channel'}), first);

        first.destroy();

        const second = startContentRelay({channel: 'restart.channel'});

        // Before the fix `destroy()` left the handle in the started map, so this
        // returned the dead relay — no listeners, no handshake, forwarding nothing.
        // That is the normal path during extension hot-reload in development.
        assert.notStrictEqual(second, first);
        assert.notEqual(second.session, first.session);

        second.destroy();
      } finally {
        globals.window = priorWindow;
        globals.chrome = priorChrome;
      }
    });
  });

  describe('the client does not leak an abort listener per request', () => {
    it('detaches the listener when the request wins the race', async () => {
      const client = createExtensionClientWith(world.uiChrome, {logSink: log.sink});
      const controller = new AbortController();
      const added = sinon.spy(controller.signal, 'addEventListener');
      const removed = sinon.spy(controller.signal, 'removeEventListener');

      await attach();

      world.contentChrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        const request = message as {envelope: Envelope};

        sendResponse({
          ok: true,
          envelope: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.RESPONSE,
            source: EnvelopeSource.PAGE,
            topic: request.envelope.topic,
            id: `resp-${request.envelope.id}`,
            session: SESSION,
            correlationId: request.envelope.id,
            ok: true,
            payload: {done: true},
          }),
        });

        return true;
      });

      for (let index = 0; index < 5; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await client.request(
          'demo.topic',
          undefined,
          {signal: controller.signal, tabId: world.tabId}
        );
      }

      // Before the fix the losing promise stayed pending for ever and its listener
      // stayed attached, so a long-lived signal accumulated one dead closure per
      // request. `{once: true}` does not help: the event never fires.
      assert.equal(added.callCount, removed.callCount);
      assert.isAbove(removed.callCount, 0);
    });

    it('still rejects with ABORTED when the signal wins', async () => {
      const client = createExtensionClientWith(world.uiChrome, {logSink: log.sink});
      const controller = new AbortController();

      await attach();
      world.contentChrome.runtime.onMessage.addListener(() => true);

      const promise = client.request('demo.topic', undefined, {
        signal: controller.signal,
        tabId: world.tabId,
      });

      controller.abort();

      const error: BridgeError = await promise.then(
        () => {
          throw new Error('expected a rejection');
        },
        (reason: BridgeError) => reason
      );

      assert.equal(error.code, 'ABORTED');
    });

    it('rejects immediately for an already-aborted signal', async () => {
      const client = createExtensionClientWith(world.uiChrome, {logSink: log.sink});
      const controller = new AbortController();

      controller.abort();

      const error: BridgeError = await client
        .request('demo.topic', undefined, {signal: controller.signal})
        .then(
          () => {
            throw new Error('expected a rejection');
          },
          (reason: BridgeError) => reason
        );

      assert.equal(error.code, 'ABORTED');
    });
  });

  describe('the command surface still guards its inputs', () => {
    it('rejects a GET_BUFFERED command carrying a malformed topic', async () => {
      const answer = await runtimeOutcome(
        world.uiChrome.runtime.sendMessage({
          __webexBridgeClient: true,
          channel: DEFAULT_CHANNEL,
          command: ClientCommand.GET_BUFFERED,
          topic: 'not a topic',
        })
      );

      assert.deepEqual((answer as {ok: boolean}).ok, false);
    });
  });
});
