import {
  CHANNEL_PATTERN,
  DEFAULT_BUFFER_MAX_BYTES,
  DEFAULT_BUFFER_MAX_ENTRIES,
  DEFAULT_BUFFER_TTL_MS,
  DEFAULT_CHANNEL,
  MAX_BUFFER_ENTRIES,
  MAX_BUFFER_MAX_BYTES,
  MAX_BUFFER_TTL_MS,
  MIN_BUFFER_ENTRIES,
  MIN_BUFFER_MAX_BYTES,
  MIN_BUFFER_TTL_MS,
} from '../core/constants';
import {PendingRequests} from '../core/correlation';
import {CounterName, Counters} from '../core/counters';
import {BridgeError, fromWireError} from '../core/errors';
import {createIdFactory} from '../core/ids';
import type {JsonValue} from '../core/json';
import {readOwn} from '../core/json';
import {clampMaxPayloadBytes, clampTimeoutMs, requireBoundedInteger} from '../core/limits';
import {ListenerSet} from '../core/listeners';
import {createLogger} from '../core/logger';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../core/protocol';
import {InFlightLimiter, RateLimiter, rateLimitKey} from '../core/rateLimit';
import {SeenIds} from '../core/replay';
import {
  asJsonValue,
  assertPayload,
  assertTopic,
  isValidTopic,
  utf8ByteLength,
} from '../core/serialize';
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
  /**
   * Serialised size, measured once on the way in and carried on the record — eviction
   * has to total the whole buffer, and re-stringifying every payload on each append
   * would make the byte cap itself the performance problem it was added to prevent.
   */
  bytes: number;
}

/** Exact origin, matching the page-side rule. */
const EXACT_ORIGIN_PATTERN = /^https?:\/\/[a-zA-Z0-9.-]+(:\d{1,5})?$/;

/**
 * Create the privileged extension-side bridge.
 *
 * Call this at the top level of the service worker: the runtime and tab listeners are
 * registered synchronously so an incoming event can revive an evicted worker.
 *
 * @param options - Bridge options. `allowedOrigins` is required.
 * @returns The bridge.
 */
export function createExtensionBridge(options: ExtensionBridgeOptions): ExtensionBridge {
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
  options: ExtensionBridgeOptions
): ExtensionBridge {
  // Guarded rather than defaulted: a call with no options is a configuration error
  // and should say so, not fail on a property read of `undefined`.
  if (typeof options !== 'object' || options === null) {
    throw new BridgeError('INSECURE_CONFIG', 'Bridge options with allowedOrigins are required');
  }

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
  const bufferMaxEntries = requireBoundedInteger(options.buffer?.maxEntries, 'buffer.maxEntries', {
    min: MIN_BUFFER_ENTRIES,
    max: MAX_BUFFER_ENTRIES,
    fallback: DEFAULT_BUFFER_MAX_ENTRIES,
  });
  const bufferTtlMs = requireBoundedInteger(options.buffer?.ttlMs, 'buffer.ttlMs', {
    min: MIN_BUFFER_TTL_MS,
    max: MAX_BUFFER_TTL_MS,
    fallback: DEFAULT_BUFFER_TTL_MS,
  });
  const bufferMaxBytes = requireBoundedInteger(options.buffer?.maxBytes, 'buffer.maxBytes', {
    min: MIN_BUFFER_MAX_BYTES,
    max: MAX_BUFFER_MAX_BYTES,
    fallback: DEFAULT_BUFFER_MAX_BYTES,
  });
  const logger = createLogger({
    debug: options.debug === true,
    ...(options.logLevel === undefined ? {} : {logLevel: options.logLevel}),
    prefix: '[web-extension-bridge:background]',
    ...(options.logSink ? {sink: options.logSink} : {}),
  });
  const counters = new Counters();
  const seenIds = new SeenIds();
  const pending = new PendingRequests();
  const pushLimiter = new RateLimiter({
    ...(options.rateLimit?.pushesPerSecond === undefined
      ? {}
      : {perSecond: options.rateLimit.pushesPerSecond}),
    ...(options.rateLimit?.aggregatePushesPerSecond === undefined
      ? {}
      : {aggregatePerSecond: options.rateLimit.aggregatePushesPerSecond}),
  });
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

  const onStorageWriteError = (name: string) => (error: unknown) => {
    counters.increment(CounterName.STORAGE_WRITE_FAILED, name);
    logger.warn('session storage write failed', {
      channel,
      store: name,
      reason: error instanceof Error ? error.name : typeof error,
    });
  };

  const connections = new SessionStore<StoredConnection[]>(
    storage,
    storageKey(channel, 'connections'),
    [],
    onStorageWriteError('connections')
  );
  const buffer = new SessionStore<StoredBufferEntry[]>(
    storage,
    storageKey(channel, 'buffer'),
    [],
    onStorageWriteError('buffer')
  );

  const findConnection = async (tabId: number): Promise<StoredConnection | undefined> => {
    const current = await connections.read();

    return current.find((entry) => entry.tabId === tabId);
  };

  const upsertConnection = (record: StoredConnection): Promise<StoredConnection[]> =>
    connections.update((current) => [
      ...current.filter((entry) => entry.tabId !== record.tabId),
      record,
    ]);

  /**
   * Remove a tab's connection record.
   *
   * `expectedSession`, when given, guards against removing a *newer* connection: a
   * relay that reloads mints session B while a `DISCONNECT` from session A may still
   * be in flight behind it, and removing by `tabId` alone would let that late message
   * delete the live connection.
   *
   * @param tabId - Tab whose connection record should be removed.
   * @param expectedSession - Only remove the record if its session matches this.
   * @returns Whether a record was actually removed.
   */
  const removeConnection = async (tabId: number, expectedSession?: string): Promise<boolean> => {
    let removed = false;

    await connections.update((current) =>
      current.filter((entry) => {
        if (entry.tabId !== tabId) {
          return true;
        }

        if (expectedSession !== undefined && entry.session !== expectedSession) {
          return true;
        }

        removed = true;

        return false;
      })
    );

    return removed;
  };

  /**
   * Release a tab's in-flight slots and settle anything still waiting on it.
   *
   * @param tabId - Tab to settle.
   * @param reason - Logged reason for the settlement.
   */
  const settleTab = (tabId: number, reason: string): void => {
    inFlight.releaseAll(tabId);

    const settled = pending.settleAll('DISCONNECTED', tabId);

    if (settled > 0) {
      logger.debug('settled in-flight requests on disconnect', {channel, tabId, reason});
    }
  };

  /**
   * Tear down everything held for a tab, regardless of session. For events about the
   * tab itself (removed, navigated, unreachable), where the document is gone either way.
   *
   * @param tabId - Tab to tear down.
   * @param reason - Logged reason.
   */
  const dropConnection = (tabId: number, reason: string): void => {
    logger.info('dropping connection', {channel, tabId, reason});
    void removeConnection(tabId);
    settleTab(tabId, reason);
  };

  /**
   * Session-scoped disconnect, for a goodbye that came from a relay.
   *
   * Awaited so the removal is durable before the worker may suspend, and scoped to the
   * disconnecting relay's own session so a late goodbye from a previous document can't
   * tear down the session that has since replaced it.
   *
   * @param tabId - Tab to disconnect.
   * @param session - Session the stored connection must match.
   * @param reason - Logged reason.
   */
  const removeConnectionForSession = async (
    tabId: number,
    session: string,
    reason: string
  ): Promise<void> => {
    const removed = await removeConnection(tabId, session);

    if (!removed) {
      // A newer session owns the tab now. Settling its requests would punish it for
      // the previous document's disconnect.
      logger.debug('ignored stale disconnect', {channel, tabId, reason});

      return;
    }

    settleTab(tabId, reason);
  };

  /**
   * @param topic - Push topic.
   * @param payload - Push payload.
   * @returns Serialised size of the buffer entry this will become.
   */
  const measureEntryBytes = (topic: string, payload: JsonValue): number => {
    try {
      return utf8ByteLength(JSON.stringify({topic, payload}) ?? '');
    } catch {
      // Unreachable for a validated payload; a wrong-but-finite estimate is still
      // better than letting the byte budget throw inside a message handler.
      return 0;
    }
  };

  /**
   * Append to the replay buffer, evicting oldest-first until the entry cap *and* the
   * total-byte budget both hold.
   *
   * The entry cap alone isn't a size bound — `maxPayloadBytes` goes up to 1 MiB, so 200
   * entries can be a 200 MiB buffer against a much smaller `chrome.storage.session`
   * quota, and writes past quota fail silently (async) without the byte budget.
   *
   * @param entry - Buffer entry to append.
   * @returns The buffer's contents after eviction.
   */
  const appendToBuffer = (entry: StoredBufferEntry): Promise<StoredBufferEntry[]> =>
    buffer.update((current) => {
      const fresh = current.filter((item) => entry.storedAt - item.storedAt < bufferTtlMs);

      fresh.push(entry);

      // Oldest-out: a chatty page evicts its own history rather than growing the worker.
      let start = Math.max(fresh.length - bufferMaxEntries, 0);
      let bytes = 0;

      for (let index = start; index < fresh.length; index += 1) {
        bytes += fresh[index]?.bytes ?? 0;
      }

      // A single entry larger than the whole budget is kept anyway (it's already
      // inside `maxPayloadBytes`) rather than dropped to satisfy a budget nothing
      // else is using.
      while (bytes > bufferMaxBytes && start < fresh.length - 1) {
        bytes -= fresh[start]?.bytes ?? 0;
        start += 1;
      }

      return fresh.slice(start);
    });

  const broadcastToUi = (event: ClientPushEvent): void => {
    // Rejects when no extension page is open. That is the normal case, not an error.
    void Promise.resolve(chromeApi.runtime.sendMessage(event)).catch(() => undefined);
  };

  const handleRelayPush = async (
    relay: RelayToWorker,
    tabId: number,
    tabUrl?: string
  ): Promise<void> => {
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

    const connection = await findConnection(tabId);

    // A stale content script from a previous document in this tab carries an old
    // token; its pushes are not this connection's pushes.
    if (!connection || connection.session !== relay.session) {
      counters.increment(CounterName.DROPPED, 'SESSION_MISMATCH');
      logger.warn('dropped push for stale session', {
        channel,
        tabId,
        topic: envelope.topic,
        reason: connection ? 'SESSION_MISMATCH' : 'NOT_CONNECTED',
      });

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
    await appendToBuffer({
      topic: envelope.topic,
      payload,
      meta,
      storedAt: meta.receivedAt,
      bytes: measureEntryBytes(envelope.topic, payload),
    });
    pushListeners.emit(envelope.topic, payload, meta);
    broadcastToUi({
      __webexBridgeClient: true,
      channel,
      event: 'push',
      topic: envelope.topic,
      payload,
      meta,
    });
  };

  /**
   * Handle one relay message to completion, including its storage write.
   *
   * Returns a promise (rather than firing the work off with `void`) so the caller can
   * hold the message channel open until persistence has settled — an MV3 worker may
   * suspend as soon as the last handler returns, and `void`-ing this work risked losing
   * a `CONNECT`, `DISCONNECT` or buffered `PUSH` between the handler returning and the
   * write landing.
   *
   * @param relay - Relay message to handle.
   * @param sender - Verified sender of the message.
   */
  const handleRelay = async (relay: RelayToWorker, sender: ChromeSender): Promise<void> => {
    const tabId = sender.tab?.id;

    if (typeof tabId !== 'number') {
      return;
    }

    switch (relay.kind) {
      case RelayKind.CONNECT: {
        // Always present: the sender-verification gate ahead of this refuses any
        // message whose reported origin isn't on the allow-list. No derive-from-tab-url
        // fallback, since that would be a second, weaker way to pass the same check.
        const origin = sender.origin ?? '';
        const record: StoredConnection = {
          tabId,
          origin,
          connectedAt: Date.now(),
          session: relay.session,
        };

        if (sender.tab?.url) {
          record.url = sender.tab.url;
        }

        logger.info('tab attached', {channel, tabId, origin});
        await upsertConnection(record);
        break;
      }

      case RelayKind.DISCONNECT:
        logger.info('tab detached', {channel, tabId, reason: relay.reason});
        await removeConnectionForSession(tabId, relay.session, relay.reason ?? 'bye');
        break;

      case RelayKind.PUSH:
        await handleRelayPush(relay, tabId, sender.tab?.url);
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
      logger.debug('no active tab to target', {channel});

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
        logger.debug('request to an unattached tab', {channel, tabId, topic});

        throw new BridgeError('NOT_CONNECTED', undefined, topic);
      }

      if (!inFlight.acquire(tabId)) {
        counters.increment(CounterName.RATE_LIMITED, topic);
        logger.warn('request rate limited', {channel, tabId, topic});

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
      logger.debug('request issued', {channel, tabId, topic, id});

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
        async () => {
          // Reject this request first, so it reports why *it* failed (dropping the
          // connection settles everything else on the tab as `DISCONNECTED`, and
          // correlation is single-use, so whichever runs first wins).
          pending.reject(id, new BridgeError('NOT_CONNECTED', undefined, topic));

          // A send failure means the tab has no listener (reloaded extension, discarded
          // tab, failed injection) even though the stored record says otherwise; treated
          // as the missing navigation/removal event that should have told us. Scoped to
          // the session this send targeted, not the bare tab ID, because a replacement
          // relay may have connected on the same tab by the time this async rejection
          // arrives — dropping by tab ID alone would tear down that healthy session too.
          logger.debug('dropping unreachable connection', {channel, tabId});
          await removeConnectionForSession(tabId, connection.session, 'send-failed');
        }
      );

      return await settled;
    } catch (error) {
      const reason = error instanceof BridgeError ? error.code : 'HANDLER_ERROR';

      counters.increment(CounterName.REQUEST_FAILED, reason);
      logger.debug('request failed', {
        channel,
        topic,
        reason,
        ...(acquiredTab === undefined ? {} : {tabId: acquiredTab}),
      });

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

        case ClientCommand.GET_BUFFERED: {
          // Topic filter applied here, before the limit — otherwise the limit truncates
          // across all topics first, and a topic behind newer pushes on other topics
          // comes back short even though its entries are still in the buffer.
          if (command.topic !== undefined && !isValidTopic(command.topic)) {
            throw new BridgeError('INVALID_TOPIC');
          }

          return {
            ok: true,
            value: await bridge.getBufferedMessages({
              ...(command.topic === undefined ? {} : {topic: command.topic}),
              ...(typeof command.limit === 'number' ? {limit: command.limit} : {}),
            }),
          };
        }

        case ClientCommand.GET_COUNTERS:
          return {ok: true, value: counters.snapshot()};

        default:
          throw new BridgeError('INVALID_PAYLOAD');
      }
    } catch (error) {
      const code = error instanceof BridgeError ? error.code : 'HANDLER_ERROR';

      logger.debug('client command failed', {
        channel,
        kind: command.command,
        ...(command.topic === undefined ? {} : {topic: command.topic}),
        reason: code,
      });

      return {
        ok: false,
        error: {
          code,
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
        logger.warn('dropped relay from non-content-script', {
          channel,
          kind: relay.kind,
          reason: 'NOT_A_CONTENT_SCRIPT',
        });

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

      // `true` holds the message channel — and with it the worker — open until the
      // relay's storage writes have settled (see `handleRelay`'s doc comment).
      void handleRelay(relay, sender).then(
        () => sendResponse({ok: true}),
        (error: unknown) => {
          counters.increment(
            CounterName.DROPPED,
            error instanceof BridgeError ? error.code : 'HANDLER_ERROR'
          );
          logger.warn('relay handling failed', {
            channel,
            tabId: sender.tab.id,
            kind: relay.kind,
            reason: error instanceof Error ? error.name : typeof error,
          });
          sendResponse({ok: false});
        }
      );

      return true;
    }

    const command = asClientCommand(message, channel);

    if (command) {
      // Extension pages only. A content script must never reach the command surface.
      if (!isFromExtensionPage(chromeApi, sender)) {
        counters.increment(CounterName.DROPPED, 'NOT_AN_EXTENSION_PAGE');
        logger.warn('dropped command from non-extension-page', {
          channel,
          kind: command.command,
          ...(typeof sender.tab?.id === 'number' ? {tabId: sender.tab.id} : {}),
          reason: 'NOT_AN_EXTENSION_PAGE',
        });

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
  logger.info('extension bridge started', {channel, count: allowedOrigins.size});
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
 * Resolve the runtime origin allow-list, which is required rather than optional.
 *
 * A manifest `matches` pattern says where a content script is *injected*, not who sent
 * the message currently being handled, and it's routinely broadened during development
 * and never narrowed again. Making the list mandatory turns a silent weakening of T1
 * into an auditable startup failure instead.
 *
 * @param origins - Configured `allowedOrigins` option.
 * @returns The allow-list as a set of exact origins.
 * @throws BridgeError `INSECURE_CONFIG` when absent, empty, wildcarded, or not an
 *   exact http(s) origin.
 */
function resolveAllowedOrigins(origins?: string[]): Set<string> {
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new BridgeError(
      'INSECURE_CONFIG',
      'allowedOrigins is required and must be a non-empty array of exact http(s) origins'
    );
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

/** Re-exported so a service worker can respond to a relay result without importing internals. */
export type {RelayResult};
