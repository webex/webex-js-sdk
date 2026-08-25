import {
  DEFAULT_MAX_PAYLOAD_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_PAYLOAD_BYTES_CEILING,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
} from './constants';

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
