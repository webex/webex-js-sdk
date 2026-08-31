import {RESERVED_KEYS, TOPIC_PATTERN} from './constants';
import {BridgeError} from './errors';
import {JsonRejection, inspectJson} from './json';
import type {JsonValue} from './json';

let encoder: TextEncoder | undefined;

/**
 * @param text - String to measure.
 * @returns UTF-8 byte length. Size caps are specified in bytes, not code units,
 *   because a 256 KiB cap measured in `length` admits a 768 KiB message.
 */
export function utf8ByteLength(text: string): number {
  if (typeof TextEncoder === 'undefined') {
    throw new BridgeError('INSECURE_CONFIG', 'TextEncoder is required to measure payload size');
  }

  if (!encoder) {
    encoder = new TextEncoder();
  }

  return encoder.encode(text).length;
}

export const PayloadRejection = {
  NOT_SERIALISABLE: 'NOT_SERIALISABLE',
  TOO_LARGE: 'TOO_LARGE',
  RESERVED_KEY: 'RESERVED_KEY',
  /** Nested past {@link MAX_WALK_DEPTH}, so the value could not be fully validated. */
  TOO_DEEP: 'TOO_DEEP',
} as const;

export type PayloadRejection = (typeof PayloadRejection)[keyof typeof PayloadRejection];

export type PayloadCheck =
  | {ok: true; bytes: number}
  | {ok: false; rejection: PayloadRejection; key?: string};

/** Maps a structural rejection onto the payload-level vocabulary. */
const REJECTION_FOR = new Map<JsonRejection, PayloadRejection>([
  [JsonRejection.NOT_JSON, PayloadRejection.NOT_SERIALISABLE],
  [JsonRejection.CYCLE, PayloadRejection.NOT_SERIALISABLE],
  [JsonRejection.RESERVED_KEY, PayloadRejection.RESERVED_KEY],
  [JsonRejection.TOO_DEEP, PayloadRejection.TOO_DEEP],
  [JsonRejection.TOO_LARGE, PayloadRejection.TOO_LARGE],
]);

/**
 * Check a payload against everything that must hold on both send and receive:
 * inside the {@link JsonValue} grammar, within the byte cap, free of reserved keys,
 * and within the depth bound (T5, T9).
 *
 * The structural walk runs *before* `JSON.stringify`, not after. A stringify that
 * returns a string is not evidence the payload is transportable: nested functions,
 * `undefined` and symbol values are dropped, `NaN`/`Infinity` become `null`, and the
 * bridge would go on to send the *original* object — which then either throws
 * `DataCloneError` inside `postMessage` or arrives at a handler holding values the
 * `JsonValue` contract says cannot occur.
 *
 * @param payload - Candidate payload. `undefined` is allowed and costs no bytes.
 * @param maxBytes - Already-clamped byte cap.
 * @returns A discriminated result, so callers can choose to throw or to drop.
 */
export function checkPayload(payload: unknown, maxBytes: number): PayloadCheck {
  if (payload === undefined) {
    return {ok: true, bytes: 0};
  }

  let structure;

  try {
    // The byte cap doubles as the expanded-node budget. Every JSON node costs at least
    // one byte of output, so a value whose expansion exceeds `maxBytes` nodes cannot
    // stringify inside `maxBytes` — and refusing it here is what keeps the
    // `JSON.stringify` below bounded, since stringify expands shared references and a
    // small DAG can expand exponentially.
    structure = inspectJson(payload, RESERVED_KEYS, maxBytes);
  } catch {
    // `inspectJson` refuses accessors without invoking them, so nothing in a payload
    // should be able to run code here. This guard exists because the alternative to
    // being wrong about that is an arbitrary exception escaping a message handler and
    // past the documented "always a BridgeError" contract.
    return {ok: false, rejection: PayloadRejection.NOT_SERIALISABLE};
  }

  if (!structure.ok) {
    const rejection = REJECTION_FOR.get(structure.rejection) ?? PayloadRejection.NOT_SERIALISABLE;

    return structure.key === undefined
      ? {ok: false, rejection}
      : {ok: false, rejection, key: structure.key};
  }

  let serialised: string;

  try {
    serialised = JSON.stringify(payload) as string;
  } catch {
    // Unreachable for a value that passed `inspectJson`, kept as a belt-and-braces
    // guard against a host `JSON` implementation that throws for its own reasons.
    return {ok: false, rejection: PayloadRejection.NOT_SERIALISABLE};
  }

  if (typeof serialised !== 'string') {
    return {ok: false, rejection: PayloadRejection.NOT_SERIALISABLE};
  }

  const bytes = utf8ByteLength(serialised);

  if (bytes > maxBytes) {
    return {ok: false, rejection: PayloadRejection.TOO_LARGE};
  }

  return {ok: true, bytes};
}

/**
 * Throwing form of {@link checkPayload}, for the outbound path.
 *
 * `publish` and `request` fail loudly on a bad payload rather than dropping it, so
 * a consumer never believes a message was sent when it was not.
 *
 * @param payload - Candidate payload.
 * @param maxBytes - Already-clamped byte cap.
 * @param topic - Topic, for the error.
 */
export function assertPayload(payload: unknown, maxBytes: number, topic?: string): void {
  const result = checkPayload(payload, maxBytes);

  if (!result.ok) {
    throw new BridgeError('INVALID_PAYLOAD', `Payload rejected: ${result.rejection}`, topic);
  }
}

/**
 * @param topic - Candidate topic.
 * @returns Whether the topic matches the protocol charset and length rule.
 */
export function isValidTopic(topic: unknown): topic is string {
  return typeof topic === 'string' && TOPIC_PATTERN.test(topic);
}

/**
 * Throwing form of {@link isValidTopic}, for the outbound path.
 *
 * @param topic - Candidate topic.
 */
export function assertTopic(topic: unknown): void {
  if (!isValidTopic(topic)) {
    throw new BridgeError('INVALID_TOPIC', 'Topic must match ^[a-zA-Z0-9._:-]{1,128}$');
  }
}

/**
 * Narrow an already-validated payload for the public handler signature.
 *
 * @param payload - Payload that passed {@link checkPayload}.
 * @returns The same value, typed as JSON.
 */
export function asJsonValue(payload: unknown): JsonValue {
  return payload as JsonValue;
}
