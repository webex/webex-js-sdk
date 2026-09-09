import fs from 'fs';
import path from 'path';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {CONTROL_TOPIC, DEFAULT_CHANNEL} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import type {JsonValue} from '../../../../src/core/json';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../../../../src/core/protocol';
import type {Envelope} from '../../../../src/core/protocol';
import {createContentRelay} from '../../../../src/extension/content';
import {RelayKind} from '../../../../src/extension/messages';
import type {RelayRequest, RelayResult} from '../../../../src/extension/messages';
import {createExtensionClientWith} from '../../../../src/extension/client';
import {createFakeExtensionWorld} from '../../lib/fakeChrome';
import {createFakeWindow} from '../../lib/fakeWindow';
import {createLogCapture, createWiredPair, rawEnvelope, runtimeOutcome} from '../../lib/wire';
import type {WiredPair} from '../../lib/wire';

/**
 * One regression test per threat in the intake spec's model (T1–T14).
 *
 * These are deliberately named after the threats rather than the code, so a future
 * change that reopens one of them fails a test that says which threat it reopened. A
 * new threat needs a new test here before the fix is accepted.
 */

const ORIGIN = 'https://app.example.com';
const HOSTILE = 'https://evil.example.com';
const SRC_DIR = path.join(__dirname, '..', '..', '..', '..', 'src');
const PACKAGE_JSON = path.join(__dirname, '..', '..', '..', '..', 'package.json');

/**
 * @returns Every TypeScript source file in the package, as `{file, text}`.
 */
function readAllSources(): {file: string; text: string}[] {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
      const full = path.join(dir, entry.name);

      return entry.isDirectory() ? walk(full) : [full];
    });

  return walk(SRC_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => ({file: path.relative(SRC_DIR, file), text: fs.readFileSync(file, 'utf8')}));
}

describe('security/threats', () => {
  let pair: WiredPair;

  const rejection = async (promise: Promise<unknown>): Promise<BridgeError> =>
    promise.then(
      (value) => {
        throw new Error(`expected a rejection, got ${JSON.stringify(value)}`);
      },
      (error: BridgeError) => error
    );

  const roundTrip = async (topic: string, payload?: JsonValue): Promise<JsonValue> => {
    const outcome = pair.bridge.request(topic, payload, {timeoutMs: 30000}).then(
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

  describe('T1 malicious site drives the extension', () => {
    it('the relay ignores an envelope that reports a foreign origin', async () => {
      const before = pair.world.tabMessages.length;

      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.PUSH,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'hostile-1',
          session: pair.relay.session,
          payload: 'from a hostile frame',
        }),
        origin: HOSTILE,
        source: pair.win,
      });
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
      assert.lengthOf(pair.world.tabMessages, before);
    });

    it('the page refuses to run on an origin outside its allow-list', () => {
      const win = createFakeWindow(HOSTILE);

      try {
        createWiredPair({origin: HOSTILE, pageOptions: {allowedOrigins: [ORIGIN]}});
        assert.fail('expected INSECURE_CONFIG');
      } catch (error) {
        assert.equal((error as BridgeError).code, 'INSECURE_CONFIG');
      }

      assert.lengthOf(win.posted, 0);
    });

    it('the worker drops relay traffic from an origin outside its allow-list', async () => {
      // The page and the relay behave perfectly; the origin they run on is the problem,
      // and the worker is the hop that has to notice.
      const guarded = createWiredPair({
        origin: HOSTILE,
        bridgeOptions: {allowedOrigins: [ORIGIN], logSink: createLogCapture().sink},
      });

      await guarded.settle();

      assert.isTrue(guarded.page.isConnected, 'the page half is unaware, by design');
      assert.lengthOf(await guarded.bridge.listConnections(), 0);

      guarded.destroy();
    });
  });

  describe('T2 cross-frame injection', () => {
    const notThisWindow = {};

    it('the page ignores an envelope from another window', async () => {
      const onConnected = sinon.spy();

      pair.destroy();
      pair = createWiredPair();
      pair.page.onConnected(onConnected);
      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.HELLO,
          source: EnvelopeSource.EXTENSION,
          topic: CONTROL_TOPIC,
          id: 'iframe-hello',
          session: 'a-token-from-an-iframe',
        }),
        origin: ORIGIN,
        source: notThisWindow,
      });

      assert.isFalse(pair.page.isConnected);
      assert.notCalled(onConnected);
      await pair.settle();
    });

    it('the relay ignores an envelope from another window', async () => {
      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.PUSH,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'iframe-push',
          session: pair.relay.session,
          payload: 'from an iframe',
        }),
        origin: ORIGIN,
        source: notThisWindow,
      });
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
    });

    it('a guessed session token is refused, so a frame cannot join a live session', async () => {
      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.PUSH,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'guessed-token',
          session: 'te-session-guess',
          payload: 'should not arrive',
        }),
        origin: ORIGIN,
        source: pair.win,
      });
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
    });
  });

  describe('T3 forged or stale response resolves a pull', () => {
    it('a response with a guessed correlationId settles nothing', async () => {
      pair.page.requestHandler('demo.topic', () => new Promise<JsonValue>(() => undefined));

      const outcome = pair.bridge.request('demo.topic', undefined, {timeoutMs: 30000}).then(
        () => 'settled',
        () => 'settled'
      );

      await pair.settle();

      const inFlight = pair.win.posted
        .map((post) => post.message as Envelope)
        .filter((message) => message?.kind === EnvelopeKind.REQUEST);

      assert.lengthOf(inFlight, 1);

      // Forge a response for a nearby id, as an attacker guessing correlations would.
      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.RESPONSE,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'forged-response',
          correlationId: `${inFlight[0].id}x`,
          session: pair.relay.session,
          ok: true,
          payload: 'forged',
        }),
        origin: ORIGIN,
        source: pair.win,
      });
      await pair.settle();

      assert.equal(
        await Promise.race([outcome, Promise.resolve('still pending')]),
        'still pending'
      );
    });

    it('a replayed envelope is dropped', async () => {
      const envelope = createEnvelope({
        channel: pair.channel,
        kind: EnvelopeKind.PUSH,
        source: EnvelopeSource.PAGE,
        topic: 'demo.topic',
        id: 'replay-me',
        session: pair.relay.session,
        payload: 'captured',
      });

      pair.win.inject({data: envelope, origin: ORIGIN, source: pair.win});
      await pair.settle();
      pair.win.inject({data: envelope, origin: ORIGIN, source: pair.win});
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 1);
    });

    it('a captured envelope replayed later is outside the clock-skew window', async () => {
      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.PUSH,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'stale-capture',
          session: pair.relay.session,
          payload: 'captured yesterday',
          ts: Date.now() - 86400000,
        }),
        origin: ORIGIN,
        source: pair.win,
      });
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
    });

    it('ids are unguessable, so correlation cannot be predicted', async () => {
      pair.page.requestHandler('demo.topic', () => 'served');
      await roundTrip('demo.topic');
      await roundTrip('demo.topic');

      const ids = pair.win.posted
        .map((post) => post.message as Envelope)
        .filter((message) => message?.kind === EnvelopeKind.REQUEST)
        .map((message) => message.id);

      assert.lengthOf(new Set(ids), ids.length);
      ids.forEach((id) => assert.isAbove(id.length, 16));
    });
  });

  describe('T4 service-worker denial of service', () => {
    it('caps the push rate per topic', async () => {
      pair.destroy();
      pair = createWiredPair({
        relayOptions: {pushesPerSecond: 1000, logSink: createLogCapture().sink},
        bridgeOptions: {rateLimit: {pushesPerSecond: 3}, logSink: createLogCapture().sink},
      });
      await pair.settle();

      for (let index = 0; index < 20; index += 1) {
        pair.page.publish('flood.topic', index);
      }
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 3);
    });

    it('caps concurrent requests per tab', async () => {
      pair.destroy();
      pair = createWiredPair({bridgeOptions: {rateLimit: {maxInFlightPerTab: 2}}});
      await pair.settle();
      pair.page.requestHandler('slow.topic', () => new Promise<JsonValue>(() => undefined));

      const outcomes = [1, 2, 3, 4, 5].map((index) =>
        pair.bridge.request('slow.topic', index, {timeoutMs: 30000}).then(
          () => 'resolved',
          (error: BridgeError) => error.code
        )
      );

      await pair.settle();

      const settled = await Promise.all(
        outcomes.map((outcome) => Promise.race([outcome, Promise.resolve('pending')]))
      );

      assert.lengthOf(
        settled.filter((value) => value === 'RATE_LIMITED'),
        3
      );

      pair.world.fireTabRemoved(pair.world.tabId);
      await pair.settle();
      await Promise.all(outcomes);
    });

    it('bounds the replay buffer', async () => {
      pair.destroy();
      pair = createWiredPair({bridgeOptions: {buffer: {maxEntries: 5}}});
      await pair.settle();

      for (let index = 0; index < 12; index += 1) {
        pair.page.publish('demo.topic', index);
      }
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 5);
    });

    it('bounds the listener set rather than growing without limit', () => {
      const add = () => pair.bridge.subscribe(() => undefined);

      for (let index = 0; index < 64; index += 1) {
        add();
      }

      assert.throws(add, RangeError, /more than 64 listeners/);
    });
  });

  describe('T5 memory exhaustion', () => {
    it('refuses an oversized payload on send', () => {
      pair.destroy();
      pair = createWiredPair({pageOptions: {maxPayloadBytes: 128}});

      assert.throws(() => pair.page.publish('demo.topic', 'x'.repeat(1000)), BridgeError);
    });

    it('refuses an oversized payload on receive', async () => {
      pair.destroy();
      pair = createWiredPair({relayOptions: {maxPayloadBytes: 128}});
      await pair.settle();

      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.PUSH,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'too-big',
          session: pair.relay.session,
          payload: 'x'.repeat(1000),
        }),
        origin: ORIGIN,
        source: pair.win,
      });
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
    });

    it('refuses a circular payload rather than throwing inside postMessage', () => {
      const circular: Record<string, unknown> = {};

      circular.self = circular;

      assert.throws(
        () => pair.page.publish('demo.topic', circular as unknown as JsonValue),
        BridgeError
      );
    });

    it('refuses a handler result that is too large', async () => {
      pair.destroy();
      pair = createWiredPair({pageOptions: {maxPayloadBytes: 128}});
      await pair.settle();
      pair.page.requestHandler('demo.topic', () => 'x'.repeat(1000));

      assert.equal((await rejection(roundTrip('demo.topic'))).code, 'INVALID_PAYLOAD');
    });
  });

  describe('T6 information disclosure through errors', () => {
    it('redacts a thrown handler message and never sends a stack', async () => {
      pair.page.requestHandler('demo.topic', () => {
        const error = new Error('connection string: postgres://user:s3cret@db');

        throw error;
      });

      const error = await rejection(roundTrip('demo.topic'));
      const wire = JSON.stringify(pair.win.posted);

      assert.equal(error.code, 'HANDLER_ERROR');
      assert.notInclude(error.message, 's3cret');
      assert.notInclude(wire, 's3cret');
      assert.notInclude(wire, 'postgres');
      assert.notInclude(wire, 'stack');
    });

    it('sends only a code and a fixed message across the boundary', async () => {
      pair.page.requestHandler('demo.topic', () => {
        throw new BridgeError('HANDLER_ERROR', 'internal detail nobody should see');
      });

      await rejection(roundTrip('demo.topic'));

      const responses = pair.win.posted
        .map((post) => post.message as Envelope)
        .filter((message) => message?.kind === EnvelopeKind.RESPONSE);

      assert.lengthOf(responses, 1);
      assert.deepEqual(Object.keys(responses[0].error ?? {}).sort(), ['code', 'message']);
      assert.notInclude(JSON.stringify(responses[0].error), 'nobody should see');
    });
  });

  describe('T7 extension fingerprinting and resource probing', () => {
    it('never asks the platform for an extension resource URL', () => {
      readAllSources().forEach(({file, text}) => {
        assert.notInclude(text, 'getURL', file);
        assert.notInclude(text, 'web_accessible_resources', file);
        assert.notInclude(text, 'externally_connectable', file);
      });
    });

    it('models only the platform APIs it needs, so extra surface is a compile error', () => {
      const platform = readAllSources().find(({file}) => file.endsWith('platform.ts'));
      const modelled = [...(platform?.text.match(/^\s{2}(\w+)[?]?[(:]/gm) ?? [])].join(' ');

      ['getURL', 'executeScript', 'connect', 'connectNative', 'management', 'cookies'].forEach(
        (forbidden) => assert.notInclude(modelled, forbidden)
      );
    });

    it('publishes no wildcard subpath, so nothing unlisted is importable', () => {
      const manifest = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as {
        exports: Record<string, unknown>;
      };

      Object.keys(manifest.exports).forEach((subpath) => assert.notInclude(subpath, '*'));
    });
  });

  describe('T8 privilege escalation into the service worker', () => {
    it('the relay does not forward a page-originated REQUEST', async () => {
      const before = pair.world.tabMessages.length;

      pair.win.inject({
        data: createEnvelope({
          channel: pair.channel,
          kind: EnvelopeKind.REQUEST,
          source: EnvelopeSource.PAGE,
          topic: 'demo.topic',
          id: 'page-request',
          session: pair.relay.session,
        }),
        origin: ORIGIN,
        source: pair.win,
      });
      await pair.settle();

      assert.lengthOf(pair.world.tabMessages, before);
    });

    it('the relay forwards nothing that is not a protocol envelope', async () => {
      const before = pair.world.tabMessages.length;

      [
        {__webexBridgeRelay: true, channel: pair.channel, kind: RelayKind.CONNECT, session: 'x'},
        {__webexBridgeClient: true, channel: pair.channel, command: 'getCounters'},
        {type: 'EXECUTE_SCRIPT', code: 'alert(1)'},
      ].forEach((data) => pair.win.inject({data, origin: ORIGIN, source: pair.win}));
      await pair.settle();

      assert.lengthOf(pair.world.tabMessages, before);
      assert.lengthOf(await pair.bridge.listConnections(), 1);
    });

    it('the worker command surface refuses a content script', async () => {
      const outcome = await runtimeOutcome(
        pair.world.sendAsContentScript({
          __webexBridgeClient: true,
          channel: pair.channel,
          command: 'listConnections',
        })
      );

      assert.include(String(outcome), 'Receiving end does not exist');
    });

    it('the worker exposes no arbitrary command surface', async () => {
      const outcome = await runtimeOutcome(
        pair.world.sendAsExtensionPage({
          __webexBridgeClient: true,
          channel: pair.channel,
          command: 'eval',
          payload: 'globalThis.polluted = true',
        })
      );

      assert.include(String(outcome), 'Receiving end does not exist');
      assert.isUndefined((globalThis as {polluted?: boolean}).polluted);
    });
  });

  describe('T9 prototype pollution', () => {
    const poisoned = (): Record<string, unknown> => {
      const value: Record<string, unknown> = {};

      Object.defineProperty(value, '__proto__', {
        value: {polluted: true},
        enumerable: true,
        configurable: true,
        writable: true,
      });

      return value;
    };

    afterEach(() => {
      assert.isUndefined(({} as {polluted?: boolean}).polluted);
      assert.isUndefined((Object.prototype as {polluted?: boolean}).polluted);
    });

    it('refuses a payload carrying a reserved key', () => {
      assert.throws(
        () => pair.page.publish('demo.topic', poisoned() as JsonValue),
        BridgeError
      );
    });

    it('refuses a reserved key nested deep inside a payload', () => {
      assert.throws(
        () => pair.page.publish('demo.topic', {a: {b: [{c: poisoned()}]}} as JsonValue),
        BridgeError
      );
    });

    it('drops an inbound envelope with a reserved key', async () => {
      const envelope = rawEnvelope({
        channel: pair.channel,
        kind: EnvelopeKind.PUSH,
        source: EnvelopeSource.PAGE,
        topic: 'demo.topic',
        session: pair.relay.session,
      });

      Object.defineProperty(envelope, 'constructor', {
        value: 'hijacked',
        enumerable: true,
        configurable: true,
      });

      pair.win.inject({data: envelope, origin: ORIGIN, source: pair.win});
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
    });

    it('keeps a legitimate round trip working', async () => {
      pair.page.requestHandler('demo.topic', (payload) => payload);

      assert.deepEqual(await roundTrip('demo.topic', {constructorName: 'safe'}), {
        constructorName: 'safe',
      });
    });
  });

  describe('T10 hanging promises and resource leaks', () => {
    it('a request against a silent handler always settles', async () => {
      const clock = sinon.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});

      try {
        pair.destroy();
        pair = createWiredPair();
        await pair.settle();
        pair.page.requestHandler('demo.topic', () => new Promise<JsonValue>(() => undefined));

        const outcome = pair.bridge.request('demo.topic', undefined, {timeoutMs: 200}).then(
          () => 'resolved',
          (error: BridgeError) => error.code
        );

        await pair.settle();
        clock.tick(200);

        assert.equal(await outcome, 'TIMEOUT');
      } finally {
        clock.restore();
      }
    });

    it('the relay settles the worker even when the page never answers', async () => {
      const clock = sinon.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
      const world = createFakeExtensionWorld({origin: ORIGIN});
      const win = createFakeWindow(ORIGIN);
      const relay = createContentRelay(win, world.contentChrome, {});

      try {
        win.inject({
          data: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.HELLO,
            source: EnvelopeSource.PAGE,
            topic: CONTROL_TOPIC,
            id: 'page-hello',
            session: '',
          }),
          origin: ORIGIN,
          source: win,
        });

        const answered = world.backgroundChrome.tabs!.sendMessage(world.tabId, {
          __webexBridgeRelay: true,
          channel: DEFAULT_CHANNEL,
          kind: RelayKind.REQUEST,
          timeoutMs: 200,
          envelope: createEnvelope({
            channel: DEFAULT_CHANNEL,
            kind: EnvelopeKind.REQUEST,
            source: EnvelopeSource.EXTENSION,
            topic: 'demo.topic',
            id: 'req-1',
            session: relay.session,
          }),
        } satisfies RelayRequest & {timeoutMs: number});

        clock.tick(200);

        const settled = (await answered) as RelayResult;

        assert.isFalse(settled.ok);
        assert.equal(settled.ok === false && settled.error.code, 'TIMEOUT');
      } finally {
        relay.destroy();
        clock.restore();
      }
    });

    it('a disconnect settles everything in flight', async () => {
      pair.page.requestHandler('demo.topic', () => new Promise<JsonValue>(() => undefined));

      const outcomes = [1, 2, 3].map((index) =>
        pair.bridge.request('demo.topic', index, {timeoutMs: 30000}).then(
          () => 'resolved',
          (error: BridgeError) => error.code
        )
      );

      await pair.settle();
      pair.world.fireTabRemoved(pair.world.tabId);
      await pair.settle();

      assert.deepEqual(await Promise.all(outcomes), [
        'DISCONNECTED',
        'DISCONNECTED',
        'DISCONNECTED',
      ]);
    });
  });

  describe('T11 log-based leakage', () => {
    const SECRET = 'a-very-secret-payload-value';

    it('logs nothing at all in the default configuration', async () => {
      const pageLog = createLogCapture();
      const relayLog = createLogCapture();
      const workerLog = createLogCapture();

      pair.destroy();
      pair = createWiredPair({
        pageOptions: {logSink: pageLog.sink},
        relayOptions: {logSink: relayLog.sink},
        bridgeOptions: {logSink: workerLog.sink},
      });
      await pair.settle();
      pair.page.publish('demo.topic', SECRET);
      await pair.settle();

      assert.lengthOf(pageLog.lines, 0);
      assert.lengthOf(relayLog.lines, 0);
      assert.lengthOf(workerLog.lines, 0);
    });

    it('never logs a payload or a session token, even with debug on', async () => {
      const pageLog = createLogCapture();
      const relayLog = createLogCapture();
      const workerLog = createLogCapture();

      pair.destroy();
      pair = createWiredPair({
        pageOptions: {debug: true, logSink: pageLog.sink},
        relayOptions: {debug: true, logSink: relayLog.sink},
        bridgeOptions: {debug: true, logSink: workerLog.sink},
      });
      await pair.settle();
      pair.page.requestHandler('demo.topic', (payload) => payload);
      pair.page.publish('demo.topic', SECRET);
      await pair.settle();
      await roundTrip('demo.topic', SECRET);

      const written = JSON.stringify([pageLog.lines, relayLog.lines, workerLog.lines]);

      assert.isAbove(pageLog.lines.length + relayLog.lines.length + workerLog.lines.length, 0);
      assert.notInclude(written, SECRET);
      assert.notInclude(written, pair.relay.session);
    });

    it('offers no log field a payload or a token could be put in', () => {
      const logger = readAllSources().find(({file}) => file.endsWith(path.join('core', 'logger.ts')));
      const context = /export interface LogContext \{[^}]+\}/.exec(logger?.text ?? '')?.[0];
      const allowList = /const CONTEXT_KEYS[^\]]+\]/.exec(logger?.text ?? '')?.[0];

      assert.isString(context, 'LogContext should be the only shape a log line can carry');
      assert.isString(allowList);

      ['payload', 'session', 'token', 'data', 'body'].forEach((forbidden) => {
        assert.notInclude(context ?? '', forbidden);
        assert.notInclude(allowList ?? '', forbidden);
      });
    });
  });

  describe('T12 supply-chain compromise', () => {
    const manifest = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as Record<string, unknown>;

    it('ships zero runtime dependencies', () => {
      assert.notProperty(manifest, 'dependencies');
      assert.notProperty(manifest, 'peerDependencies');
      assert.notProperty(manifest, 'bundledDependencies');
      assert.notProperty(manifest, 'optionalDependencies');
    });

    it('publishes an explicit file list rather than whatever is on disk', () => {
      assert.deepEqual(manifest.files, ['dist', 'README.md', 'SECURITY.md']);
    });

    it('imports nothing outside the package', () => {
      readAllSources().forEach(({file, text}) => {
        const imports = [...text.matchAll(/from '([^']+)'/g)].map((match) => match[1]);

        imports.forEach((specifier) =>
          assert.isTrue(
            specifier.startsWith('.'),
            `${file} imports '${specifier}', which would become a runtime dependency`
          )
        );
      });
    });
  });

  describe('T13 UI injection in extension pages', () => {
    const sinks = ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval('];

    it('uses no DOM sink anywhere in the package source', () => {
      readAllSources().forEach(({file, text}) => {
        sinks.forEach((sink) => assert.notInclude(text, sink, `${file} must not use ${sink}`));
      });
    });

    it('hands a payload to the UI as data, never as markup', async () => {
      const world = createFakeExtensionWorld({origin: ORIGIN});
      const client = createExtensionClientWith(world.uiChrome, {});
      const listener = sinon.spy();
      const markup = '<img src=x onerror="alert(1)">';

      client.subscribe(listener);
      await runtimeOutcome(
        world.sendToUi({
          __webexBridgeClient: true,
          channel: DEFAULT_CHANNEL,
          event: 'push',
          topic: 'demo.topic',
          payload: markup,
          meta: {tabId: 7, origin: ORIGIN, receivedAt: Date.now(), messageId: 'push-1'},
        })
      );

      // Delivered verbatim as a string: rendering is the consumer's decision, and the
      // SDK gives it no help in rendering it as HTML.
      assert.calledOnce(listener);
      assert.strictEqual(listener.args[0][1], markup);
    });
  });

  describe('T14 rogue peer extension', () => {
    it('the worker refuses a relay message from another extension', async () => {
      await runtimeOutcome(
        pair.world.sendAsForeignExtension({
          __webexBridgeRelay: true,
          channel: pair.channel,
          kind: RelayKind.PUSH,
          session: pair.relay.session,
          envelope: createEnvelope({
            channel: pair.channel,
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.PAGE,
            topic: 'demo.topic',
            id: 'rogue-push',
            session: pair.relay.session,
            payload: 'from a rogue extension',
          }),
        })
      );
      await pair.settle();

      assert.lengthOf(await pair.bridge.getBufferedMessages(), 0);
    });

    it('the relay refuses a request from another extension', async () => {
      const outcome = await runtimeOutcome(
        pair.world.sendToContent(
          {
            __webexBridgeRelay: true,
            channel: pair.channel,
            kind: RelayKind.REQUEST,
            timeoutMs: 1000,
            envelope: createEnvelope({
              channel: pair.channel,
              kind: EnvelopeKind.REQUEST,
              source: EnvelopeSource.EXTENSION,
              topic: 'demo.topic',
              id: 'rogue-request',
              session: pair.relay.session,
            }),
          },
          {id: 'a-different-extension-id'}
        )
      );

      assert.include(String(outcome), 'Receiving end does not exist');
    });

    it('an extension page refuses a broadcast from another extension', async () => {
      const world = createFakeExtensionWorld({origin: ORIGIN});
      const client = createExtensionClientWith(world.uiChrome, {});
      const listener = sinon.spy();

      client.subscribe(listener);
      await runtimeOutcome(
        world.sendToUi(
          {
            __webexBridgeClient: true,
            channel: DEFAULT_CHANNEL,
            event: 'push',
            topic: 'demo.topic',
            payload: 'from a rogue extension',
            meta: {tabId: 7, origin: ORIGIN, receivedAt: Date.now(), messageId: 'rogue-1'},
          },
          {id: 'a-different-extension-id'}
        )
      );

      assert.notCalled(listener);
    });
  });
});
