import {readOwn} from './json';

/**
 * Stable, machine-readable failure codes. These are part of the public API
 * contract and must not change meaning within a major version.
 */
export type BridgeErrorCode =
  | 'NOT_CONNECTED'
  | 'NO_TAB'
  | 'NO_HANDLER'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'ABORTED'
  | 'HANDLER_ERROR'
  | 'INVALID_PAYLOAD'
  | 'INVALID_TOPIC'
  | 'RATE_LIMITED'
  | 'PROTOCOL_MISMATCH'
  | 'INSECURE_CONFIG'
  | 'CRYPTO_UNAVAILABLE';

export const BRIDGE_ERROR_CODES: readonly BridgeErrorCode[] = [
  'NOT_CONNECTED',
  'NO_TAB',
  'NO_HANDLER',
  'TIMEOUT',
  'DISCONNECTED',
  'ABORTED',
  'HANDLER_ERROR',
  'INVALID_PAYLOAD',
  'INVALID_TOPIC',
  'RATE_LIMITED',
  'PROTOCOL_MISMATCH',
  'INSECURE_CONFIG',
  'CRYPTO_UNAVAILABLE',
];

const KNOWN_CODES = new Set<string>(BRIDGE_ERROR_CODES);

/**
 * Messages that are safe to send across a trust boundary: fixed strings keyed by
 * code, containing nothing derived from a handler, a payload or a stack (T6).
 */
const REDACTED_MESSAGES = new Map<BridgeErrorCode, string>([
  ['NOT_CONNECTED', 'No bridge is attached in the target tab'],
  ['NO_TAB', 'No target tab could be resolved'],
  ['NO_HANDLER', 'No handler is registered for this topic'],
  ['TIMEOUT', 'The peer did not respond in time'],
  ['DISCONNECTED', 'The peer went away before the request settled'],
  ['ABORTED', 'The request was aborted by the caller'],
  ['HANDLER_ERROR', 'The handler failed'],
  ['INVALID_PAYLOAD', 'The payload failed validation'],
  ['INVALID_TOPIC', 'The topic failed validation'],
  ['RATE_LIMITED', 'The message was rejected by the rate limiter'],
  ['PROTOCOL_MISMATCH', 'The peer runs an incompatible protocol version'],
  ['INSECURE_CONFIG', 'The configuration was rejected'],
  ['CRYPTO_UNAVAILABLE', 'No cryptographically secure random source is available'],
]);

/** A coded error, redacted to `{code, message}`, as carried on a `RESPONSE` envelope. */
export interface WireError {
  code: BridgeErrorCode;
  message: string;
}

/**
 * The single error type every bridge rejection surfaces.
 */
export class BridgeError extends Error {
  public readonly code: BridgeErrorCode;

  public readonly topic?: string;

  /**
   * @param code - Stable failure code.
   * @param message - Optional detail. Never crosses a trust boundary; use
   *   {@link toWireError} for that.
   * @param topic - Topic the failure relates to, when there is one.
   */
  public constructor(code: BridgeErrorCode, message?: string, topic?: string) {
    super(message ?? REDACTED_MESSAGES.get(code) ?? code);
    this.name = 'BridgeError';
    this.code = code;
    if (topic !== undefined) {
      this.topic = topic;
    }
  }
}

/**
 * @param value - Value to test.
 * @returns Whether the value is a {@link BridgeError}.
 */
export function isBridgeError(value: unknown): value is BridgeError {
  return value instanceof BridgeError;
}

/**
 * Reduce any failure to a code and a fixed message.
 *
 * Anything thrown by a page handler funnels through here, which is what keeps
 * stack traces, internal object shapes and handler-authored messages on their own
 * side of the boundary (T6).
 *
 * @param cause - The original failure. Only its code is used, if it has one.
 * @returns A redacted, sendable error.
 */
export function toWireError(cause: unknown): WireError {
  const code = isBridgeError(cause) ? cause.code : 'HANDLER_ERROR';

  return {
    code,
    message: REDACTED_MESSAGES.get(code) ?? 'The request failed',
  };
}

/**
 * Rebuild a `BridgeError` from an untrusted wire error.
 *
 * An unrecognised code is mapped to `HANDLER_ERROR` rather than trusted, so a
 * hostile peer cannot invent codes that a consumer's `switch` does not expect.
 *
 * @param value - The `error` field of an inbound `RESPONSE`.
 * @param topic - Topic of the request being settled.
 * @returns A `BridgeError` with a known code.
 */
export function fromWireError(value: unknown, topic?: string): BridgeError {
  const code = readOwn(value, 'code');
  const known = typeof code === 'string' && KNOWN_CODES.has(code);

  return new BridgeError(known ? (code as BridgeErrorCode) : 'HANDLER_ERROR', undefined, topic);
}
