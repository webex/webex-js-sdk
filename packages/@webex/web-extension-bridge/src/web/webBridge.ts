import {CONTROL_TOPIC} from '../core/constants';
import {Counters, CounterName} from '../core/counters';
import {BridgeError, toWireError} from '../core/errors';
import {createIdFactory} from '../core/ids';
import type {IdFactory} from '../core/ids';
import type {JsonValue} from '../core/json';
import {ListenerSet} from '../core/listeners';
import {createLogger} from '../core/logger';
import type {BridgeLogger} from '../core/logger';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../core/protocol';
import type {Envelope} from '../core/protocol';
import {SeenIds} from '../core/replay';
import {asJsonValue, assertPayload, assertTopic} from '../core/serialize';
import {validateEnvelope} from '../core/validate';
import type {DropReason} from '../core/validate';
import {resolveWebConfig} from './config';
import type {ResolvedWebConfig} from './config';
import {resolvePageWindow} from './pageWindow';
import type {PageMessageEvent, PageWindowLike} from './pageWindow';
import type {
  HandlerOptions,
  RequestHandler,
  RequestMeta,
  WebBridge,
  WebBridgeOptions,
} from '../types';

/** Kinds the page accepts from the extension. A page never receives a push or a response. */
const ACCEPTED_KINDS = [
  EnvelopeKind.HELLO,
  EnvelopeKind.HELLO_ACK,
  EnvelopeKind.REQUEST,
  EnvelopeKind.BYE,
] as const;

interface HandlerEntry {
  handler: RequestHandler;
  validate?: (payload: JsonValue) => boolean;
}

/**
 * Create the page-side bridge.
 *
 * @param options - Bridge options. Insecure values are rejected here, not later.
 * @returns The bridge.
 */
export function createWebBridge(options?: WebBridgeOptions): WebBridge {
  return createWebBridgeWith(resolvePageWindow(), options);
}

/**
 * @internal Test seam. Accepts a simulated window so the origin, `event.source` and
 *   session rules can be exercised without a real DOM.
 *
 * @param win - Window to attach to.
 * @param options - Bridge options.
 * @returns The bridge.
 */
export function createWebBridgeWith(
  win: PageWindowLike,
  options: WebBridgeOptions = {}
): WebBridge {
  const config: ResolvedWebConfig = resolveWebConfig(win, options);
  const nextId: IdFactory = createIdFactory();
  const logger: BridgeLogger = createLogger({
    debug: config.debug,
    ...(config.logSink ? {sink: config.logSink} : {}),
  });
  const counters = new Counters();
  const handlers = new Map<string, HandlerEntry>();
  const seenIds = new SeenIds();
  const onConnectedListeners = new ListenerSet<() => void>({
    onError: (error) => logger.warn('onConnected listener threw', {reason: describe(error)}),
  });
  const onDisconnectedListeners = new ListenerSet<(reason: string) => void>({
    onError: (error) => logger.warn('onDisconnected listener threw', {reason: describe(error)}),
  });

  let session: string | null = null;
  let connected = false;
  let destroyed = false;

  const send = (envelope: Envelope): void => {
    try {
      win.postMessage(envelope, config.targetOrigin);
    } catch (error) {
      // Payload validation should have caught anything the structured clone algorithm
      // will refuse, so reaching here means validation and the clone disagree. Rather
      // than let a raw `DataCloneError` — or, for an exotic object, an error thrown from
      // inside the caller's own code during cloning — escape as the only exception
      // `publish()` ever raises that is not a `BridgeError`, it is normalised. The
      // documented contract is that every failure out of this API is coded.
      counters.increment(CounterName.DROPPED, 'CLONE_FAILED');
      logger.warn('postMessage refused the envelope', {
        channel: config.channel,
        kind: envelope.kind,
        topic: envelope.topic,
        reason: describe(error),
      });

      throw new BridgeError(
        'INVALID_PAYLOAD',
        'The payload could not be transferred to the extension',
        envelope.topic
      );
    }
  };

  const control = (kind: (typeof EnvelopeKind)[keyof typeof EnvelopeKind], token: string): void => {
    send(
      createEnvelope({
        channel: config.channel,
        kind,
        source: EnvelopeSource.PAGE,
        topic: CONTROL_TOPIC,
        id: nextId(),
        session: token,
      })
    );
  };

  const markConnected = (token: string): void => {
    if (connected && session === token) {
      return;
    }

    if (connected && session !== token) {
      // A new token means a new content script: the old peer is gone.
      markDisconnected('session-replaced');
    }

    session = token;
    seenIds.clear();
    connected = true;
    logger.debug('connected', {channel: config.channel});
    onConnectedListeners.emit();
  };

  function markDisconnected(reason: string): void {
    if (!connected) {
      return;
    }

    connected = false;
    session = null;
    logger.debug('disconnected', {channel: config.channel, reason});
    onDisconnectedListeners.emit(reason);
  }

  const drop = (reason: DropReason | string): void => {
    counters.increment(CounterName.DROPPED, reason);
    // Deliberately not logged: a page receives unrelated postMessage traffic
    // constantly, so logging every miss is noise and a log-flood vector.
  };

  const respond = (
    request: Envelope,
    result: {ok: true; payload: JsonValue} | {ok: false; cause: unknown}
  ): void => {
    if (session === null) {
      return;
    }

    send(
      createEnvelope({
        channel: config.channel,
        kind: EnvelopeKind.RESPONSE,
        source: EnvelopeSource.PAGE,
        topic: request.topic,
        id: nextId(),
        correlationId: request.id,
        session,
        ...(result.ok
          ? {ok: true, payload: result.payload}
          : {ok: false, error: toWireError(result.cause)}),
      })
    );
  };

  const serveRequest = async (request: Envelope): Promise<void> => {
    const entry = handlers.get(request.topic);

    if (!entry) {
      counters.increment(CounterName.REQUEST_FAILED, 'NO_HANDLER');
      respond(request, {ok: false, cause: new BridgeError('NO_HANDLER', undefined, request.topic)});

      return;
    }

    const payload = asJsonValue(request.payload ?? null);

    if (entry.validate) {
      let valid = false;

      try {
        valid = entry.validate(payload) === true;
      } catch {
        valid = false;
      }

      if (!valid) {
        counters.increment(CounterName.REQUEST_FAILED, 'INVALID_PAYLOAD');
        respond(request, {
          ok: false,
          cause: new BridgeError('INVALID_PAYLOAD', undefined, request.topic),
        });

        return;
      }
    }

    const meta: RequestMeta = Object.freeze({
      topic: request.topic,
      messageId: request.id,
      receivedAt: Date.now(),
    });

    try {
      const result = await entry.handler(payload, meta);

      // The handler's own output is checked too: an oversized or circular return
      // value must fail as INVALID_PAYLOAD rather than throwing inside postMessage.
      assertPayload(result, config.maxPayloadBytes, request.topic);
      counters.increment(CounterName.REQUEST_SERVED, request.topic);
      respond(request, {ok: true, payload: result ?? null});
    } catch (cause) {
      counters.increment(CounterName.REQUEST_FAILED, request.topic);
      logger.debug('handler failed', {topic: request.topic, id: request.id});
      respond(request, {ok: false, cause});
    }
  };

  const onMessage = (event: PageMessageEvent): void => {
    if (destroyed) {
      return;
    }

    // Same-window only: blocks a hostile iframe or opener from speaking the protocol.
    if (event.source !== win) {
      drop('NOT_SAME_WINDOW');

      return;
    }

    if (typeof event.origin !== 'string' || !config.allowedOrigins.has(event.origin)) {
      drop('ORIGIN_NOT_ALLOWED');

      return;
    }

    const result = validateEnvelope(event.data, {
      channel: config.channel,
      expectedSource: EnvelopeSource.EXTENSION,
      session,
      maxPayloadBytes: config.maxPayloadBytes,
      now: Date.now(),
      allowedKinds: ACCEPTED_KINDS,
      seenIds,
    });

    if (!result.ok) {
      drop(result.reason);

      return;
    }

    const {envelope} = result;

    switch (envelope.kind) {
      case EnvelopeKind.HELLO:
        if (envelope.session.length === 0) {
          drop('SESSION_MISMATCH');

          return;
        }
        markConnected(envelope.session);
        control(EnvelopeKind.HELLO_ACK, envelope.session);
        break;

      case EnvelopeKind.HELLO_ACK:
        if (envelope.session.length === 0) {
          drop('SESSION_MISMATCH');

          return;
        }
        markConnected(envelope.session);
        break;

      case EnvelopeKind.REQUEST:
        void serveRequest(envelope);
        break;

      case EnvelopeKind.BYE:
        markDisconnected('peer-left');
        break;

      default:
        drop('KIND_NOT_ALLOWED');
    }
  };

  const onPageHide = (): void => {
    if (destroyed || session === null) {
      return;
    }

    control(EnvelopeKind.BYE, session);
    markDisconnected('pagehide');
  };

  win.addEventListener('message', onMessage);
  win.addEventListener('pagehide', onPageHide);

  // Announce ourselves in case the content script was injected before this bridge
  // existed. HELLO is the one kind that may carry an empty session, since it is what
  // asks for one.
  control(EnvelopeKind.HELLO, '');

  const bridge: WebBridge = {
    publish(topic: string, payload?: JsonValue): void {
      if (destroyed) {
        throw new BridgeError('NOT_CONNECTED', 'The bridge has been destroyed');
      }

      assertTopic(topic);
      assertPayload(payload, config.maxPayloadBytes, topic);

      if (!connected || session === null) {
        throw new BridgeError('NOT_CONNECTED', undefined, topic);
      }

      send(
        createEnvelope({
          channel: config.channel,
          kind: EnvelopeKind.PUSH,
          source: EnvelopeSource.PAGE,
          topic,
          id: nextId(),
          session,
          ...(payload === undefined ? {} : {payload}),
        })
      );
      counters.increment(CounterName.PUSH_SENT, topic);
    },

    requestHandler(topic: string, handler: RequestHandler, opts: HandlerOptions = {}): () => void {
      assertTopic(topic);

      if (typeof handler !== 'function') {
        throw new BridgeError('INSECURE_CONFIG', 'handler must be a function', topic);
      }

      if (handlers.has(topic) && opts.replace !== true) {
        throw new BridgeError(
          'INSECURE_CONFIG',
          `A handler for '${topic}' is already registered. Pass {replace: true} to replace it.`,
          topic
        );
      }

      const entry: HandlerEntry = {handler};

      if (opts.validate) {
        entry.validate = opts.validate;
      }

      handlers.set(topic, entry);

      return () => {
        if (handlers.get(topic) === entry) {
          handlers.delete(topic);
        }
      };
    },

    onConnected(listener: () => void): () => void {
      const off = onConnectedListeners.add(listener);

      if (connected) {
        try {
          listener();
        } catch (error) {
          logger.warn('onConnected listener threw', {reason: describe(error)});
        }
      }

      return off;
    },

    onDisconnected(listener: (reason: string) => void): () => void {
      return onDisconnectedListeners.add(listener);
    },

    get isConnected(): boolean {
      return connected;
    },

    getCounters(): Record<string, number> {
      return counters.snapshot();
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      if (session !== null) {
        control(EnvelopeKind.BYE, session);
      }

      destroyed = true;
      win.removeEventListener('message', onMessage);
      win.removeEventListener('pagehide', onPageHide);
      markDisconnected('destroyed');
      onConnectedListeners.clear();
      onDisconnectedListeners.clear();
      handlers.clear();
      seenIds.clear();
    },
  };

  return bridge;
}

/**
 * @param error - Anything thrown by consumer code.
 * @returns A short, non-leaking descriptor for a local log line.
 */
function describe(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
