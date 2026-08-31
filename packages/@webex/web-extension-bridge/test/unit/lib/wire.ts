import {ENVELOPE_MARKER, PROTOCOL_VERSION, DEFAULT_CHANNEL, CONTROL_TOPIC} from '../../../src/core/constants';
import type {LogContext, LogLevel, LogSink} from '../../../src/core/logger';
import {EnvelopeKind, EnvelopeSource} from '../../../src/core/protocol';
import type {Envelope} from '../../../src/core/protocol';
import {createExtensionBridgeWith} from '../../../src/extension/background';
import {createContentRelay} from '../../../src/extension/content';
import type {ContentRelay} from '../../../src/extension/content';
import {createWebBridgeWith} from '../../../src/web/webBridge';
import type {ExtensionBridge, WebBridge} from '../../../src/types';
import {createFakeExtensionWorld} from './fakeChrome';
import type {FakeExtensionWorld} from './fakeChrome';
import {createFakeWindow} from './fakeWindow';
import type {FakeWindow} from './fakeWindow';

/**
 * @returns A promise resolved on the next macrotask, which drains pending microtasks
 *   without depending on any timer that a test may have faked.
 */
export function tick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * Pump queued page messages and drain microtasks until the system is quiet.
 *
 * A fixed number of rounds rather than "until nothing moves": handler promises can
 * schedule more traffic, and a fixed pump makes a stuck flow fail visibly instead of
 * spinning forever.
 *
 * @param win - The window carrying the queued posts.
 */
export async function pump(win: FakeWindow): Promise<void> {
  for (let round = 0; round < 12; round += 1) {
    win.flush();
    // eslint-disable-next-line no-await-in-loop
    await tick();
  }
}

export interface LogCapture {
  sink: LogSink;
  lines: {level: LogLevel; message: string; context?: LogContext}[];
  /**
   * @param level - Level to filter by.
   * @returns The messages logged at that level.
   */
  messages(level: LogLevel): string[];
}

/**
 * A log sink that records instead of writing to the console.
 *
 * Used both to assert on what was logged and to keep expected warnings out of the
 * test output.
 *
 * @returns The capture.
 */
export function createLogCapture(): LogCapture {
  const lines: LogCapture['lines'] = [];
  const record =
    (level: LogLevel) =>
    (message: string, context?: LogContext): void => {
      lines.push({level, message, ...(context ? {context} : {})});
    };

  return {
    lines,
    sink: {
      debug: record('debug'),
      info: record('info'),
      warn: record('warn'),
      error: record('error'),
    },
    messages(level: LogLevel): string[] {
      return lines.filter((line) => line.level === level).map((line) => line.message);
    },
  };
}

/**
 * Flatten a runtime `sendMessage` promise into whatever the caller would observe.
 *
 * An ignored message rejects with Chrome's no-receiver text, so this lets "was
 * answered" and "was ignored" be asserted the same way.
 *
 * @param promise - The `sendMessage` result.
 * @returns The response, or the rejection message.
 */
export function runtimeOutcome(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => value,
    (error: Error) => error.message
  );
}

export interface WiredPair {
  win: FakeWindow;
  world: FakeExtensionWorld;
  relay: ContentRelay;
  page: WebBridge;
  bridge: ExtensionBridge;
  channel: string;
  /** Pump queued page messages and drain microtasks until everything has settled. */
  settle(): Promise<void>;
  destroy(): void;
}

export interface WiredPairOptions {
  channel?: string;
  origin?: string;
  /** `page-first` exercises the init race where the relay's first HELLO is missed. */
  order?: 'relay-first' | 'page-first';
  pageOptions?: Parameters<typeof createWebBridgeWith>[1];
  relayOptions?: Parameters<typeof createContentRelay>[2];
  bridgeOptions?: Parameters<typeof createExtensionBridgeWith>[1];
}

/**
 * Wire a page bridge, a content relay and a background bridge into one in-memory
 * system, so a test can exercise a real end-to-end flow across all four hops.
 *
 * @param options - Wiring options.
 * @returns The wired system.
 */
export function createWiredPair(options: WiredPairOptions = {}): WiredPair {
  const channel = options.channel ?? DEFAULT_CHANNEL;
  const origin = options.origin ?? 'https://app.example.com';
  const win = createFakeWindow(origin);
  const world = createFakeExtensionWorld({origin, url: `${origin}/index.html`});
  const order = options.order ?? 'relay-first';

  const bridge = createExtensionBridgeWith(world.backgroundChrome, {
    channel,
    // `allowedOrigins` is mandatory now, so the wired pair supplies the fake world's
    // own origin by default. A test that cares about origin rejection overrides it.
    allowedOrigins: [origin],
    ...options.bridgeOptions,
  });

  let relay: ContentRelay;
  let page: WebBridge;

  if (order === 'relay-first') {
    relay = createContentRelay(win, world.contentChrome, {channel, ...options.relayOptions});
    page = createWebBridgeWith(win, {channel, ...options.pageOptions});
  } else {
    page = createWebBridgeWith(win, {channel, ...options.pageOptions});
    relay = createContentRelay(win, world.contentChrome, {channel, ...options.relayOptions});
  }

  return {
    win,
    world,
    relay,
    page,
    bridge,
    channel,

    settle(): Promise<void> {
      return pump(win);
    },

    destroy(): void {
      page.destroy();
      relay.destroy();
    },
  };
}

export interface EnvelopeOverrides {
  [key: string]: unknown;
}

/**
 * Build a raw envelope-shaped object for injection tests.
 *
 * Deliberately not using `createEnvelope`: these tests need to produce values the
 * production builder cannot, such as a wrong version or a reserved key.
 *
 * @param overrides - Fields to set or replace.
 * @returns A plain object shaped like an envelope.
 */
export function rawEnvelope(overrides: EnvelopeOverrides = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    [ENVELOPE_MARKER]: true,
    v: PROTOCOL_VERSION,
    channel: DEFAULT_CHANNEL,
    kind: EnvelopeKind.PUSH,
    source: EnvelopeSource.EXTENSION,
    topic: CONTROL_TOPIC,
    id: 'id-00000000-0000-4000-8000-000000000000',
    correlationId: null,
    session: 'session-token',
    ts: Date.now(),
  };

  return {...base, ...overrides};
}

/**
 * @param win - Fake window to read from.
 * @param kind - Envelope kind to look for.
 * @returns Every envelope of that kind posted so far, oldest first.
 */
export function postedOfKind(win: FakeWindow, kind: string): Envelope[] {
  return win.posted
    .map((post) => post.message as Envelope)
    .filter((message) => message && typeof message === 'object' && message.kind === kind);
}
