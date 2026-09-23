import {RESERVED_KEYS, TOPIC_PATTERN} from './constants';
import {BridgeError} from './errors';
import {JsonRejection, inspectJson} from './json';
import type {JsonValue} from './json';

let encoder: TextEncoder | undefined;

/**
 * @param text - String to measure.
 * @returns UTF-8 byte length. Size caps are specified in bytes, not code units,
 *   because a 256 KiB cap measured in `length` admits a 768 KiB message.
 * @throws BridgeError `INSECURE_CONFIG` when the host has no `TextEncoder`.
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
 * Check a payload against every rule that must hold on both send and receive: the
 * {@link JsonValue} grammar, the byte cap, reserved keys, and the depth bound (T5, T9).
 *
 * The structural walk runs *before* `JSON.stringify`, not after — a successful
 * stringify isn't evidence the payload is transportable, since it silently drops
 * functions/`undefined`/symbols and turns `NaN`/`Infinity` into `null` while the
 * bridge would still send the *original* object.
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
    // Belt-and-braces: `inspectJson` shouldn't be able to throw (it refuses accessors
    // without invoking them), but if it ever did, this keeps the failure a BridgeError
    // instead of an arbitrary exception escaping a message handler.
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
 * @throws BridgeError `INVALID_PAYLOAD` when the payload fails any check.
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
 * @throws BridgeError `INVALID_TOPIC` when the topic fails the charset or length rule.
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
