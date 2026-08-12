import {
  CHANNEL_PATTERN,
  DEFAULT_BUFFER_MAX_ENTRIES,
  DEFAULT_BUFFER_TTL_MS,
  DEFAULT_CHANNEL,
} from '../core/constants';
import {PendingRequests} from '../core/correlation';
import {CounterName, Counters} from '../core/counters';
import {BridgeError, fromWireError} from '../core/errors';
import {createIdFactory} from '../core/ids';
import type {JsonValue} from '../core/json';
import {readOwn} from '../core/json';
import {clampMaxPayloadBytes, clampTimeoutMs} from '../core/limits';
import {ListenerSet} from '../core/listeners';
import {createLogger} from '../core/logger';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../core/protocol';
import {InFlightLimiter, RateLimiter, rateLimitKey} from '../core/rateLimit';
import {SeenIds} from '../core/replay';
import {asJsonValue, assertPayload, assertTopic, isValidTopic} from '../core/serialize';
import {validateEnvelope} from '../core/validate';
import {ClientCommand, RelayKind, asClientCommand, asRelayToWorker} from './messages';
import type {
  ClientCommandMessage,
  ClientPushEvent,
  ClientResult,
  RelayRequest,
  RelayResult,
  RelayToWorker,
} from './messages';
import {requireSessionStorage, requireTabs, resolveChrome} from './platform';
import type {ChromeLike, ChromeSender, SendResponse} from './platform';
import {isFromContentScript, isFromExtensionPage, isOriginAllowed, isOwnExtension} from './senders';
import {SessionStore, storageKey} from './sessionStore';
import type {
  BufferedMessage,
  Connection,
  ExtensionBridge,
  ExtensionBridgeOptions,
  PushListener,
  PushMeta,
  RequestOptions,
  TopicPushListener,
} from '../types';

/** Connection record. Carries the session token, which never leaves the worker. */
interface StoredConnection {
  tabId: number;
  origin: string;
  url?: string;
  connectedAt: number;
  session: string;
}

interface StoredBufferEntry {
  topic: string;
  payload: JsonValue;
  meta: PushMeta;
  storedAt: number;
}

/** Exact origin, matching the page-side rule. */
const EXACT_ORIGIN_PATTERN = /^https?:\/\/[a-zA-Z0-9.-]+(:\d{1,5})?$/;

/**
 * Create the privileged extension-side bridge.
 *
 * Call this at the top level of the service worker: the runtime and tab listeners are
 * registered synchronously so an incoming event can revive an evicted worker.
 *
 * @param options - Bridge options.
 * @returns The bridge.
 */
export function createExtensionBridge(options?: ExtensionBridgeOptions): ExtensionBridge {
  return createExtensionBridgeWith(resolveChrome(), options);
}

/**
 * @internal Test seam. Accepts a mocked platform object so the sender-verification
 *   matrix, tab resolution and disconnect settlement can be driven directly.
 *
 * @param chromeApi - Extension platform object.
 * @param options - Bridge options.
 * @returns The bridge.
 */
export function createExtensionBridgeWith(
  chromeApi: ChromeLike,
  options: ExtensionBridgeOptions = {}
): ExtensionBridge {
  const channel = options.channel ?? DEFAULT_CHANNEL;

  if (typeof channel !== 'string' || !CHANNEL_PATTERN.test(channel)) {
    throw new BridgeError('INSECURE_CONFIG', 'channel must match ^[a-zA-Z0-9._:-]{1,128}$');
  }

  const allowedOrigins = resolveAllowedOrigins(options.allowedOrigins);
  const tabsApi = requireTabs(chromeApi);
  const storage = requireSessionStorage(chromeApi);
  const nextId = createIdFactory();
  const maxPayloadBytes = clampMaxPayloadBytes(options.maxPayloadBytes);
  const defaultTimeoutMs = clampTimeoutMs(options.defaultTimeoutMs);
  const bufferMaxEntries = Math.max(options.buffer?.maxEntries ?? DEFAULT_BUFFER_MAX_ENTRIES, 1);
  const bufferTtlMs = Math.max(options.buffer?.ttlMs ?? DEFAULT_BUFFER_TTL_MS, 1);
  const logger = createLogger({
    debug: options.debug === true,
    prefix: '[web-extension-bridge:background]',
    ...(options.logSink ? {sink: options.logSink} : {}),
  });
  const counters = new Counters();
  const seenIds = new SeenIds();
  const pending = new PendingRequests();
  const pushLimiter = new RateLimiter(
    options.rateLimit?.pushesPerSecond === undefined
      ? {}
      : {perSecond: options.rateLimit.pushesPerSecond}
  );
  const inFlight = new InFlightLimiter(
    options.rateLimit?.maxInFlightPerTab === undefined
      ? {}
      : {max: options.rateLimit.maxInFlightPerTab}
  );
  const pushListeners = new ListenerSet<PushListener>({
    onError: (error) =>
      logger.warn('push listener threw', {
        channel,
        reason: error instanceof Error ? error.name : typeof error,
      }),
  });

  const connections = new SessionStore<StoredConnection[]>(
    storage,
    storageKey(channel, 'connections'),
    []
  );
  const buffer = new SessionStore<StoredBufferEntry[]>(storage, storageKey(channel, 'buffer'), []);

  const findConnection = async (tabId: number): Promise<StoredConnection | undefined> => {
    const current = await connections.read();

    return current.find((entry) => entry.tabId === tabId);
  };

  const upsertConnection = (record: StoredConnection): Promise<StoredConnection[]> =>
    connections.update((current) => [
      ...current.filter((entry) => entry.tabId !== record.tabId),
      record,
    ]);

  const removeConnection = (tabId: number): Promise<StoredConnection[]> =>
    connections.update((current) => current.filter((entry) => entry.tabId !== tabId));

  const dropConnection = (tabId: number, reason: string): void => {
    void removeConnection(tabId);
    inFlight.releaseAll(tabId);

    const settled = pending.settleAll('DISCONNECTED', tabId);

    if (settled > 0) {
      logger.debug('settled in-flight requests on disconnect', {channel, tabId, reason});
    }
  };

  const appendToBuffer = (entry: StoredBufferEntry): Promise<StoredBufferEntry[]> =>
    buffer.update((current) => {
      const fresh = current.filter((item) => entry.storedAt - item.storedAt < bufferTtlMs);

      fresh.push(entry);

      // Oldest-out: the buffer is a bounded convenience, so a chatty page evicts its
      // own history rather than growing the worker's footprint.
      return fresh.slice(Math.max(fresh.length - bufferMaxEntries, 0));
    });

  const broadcastToUi = (event: ClientPushEvent): void => {
    // Rejects when no extension page is open. That is the normal case, not an error.
    void Promise.resolve(chromeApi.runtime.sendMessage(event)).catch(() => undefined);
  };

  const handleRelayPush = (relay: RelayToWorker, tabId: number, tabUrl?: string): void => {
    const validated = validateEnvelope(relay.envelope, {
      channel,
      expectedSource: EnvelopeSource.PAGE,
      session: relay.session,
      maxPayloadBytes,
      now: Date.now(),
      allowedKinds: [EnvelopeKind.PUSH],
      seenIds,
    });

    if (!validated.ok) {
      counters.increment(CounterName.DROPPED, validated.reason);
      logger.warn('dropped inbound push', {channel, tabId, reason: validated.reason});

      return;
    }

    const {envelope} = validated;

    // Synchronous limiter check, before any storage round trip, so a flood cannot
    // queue up asynchronous work faster than it is drained.
    if (!pushLimiter.allow(rateLimitKey(tabId, envelope.topic))) {
      counters.increment(CounterName.RATE_LIMITED, envelope.topic);
      logger.warn('push rate limited', {channel, tabId, topic: envelope.topic});

      return;
    }

    void (async () => {
      const connection = await findConnection(tabId);

      // A stale content script from a previous document in this tab carries an old
      // token; its pushes are not this connection's pushes.
      if (!connection || connection.session !== relay.session) {
        counters.increment(CounterName.DROPPED, 'SESSION_MISMATCH');

        return;
      }

      const meta: PushMeta = Object.freeze({
        tabId,
        origin: connection.origin,
        ...(tabUrl ?? connection.url ? {url: tabUrl ?? connection.url} : {}),
        receivedAt: Date.now(),
        messageId: envelope.id,
      });
      const payload = asJsonValue(envelope.payload ?? null);

      counters.increment(CounterName.PUSH_RECEIVED, envelope.topic);
      await appendToBuffer({topic: envelope.topic, payload, meta, storedAt: meta.receivedAt});
      pushListeners.emit(envelope.topic, payload, meta);
      broadcastToUi({
        __webexBridgeClient: true,
        channel,
        event: 'push',
        topic: envelope.topic,
        payload,
        meta,
      });
    })();
  };

  const handleRelay = (relay: RelayToWorker, sender: ChromeSender): void => {
    const tabId = sender.tab?.id;

    if (typeof tabId !== 'number') {
      return;
    }

    switch (relay.kind) {
      case RelayKind.CONNECT: {
        const origin = sender.origin ?? deriveOrigin(sender.tab?.url) ?? '';
        const record: StoredConnection = {
          tabId,
          origin,
          connectedAt: Date.now(),
          session: relay.session,
        };

        if (sender.tab?.url) {
          record.url = sender.tab.url;
        }

        logger.debug('tab attached', {channel, tabId, origin});
        void upsertConnection(record);
        break;
      }

      case RelayKind.DISCONNECT:
        logger.debug('tab detached', {channel, tabId, reason: relay.reason});
        dropConnection(tabId, relay.reason ?? 'bye');
        break;

      case RelayKind.PUSH:
        handleRelayPush(relay, tabId, sender.tab?.url);
        break;

      default:
        break;
    }
  };

  const resolveTargetTab = async (requested?: number): Promise<number> => {
    if (typeof requested === 'number') {
      return requested;
    }

    // `chrome.tabs.query` returns the active tab's id without the `tabs` permission,
    // which is why the manifest needs only `["storage"]`.
    const found = await tabsApi.query({active: true, currentWindow: true});
    const tabId = found[0]?.id;

    if (typeof tabId !== 'number') {
      throw new BridgeError('NO_TAB');
    }

    return tabId;
  };

  const settleFromRelay = (id: string, topic: string, session: string, response: unknown): void => {
    const ok = readOwn(response, 'ok');

    if (ok !== true) {
      pending.reject(id, fromWireError(readOwn(response, 'error'), topic));

      return;
    }

    const validated = validateEnvelope(readOwn(response, 'envelope'), {
      channel,
      expectedSource: EnvelopeSource.PAGE,
      session,
      maxPayloadBytes,
      now: Date.now(),
      allowedKinds: [EnvelopeKind.RESPONSE],
      seenIds,
    });

    if (!validated.ok) {
      logger.warn('dropped inbound response', {channel, id, reason: validated.reason});
      pending.reject(id, new BridgeError('HANDLER_ERROR', undefined, topic));

      return;
    }

    const {envelope} = validated;

    // Single-use correlation: a response for a different request cannot settle this one.
    if (envelope.correlationId !== id) {
      logger.warn('dropped mismatched correlation', {
        channel,
        id,
        correlationId: envelope.correlationId,
      });

      return;
    }

    if (envelope.ok === true) {
      pending.resolve(id, asJsonValue(envelope.payload ?? null));

      return;
    }

    pending.reject(id, fromWireError(envelope.error, topic));
  };

  const request = async (
    topic: string,
    payload?: JsonValue,
    opts: RequestOptions = {}
  ): Promise<JsonValue> => {
    // Held so the slot is released only by the call that took it, and so every failure
    // path — including the ones before a slot exists — is counted in one place.
    let acquiredTab: number | undefined;

    try {
      assertTopic(topic);
      assertPayload(payload, maxPayloadBytes, topic);

      const tabId = await resolveTargetTab(opts.tabId);
      const connection = await findConnection(tabId);

      if (!connection) {
        throw new BridgeError('NOT_CONNECTED', undefined, topic);
      }

      if (!inFlight.acquire(tabId)) {
        counters.increment(CounterName.RATE_LIMITED, topic);
        throw new BridgeError('RATE_LIMITED', undefined, topic);
      }

      acquiredTab = tabId;

      const id = nextId();
      const timeoutMs = clampTimeoutMs(opts.timeoutMs ?? defaultTimeoutMs);
      const envelope = createEnvelope({
        channel,
        kind: EnvelopeKind.REQUEST,
        source: EnvelopeSource.EXTENSION,
        topic,
        id,
        session: connection.session,
        ...(payload === undefined ? {} : {payload}),
      });
      const relayRequest: RelayRequest = {
        __webexBridgeRelay: true,
        channel,
        kind: RelayKind.REQUEST,
        envelope,
        timeoutMs,
      };

      counters.increment(CounterName.REQUEST_ISSUED, topic);

      const settled = pending.create(
        id,
        {
          timeoutMs,
          topic,
          ...(opts.signal ? {signal: opts.signal} : {}),
        },
        tabId
      );

      // The relay round trip settles the promise; the timer inside `pending` settles it
      // if the relay never answers. Whichever happens first wins, and the loser is a
      // no-op because correlation is single-use.
      void Promise.resolve(tabsApi.sendMessage(tabId, relayRequest)).then(
        (response) => settleFromRelay(id, topic, connection.session, response),
        () => pending.reject(id, new BridgeError('NOT_CONNECTED', undefined, topic))
      );

      return await settled;
    } catch (error) {
      counters.increment(
        CounterName.REQUEST_FAILED,
        error instanceof BridgeError ? error.code : 'HANDLER_ERROR'
      );
      throw error;
    } finally {
      if (acquiredTab !== undefined) {
        inFlight.release(acquiredTab);
      }
    }
  };

  const runClientCommand = async (command: ClientCommandMessage): Promise<ClientResult> => {
    try {
      switch (command.command) {
        case ClientCommand.REQUEST: {
          if (!isValidTopic(command.topic)) {
            throw new BridgeError('INVALID_TOPIC');
          }

          const value = await request(command.topic, command.payload, {
            ...(typeof command.tabId === 'number' ? {tabId: command.tabId} : {}),
            ...(typeof command.timeoutMs === 'number' ? {timeoutMs: command.timeoutMs} : {}),
          });

          return {ok: true, value};
        }

        case ClientCommand.LIST_CONNECTIONS:
          return {ok: true, value: await bridge.listConnections()};

        case ClientCommand.GET_BUFFERED:
          return {
            ok: true,
            value: await bridge.getBufferedMessages(
              typeof command.limit === 'number' ? {limit: command.limit} : {}
            ),
          };

        case ClientCommand.GET_COUNTERS:
          return {ok: true, value: counters.snapshot()};

        default:
          throw new BridgeError('INVALID_PAYLOAD');
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: error instanceof BridgeError ? error.code : 'HANDLER_ERROR',
          message: error instanceof BridgeError ? error.message : 'The command failed',
        },
      };
    }
  };

  const onRuntimeMessage = (
    message: unknown,
    sender: ChromeSender,
    sendResponse: SendResponse
  ): boolean | void => {
    if (!isOwnExtension(chromeApi, sender)) {
      counters.increment(CounterName.DROPPED, 'FOREIGN_SENDER');

      return undefined;
    }

    const relay = asRelayToWorker(message, channel);

    if (relay) {
      // Content-script traffic must come from a tab, and from an allow-listed origin
      // when one is configured. The manifest is not a substitute for this check.
      if (!isFromContentScript(chromeApi, sender)) {
        counters.increment(CounterName.DROPPED, 'NOT_A_CONTENT_SCRIPT');

        return undefined;
      }

      if (!isOriginAllowed(allowedOrigins, sender.origin)) {
        counters.increment(CounterName.DROPPED, 'ORIGIN_NOT_ALLOWED');
        logger.warn('dropped relay message from disallowed origin', {
          channel,
          tabId: sender.tab.id,
          origin: sender.origin,
        });

        return undefined;
      }

      handleRelay(relay, sender);

      return undefined;
    }

    const command = asClientCommand(message, channel);

    if (command) {
      // Extension pages only. A content script must never reach the command surface.
      if (!isFromExtensionPage(chromeApi, sender)) {
        counters.increment(CounterName.DROPPED, 'NOT_AN_EXTENSION_PAGE');

        return undefined;
      }

      void runClientCommand(command).then(sendResponse, () =>
        sendResponse({ok: false, error: {code: 'HANDLER_ERROR', message: 'The command failed'}})
      );

      return true;
    }

    return undefined;
  };

  chromeApi.runtime.onMessage.addListener(onRuntimeMessage);
  tabsApi.onRemoved.addListener((tabId) => dropConnection(tabId, 'tab-removed'));
  tabsApi.onUpdated.addListener((tabId, changeInfo) => {
    // A killed or navigating page cannot send BYE, so navigation is its own signal.
    if (changeInfo.status === 'loading' || typeof changeInfo.url === 'string') {
      dropConnection(tabId, 'tab-navigated');
    }
  });

  const bridge: ExtensionBridge = {
    subscribe(listener: PushListener): () => void {
      return pushListeners.add(listener);
    },

    subscribeTopic(topic: string, listener: TopicPushListener): () => void {
      assertTopic(topic);

      return pushListeners.add((pushTopic, payload, meta) => {
        if (pushTopic === topic) {
          listener(payload, meta);
        }
      });
    },

    request<T = JsonValue>(topic: string, payload?: JsonValue, opts?: RequestOptions): Promise<T> {
      return request(topic, payload, opts) as Promise<T>;
    },

    async listConnections(): Promise<Connection[]> {
      const current = await connections.read();

      return current.map((entry) => {
        const connection: Connection = {
          tabId: entry.tabId,
          origin: entry.origin,
          connectedAt: entry.connectedAt,
          ...(entry.url === undefined ? {} : {url: entry.url}),
        };

        return connection;
      });
    },

    async getBufferedMessages(
      opts: {topic?: string; limit?: number} = {}
    ): Promise<BufferedMessage[]> {
      const now = Date.now();
      const current = await buffer.read();
      const fresh = current.filter((entry) => now - entry.storedAt < bufferTtlMs);
      const filtered =
        opts.topic === undefined ? fresh : fresh.filter((entry) => entry.topic === opts.topic);
      const limit = Math.min(Math.max(opts.limit ?? bufferMaxEntries, 0), bufferMaxEntries);

      return filtered.slice(Math.max(filtered.length - limit, 0)).map((entry) => ({
        topic: entry.topic,
        payload: entry.payload,
        meta: entry.meta,
      }));
    },

    getCounters(): Promise<Record<string, number>> {
      return Promise.resolve(counters.snapshot());
    },
  };

  return bridge;
}

/**
 * @param origins - Optional runtime origin allow-list.
 * @returns A set of exact origins, or `undefined` to defer to the manifest.
 * @throws BridgeError `INSECURE_CONFIG` for a wildcard or a non-origin entry.
 */
function resolveAllowedOrigins(origins?: string[]): Set<string> | undefined {
  if (origins === undefined) {
    return undefined;
  }

  if (!Array.isArray(origins) || origins.length === 0) {
    throw new BridgeError('INSECURE_CONFIG', 'allowedOrigins must be a non-empty array');
  }

  for (const origin of origins) {
    if (typeof origin !== 'string' || origin.includes('*') || !EXACT_ORIGIN_PATTERN.test(origin)) {
      throw new BridgeError(
        'INSECURE_CONFIG',
        `'${String(origin)}' is not an exact http(s) origin`
      );
    }
  }

  return new Set(origins);
}

/**
 * @param url - Tab URL, when the platform provided one.
 * @returns The URL's origin, or `undefined` when it cannot be parsed.
 */
function deriveOrigin(url?: string): string | undefined {
  if (typeof url !== 'string') {
    return undefined;
  }

  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/** Re-exported so a service worker can respond to a relay result without importing internals. */
export type {RelayResult};
