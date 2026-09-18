import {
  DEFAULT_MAX_PAYLOAD_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_PAYLOAD_BYTES_CEILING,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
} from './constants';
import {BridgeError} from './errors';

/**
 * Validate a numeric option, or fall back to the default when it was not supplied.
 *
 * Used for limiter and buffer bounds, where clamping (as {@link clampMaxPayloadBytes}
 * and {@link clampTimeoutMs} do) would be wrong: `Math.max(NaN, 1)` is `NaN`, and every
 * later `tokens < 1` comparison against `NaN` is `false`, so a stray `NaN` (or
 * `Infinity`) would fail *open* and silently disable rate limiting. Refused loudly
 * at construction instead.
 *
 * @param value - Supplied value, or `undefined` to take the default.
 * @param name - Option name, used in the thrown error's message.
 * @param bounds - Inclusive `[min, max]` range and the default.
 * @returns The validated value, or `bounds.fallback` when `value` is `undefined`.
 * @throws BridgeError `INSECURE_CONFIG` when the value is not a finite integer in range.
 */
export function requireBoundedInteger(
  value: number | undefined,
  name: string,
  bounds: {min: number; max: number; fallback: number}
): number {
  if (value === undefined) {
    return bounds.fallback;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new BridgeError('INSECURE_CONFIG', `${name} must be a finite integer`);
  }

  if (value < bounds.min || value > bounds.max) {
    throw new BridgeError(
      'INSECURE_CONFIG',
      `${name} must be between ${bounds.min} and ${bounds.max}`
    );
  }

  return value;
}

/**
 * Clamps (rather than rejects) so a consumer can't configure an unbounded payload
 * size or disable the cap by passing a huge number.
 *
 * @param value - Requested maximum, or `undefined` for the default.
 * @returns A size within `[1, 1 MiB]`.
 */
export function clampMaxPayloadBytes(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_PAYLOAD_BYTES;
  }

  return Math.min(Math.max(Math.floor(value), 1), MAX_PAYLOAD_BYTES_CEILING);
}

/**
 * @param value - Requested timeout, or `undefined` for the default.
 * @returns A timeout within `[100, 30000]` ms. There is no "no timeout" option:
 *   every request must settle (AC9).
 */
export function clampTimeoutMs(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.max(Math.floor(value), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}
