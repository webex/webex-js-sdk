import {RESERVED_KEYS, TOPIC_PATTERN} from './constants';
import {BridgeError} from './errors';
import {findReservedKey} from './json';
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
} as const;

export type PayloadRejection = (typeof PayloadRejection)[keyof typeof PayloadRejection];

export type PayloadCheck =
  | {ok: true; bytes: number}
  | {ok: false; rejection: PayloadRejection; key?: string};

/**
 * Check a payload against everything that must hold on both send and receive:
 * serialisable, within the byte cap, and free of reserved keys (T5, T9).
 *
 * @param payload - Candidate payload. `undefined` is allowed and costs no bytes.
 * @param maxBytes - Already-clamped byte cap.
 * @returns A discriminated result, so callers can choose to throw or to drop.
 */
export function checkPayload(payload: unknown, maxBytes: number): PayloadCheck {
  if (payload === undefined) {
    return {ok: true, bytes: 0};
  }

  let serialised: string;

  try {
    serialised = JSON.stringify(payload) as string;
  } catch {
    // Circular structures and BigInt land here.
    return {ok: false, rejection: PayloadRejection.NOT_SERIALISABLE};
  }

  if (typeof serialised !== 'string') {
    // `undefined`, functions and symbols serialise to `undefined`.
    return {ok: false, rejection: PayloadRejection.NOT_SERIALISABLE};
  }

  const bytes = utf8ByteLength(serialised);

  if (bytes > maxBytes) {
    return {ok: false, rejection: PayloadRejection.TOO_LARGE};
  }

  const reserved = findReservedKey(payload, RESERVED_KEYS);

  if (reserved !== undefined) {
    return {ok: false, rejection: PayloadRejection.RESERVED_KEY, key: reserved};
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
