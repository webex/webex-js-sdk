import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {
  CONTROL_TOPIC,
  DEFAULT_CHANNEL,
  HELLO_REANNOUNCE_DELAY_MS,
} from '../../../../src/core/constants';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../../../../src/core/protocol';
import type {Envelope} from '../../../../src/core/protocol';
import {createContentRelay} from '../../../../src/extension/content';
import type {ContentRelay} from '../../../../src/extension/content';
import {RelayKind} from '../../../../src/extension/messages';
import type {RelayResult, RelayToWorker} from '../../../../src/extension/messages';
import {NO_RECEIVER, createFakeExtensionWorld} from '../../lib/fakeChrome';
import type {FakeExtensionWorld} from '../../lib/fakeChrome';
import {createFakeWindow} from '../../lib/fakeWindow';
import type {FakeWindow} from '../../lib/fakeWindow';
import {createLogCapture, postedOfKind, runtimeOutcome, tick} from '../../lib/wire';

const ORIGIN = 'https://app.example.com';

describe('extension/content', () => {
  let win: FakeWindow;
  let world: FakeExtensionWorld;
  let relay: ContentRelay;
  let toWorker: sinon.SinonSpy;
  let idCounter = 0;

  /** Build an envelope as the page would, carrying the relay's own session token. */
  const fromPage = (overrides: Partial<Envelope> & {kind: EnvelopeKind}): Envelope => {
    idCounter += 1;

    return createEnvelope({
      channel: DEFAULT_CHANNEL,
      source: EnvelopeSource.PAGE,
      topic: CONTROL_TOPIC,
      id: `page-${idCounter}`,
      session: relay.session,
      ...overrides,
    });
  };

  const inject = (data: unknown, overrides: Record<string, unknown> = {}): void => {
    win.inject({data, origin: ORIGIN, source: win, ...overrides});
  };

  const posted = (kind: EnvelopeKind): Envelope[] => postedOfKind(win, kind);

  const relayed = (kind: RelayKind): RelayToWorker[] =>
    toWorker.args
      .map(([message]) => message as RelayToWorker)
      .filter((message) => message?.kind === kind);

  /** Complete the handshake from the page side, so the relay treats the page as attached. */
  const attachPage = (): void => {
    inject(fromPage({kind: EnvelopeKind.HELLO, session: ''}));
  };

  const workerRequest = (overrides: Record<string, unknown> = {}) => ({
    __webexBridgeRelay: true,
    channel: DEFAULT_CHANNEL,
    kind: RelayKind.REQUEST,
    timeoutMs: 1000,
    envelope: createEnvelope({
      channel: DEFAULT_CHANNEL,
      kind: EnvelopeKind.REQUEST,
      source: EnvelopeSource.EXTENSION,
      topic: 'demo.topic',
      id: 'req-1',
      session: relay.session,
    }),
    ...overrides,
  });

  beforeEach(() => {
    win = createFakeWindow(ORIGIN);
    world = createFakeExtensionWorld({origin: ORIGIN});
    toWorker = sinon.spy(world.contentChrome.runtime, 'sendMessage');
    relay = createContentRelay(win, world.contentChrome, {});
  });

  afterEach(() => {
    relay.destroy();
    sinon.restore();
  });

  describe('session token', () => {
    it('mints a distinct unguessable token per page load', () => {
      const other = createContentRelay(createFakeWindow(ORIGIN), world.contentChrome, {});

      assert.isString(relay.session);
      assert.isAbove(relay.session.length, 16);
      assert.notEqual(relay.session, other.session);

      other.destroy();
    });

    it('announces HELLO carrying the token, as the extension', () => {
      const hello = posted(EnvelopeKind.HELLO);

      assert.lengthOf(hello, 1);
      assert.equal(hello[0].session, relay.session);
      assert.equal(hello[0].source, EnvelopeSource.EXTENSION);
      assert.equal(hello[0].topic, CONTROL_TOPIC);
    });

    it('posts to the exact document origin, never a wildcard', () => {
      assert.equal(win.posted[0].targetOrigin, ORIGIN);
    });

    it('refuses a channel outside the allowed charset', () => {
      assert.throws(
        () => createContentRelay(win, world.contentChrome, {channel: 'not a channel'}),
        /channel must match/
      );
    });
  });

  describe('re-announcement', () => {
    let clock: sinon.SinonFakeTimers;
    let late: ContentRelay;

    beforeEach(() => {
      clock = sinon.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    });

    afterEach(() => {
      late.destroy();
      clock.restore();
    });

    it('announces once more for a page bridge that started after injection', () => {
      late = createContentRelay(win, world.contentChrome, {});

      const before = posted(EnvelopeKind.HELLO).length;

      clock.tick(HELLO_REANNOUNCE_DELAY_MS);

      assert.lengthOf(posted(EnvelopeKind.HELLO), before + 1);
    });

    it('stops after the single retry, so a silent page is not polled forever', () => {
      late = createContentRelay(win, world.contentChrome, {});

      clock.tick(HELLO_REANNOUNCE_DELAY_MS);

      const after = posted(EnvelopeKind.HELLO).length;

      clock.tick(HELLO_REANNOUNCE_DELAY_MS * 10);

      assert.lengthOf(posted(EnvelopeKind.HELLO), after);
    });

    it('does not re-announce once the page has attached', () => {
      late = createContentRelay(win, world.contentChrome, {});

      const before = posted(EnvelopeKind.HELLO).length;

      inject(
        createEnvelope({
          channel: DEFAULT_CHANNEL,
          kind: EnvelopeKind.HELLO_ACK,
          source: EnvelopeSource.PAGE,
          topic: CONTROL_TOPIC,
          id: 'late-ack',
          session: late.session,
        })
      );
      clock.tick(HELLO_REANNOUNCE_DELAY_MS * 4);

      assert.lengthOf(posted(EnvelopeKind.HELLO), before);
    });
  });

  describe('handshake with the page', () => {
    it('answers a page HELLO with HELLO_ACK and tells the worker', () => {
      attachPage();

      const ack = posted(EnvelopeKind.HELLO_ACK);

      assert.lengthOf(ack, 1);
      assert.equal(ack[0].session, relay.session);
      assert.lengthOf(relayed(RelayKind.CONNECT), 1);
      assert.equal(relayed(RelayKind.CONNECT)[0].session, relay.session);
    });

    it('accepts a page HELLO_ACK as an attach', () => {
      inject(fromPage({kind: EnvelopeKind.HELLO_ACK}));

      assert.lengthOf(relayed(RelayKind.CONNECT), 1);
    });

    it('reports CONNECT only once for a repeated handshake', () => {
      attachPage();
      inject(fromPage({kind: EnvelopeKind.HELLO_ACK}));

      assert.lengthOf(relayed(RelayKind.CONNECT), 1);
    });

    it('reports DISCONNECT on a page BYE', () => {
      attachPage();
      inject(fromPage({kind: EnvelopeKind.BYE}));

      assert.lengthOf(relayed(RelayKind.DISCONNECT), 1);
      assert.equal(relayed(RelayKind.DISCONNECT)[0].reason, 'bye');
    });

    it('swallows a rejection from an evicted worker', async () => {
      // Nothing is listening on the background side in this suite, so every notify
      // rejects. That must never surface as an unhandled rejection in the page.
      attachPage();
      await tick();

      assert.called(toWorker);
    });
  });

  describe('forwarding pushes', () => {
    beforeEach(attachPage);

    it('forwards a validated push with its envelope intact', () => {
      inject(fromPage({kind: EnvelopeKind.PUSH, topic: 'demo.topic', payload: {a: 1}}));

      const forwarded = relayed(RelayKind.PUSH);

      assert.lengthOf(forwarded, 1);
      assert.equal(forwarded[0].envelope?.topic, 'demo.topic');
      assert.deepEqual(forwarded[0].envelope?.payload, {a: 1});
      assert.equal(forwarded[0].session, relay.session);
    });

    it('drops a push whose session token was forged', () => {
      inject(fromPage({kind: EnvelopeKind.PUSH, topic: 'demo.topic', session: 'forged-token'}));

      assert.lengthOf(relayed(RelayKind.PUSH), 0);
    });

    it('drops a replayed push', () => {
      const push = fromPage({kind: EnvelopeKind.PUSH, topic: 'demo.topic', id: 'replay-me'});

      inject(push);
      inject(push);

      assert.lengthOf(relayed(RelayKind.PUSH), 1);
    });

    it('drops a push for another channel', () => {
      inject(
        createEnvelope({
          channel: 'another-channel',
          kind: EnvelopeKind.PUSH,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'other-channel',
          session: relay.session,
        })
      );

      assert.lengthOf(relayed(RelayKind.PUSH), 0);
    });

    it('ignores a REQUEST originating from the page', () => {
      inject(fromPage({kind: EnvelopeKind.REQUEST, topic: 'demo.topic'}));

      assert.lengthOf(toWorker.args, 1); // The CONNECT from attachPage, nothing more.
    });

    it('ignores a message from another window', () => {
      inject(fromPage({kind: EnvelopeKind.PUSH, topic: 'demo.topic'}), {source: {}});

      assert.lengthOf(relayed(RelayKind.PUSH), 0);
    });

    it('ignores a message reporting a different origin', () => {
      inject(fromPage({kind: EnvelopeKind.PUSH, topic: 'demo.topic'}), {
        origin: 'https://evil.example.com',
      });

      assert.lengthOf(relayed(RelayKind.PUSH), 0);
    });

    it('rate limits a flood, so the worker is never woken by it', () => {
      const floodWin = createFakeWindow(ORIGIN);
      const log = createLogCapture();
      const flooded = createContentRelay(floodWin, world.contentChrome, {
        pushesPerSecond: 2,
        logSink: log.sink,
      });

      floodWin.inject({
        data: createEnvelope({
          channel: DEFAULT_CHANNEL,
          kind: EnvelopeKind.HELLO,
          source: EnvelopeSource.PAGE,
          topic: CONTROL_TOPIC,
          id: 'flood-hello',
          session: '',
        }),
        origin: ORIGIN,
        source: floodWin,
      });
      toWorker.resetHistory();

      // A synchronous loop, so the bucket refills by a fraction of a token at most.
      for (let index = 0; index < 10; index += 1) {
        floodWin.inject({
          data: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.PAGE,
            topic: 'flood.topic',
            id: `flood-${index}`,
            session: flooded.session,
            payload: index,
          }),
          origin: ORIGIN,
          source: floodWin,
        });
      }

      assert.lengthOf(relayed(RelayKind.PUSH), 2);
      assert.lengthOf(log.messages('warn'), 8);

      flooded.destroy();
    });
  });

  describe('serving a worker request', () => {
    it('relays the request to the page and returns the page response', async () => {
      attachPage();

      const result = world.sendToContent(workerRequest());
      const request = posted(EnvelopeKind.REQUEST);

      assert.lengthOf(request, 1);
      assert.equal(request[0].id, 'req-1');
      assert.equal(win.posted[win.posted.length - 1].targetOrigin, ORIGIN);

      inject(
        fromPage({
          kind: EnvelopeKind.RESPONSE,
          topic: 'demo.topic',
          correlationId: 'req-1',
          ok: true,
          payload: 'served',
        })
      );

      const settled = (await result) as RelayResult;

      assert.isTrue(settled.ok);
      assert.equal(settled.ok === true && settled.envelope.payload, 'served');
    });

    it('answers NOT_CONNECTED when no page is attached', async () => {
      const settled = (await world.sendToContent(workerRequest())) as RelayResult;

      assert.isFalse(settled.ok);
      assert.equal(settled.ok === false && settled.error.code, 'NOT_CONNECTED');
    });

    it('answers INVALID_PAYLOAD for a request that fails validation', async () => {
      attachPage();

      const settled = (await world.sendToContent(
        workerRequest({
          envelope: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.REQUEST,
            source: EnvelopeSource.EXTENSION,
            topic: 'demo.topic',
            id: 'req-forged',
            session: 'a-forged-session',
          }),
        })
      )) as RelayResult;

      assert.isFalse(settled.ok);
      assert.equal(settled.ok === false && settled.error.code, 'INVALID_PAYLOAD');
      assert.lengthOf(posted(EnvelopeKind.REQUEST), 0);
    });

    it('arms its own timer, so a page that goes quiet still settles the worker', async () => {
      const clock = sinon.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});

      try {
        attachPage();

        const result = world.sendToContent(workerRequest({timeoutMs: 500}));

        clock.tick(500);

        const settled = (await result) as RelayResult;

        assert.isFalse(settled.ok);
        assert.equal(settled.ok === false && settled.error.code, 'TIMEOUT');
      } finally {
        clock.restore();
      }
    });

    it('ignores a response correlated to nothing', async () => {
      attachPage();
      inject(
        fromPage({
          kind: EnvelopeKind.RESPONSE,
          topic: 'demo.topic',
          correlationId: 'never-asked',
          ok: true,
          payload: 'ignored',
        })
      );
      await tick();

      assert.lengthOf(relayed(RelayKind.PUSH), 0);
    });

    it('keeps the first response and ignores a second for the same request', async () => {
      attachPage();

      const result = world.sendToContent(workerRequest());
      const respond = (payload: string, id: string): void => {
        inject(
          fromPage({
            kind: EnvelopeKind.RESPONSE,
            topic: 'demo.topic',
            id,
            correlationId: 'req-1',
            ok: true,
            payload,
          })
        );
      };

      respond('first', 'resp-a');
      respond('second', 'resp-b');

      const settled = (await result) as RelayResult;

      assert.equal(settled.ok === true && settled.envelope.payload, 'first');
    });

    it('settles a pending request when the page says goodbye', async () => {
      attachPage();

      const result = world.sendToContent(workerRequest());

      inject(fromPage({kind: EnvelopeKind.BYE}));

      const settled = (await result) as RelayResult;

      assert.isFalse(settled.ok);
      assert.equal(settled.ok === false && settled.error.code, 'DISCONNECTED');
    });
  });

  describe('runtime sender and shape checks', () => {
    // An ignored message leaves the response channel closed, which Chrome surfaces to
    // the sender as a no-receiver rejection.
    const cases = [
      {why: 'a content script in another tab', sender: {tab: {id: 99}}, message: workerRequest},
      {
        why: 'a different extension',
        sender: {id: 'a-different-extension-id'},
        message: workerRequest,
      },
      {why: 'a request for another channel', message: () => workerRequest({channel: 'other'})},
      {why: 'a request with an unusable timeout', message: () => workerRequest({timeoutMs: 'soon'})},
      {why: 'a message that is not a relay request', message: () => ({hello: 'there'})},
      {why: 'a request without the relay marker', message: () => ({...workerRequest(), __webexBridgeRelay: false})},
    ];

    cases.forEach(({why, sender, message}) => {
      it(`does not answer ${why}`, async () => {
        attachPage();

        assert.equal(await runtimeOutcome(world.sendToContent(message(), sender)), NO_RECEIVER);
        assert.lengthOf(posted(EnvelopeKind.REQUEST), 0);
      });
    });
  });

  describe('destroy', () => {
    it('detaches from the window and the runtime, and tells the worker', () => {
      attachPage();
      relay.destroy();

      assert.equal(win.listenerCount('message'), 0);
      assert.lengthOf(relayed(RelayKind.DISCONNECT), 1);
      assert.equal(relayed(RelayKind.DISCONNECT)[0].reason, 'relay-destroyed');
    });

    it('is idempotent', () => {
      relay.destroy();

      assert.doesNotThrow(() => relay.destroy());
      assert.lengthOf(relayed(RelayKind.DISCONNECT), 0);
    });

    it('stops forwarding afterwards', () => {
      attachPage();
      relay.destroy();
      toWorker.resetHistory();

      inject(fromPage({kind: EnvelopeKind.PUSH, topic: 'demo.topic'}));

      assert.notCalled(toWorker);
    });
  });
});
