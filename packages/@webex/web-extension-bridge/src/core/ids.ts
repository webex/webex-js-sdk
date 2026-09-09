import {BridgeError} from './errors';

/** The only crypto surface the bridge needs. */
export interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
}

/** Produces a fresh, unguessable id. */
export type IdFactory = () => string;

/**
 * @param source - Candidate crypto object.
 * @returns Whether it can produce cryptographically secure randomness.
 */
export function isUsableCrypto(source: unknown): source is CryptoLike {
  if (typeof source !== 'object' || source === null) {
    return false;
  }

  const candidate = source as CryptoLike;

  return (
    typeof candidate.randomUUID === 'function' || typeof candidate.getRandomValues === 'function'
  );
}

/**
 * Build the id factory, failing closed when no CSPRNG exists.
 *
 * There is deliberately no `Math.random` fallback. Correlation integrity depends on
 * ids being unguessable (T3), so a silent downgrade to predictable ids would be
 * worse than refusing to start (spec 8.4).
 *
 * @param source - Crypto object. Defaults to the ambient `globalThis.crypto`.
 * @returns A factory producing unique, unguessable ids.
 */
export function createIdFactory(source?: unknown): IdFactory {
  const cryptoObj = source ?? (typeof globalThis === 'undefined' ? undefined : globalThis.crypto);

  if (!isUsableCrypto(cryptoObj)) {
    throw new BridgeError('CRYPTO_UNAVAILABLE');
  }

  const {randomUUID, getRandomValues} = cryptoObj;

  if (typeof randomUUID === 'function') {
    return () => randomUUID.call(cryptoObj);
  }

  return () => {
    const bytes = (getRandomValues as (array: Uint8Array) => Uint8Array).call(
      cryptoObj,
      new Uint8Array(16)
    );

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  };
}
