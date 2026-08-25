import type {JsonValue} from './core/json';
import type {LogSink} from './core/logger';

export type {BridgeErrorCode, WireError} from './core/errors';
export type {JsonValue} from './core/json';
export type {LogContext, LogSink} from './core/logger';

export interface WebBridgeOptions {
  /**
   * Non-empty list of exact origins this bridge may run on. `'*'` is rejected, and
   * so is an origin list that does not include the document's own origin — the
   * bridge refuses to start rather than silently never connecting.
   */
  allowedOrigins?: string[];
  /** Namespace, so independent bridges can share a page. Must match the extension. */
  channel?: string;
  /** Metadata-only logging. Never logs payloads or session tokens. */
  debug?: boolean;
  /** Clamped to `[1, 1 MiB]`. */
  maxPayloadBytes?: number;
  /** Optional sink for the metadata-only logger. */
  logSink?: LogSink;
}

export interface RequestMeta {
  readonly topic: string;
  readonly messageId: string;
  readonly receivedAt: number;
}

export interface HandlerOptions {
  /**
   * Validate the inbound payload before the handler runs. Shape and size checks are
   * not input validation; this is where a schema belongs.
   */
  validate?: (payload: JsonValue) => boolean;
  /** Allow replacing an existing handler for this topic. */
  replace?: boolean;
}

export type RequestHandler = (
  payload: JsonValue,
  meta: RequestMeta
) => JsonValue | Promise<JsonValue>;

export interface WebBridge {
  /** Fire-and-forget push to the extension. Throws rather than dropping silently. */
  publish(topic: string, payload?: JsonValue): void;
  /**
   * Register the handler that answers on-demand requests for a topic.
   *
   * @returns An unregister function.
   */
  requestHandler(topic: string, handler: RequestHandler, opts?: HandlerOptions): () => void;
  /** Fires immediately when already connected. */
  onConnected(listener: () => void): () => void;
  onDisconnected(listener: (reason: string) => void): () => void;
  readonly isConnected: boolean;
  /** Telemetry counters for the host application. The SDK performs no network I/O. */
  getCounters(): Record<string, number>;
  /** Detach every listener and handler. Idempotent. */
  destroy(): void;
}

export interface PushMeta {
  readonly tabId: number;
  readonly url?: string;
  readonly origin: string;
  readonly receivedAt: number;
  readonly messageId: string;
}

export interface RequestOptions {
  /** Defaults to the active tab in the current window. */
  tabId?: number;
  /** Default 5000; clamped to `[100, 30000]`. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface Connection {
  readonly tabId: number;
  readonly origin: string;
  readonly url?: string;
  readonly connectedAt: number;
}

export interface BufferedMessage {
  readonly topic: string;
  readonly payload: JsonValue;
  readonly meta: PushMeta;
}

export interface ExtensionBridgeOptions {
  channel?: string;
  debug?: boolean;
  defaultTimeoutMs?: number;
  /**
   * Runtime origin allow-list, checked in addition to the manifest's `matches`.
   * When omitted, the manifest is the only origin control — see the ship checklist.
   */
  allowedOrigins?: string[];
  maxPayloadBytes?: number;
  buffer?: {maxEntries?: number; ttlMs?: number};
  rateLimit?: {pushesPerSecond?: number; maxInFlightPerTab?: number};
  logSink?: LogSink;
}

export type PushListener = (topic: string, payload: JsonValue, meta: PushMeta) => void;

export type TopicPushListener = (payload: JsonValue, meta: PushMeta) => void;

export interface ExtensionBridge {
  /** Receive pushed messages. A listener that throws cannot break the others. */
  subscribe(listener: PushListener): () => void;
  /** Topic-filtered form of {@link ExtensionBridge.subscribe}. */
  subscribeTopic(topic: string, listener: TopicPushListener): () => void;
  /** Pull from the page on demand. Always settles; rejects with a coded `BridgeError`. */
  request<T = JsonValue>(topic: string, payload?: JsonValue, opts?: RequestOptions): Promise<T>;
  /** Live view of attached tabs, for FR5 target selection. */
  listConnections(): Promise<Connection[]>;
  /** Bounded replay buffer of pushes received while no UI was open. */
  getBufferedMessages(opts?: {topic?: string; limit?: number}): Promise<BufferedMessage[]>;
  /**
   * Telemetry counters. Asynchronous because the counters live in the service worker,
   * and an extension page has to cross the runtime boundary to read them.
   */
  getCounters(): Promise<Record<string, number>>;
}
