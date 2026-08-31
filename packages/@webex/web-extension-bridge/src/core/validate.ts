import {
  CLOCK_SKEW_TOLERANCE_MS,
  ENVELOPE_MARKER,
  MAX_ID_LENGTH,
  PROTOCOL_VERSION,
  RESERVED_KEYS,
} from './constants';
import {readOwn} from './json';
import {ENVELOPE_KINDS, EnvelopeKind} from './protocol';
import type {Envelope, EnvelopeSource} from './protocol';
import {isWithinClockSkew} from './replay';
import type {SeenIds} from './replay';
import {PayloadRejection, checkPayload, isValidTopic} from './serialize';

/**
 * Why an envelope was dropped. Every rule in the spec's validation list has its own
 * reason, so drops are countable and debuggable without ever logging a payload.
 */
export const DropReason = {
  NOT_AN_ENVELOPE: 'NOT_AN_ENVELOPE',
  RESERVED_KEY: 'RESERVED_KEY',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  CHANNEL_MISMATCH: 'CHANNEL_MISMATCH',
  UNKNOWN_KIND: 'UNKNOWN_KIND',
  KIND_NOT_ALLOWED: 'KIND_NOT_ALLOWED',
  INVALID_SOURCE: 'INVALID_SOURCE',
  INVALID_ID: 'INVALID_ID',
  INVALID_CORRELATION_ID: 'INVALID_CORRELATION_ID',
  INVALID_TOPIC: 'INVALID_TOPIC',
  SESSION_MISMATCH: 'SESSION_MISMATCH',
  CLOCK_SKEW: 'CLOCK_SKEW',
  REPLAYED_ID: 'REPLAYED_ID',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  PAYLOAD_NOT_SERIALISABLE: 'PAYLOAD_NOT_SERIALISABLE',
  PAYLOAD_TOO_DEEP: 'PAYLOAD_TOO_DEEP',
  INVALID_RESULT: 'INVALID_RESULT',
  INVALID_ERROR: 'INVALID_ERROR',
} as const;

export type DropReason = (typeof DropReason)[keyof typeof DropReason];

export interface ValidateContext {
  /** Channel this hop is configured for. */
  channel: string;
  /** Source tag the peer must carry. Each side ignores its own broadcasts. */
  expectedSource: EnvelopeSource;
  /**
   * Established session token, or `null` before the handshake completes. Every kind
   * except `HELLO` must carry a matching token.
   */
  session: string | null;
  maxPayloadBytes: number;
  /** Local time, injected so clock-skew behaviour is testable. */
  now: number;
  /** Kinds this hop accepts. A hop that forwards only pushes must not accept requests. */
  allowedKinds?: readonly EnvelopeKind[];
  /** Single-use id cache. Omit to skip replay detection (for example on a fresh hop). */
  seenIds?: SeenIds;
  clockSkewToleranceMs?: number;
}

export type ValidationResult = {ok: true; envelope: Envelope} | {ok: false; reason: DropReason};

const drop = (reason: DropReason): ValidationResult => ({ok: false, reason});

const KIND_SET = new Set<string>(ENVELOPE_KINDS);

/** The complete key set of a {@link WireError}. Anything else is not one. */
const WIRE_ERROR_KEYS = new Set<string>(['code', 'message']);

/**
 * Validate the `error` sub-object of a failed `RESPONSE`.
 *
 * `fromWireError` already refuses to trust an unrecognised `code`, so this is not the
 * only thing standing between a hostile peer and a consumer's `switch`. It is here so
 * the validator enforces the whole wire contract in one place: a `RESPONSE` that does
 * not carry a well-formed error is malformed, and a malformed envelope should be
 * dropped and counted at the boundary rather than quietly normalised three hops later.
 * Unknown keys are rejected too, so an error object cannot be used to smuggle fields
 * past the envelope-level key checks.
 *
 * @param value - The `error` field of an inbound `RESPONSE`.
 * @returns Whether it is a well-formed `{code, message}` pair.
 */
function isValidWireError(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    if (RESERVED_KEYS.includes(key) || !WIRE_ERROR_KEYS.has(key)) {
      return false;
    }
  }

  const code = readOwn(value, 'code');

  if (typeof code !== 'string' || code.length < 1 || code.length > MAX_ID_LENGTH) {
    return false;
  }

  const message = readOwn(value, 'message');

  return message === undefined || (typeof message === 'string' && message.length <= MAX_ID_LENGTH);
}

/**
 * Validate an inbound value against every protocol rule.
 *
 * This runs at every hop — page inbound, content script inbound from the page,
 * content script inbound from the runtime, service worker inbound. No hop trusts an
 * upstream hop's validation, because a hop can be reached without passing through
 * the one before it.
 *
 * @param value - Untrusted inbound value.
 * @param context - What this hop expects.
 * @returns The typed envelope, or the reason it was dropped.
 */
export function validateEnvelope(value: unknown, context: ValidateContext): ValidationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return drop(DropReason.NOT_AN_ENVELOPE);
  }

  if (readOwn(value, ENVELOPE_MARKER) !== true) {
    return drop(DropReason.NOT_AN_ENVELOPE);
  }

  // Rule 11: reserved names must not appear as envelope keys at all. Checked before
  // any field is read, so a poisoned key cannot influence the reads below.
  for (const key of Object.getOwnPropertyNames(value)) {
    if (RESERVED_KEYS.includes(key)) {
      return drop(DropReason.RESERVED_KEY);
    }
  }

  if (readOwn(value, 'v') !== PROTOCOL_VERSION) {
    return drop(DropReason.VERSION_MISMATCH);
  }

  if (readOwn(value, 'channel') !== context.channel) {
    return drop(DropReason.CHANNEL_MISMATCH);
  }

  const kind = readOwn(value, 'kind');

  if (typeof kind !== 'string' || !KIND_SET.has(kind)) {
    return drop(DropReason.UNKNOWN_KIND);
  }

  if (context.allowedKinds && !context.allowedKinds.includes(kind as EnvelopeKind)) {
    return drop(DropReason.KIND_NOT_ALLOWED);
  }

  if (readOwn(value, 'source') !== context.expectedSource) {
    return drop(DropReason.INVALID_SOURCE);
  }

  const id = readOwn(value, 'id');

  if (typeof id !== 'string' || id.length < 1 || id.length > MAX_ID_LENGTH) {
    return drop(DropReason.INVALID_ID);
  }

  const correlationId = readOwn(value, 'correlationId');

  if (
    correlationId !== null &&
    (typeof correlationId !== 'string' ||
      correlationId.length < 1 ||
      correlationId.length > MAX_ID_LENGTH)
  ) {
    return drop(DropReason.INVALID_CORRELATION_ID);
  }

  // Only a `RESPONSE` correlates to anything. A `REQUEST`, `PUSH` or handshake kind
  // carrying a correlation id is either a peer that does not implement the protocol
  // or an attempt to have a downstream hop treat one kind as a reply to another, so
  // the field is required to be null rather than merely ignored.
  if (kind !== EnvelopeKind.RESPONSE && correlationId !== null) {
    return drop(DropReason.INVALID_CORRELATION_ID);
  }

  const topic = readOwn(value, 'topic');

  if (!isValidTopic(topic)) {
    return drop(DropReason.INVALID_TOPIC);
  }

  const session = readOwn(value, 'session');

  if (typeof session !== 'string' || session.length > MAX_ID_LENGTH) {
    return drop(DropReason.SESSION_MISMATCH);
  }

  // Handshake kinds are what establish a session, so they are the only ones that may
  // precede it. `HELLO` stays exempt after that too, because a new token means the peer
  // restarted; `HELLO_ACK` does not, so an established session cannot be switched by an
  // acknowledgement nobody asked for.
  const establishesSession =
    kind === EnvelopeKind.HELLO || (kind === EnvelopeKind.HELLO_ACK && context.session === null);

  if (!establishesSession && (context.session === null || session !== context.session)) {
    return drop(DropReason.SESSION_MISMATCH);
  }

  const ts = readOwn(value, 'ts');

  if (
    !isWithinClockSkew(ts, context.now, context.clockSkewToleranceMs ?? CLOCK_SKEW_TOLERANCE_MS)
  ) {
    return drop(DropReason.CLOCK_SKEW);
  }

  const payloadCheck = checkPayload(readOwn(value, 'payload'), context.maxPayloadBytes);

  if (!payloadCheck.ok) {
    if (payloadCheck.rejection === PayloadRejection.TOO_LARGE) {
      return drop(DropReason.PAYLOAD_TOO_LARGE);
    }

    if (payloadCheck.rejection === PayloadRejection.RESERVED_KEY) {
      return drop(DropReason.RESERVED_KEY);
    }

    if (payloadCheck.rejection === PayloadRejection.TOO_DEEP) {
      return drop(DropReason.PAYLOAD_TOO_DEEP);
    }

    return drop(DropReason.PAYLOAD_NOT_SERIALISABLE);
  }

  if (kind === EnvelopeKind.RESPONSE) {
    const ok = readOwn(value, 'ok');

    if (typeof ok !== 'boolean') {
      return drop(DropReason.INVALID_RESULT);
    }

    if (correlationId === null) {
      return drop(DropReason.INVALID_CORRELATION_ID);
    }

    if (ok === false && !isValidWireError(readOwn(value, 'error'))) {
      return drop(DropReason.INVALID_ERROR);
    }
  }

  // Replay detection runs last: a message that fails an earlier rule must not
  // consume a cache slot, or a flood of malformed ids would evict live ones.
  if (context.seenIds && !context.seenIds.accept(id)) {
    return drop(DropReason.REPLAYED_ID);
  }

  return {ok: true, envelope: value as Envelope};
}
