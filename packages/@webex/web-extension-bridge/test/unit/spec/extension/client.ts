import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {DEFAULT_CHANNEL} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import type {JsonValue} from '../../../../src/core/json';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../../../../src/core/protocol';
import type {Envelope} from '../../../../src/core/protocol';
import {createExtensionBridgeWith} from '../../../../src/extension/background';
import {createExtensionClientWith} from '../../../../src/extension/client';
import {ClientCommand, RelayKind} from '../../../../src/extension/messages';
import type {ClientPushEvent, RelayRequest, RelayResult} from '../../../../src/extension/messages';
import type {ExtensionBridge, PushMeta} from '../../../../src/types';
import {createFakeExtensionWorld} from '../../lib/fakeChrome';
import type {FakeExtensionWorld} from '../../lib/fakeChrome';
import {createLogCapture, tick} from '../../lib/wire';

const ORIGIN = 'https://app.example.com';
const SESSION = 'relay-session-token';

describe('extension/client', () => {
  let world: FakeExtensionWorld;
  let worker: ExtensionBridge;
  let client: ExtensionBridge;
  let log: ReturnType<typeof createLogCapture>;

  const meta: PushMeta = {
    tabId: 7,
    origin: ORIGIN,
    url: `${ORIGIN}/index.html`,
    receivedAt: 1700000000000,
    messageId: 'push-1',
  };

  const pushEvent = (overrides: Partial<ClientPushEvent> = {}): unknown => ({
    __webexBridgeClient: true,
    channel: DEFAULT_CHANNEL,
    event: 'push',
    topic: 'demo.topic',
    payload: 'from the page',
    meta,
    ...overrides,
  });

  const drain = async (): Promise<void> => {
    for (let round = 0; round < 6; round += 1) {
      // eslint-disable-next-line no-await-in-loop
      await tick();
    }
  };

  /** Attach a page to the worker, so its command surface has something to report. */
  const attachTab = async (): Promise<void> => {
    await world
      .sendAsContentScript({
        __webexBridgeRelay: true,
        channel: DEFAULT_CHANNEL,
        kind: RelayKind.CONNECT,
        session: SESSION,
      })
      .catch(() => undefined);
    await drain();
  };

  const relayAnswersOk = (payload: JsonValue): void => {
    world.contentChrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const {envelope} = message as RelayRequest;
      const response: RelayResult = {
        ok: true,
        envelope: createEnvelope({
          channel: DEFAULT_CHANNEL,
          kind: EnvelopeKind.RESPONSE,
          source: EnvelopeSource.PAGE,
          topic: envelope.topic,
          id: `resp-${envelope.id}`,
          session: SESSION,
          correlationId: envelope.id,
          ok: true,
          payload,
        }),
      };

      sendResponse(response);

      return true;
    });
  };

  const rejection = async (promise: Promise<unknown>): Promise<BridgeError> =>
    promise.then(
      (value) => {
        throw new Error(`expected a rejection, got ${JSON.stringify(value)}`);
      },
      (error: BridgeError) => error
    );

  beforeEach(() => {
    world = createFakeExtensionWorld({origin: ORIGIN});
    log = createLogCapture();
    worker = createExtensionBridgeWith(world.backgroundChrome, {logSink: log.sink});
    client = createExtensionClientWith(world.uiChrome, {logSink: log.sink});
  });

  afterEach(() => {
    sinon.restore();
  });

  it('refuses a channel outside the allowed charset', () => {
    assert.throws(
      () => createExtensionClientWith(world.uiChrome, {channel: 'not a channel'}),
      /channel must match/
    );
  });

  describe('proxying to the worker', () => {
    beforeEach(attachTab);

    it('lists the connections the worker knows about', async () => {
      const connections = await client.listConnections();

      assert.deepEqual(connections, await worker.listConnections());
      assert.lengthOf(connections, 1);
      assert.equal(connections[0].origin, ORIGIN);
    });

    it('returns buffered messages, filtered by topic', async () => {
      const relayPush = (topic: string, payload: JsonValue, id: string): Promise<unknown> =>
        world
          .sendAsContentScript({
            __webexBridgeRelay: true,
            channel: DEFAULT_CHANNEL,
            kind: RelayKind.PUSH,
            session: SESSION,
            envelope: createEnvelope({
              channel: DEFAULT_CHANNEL,
              kind: EnvelopeKind.PUSH,
              source: EnvelopeSource.PAGE,
              topic,
              id,
              session: SESSION,
              payload,
            }) as Envelope,
          })
          .catch(() => undefined);

      await relayPush('a.topic', 1, 'push-a');
      await relayPush('b.topic', 2, 'push-b');
      await drain();

      const all = await client.getBufferedMessages();
      const filtered = await client.getBufferedMessages({topic: 'b.topic'});

      assert.lengthOf(all, 2);
      assert.lengthOf(filtered, 1);
      assert.equal(filtered[0].payload, 2);
    });

    it('passes a limit through to the worker', async () => {
      const send = sinon.spy(world.uiChrome.runtime, 'sendMessage');

      await client.getBufferedMessages({limit: 3});

      assert.equal((send.args[0][0] as {limit: number}).limit, 3);
    });

    it('reads the counters that live in the worker', async () => {
      relayAnswersOk('served');
      await client.request('demo.topic');

      const counters = await client.getCounters();

      assert.equal(counters['requestIssued.demo.topic'], 1);
      assert.deepEqual(counters, await worker.getCounters());
    });

    it('performs a request end to end', async () => {
      relayAnswersOk({answer: 42});

      assert.deepEqual(await client.request('demo.topic', {ask: true}), {answer: 42});
    });

    it('sends the tab and timeout the caller asked for', async () => {
      const send = sinon.spy(world.uiChrome.runtime, 'sendMessage');

      relayAnswersOk('served');
      await client.request('demo.topic', undefined, {tabId: world.tabId, timeoutMs: 1234});

      const command = send.args[0][0] as {tabId: number; timeoutMs: number; command: string};

      assert.equal(command.command, ClientCommand.REQUEST);
      assert.equal(command.tabId, world.tabId);
      assert.equal(command.timeoutMs, 1234);
    });

    it('surfaces the worker error as a coded BridgeError', async () => {
      const error = await rejection(client.request('demo.topic', undefined, {tabId: 4242}));

      assert.instanceOf(error, BridgeError);
      assert.equal(error.code, 'NOT_CONNECTED');
      assert.equal(error.topic, 'demo.topic');
    });

    it('rejects an invalid topic locally, without waking the worker', async () => {
      const send = sinon.spy(world.uiChrome.runtime, 'sendMessage');
      const error = await rejection(client.request('not a topic'));

      assert.equal(error.code, 'INVALID_TOPIC');
      assert.notCalled(send);
    });

    it('rejects when the worker cannot be reached at all', async () => {
      sinon.stub(world.uiChrome.runtime, 'sendMessage').rejects(new Error('worker is gone'));

      const error = await rejection(client.listConnections());

      assert.instanceOf(error, Error);
      assert.equal(error.message, 'worker is gone');
    });

    it('treats a malformed worker answer as a handler error', async () => {
      sinon.stub(world.uiChrome.runtime, 'sendMessage').resolves({surprise: true});

      const error = await rejection(client.request('demo.topic'));

      assert.equal(error.code, 'HANDLER_ERROR');
    });

    it('returns an empty list when the worker answers with a non-list', async () => {
      sinon.stub(world.uiChrome.runtime, 'sendMessage').resolves({ok: true, value: 'nonsense'});

      assert.deepEqual(await client.listConnections(), []);
      assert.deepEqual(await client.getBufferedMessages(), []);
    });
  });

  describe('aborting a request', () => {
    beforeEach(attachTab);

    it('rejects immediately for an already-aborted signal', async () => {
      const controller = new AbortController();

      controller.abort();

      const error = await rejection(
        client.request('demo.topic', undefined, {signal: controller.signal})
      );

      assert.equal(error.code, 'ABORTED');
    });

    it('rejects when the signal aborts while the worker is still working', async () => {
      const controller = new AbortController();

      // The worker never answers, which is what an unresponsive page looks like from here.
      world.contentChrome.runtime.onMessage.addListener(() => true);

      const settled = rejection(
        client.request('demo.topic', undefined, {signal: controller.signal})
      );

      await tick();
      controller.abort();

      assert.equal((await settled).code, 'ABORTED');
    });

    it('still resolves when the signal never aborts', async () => {
      const controller = new AbortController();

      relayAnswersOk('served');

      assert.equal(
        await client.request('demo.topic', undefined, {signal: controller.signal}),
        'served'
      );
    });
  });

  describe('receiving broadcast pushes', () => {
    it('delivers a worker broadcast to a subscriber', async () => {
      const listener = sinon.spy();

      client.subscribe(listener);
      await world.sendToUi(pushEvent()).catch(() => undefined);

      assert.calledOnceWithExactly(listener, 'demo.topic', 'from the page', meta);
    });

    it('does not listen at all until something subscribes', async () => {
      // Nothing is listening, so the broadcast finds no receiver.
      const outcome = await world
        .sendToUi(pushEvent())
        .then(() => 'delivered', () => 'ignored');

      assert.equal(outcome, 'ignored');
    });

    it('filters by topic for subscribeTopic', async () => {
      const listener = sinon.spy();

      client.subscribeTopic('wanted.topic', listener);
      await world.sendToUi(pushEvent({topic: 'unwanted.topic'})).catch(() => undefined);
      await world.sendToUi(pushEvent({topic: 'wanted.topic'})).catch(() => undefined);

      assert.calledOnceWithExactly(listener, 'from the page', meta);
    });

    it('stops delivering after unsubscribe', async () => {
      const listener = sinon.spy();
      const off = client.subscribe(listener);

      off();
      await world.sendToUi(pushEvent()).catch(() => undefined);

      assert.notCalled(listener);
    });

    it('keeps delivering to the other listeners when one throws', async () => {
      const after = sinon.spy();

      client.subscribe(() => {
        throw new Error('listener blew up');
      });
      client.subscribe(after);
      await world.sendToUi(pushEvent()).catch(() => undefined);

      assert.called(after);
      assert.include(log.messages('warn').join(' '), 'push listener threw');
    });

    const ignored: [string, unknown, Record<string, unknown> | undefined][] = [
      ['a content script', undefined, {tab: {id: 7}}],
      ['a different extension', undefined, {id: 'a-different-extension-id'}],
    ];

    ignored.forEach(([why, _message, sender]) => {
      it(`ignores a broadcast from ${why}`, async () => {
        const listener = sinon.spy();

        client.subscribe(listener);
        await world.sendToUi(pushEvent(), sender).catch(() => undefined);

        assert.notCalled(listener);
      });
    });

    const malformed: [string, unknown][] = [
      ['another channel', {channel: 'another-channel'}],
      ['a different event', {event: 'something-else'}],
      ['a missing topic', {topic: 42}],
    ];

    malformed.forEach(([why, overrides]) => {
      it(`ignores a broadcast with ${why}`, async () => {
        const listener = sinon.spy();

        client.subscribe(listener);
        await world
          .sendToUi(pushEvent(overrides as Partial<ClientPushEvent>))
          .catch(() => undefined);

        assert.notCalled(listener);
      });
    });

    it('ignores a command echoed back as if it were a push', async () => {
      const listener = sinon.spy();

      client.subscribe(listener);
      await world
        .sendToUi({__webexBridgeClient: true, channel: DEFAULT_CHANNEL, command: ClientCommand.GET_COUNTERS})
        .catch(() => undefined);

      assert.notCalled(listener);
    });

    it('receives what the worker actually broadcasts', async () => {
      const listener = sinon.spy();

      client.subscribe(listener);
      await attachTab();
      await world
        .sendAsContentScript({
          __webexBridgeRelay: true,
          channel: DEFAULT_CHANNEL,
          kind: RelayKind.PUSH,
          session: SESSION,
          envelope: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.PAGE,
            topic: 'demo.topic',
            id: 'push-real',
            session: SESSION,
            payload: 'live',
          }),
        })
        .catch(() => undefined);
      await drain();

      assert.calledOnce(listener);
      assert.equal(listener.args[0][0], 'demo.topic');
      assert.equal(listener.args[0][1], 'live');
      assert.equal((listener.args[0][2] as PushMeta).tabId, world.tabId);
    });
  });
});
