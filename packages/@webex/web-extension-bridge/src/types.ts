import type {JsonValue} from './core/json';
import type {LogLevelSetting, LogSink} from './core/logger';

export type {BridgeErrorCode, WireError} from './core/errors';
export type {JsonValue} from './core/json';
export type {LogContext, LogLevel, LogLevelSetting, LogSink} from './core/logger';

export interface WebBridgeOptions {
  /**
   * Non-empty list of exact origins this bridge may run on. `'*'` is rejected, and
   * so is an origin list that does not include the document's own origin — the
   * bridge refuses to start rather than silently never connecting.
   */
  allowedOrigins?: string[];
  /** Namespace, so independent bridges can share a page. Must match the extension. */
  channel?: string;
  /**
   * Lowest severity to log: `'silent' | 'error' | 'warn' | 'info' | 'debug'`, default
   * `'warn'`. Lifecycle events are `info`, per-message detail is `debug`.
   */
  logLevel?: LogLevelSetting;
  /** Alias for `logLevel: 'debug'`. Ignored when `logLevel` is given. */
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
  /**
   * Fire-and-forget push to the extension. Throws rather than dropping silently.
   *
   * @param topic - Push topic.
   * @param payload - Push payload.
   */
  publish(topic: string, payload?: JsonValue): void;
  /**
   * Register the handler that answers on-demand requests for a topic.
   *
   * @param topic - Request topic to handle.
   * @param handler - Called with each request's payload and metadata.
   * @param opts - Validation and replace options.
   * @returns An unsubscribe function that removes this handler.
   */
  requestHandler(topic: string, handler: RequestHandler, opts?: HandlerOptions): () => void;
  /**
   * Fires immediately when already connected.
   *
   * @param listener - Called with no arguments on connect.
   * @returns An unsubscribe function.
   */
  onConnected(listener: () => void): () => void;
  /**
   * Fires whenever the extension-side peer goes away.
   *
   * @param listener - Called with the disconnect reason.
   * @returns An unsubscribe function.
   */
  onDisconnected(listener: (reason: string) => void): () => void;
  /** Whether an extension-side peer is currently attached. */
  readonly isConnected: boolean;
  /**
   * Telemetry counters for the host application. The SDK performs no network I/O.
   *
   * @returns A snapshot of the current counts.
   */
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
  /**
   * Required, non-empty list of exact origins the worker accepts relay traffic from,
   * checked in addition to the manifest's `matches`.
   *
   * A manifest pattern controls where the content script is injected, not who sent the
   * message being handled, so it is not a substitute for this list. Construction fails
   * with `INSECURE_CONFIG` when it is missing, empty, or contains a wildcard.
   */
  allowedOrigins: string[];
  channel?: string;
  /** As {@link WebBridgeOptions.logLevel}. */
  logLevel?: LogLevelSetting;
  /** Alias for `logLevel: 'debug'`. Ignored when `logLevel` is given. */
  debug?: boolean;
  defaultTimeoutMs?: number;
  maxPayloadBytes?: number;
  buffer?: {
    maxEntries?: number;
    ttlMs?: number;
    /** Total serialised bytes the buffer may hold, enforced alongside `maxEntries`.
     * Defaults to 4 MiB. */
    maxBytes?: number;
  };
  rateLimit?: {
    /** Per `(tab, topic)` push budget. */
    pushesPerSecond?: number;
    /**
     * Per-tab push budget across every topic, which is what actually bounds a page
     * that cycles topic names. Defaults to four times `pushesPerSecond`.
     */
    aggregatePushesPerSecond?: number;
    maxInFlightPerTab?: number;
  };
  logSink?: LogSink;
}

export type PushListener = (topic: string, payload: JsonValue, meta: PushMeta) => void;

export type TopicPushListener = (payload: JsonValue, meta: PushMeta) => void;

export interface ExtensionBridge {
  /**
   * Receive pushed messages. A listener that throws cannot break the others.
   *
   * @param listener - Called with the topic, payload and metadata of each push.
   * @returns An unsubscribe function.
   */
  subscribe(listener: PushListener): () => void;
  /**
   * Topic-filtered form of {@link ExtensionBridge.subscribe}.
   *
   * @param topic - Topic to filter on.
   * @param listener - Called with the payload and metadata of each matching push.
   * @returns An unsubscribe function.
   */
  subscribeTopic(topic: string, listener: TopicPushListener): () => void;
  /**
   * Pull from the page on demand. Always settles; rejects with a coded `BridgeError`.
   *
   * @param topic - Request topic.
   * @param payload - Request payload.
   * @param opts - Target tab, timeout and abort signal.
   * @returns The page handler's result.
   */
  request<T = JsonValue>(topic: string, payload?: JsonValue, opts?: RequestOptions): Promise<T>;
  /**
   * Live view of attached tabs, for FR5 target selection.
   *
   * @returns Every tab currently attached to this channel.
   */
  listConnections(): Promise<Connection[]>;
  /**
   * Bounded replay buffer of pushes received while no UI was open.
   *
   * @param opts - Topic filter and max entries to return.
   * @returns Matching buffered messages, oldest first.
   */
  getBufferedMessages(opts?: {topic?: string; limit?: number}): Promise<BufferedMessage[]>;
  /**
   * Telemetry counters. Asynchronous because the counters live in the service worker,
   * and an extension page has to cross the runtime boundary to read them.
   *
   * @returns A snapshot of the worker's current counts.
   */
  getCounters(): Promise<Record<string, number>>;
}
