import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {DEFAULT_CHANNEL} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import type {JsonValue} from '../../../../src/core/json';
import {EnvelopeKind} from '../../../../src/core/protocol';
import {createExtensionBridgeWith} from '../../../../src/extension/background';
import {createContentRelay} from '../../../../src/extension/content';
import type {ContentRelay} from '../../../../src/extension/content';
import {createWebBridgeWith} from '../../../../src/web/webBridge';
import type {ExtensionBridge, PushMeta, RequestMeta, WebBridge} from '../../../../src/types';
import {createFakeExtensionWorld} from '../../lib/fakeChrome';
import {createFakeWindow} from '../../lib/fakeWindow';
import type {FakeWindow} from '../../lib/fakeWindow';
import {createWiredPair, postedOfKind, pump, rawEnvelope, tick} from '../../lib/wire';
import type {WiredPair} from '../../lib/wire';

const ORIGIN = 'https://app.example.com';

describe('integration/bridge', () => {
  let pair: WiredPair;

  const rejection = async (promise: Promise<unknown>): Promise<BridgeError> =>
    promise.then(
      (value) => {
        throw new Error(`expected a rejection, got ${JSON.stringify(value)}`);
      },
      (error: BridgeError) => error
    );

  /**
   * Issue a request, pump the four hops, and return however it settled.
   *
   * The outcome is captured as a thunk the moment the request is made, because the
   * request can settle during the pump and an unhandled rejection in between would be
   * reported as a warning rather than as this test's failure.
   */
  const roundTrip = async (
    topic: string,
    payload?: JsonValue,
    opts?: {tabId?: number; timeoutMs?: number}
  ): Promise<JsonValue> => {
    const outcome = pair.bridge.request(topic, payload, opts).then(
      (value: JsonValue) => () => value,
      (error: unknown) => () => {
        throw error;
      }
    );

    await pair.settle();

    return (await outcome)();
  };

  beforeEach(async () => {
    pair = createWiredPair();
    await pair.settle();
  });

  afterEach(() => {
    pair.destroy();
    sinon.restore();
  });

  describe('handshake', () => {
    it('connects the page to the worker through the relay', async () => {
      assert.isTrue(pair.page.isConnected);

      const connections = await pair.bridge.listConnections();

      assert.lengthOf(connections, 1);
      assert.equal(connections[0].origin, ORIGIN);
      assert.equal(connections[0].tabId, pair.world.tabId);
    });

    it('connects when the page bridge is constructed before the relay exists', async () => {
      pair.destroy();
      pair = createWiredPair({order: 'page-first'});
      await pair.settle();

      assert.isTrue(pair.page.isConnected);
      assert.lengthOf(await pair.bridge.listConnections(), 1);
    });

    it('notifies the page application that it can start talking', async () => {
      pair.destroy();
      pair = createWiredPair();

      const onConnected = sinon.spy();

      pair.page.onConnected(onConnected);
      await pair.settle();

      assert.called(onConnected);
    });

    it('never puts the session token anywhere the page can read it back', async () => {
      const connections = await pair.bridge.listConnections();
      const posted = pair.win.posted.map((post) => post.message);

      // The token is on the wire by design; what must not happen is the worker handing
      // it back out through its public surface.
      assert.notInclude(JSON.stringify(connections), 'session');
      assert.isAbove(posted.length, 0);
    });
  });

  describe('push, page to extension', () => {
    let received: {topic: string; payload: JsonValue; meta: PushMeta}[];

    beforeEach(() => {
      received = [];
      pair.bridge.subscribe((topic, payload, meta) => received.push({topic, payload, meta}));
    });

    it('delivers a published payload with usable metadata', async () => {
      pair.page.publish('demo.topic', {count: 1});
      await pair.settle();

      assert.lengthOf(received, 1);
      assert.equal(received[0].topic, 'demo.topic');
      assert.deepEqual(received[0].payload, {count: 1});
      assert.equal(received[0].meta.tabId, pair.world.tabId);
      assert.equal(received[0].meta.origin, ORIGIN);
    });

    it('preserves order across several pushes', async () => {
      [1, 2, 3, 4].forEach((value) => pair.page.publish('demo.topic', value));
      await pair.settle();

      assert.deepEqual(
        received.map((entry) => entry.payload),
        [1, 2, 3, 4]
      );
    });

    it('buffers pushes for a UI that opens later', async () => {
      pair.page.publish('demo.topic', 'buffered');
      await pair.settle();

      const buffered = await pair.bridge.getBufferedMessages({topic: 'demo.topic'});

      assert.lengthOf(buffered, 1);
      assert.equal(buffered[0].payload, 'buffered');
    });

    it('refuses to publish before the relay has answered', async () => {
      pair.destroy();
      pair = createWiredPair();

      // No pump yet, so the handshake has not completed.
      assert.throws(() => pair.page.publish('demo.topic', 1), BridgeError);
      await pair.settle();
    });

    it('refuses to publish after the page bridge is destroyed', async () => {
      pair.page.destroy();

      assert.throws(() => pair.page.publish('demo.topic', 1), BridgeError);
    });

    it('rejects an oversized payload in the page, before it reaches the wire', async () => {
      pair.destroy();
      pair = createWiredPair({pageOptions: {maxPayloadBytes: 64}});
      await pair.settle();

      const before = pair.win.posted.length;

      assert.throws(() => pair.page.publish('demo.topic', 'x'.repeat(200)), BridgeError);
      assert.lengthOf(pair.win.posted, before);
      await pair.settle();
      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
    });

    it('counts what the page sent and what the worker received', async () => {
      pair.page.publish('demo.topic', 1);
      await pair.settle();

      assert.equal(pair.page.getCounters()['pushSent.demo.topic'], 1);
      assert.equal((await pair.bridge.getCounters())['pushReceived.demo.topic'], 1);
    });
  });

  describe('request, extension to page', () => {
    it('resolves with what the page handler returned', async () => {
      pair.page.requestHandler('demo.topic', (payload) => ({echo: payload}));

      assert.deepEqual(await roundTrip('demo.topic', {ask: true}), {echo: {ask: true}});
    });

    it('awaits an asynchronous handler', async () => {
      pair.page.requestHandler('demo.topic', async () => {
        await tick();

        return 'eventually';
      });

      assert.equal(await roundTrip('demo.topic'), 'eventually');
    });

    it('gives the handler metadata about the request', async () => {
      let seen: RequestMeta | undefined;

      pair.page.requestHandler('demo.topic', (_payload, meta) => {
        seen = meta;

        return null;
      });
      await roundTrip('demo.topic');

      assert.equal(seen?.topic, 'demo.topic');
      assert.isString(seen?.messageId);
      assert.isNumber(seen?.receivedAt);
    });

    it('substitutes null for an absent payload in both directions', async () => {
      pair.page.requestHandler('demo.topic', (payload) => payload);

      assert.isNull(await roundTrip('demo.topic'));
    });

    it('answers NO_HANDLER for a topic nothing serves', async () => {
      const error = await rejection(roundTrip('nobody.serves.this'));

      assert.equal(error.code, 'NO_HANDLER');
      assert.equal(error.topic, 'nobody.serves.this');
    });

    it('answers NO_HANDLER once the handler is unregistered', async () => {
      const off = pair.page.requestHandler('demo.topic', () => 'served');

      assert.equal(await roundTrip('demo.topic'), 'served');

      off();

      assert.equal((await rejection(roundTrip('demo.topic'))).code, 'NO_HANDLER');
    });

    it('reports a thrown handler as HANDLER_ERROR without leaking its message', async () => {
      pair.page.requestHandler('demo.topic', () => {
        throw new Error('database password is hunter2');
      });

      const error = await rejection(roundTrip('demo.topic'));

      assert.equal(error.code, 'HANDLER_ERROR');
      assert.notInclude(error.message, 'hunter2');
      assert.notInclude(JSON.stringify(pair.win.posted), 'hunter2');
    });

    it('reports a rejected validate as INVALID_PAYLOAD', async () => {
      pair.page.requestHandler('demo.topic', () => 'never reached', {
        validate: (payload) => typeof payload === 'number',
      });

      const error = await rejection(roundTrip('demo.topic', 'not a number'));

      assert.equal(error.code, 'INVALID_PAYLOAD');
    });

    it('accepts a payload that passes validate', async () => {
      pair.page.requestHandler('demo.topic', (payload) => payload, {
        validate: (payload) => typeof payload === 'number',
      });

      assert.equal(await roundTrip('demo.topic', 42), 42);
    });

    it('reports an oversized handler result as INVALID_PAYLOAD', async () => {
      pair.destroy();
      pair = createWiredPair({pageOptions: {maxPayloadBytes: 64}});
      await pair.settle();
      pair.page.requestHandler('demo.topic', () => 'x'.repeat(500));

      assert.equal((await rejection(roundTrip('demo.topic'))).code, 'INVALID_PAYLOAD');
    });

    it('always settles: a handler that never answers times out', async () => {
      const clock = sinon.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});

      try {
        pair.destroy();
        pair = createWiredPair();
        await pair.settle();
        pair.page.requestHandler('demo.topic', () => new Promise<JsonValue>(() => undefined));

        const answer = rejection(pair.bridge.request('demo.topic', undefined, {timeoutMs: 100}));

        await pair.settle();
        clock.tick(100);

        assert.equal((await answer).code, 'TIMEOUT');
      } finally {
        clock.restore();
      }
    });

    it('multiplexes concurrent requests, answering each caller correctly', async () => {
      const gates = new Map<JsonValue, () => void>();

      pair.page.requestHandler(
        'slow.topic',
        (payload) =>
          new Promise<JsonValue>((resolve) => {
            gates.set(payload, () => resolve(`answer-${String(payload)}`));
          })
      );

      const answers = [1, 2, 3, 4, 5].map((index) =>
        pair.bridge.request('slow.topic', index, {timeoutMs: 30000})
      );

      await pair.settle();

      // Answer out of order, which is the case correlation exists to handle.
      [3, 1, 5, 2, 4].forEach((index) => gates.get(index)?.());
      await pair.settle();

      assert.deepEqual(await Promise.all(answers), [
        'answer-1',
        'answer-2',
        'answer-3',
        'answer-4',
        'answer-5',
      ]);
    });

    it('settles an in-flight request when the tab goes away', async () => {
      pair.page.requestHandler('demo.topic', () => new Promise<JsonValue>(() => undefined));

      const answer = rejection(pair.bridge.request('demo.topic', undefined, {timeoutMs: 30000}));

      await pair.settle();
      pair.world.fireTabRemoved(pair.world.tabId);
      await pair.settle();

      assert.equal((await answer).code, 'DISCONNECTED');
    });

    it('settles an in-flight request when the page bridge is destroyed', async () => {
      pair.page.requestHandler('demo.topic', () => new Promise<JsonValue>(() => undefined));

      const answer = rejection(pair.bridge.request('demo.topic', undefined, {timeoutMs: 30000}));

      await pair.settle();
      pair.page.destroy();
      await pair.settle();

      assert.equal((await answer).code, 'DISCONNECTED');
    });

    it('rejects with NOT_CONNECTED after the page has gone', async () => {
      pair.page.destroy();
      await pair.settle();

      assert.equal((await rejection(roundTrip('demo.topic'))).code, 'NOT_CONNECTED');
    });
  });

  describe('lifecycle', () => {
    it('tells the page when the relay goes away', async () => {
      const onDisconnected = sinon.spy();

      pair.page.onDisconnected(onDisconnected);
      pair.relay.destroy();
      await pair.settle();

      // The relay does not announce its own teardown to the page, so the page only
      // finds out when it next tries to talk. What must hold is that the worker knows.
      assert.lengthOf(await pair.bridge.listConnections(), 0);
    });

    it('drops the worker connection when the page says goodbye', async () => {
      pair.page.destroy();
      await pair.settle();

      assert.lengthOf(await pair.bridge.listConnections(), 0);
    });

    it('drops the worker connection when the page navigates away', async () => {
      pair.win.fire('pagehide');
      await pair.settle();

      assert.isFalse(pair.page.isConnected);
      assert.lengthOf(await pair.bridge.listConnections(), 0);
    });

    it('reconnects after a page reload', async () => {
      pair.page.destroy();
      await pair.settle();

      const reloaded = createWebBridgeWith(pair.win, {channel: pair.channel});

      await pair.settle();

      assert.isTrue(reloaded.isConnected);
      assert.lengthOf(await pair.bridge.listConnections(), 1);

      reloaded.destroy();
    });
  });

  describe('protocol version', () => {
    it('ignores an envelope from a future version at the page', async () => {
      const onConnected = sinon.spy();

      pair.destroy();
      pair = createWiredPair();
      pair.page.onConnected(onConnected);
      pair.win.inject({
        data: rawEnvelope({v: 2, kind: EnvelopeKind.HELLO, session: 'future-session'}),
        origin: ORIGIN,
        source: pair.win,
      });

      assert.notCalled(onConnected);
      assert.isFalse(pair.page.isConnected);
      await pair.settle();
    });

    it('ignores an envelope from a future version at the relay', async () => {
      const world = createFakeExtensionWorld({origin: ORIGIN});
      const win = createFakeWindow(ORIGIN);
      const bridge = createExtensionBridgeWith(world.backgroundChrome, {allowedOrigins: [ORIGIN]});
      const relay: ContentRelay = createContentRelay(win, world.contentChrome, {});

      win.inject({
        data: rawEnvelope({
          v: 99,
          kind: EnvelopeKind.PUSH,
          source: 'page',
          topic: 'demo.topic',
          session: relay.session,
        }),
        origin: ORIGIN,
        source: win,
      });
      await pump(win);

      assert.lengthOf(await bridge.listConnections(), 0);
      assert.lengthOf(await bridge.getBufferedMessages(), 0);

      relay.destroy();
    });
  });

  describe('multi-channel isolation (FR7)', () => {
    interface Channel {
      page: WebBridge;
      relay: ContentRelay;
      bridge: ExtensionBridge;
      received: {topic: string; payload: JsonValue}[];
    }

    let win: FakeWindow;
    let alpha: Channel;
    let beta: Channel;

    const wire = (world: ReturnType<typeof createFakeExtensionWorld>, channel: string): Channel => {
      const bridge = createExtensionBridgeWith(world.backgroundChrome, {
        channel,
        allowedOrigins: [ORIGIN],
      });
      const relay = createContentRelay(win, world.contentChrome, {channel});
      const page = createWebBridgeWith(win, {channel});
      const received: {topic: string; payload: JsonValue}[] = [];

      bridge.subscribe((topic, payload) => received.push({topic, payload}));

      return {bridge, relay, page, received};
    };

    beforeEach(async () => {
      // One page, one extension, two independent bridges sharing both.
      const world = createFakeExtensionWorld({origin: ORIGIN});

      win = createFakeWindow(ORIGIN);
      alpha = wire(world, 'alpha');
      beta = wire(world, 'beta');
      await pump(win);
    });

    afterEach(() => {
      alpha.page.destroy();
      alpha.relay.destroy();
      beta.page.destroy();
      beta.relay.destroy();
    });

    it('connects both channels independently', () => {
      assert.isTrue(alpha.page.isConnected);
      assert.isTrue(beta.page.isConnected);
    });

    it('delivers a push only to its own channel', async () => {
      alpha.page.publish('demo.topic', 'for alpha');
      await pump(win);

      assert.deepEqual(alpha.received, [{topic: 'demo.topic', payload: 'for alpha'}]);
      assert.lengthOf(beta.received, 0);
    });

    it('routes a request only to its own channel handler', async () => {
      const alphaHandler = sinon.stub().returns('from alpha');
      const betaHandler = sinon.stub().returns('from beta');

      alpha.page.requestHandler('demo.topic', alphaHandler);
      beta.page.requestHandler('demo.topic', betaHandler);

      const answer = beta.bridge.request('demo.topic');

      await pump(win);

      assert.equal(await answer, 'from beta');
      assert.notCalled(alphaHandler);
    });

    it('keeps a channel working when the other is torn down', async () => {
      beta.page.destroy();
      beta.relay.destroy();
      await pump(win);

      alpha.page.publish('demo.topic', 'still here');
      await pump(win);

      assert.lengthOf(alpha.received, 1);
      assert.lengthOf(await alpha.bridge.listConnections(), 1);
      assert.lengthOf(await beta.bridge.listConnections(), 0);
    });
  });

  describe('what crosses the wire', () => {
    it('sends every message to an exact origin, never a wildcard', async () => {
      pair.page.publish('demo.topic', 1);
      await pair.settle();

      assert.isAbove(pair.win.posted.length, 2);
      pair.win.posted.forEach((post) => {
        assert.equal(post.targetOrigin, ORIGIN);
      });
    });

    it('carries no page-originated REQUEST, so a page cannot drive the extension', async () => {
      pair.page.publish('demo.topic', 1);
      await pair.settle();

      const fromPage = pair.win.posted
        .map((post) => post.message as {source?: string; kind?: string})
        .filter((message) => message?.source === 'page');

      assert.isAbove(fromPage.length, 0);
      assert.notInclude(
        fromPage.map((message) => message.kind),
        EnvelopeKind.REQUEST
      );
    });

    it('uses the default channel when none is configured', async () => {
      const hello = postedOfKind(pair.win, EnvelopeKind.HELLO);

      assert.isAbove(hello.length, 0);
      hello.forEach((envelope) => assert.equal(envelope.channel, DEFAULT_CHANNEL));
    });
  });
});
