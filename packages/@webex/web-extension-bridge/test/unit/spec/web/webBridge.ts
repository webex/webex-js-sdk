import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {CONTROL_TOPIC, DEFAULT_CHANNEL} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../../../../src/core/protocol';
import type {Envelope} from '../../../../src/core/protocol';
import {createWebBridgeWith} from '../../../../src/web/webBridge';
import type {WebBridge} from '../../../../src/types';
import {createFakeWindow} from '../../lib/fakeWindow';
import type {FakeWindow} from '../../lib/fakeWindow';
import {tick} from '../../lib/wire';

const ORIGIN = 'https://app.example.com';
const SESSION = 'relay-session-token';

let idCounter = 0;

/** Build an envelope as the content relay would. */
function fromExtension(overrides: Partial<Envelope> & {kind: Envelope['kind']}): Envelope {
  idCounter += 1;

  return createEnvelope({
    channel: DEFAULT_CHANNEL,
    source: EnvelopeSource.EXTENSION,
    topic: CONTROL_TOPIC,
    id: `ext-${idCounter}`,
    session: SESSION,
    ...overrides,
  });
}

describe('web/webBridge', () => {
  let win: FakeWindow;
  let bridge: WebBridge;

  const connect = (): void => {
    win.inject({data: fromExtension({kind: EnvelopeKind.HELLO}), origin: ORIGIN, source: win});
  };

  const posted = (kind: string): Envelope[] =>
    win.posted
      .map((post) => post.message as Envelope)
      .filter((message) => message?.kind === kind);

  beforeEach(() => {
    win = createFakeWindow(ORIGIN);
    bridge = createWebBridgeWith(win);
  });

  afterEach(() => {
    bridge.destroy();
  });

  describe('handshake', () => {
    it('announces HELLO on construction, in case the relay was injected first', () => {
      const hello = posted(EnvelopeKind.HELLO);

      assert.lengthOf(hello, 1);
      assert.equal(hello[0].session, '');
      assert.equal(hello[0].source, EnvelopeSource.PAGE);
      assert.equal(hello[0].topic, CONTROL_TOPIC);
    });

    it('starts disconnected', () => {
      assert.isFalse(bridge.isConnected);
    });

    it('adopts the relay session on HELLO and acknowledges it', () => {
      connect();

      assert.isTrue(bridge.isConnected);

      const ack = posted(EnvelopeKind.HELLO_ACK);

      assert.lengthOf(ack, 1);
      assert.equal(ack[0].session, SESSION);
    });

    it('adopts the relay session on HELLO_ACK, which answers our own HELLO', () => {
      win.inject({
        data: fromExtension({kind: EnvelopeKind.HELLO_ACK}),
        origin: ORIGIN,
        source: win,
      });

      assert.isTrue(bridge.isConnected);
    });

    it('ignores a HELLO with an empty session, which cannot establish anything', () => {
      win.inject({
        data: fromExtension({kind: EnvelopeKind.HELLO, session: ''}),
        origin: ORIGIN,
        source: win,
      });

      assert.isFalse(bridge.isConnected);
    });

    it('treats a new session token as a reconnect', () => {
      const onDisconnected = sinon.stub();
      const onConnected = sinon.stub();

      connect();
      bridge.onDisconnected(onDisconnected);
      bridge.onConnected(onConnected);
      onConnected.resetHistory();

      win.inject({
        data: fromExtension({kind: EnvelopeKind.HELLO, session: 'a-second-token'}),
        origin: ORIGIN,
        source: win,
      });

      assert.calledOnceWithExactly(onDisconnected, 'session-replaced');
      assert.calledOnce(onConnected);
      assert.isTrue(bridge.isConnected);
    });

    it('ignores a repeated HELLO carrying the same token', () => {
      const onConnected = sinon.stub();

      connect();
      bridge.onConnected(onConnected);
      onConnected.resetHistory();

      connect();

      assert.notCalled(onConnected);
    });
  });

  describe('inbound filtering', () => {
    it('ignores a message whose source is not this window', () => {
      win.inject({data: fromExtension({kind: EnvelopeKind.HELLO}), origin: ORIGIN, source: {}});

      assert.isFalse(bridge.isConnected);
    });

    it('ignores a message from a disallowed origin', () => {
      win.inject({
        data: fromExtension({kind: EnvelopeKind.HELLO}),
        origin: 'https://evil.example.com',
        source: win,
      });

      assert.isFalse(bridge.isConnected);
    });

    it('ignores a message with no origin at all', () => {
      win.inject({data: fromExtension({kind: EnvelopeKind.HELLO}), source: win});

      assert.isFalse(bridge.isConnected);
    });

    it('ignores its own page-sourced envelopes echoed back', () => {
      win.flush();

      assert.isFalse(bridge.isConnected);
    });

    [EnvelopeKind.PUSH, EnvelopeKind.RESPONSE].forEach((kind) => {
      it(`ignores ${kind}, which a page never receives`, () => {
        connect();
        const before = win.posted.length;

        win.inject({
          data: fromExtension({kind, topic: 'demo.topic', ok: true, correlationId: 'x'}),
          origin: ORIGIN,
          source: win,
        });

        assert.lengthOf(win.posted, before);
      });
    });

    it('ignores a request carrying a forged session token', async () => {
      connect();
      bridge.requestHandler('demo.topic', () => 'served');

      win.inject({
        data: fromExtension({
          kind: EnvelopeKind.REQUEST,
          topic: 'demo.topic',
          session: 'not-the-session',
        }),
        origin: ORIGIN,
        source: win,
      });
      await tick();

      assert.lengthOf(posted(EnvelopeKind.RESPONSE), 0);
    });
  });

  describe('publish', () => {
    it('throws NOT_CONNECTED before the handshake, rather than dropping silently', () => {
      try {
        bridge.publish('demo.topic', {a: 1});
        assert.fail('expected a throw');
      } catch (error) {
        assert.instanceOf(error, BridgeError);
        assert.equal((error as BridgeError).code, 'NOT_CONNECTED');
      }
    });

    it('sends a PUSH to the exact document origin', () => {
      connect();
      bridge.publish('demo.topic', {a: 1});

      const push = posted(EnvelopeKind.PUSH);

      assert.lengthOf(push, 1);
      assert.equal(push[0].topic, 'demo.topic');
      assert.deepEqual(push[0].payload, {a: 1});
      assert.equal(push[0].session, SESSION);
      assert.equal(win.posted[win.posted.length - 1].targetOrigin, ORIGIN);
    });

    it('never posts to a wildcard target origin', () => {
      connect();
      bridge.publish('demo.topic');

      win.posted.forEach((post) => assert.notEqual(post.targetOrigin, '*'));
    });

    it('allows an absent payload', () => {
      connect();

      assert.doesNotThrow(() => bridge.publish('demo.topic'));
      assert.notProperty(posted(EnvelopeKind.PUSH)[0], 'payload');
    });

    [
      {name: 'an invalid topic', topic: 'not a topic', payload: undefined, code: 'INVALID_TOPIC'},
      {name: 'an empty topic', topic: '', payload: undefined, code: 'INVALID_TOPIC'},
      {
        name: 'an oversized payload',
        topic: 'demo.topic',
        payload: 'x'.repeat(400),
        code: 'INVALID_PAYLOAD',
      },
      {
        name: 'a reserved key in the payload',
        topic: 'demo.topic',
        payload: JSON.parse('{"__proto__": {"a": 1}}'),
        code: 'INVALID_PAYLOAD',
      },
    ].forEach(({name, topic, payload, code}) => {
      it(`throws ${code} for ${name}`, () => {
        const small = createWebBridgeWith(createFakeWindow(ORIGIN), {maxPayloadBytes: 100});

        try {
          small.publish(topic, payload as never);
          assert.fail('expected a throw');
        } catch (error) {
          assert.equal((error as BridgeError).code, code);
        } finally {
          small.destroy();
        }
      });
    });

    it('validates before checking the connection, so a bad call fails the same way either way', () => {
      assert.throws(() => bridge.publish('bad topic'), /Topic must match/);
    });

    it('counts pushes', () => {
      connect();
      bridge.publish('demo.topic');
      bridge.publish('demo.topic');

      assert.equal(bridge.getCounters()['pushSent.demo.topic'], 2);
    });
  });

  describe('requestHandler', () => {
    const request = (topic: string, payload?: unknown, id = 'req-1'): void => {
      win.inject({
        data: fromExtension({
          kind: EnvelopeKind.REQUEST,
          topic,
          id,
          ...(payload === undefined ? {} : {payload: payload as never}),
        }),
        origin: ORIGIN,
        source: win,
      });
    };

    beforeEach(() => {
      connect();
    });

    it('answers with the handler result, correlated to the request id', async () => {
      bridge.requestHandler('demo.topic', (payload) => ({echo: payload}));
      request('demo.topic', {a: 1});
      await tick();

      const responses = posted(EnvelopeKind.RESPONSE);

      assert.lengthOf(responses, 1);
      assert.isTrue(responses[0].ok);
      assert.deepEqual(responses[0].payload, {echo: {a: 1}});
      assert.equal(responses[0].correlationId, 'req-1');
      assert.equal(responses[0].topic, 'demo.topic');
    });

    it('awaits an async handler', async () => {
      bridge.requestHandler('demo.topic', async () => {
        await tick();

        return 'eventually';
      });
      request('demo.topic');
      await tick();
      await tick();

      assert.equal(posted(EnvelopeKind.RESPONSE)[0].payload, 'eventually');
    });

    it('passes metadata describing the request', async () => {
      const handler = sinon.stub().returns(null);

      bridge.requestHandler('demo.topic', handler);
      request('demo.topic', {a: 1}, 'req-meta');
      await tick();

      const meta = handler.firstCall.args[1];

      assert.equal(meta.topic, 'demo.topic');
      assert.equal(meta.messageId, 'req-meta');
      assert.isNumber(meta.receivedAt);
    });

    it('normalises an absent payload to null', async () => {
      const handler = sinon.stub().returns(null);

      bridge.requestHandler('demo.topic', handler);
      request('demo.topic');
      await tick();

      assert.isNull(handler.firstCall.args[0]);
    });

    it('answers NO_HANDLER for an unregistered topic', async () => {
      request('demo.topic');
      await tick();

      const response = posted(EnvelopeKind.RESPONSE)[0];

      assert.isFalse(response.ok);
      assert.equal(response.error?.code, 'NO_HANDLER');
    });

    it('answers HANDLER_ERROR without leaking the thrown message', async () => {
      bridge.requestHandler('demo.topic', () => {
        throw new Error('row 42 for user bob is missing');
      });
      request('demo.topic');
      await tick();

      const response = posted(EnvelopeKind.RESPONSE)[0];

      assert.isFalse(response.ok);
      assert.equal(response.error?.code, 'HANDLER_ERROR');
      assert.notInclude(JSON.stringify(response.error), 'bob');
      assert.notInclude(JSON.stringify(response.error), 'row');
      assert.notProperty(response.error, 'stack');
      assert.deepEqual(Object.keys(response.error ?? {}).sort(), ['code', 'message']);
    });

    it('answers HANDLER_ERROR for a rejected promise', async () => {
      bridge.requestHandler('demo.topic', () => Promise.reject(new Error('nope')));
      request('demo.topic');
      await tick();

      assert.equal(posted(EnvelopeKind.RESPONSE)[0].error?.code, 'HANDLER_ERROR');
    });

    it('answers INVALID_PAYLOAD when the handler returns something unsendable', async () => {
      bridge.requestHandler('demo.topic', () => {
        const cyclic: Record<string, unknown> = {};

        cyclic.self = cyclic;

        return cyclic as never;
      });
      request('demo.topic');
      await tick();

      assert.equal(posted(EnvelopeKind.RESPONSE)[0].error?.code, 'INVALID_PAYLOAD');
    });

    describe('opts.validate', () => {
      it('answers INVALID_PAYLOAD when validation fails, without calling the handler', async () => {
        const handler = sinon.stub().returns('served');

        bridge.requestHandler('demo.topic', handler, {
          validate: (payload) => typeof payload === 'object' && payload !== null,
        });
        request('demo.topic', 'a string');
        await tick();

        assert.notCalled(handler);
        assert.equal(posted(EnvelopeKind.RESPONSE)[0].error?.code, 'INVALID_PAYLOAD');
      });

      it('treats a throwing validator as a failed validation', async () => {
        bridge.requestHandler('demo.topic', () => 'served', {
          validate: () => {
            throw new Error('validator blew up');
          },
        });
        request('demo.topic', {a: 1});
        await tick();

        assert.equal(posted(EnvelopeKind.RESPONSE)[0].error?.code, 'INVALID_PAYLOAD');
      });

      it('treats a truthy non-true return as a failed validation', async () => {
        bridge.requestHandler('demo.topic', () => 'served', {
          validate: () => 1 as never,
        });
        request('demo.topic', {a: 1});
        await tick();

        assert.equal(posted(EnvelopeKind.RESPONSE)[0].error?.code, 'INVALID_PAYLOAD');
      });
    });

    describe('registration', () => {
      it('rejects an invalid topic', () => {
        assert.throws(() => bridge.requestHandler('bad topic', () => null), /Topic must match/);
      });

      it('rejects a non-function handler', () => {
        assert.throws(
          () => bridge.requestHandler('demo.topic', undefined as never),
          /must be a function/
        );
      });

      it('refuses to shadow an existing handler', () => {
        bridge.requestHandler('demo.topic', () => 'first');

        try {
          bridge.requestHandler('demo.topic', () => 'second');
          assert.fail('expected a throw');
        } catch (error) {
          assert.equal((error as BridgeError).code, 'INSECURE_CONFIG');
          assert.match((error as BridgeError).message, /replace: true/);
        }
      });

      it('replaces on request', async () => {
        bridge.requestHandler('demo.topic', () => 'first');
        bridge.requestHandler('demo.topic', () => 'second', {replace: true});
        request('demo.topic');
        await tick();

        assert.equal(posted(EnvelopeKind.RESPONSE)[0].payload, 'second');
      });

      it('unregisters', async () => {
        const off = bridge.requestHandler('demo.topic', () => 'served');

        off();
        request('demo.topic');
        await tick();

        assert.equal(posted(EnvelopeKind.RESPONSE)[0].error?.code, 'NO_HANDLER');
      });

      it('unregistering twice does not remove a replacement handler', async () => {
        const off = bridge.requestHandler('demo.topic', () => 'first');

        off();
        bridge.requestHandler('demo.topic', () => 'second');
        off();
        request('demo.topic');
        await tick();

        assert.equal(posted(EnvelopeKind.RESPONSE)[0].payload, 'second');
      });
    });
  });

  describe('lifecycle', () => {
    it('fires onConnected immediately when already connected', () => {
      connect();

      const listener = sinon.stub();

      bridge.onConnected(listener);

      assert.calledOnce(listener);
    });

    it('survives a throwing onConnected listener', () => {
      const after = sinon.stub();

      bridge.onConnected(() => {
        throw new Error('listener blew up');
      });
      bridge.onConnected(after);

      assert.doesNotThrow(connect);
      assert.calledOnce(after);
    });

    it('reports a peer BYE as a disconnect', () => {
      const onDisconnected = sinon.stub();

      connect();
      bridge.onDisconnected(onDisconnected);

      win.inject({data: fromExtension({kind: EnvelopeKind.BYE}), origin: ORIGIN, source: win});

      assert.calledOnceWithExactly(onDisconnected, 'peer-left');
      assert.isFalse(bridge.isConnected);
    });

    it('sends BYE and disconnects on pagehide', () => {
      connect();
      const onDisconnected = sinon.stub();

      bridge.onDisconnected(onDisconnected);
      win.fire('pagehide');

      assert.lengthOf(posted(EnvelopeKind.BYE), 1);
      assert.calledOnceWithExactly(onDisconnected, 'pagehide');
    });

    it('unsubscribes a lifecycle listener', () => {
      const listener = sinon.stub();
      const off = bridge.onDisconnected(listener);

      off();
      connect();
      win.inject({data: fromExtension({kind: EnvelopeKind.BYE}), origin: ORIGIN, source: win});

      assert.notCalled(listener);
    });
  });

  describe('destroy', () => {
    it('sends BYE, detaches every listener and reports the reason', () => {
      connect();
      const onDisconnected = sinon.stub();

      bridge.onDisconnected(onDisconnected);
      bridge.destroy();

      assert.lengthOf(posted(EnvelopeKind.BYE), 1);
      assert.calledOnceWithExactly(onDisconnected, 'destroyed');
      assert.equal(win.listenerCount('message'), 0);
      assert.equal(win.listenerCount('pagehide'), 0);
      assert.isFalse(bridge.isConnected);
    });

    it('is idempotent', () => {
      connect();
      bridge.destroy();
      const after = win.posted.length;

      assert.doesNotThrow(() => bridge.destroy());
      assert.lengthOf(win.posted, after);
    });

    it('refuses to publish afterwards', () => {
      connect();
      bridge.destroy();

      assert.throws(() => bridge.publish('demo.topic'), /destroyed/);
    });

    it('stops serving requests afterwards', async () => {
      connect();
      bridge.requestHandler('demo.topic', () => 'served');
      bridge.destroy();

      const before = win.posted.length;

      win.inject({
        data: fromExtension({kind: EnvelopeKind.REQUEST, topic: 'demo.topic'}),
        origin: ORIGIN,
        source: win,
      });
      await tick();

      assert.lengthOf(win.posted, before);
    });
  });
});
