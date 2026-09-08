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
 * Clamping is right for payload size and timeouts — a too-large value there is still
 * a safe intent, just an unsupported one. It is wrong for limiter and buffer bounds:
 * `Math.max(NaN, 1)` is `NaN`, and every subsequent `tokens < 1` comparison against
 * `NaN` is `false`, so a single stray `NaN` fails *open* and disables rate limiting
 * altogether. `Infinity` is the same defect wearing a different hat. Those must be
 * refused loudly at construction, which is what this does.
 *
 * @param value - Supplied value, or `undefined` to take the default.
 * @param name - Option name, for the error message.
 * @param bounds - Inclusive `[min, max]` range and the default.
 * @returns A finite integer inside the range.
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
 * Clamp rather than reject, so a consumer cannot accidentally configure an
 * unbounded payload size, and cannot disable the cap by passing a huge number.
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
