import {
  CHANNEL_PATTERN,
  CONTROL_TOPIC,
  DEFAULT_CHANNEL,
  HELLO_REANNOUNCE_DELAY_MS,
} from '../core/constants';
import {CounterName, Counters} from '../core/counters';
import {BridgeError, toWireError} from '../core/errors';
import {createIdFactory} from '../core/ids';
import {clampMaxPayloadBytes} from '../core/limits';
import {createLogger} from '../core/logger';
import type {LogSink} from '../core/logger';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../core/protocol';
import type {Envelope} from '../core/protocol';
import {RateLimiter, rateLimitKey} from '../core/rateLimit';
import {SeenIds} from '../core/replay';
import {validateEnvelope} from '../core/validate';
import {RelayKind, asRelayRequest} from './messages';
import type {RelayRequest, RelayResult, RelayToWorker} from './messages';
import {resolveChrome} from './platform';
import type {ChromeLike, ChromeSender, SendResponse} from './platform';
import {isFromExtensionPage} from './senders';
import {resolvePageWindow} from '../web/pageWindow';
import type {PageMessageEvent, PageWindowLike} from '../web/pageWindow';

/**
 * Consecutive failed worker notifications before the relay stops calling the page
 * connected. Three, because one rejection is the ordinary cost of waking an evicted
 * MV3 worker and two in a row can still be a slow restart; three in a row is a worker
 * that is not coming back.
 */
const MAX_WORKER_NOTIFY_FAILURES = 3;

/** Kinds the relay accepts from the page. A page may not originate a REQUEST (T8). */
const ACCEPTED_FROM_PAGE = [
  EnvelopeKind.HELLO,
  EnvelopeKind.HELLO_ACK,
  EnvelopeKind.PUSH,
  EnvelopeKind.RESPONSE,
  EnvelopeKind.BYE,
] as const;

export interface ContentRelayOptions {
  channel?: string;
  debug?: boolean;
  maxPayloadBytes?: number;
  /** Inbound push budget per topic, enforced before anything reaches the worker. */
  pushesPerSecond?: number;
  /** Inbound push budget for the page as a whole. Defaults to four times the above. */
  aggregatePushesPerSecond?: number;
  logSink?: LogSink;
}

export interface ContentRelay {
  /** The session token this relay minted for the page load. */
  readonly session: string;
  /**
   * Counters for what the relay itself dropped, which no other hop can see.
   *
   * The relay sits between the page's `publish()` and the worker, and both of its
   * failure modes are invisible from either end: a push refused by the relay's rate
   * limiter never reaches the worker's counters, and a `runtime.sendMessage` that
   * rejects because the worker is gone never reaches anything at all. Neither is
   * recoverable at this hop — the page has already been told `publish()` succeeded,
   * and buffering here would just relocate the flood — so the least this layer owes an
   * operator is a count of what it threw away.
   */
  getCounters(): Record<string, number>;
  destroy(): void;
}

interface PendingRelay {
  settle: (result: RelayResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Create the page-to-worker relay.
 *
 * This is the security-critical component: it is the only thing that speaks to the
 * privileged service worker, and it runs in the extension's isolated world so page
 * scripts can neither read its state nor monkey-patch the references it captured.
 * It carries no product logic — it validates and forwards, nothing else.
 *
 * @internal Exposed for tests and for `startContentRelay`.
 * @param win - The page window to relay for.
 * @param chromeApi - Extension platform object.
 * @param options - Relay options.
 * @returns A handle for teardown.
 */
export function createContentRelay(
  win: PageWindowLike,
  chromeApi: ChromeLike,
  options: ContentRelayOptions = {}
): ContentRelay {
  const channel = options.channel ?? DEFAULT_CHANNEL;

  if (typeof channel !== 'string' || !CHANNEL_PATTERN.test(channel)) {
    throw new BridgeError('INSECURE_CONFIG', 'channel must match ^[a-zA-Z0-9._:-]{1,128}$');
  }

  const nextId = createIdFactory();
  const maxPayloadBytes = clampMaxPayloadBytes(options.maxPayloadBytes);
  const logger = createLogger({
    debug: options.debug === true,
    prefix: '[web-extension-bridge:content]',
    ...(options.logSink ? {sink: options.logSink} : {}),
  });

  // The relay owns the session token: it is minted in the isolated world at
  // document_start, before any page script has run.
  const session = nextId();
  const documentOrigin = win.location.origin;
  const pageSeenIds = new SeenIds();
  const runtimeSeenIds = new SeenIds();
  const counters = new Counters();
  const pushLimiter = new RateLimiter({
    ...(options.pushesPerSecond === undefined ? {} : {perSecond: options.pushesPerSecond}),
    ...(options.aggregatePushesPerSecond === undefined
      ? {}
      : {aggregatePerSecond: options.aggregatePushesPerSecond}),
  });
  const pending = new Map<string, PendingRelay>();

  let pageConnected = false;
  let destroyed = false;
  let reannounceTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * Consecutive `runtime.sendMessage` rejections. Reset by the first success.
   *
   * A single rejection is normal — an MV3 worker that has been evicted is revived by
   * the very message that failed, so the next one usually lands. A run of them is not:
   * it means the worker is not coming back for this page (extension reloaded, updated,
   * or disabled), and the page believing it is still connected is then simply wrong.
   */
  let consecutiveWorkerFailures = 0;

  const postToPage = (envelope: Envelope): void => {
    win.postMessage(envelope, documentOrigin);
  };

  const control = (kind: (typeof EnvelopeKind)[keyof typeof EnvelopeKind], token: string): void => {
    postToPage(
      createEnvelope({
        channel,
        kind,
        source: EnvelopeSource.EXTENSION,
        topic: CONTROL_TOPIC,
        id: nextId(),
        session: token,
      })
    );
  };

  const notifyWorker = (message: RelayToWorker): void => {
    // Best-effort by design: the worker may be evicted or still spinning up, and a
    // rejected sendMessage must never surface as an unhandled rejection in the page.
    //
    // "Best-effort" is not the same as "unobserved", though. Swallowing every
    // rejection meant that after an extension reload the page stayed `isConnected`
    // while nothing it published reached the worker — the one failure mode a consumer
    // has no way to detect from the outside. Each failure is now counted, and a run of
    // them tells the page it has been disconnected so `onDisconnected` fires and the
    // handshake can start again.
    void Promise.resolve(chromeApi.runtime.sendMessage(message)).then(
      () => {
        consecutiveWorkerFailures = 0;
      },
      (error: unknown) => {
        consecutiveWorkerFailures += 1;
        counters.increment(CounterName.RELAY_SEND_FAILED, message.kind);
        logger.warn('worker notification failed', {
          channel,
          kind: message.kind,
          count: consecutiveWorkerFailures,
          reason: error instanceof Error ? error.name : typeof error,
        });

        if (consecutiveWorkerFailures >= MAX_WORKER_NOTIFY_FAILURES) {
          // `markPageGone` re-enters `notifyWorker` with a DISCONNECT that will fail
          // too; the counter is cleared first so that failure cannot re-trigger this
          // branch and recurse.
          consecutiveWorkerFailures = 0;
          markPageGone('worker-unreachable', true);
        }
      }
    );
  };

  const relayMessage = (
    kind: RelayToWorker['kind'],
    extra: {envelope?: Envelope; reason?: string} = {}
  ): RelayToWorker => ({
    __webexBridgeRelay: true,
    channel,
    kind,
    session,
    ...extra,
  });

  const settlePending = (id: string, result: RelayResult): boolean => {
    const entry = pending.get(id);

    if (!entry) {
      // Unknown or already-settled correlation: a stale or forged response cannot
      // resolve a live request.
      return false;
    }

    pending.delete(id);
    clearTimeout(entry.timer);
    entry.settle(result);

    return true;
  };

  const markPageConnected = (): void => {
    if (pageConnected) {
      return;
    }

    pageConnected = true;
    logger.debug('page attached', {channel});
    notifyWorker(relayMessage(RelayKind.CONNECT));
  };

  /**
   * @param reason - Why the page is no longer considered attached.
   * @param tellPage - Whether the page needs to be told. `false` when the page is the
   *   one that said goodbye and already knows; `true` when the relay decided, in which
   *   case the page is still reporting `isConnected` and must be corrected.
   */
  const markPageGone = (reason: string, tellPage = false): void => {
    if (!pageConnected) {
      return;
    }

    pageConnected = false;
    logger.debug('page detached', {channel, reason});
    notifyWorker(relayMessage(RelayKind.DISCONNECT, {reason}));

    if (tellPage) {
      control(EnvelopeKind.BYE, session);
    }

    for (const id of [...pending.keys()]) {
      settlePending(id, {ok: false, error: toWireError(new BridgeError('DISCONNECTED'))});
    }
  };

  const onPageMessage = (event: PageMessageEvent): void => {
    if (destroyed) {
      return;
    }

    if (event.source !== win || event.origin !== documentOrigin) {
      return;
    }

    const result = validateEnvelope(event.data, {
      channel,
      expectedSource: EnvelopeSource.PAGE,
      session,
      maxPayloadBytes,
      now: Date.now(),
      allowedKinds: ACCEPTED_FROM_PAGE,
      seenIds: pageSeenIds,
    });

    if (!result.ok) {
      return;
    }

    const {envelope} = result;

    switch (envelope.kind) {
      case EnvelopeKind.HELLO:
        // The page came up after injection and is asking for a token.
        control(EnvelopeKind.HELLO_ACK, session);
        markPageConnected();
        break;

      case EnvelopeKind.HELLO_ACK:
        markPageConnected();
        break;

      case EnvelopeKind.PUSH:
        if (!pushLimiter.allow(rateLimitKey(undefined, envelope.topic))) {
          // Counted, not just logged. `publish()` has already returned to the page by
          // the time the envelope arrives here, so there is nothing left to propagate
          // backpressure to; a counter is the only way an operator can tell a quiet
          // page from a throttled one. See the delivery-guarantee table in the README.
          counters.increment(CounterName.RELAY_DROPPED, 'RATE_LIMITED');
          logger.warn('push rate limited', {channel, topic: envelope.topic});
          break;
        }
        markPageConnected();
        notifyWorker(relayMessage(RelayKind.PUSH, {envelope}));
        break;

      case EnvelopeKind.RESPONSE:
        if (envelope.correlationId !== null) {
          settlePending(envelope.correlationId, {ok: true, envelope});
        }
        break;

      case EnvelopeKind.BYE:
        markPageGone('bye');
        break;

      default:
        break;
    }
  };

  const serveRelayRequest = (request: RelayRequest, sendResponse: SendResponse): boolean => {
    const validated = validateEnvelope(request.envelope, {
      channel,
      expectedSource: EnvelopeSource.EXTENSION,
      session,
      maxPayloadBytes,
      now: Date.now(),
      allowedKinds: [EnvelopeKind.REQUEST],
      seenIds: runtimeSeenIds,
    });

    if (!validated.ok) {
      const rejected: RelayResult = {
        ok: false,
        error: toWireError(new BridgeError('INVALID_PAYLOAD')),
      };

      sendResponse(rejected);

      return false;
    }

    if (!pageConnected) {
      const rejected: RelayResult = {
        ok: false,
        error: toWireError(new BridgeError('NOT_CONNECTED')),
      };

      sendResponse(rejected);

      return false;
    }

    const {envelope} = validated;
    let settled = false;
    const settle = (result: RelayResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      sendResponse(result);
    };

    // Second timer. The worker arms one too, so neither side can be left waiting if
    // the other disappears mid-flight.
    const timer = setTimeout(() => {
      pending.delete(envelope.id);
      settle({ok: false, error: toWireError(new BridgeError('TIMEOUT'))});
    }, request.timeoutMs);

    pending.set(envelope.id, {settle, timer});
    postToPage(envelope);

    return true;
  };

  const onRuntimeMessage = (
    message: unknown,
    sender: ChromeSender,
    sendResponse: SendResponse
  ): boolean | void => {
    if (destroyed) {
      return undefined;
    }

    // Only the service worker and our own extension pages may drive the relay. A
    // content script in another tab must not be able to reach this one.
    if (!isFromExtensionPage(chromeApi, sender)) {
      return undefined;
    }

    const request = asRelayRequest(message, channel);

    if (!request) {
      return undefined;
    }

    // `true` keeps the response channel open for the asynchronous settle.
    return serveRelayRequest(request, sendResponse);
  };

  win.addEventListener('message', onPageMessage);
  chromeApi.runtime.onMessage.addListener(onRuntimeMessage);

  // Announce immediately, then once more shortly after, so a page bridge constructed
  // after document_start still receives a token without polling.
  control(EnvelopeKind.HELLO, session);
  reannounceTimer = setTimeout(() => {
    reannounceTimer = undefined;

    if (!destroyed && !pageConnected) {
      control(EnvelopeKind.HELLO, session);
    }
  }, HELLO_REANNOUNCE_DELAY_MS);

  const relay: ContentRelay = {
    session,

    getCounters(): Record<string, number> {
      return counters.snapshot();
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;

      if (reannounceTimer !== undefined) {
        clearTimeout(reannounceTimer);
        reannounceTimer = undefined;
      }

      markPageGone('relay-destroyed', true);
      win.removeEventListener('message', onPageMessage);
      chromeApi.runtime.onMessage.removeListener(onRuntimeMessage);
      pageSeenIds.clear();
      runtimeSeenIds.clear();
      forgetStartedRelay(relay);
    },
  };

  return relay;
}

const started = new Map<string, ContentRelay>();

/**
 * Drop a destroyed relay from the started registry.
 *
 * Without this, `destroy()` unhooked the listeners but left the handle in the map, so
 * the next `startContentRelay()` for that channel handed back the dead relay instead
 * of building a live one — no listeners, no handshake, silently forwarding nothing.
 * That is the normal path during extension hot-reload in development, where the whole
 * point of calling `destroy()` is to start again.
 *
 * Matched by identity, not by channel, so a relay destroyed after its channel has
 * already been re-registered cannot evict its replacement.
 *
 * @param relay - The relay being torn down.
 */
function forgetStartedRelay(relay: ContentRelay): void {
  for (const [channel, candidate] of started) {
    if (candidate === relay) {
      started.delete(channel);

      return;
    }
  }
}

/**
 * Start the relay for the ambient page and extension context.
 *
 * @param options - Relay options.
 * @returns The relay, or the existing one when this channel is already relayed.
 */
export function startContentRelay(options: ContentRelayOptions = {}): ContentRelay {
  const channel = options.channel ?? DEFAULT_CHANNEL;
  const existing = started.get(channel);

  if (existing) {
    return existing;
  }

  const relay = createContentRelay(resolvePageWindow(), resolveChrome(), options);

  started.set(channel, relay);

  return relay;
}
