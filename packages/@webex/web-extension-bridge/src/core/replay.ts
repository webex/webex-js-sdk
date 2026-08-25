import {CLOCK_SKEW_TOLERANCE_MS, SEEN_ID_MAX_ENTRIES, SEEN_ID_TTL_MS} from './constants';

export interface SeenIdsOptions {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
}

/**
 * Bounded single-use id cache.
 *
 * Backed by a `Map` in insertion order, which gives LRU eviction for free and
 * keeps attacker-controlled ids out of any object key space. Both a size cap and a
 * TTL apply, because in a long-lived service worker an unbounded cache is a leak.
 */
export class SeenIds {
  private readonly entries = new Map<string, number>();

  private readonly maxEntries: number;

  private readonly ttlMs: number;

  private readonly now: () => number;

  public constructor(options: SeenIdsOptions = {}) {
    this.maxEntries = options.maxEntries ?? SEEN_ID_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? SEEN_ID_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Record an id, reporting whether it is the first sighting.
   *
   * @param id - Envelope id.
   * @returns `true` when the id is new, `false` when it is a replay.
   */
  public accept(id: string): boolean {
    const at = this.now();

    this.evictExpired(at);

    const existing = this.entries.get(id);

    if (existing !== undefined) {
      return false;
    }

    this.entries.set(id, at);

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();

      if (oldest.done) {
        break;
      }

      this.entries.delete(oldest.value);
    }

    return true;
  }

  /**
   * @param id - Envelope id.
   * @returns Whether the id is currently cached.
   */
  public has(id: string): boolean {
    this.evictExpired(this.now());

    return this.entries.has(id);
  }

  public clear(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }

  private evictExpired(at: number): void {
    for (const [id, seenAt] of this.entries) {
      if (at - seenAt < this.ttlMs) {
        // Insertion order means everything after this entry is younger still.
        break;
      }

      this.entries.delete(id);
    }
  }
}

/**
 * @param ts - Envelope timestamp.
 * @param now - Local time.
 * @param toleranceMs - Half-width of the accepted window.
 * @returns Whether the timestamp is close enough to local time to not be a
 *   replayed capture. A non-numeric timestamp is never within the window.
 */
export function isWithinClockSkew(
  ts: unknown,
  now: number,
  toleranceMs: number = CLOCK_SKEW_TOLERANCE_MS
): boolean {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) {
    return false;
  }

  return Math.abs(now - ts) <= toleranceMs;
}
