import {
  DEFAULT_MAX_IN_FLIGHT_PER_TAB,
  DEFAULT_PUSHES_PER_SECOND,
  RATE_LIMIT_MAX_KEYS,
} from './constants';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimiterOptions {
  /** Sustained rate. Burst capacity equals this value. */
  perSecond?: number;
  /** Cap on tracked keys, so a topic-cycling flood cannot grow the map. */
  maxKeys?: number;
  now?: () => number;
}

/**
 * Token-bucket limiter keyed per `(tabId, topic)`.
 *
 * Excess is rejected outright rather than queued: queueing a flood just moves the
 * denial of service from the CPU to memory (T4).
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  private readonly perSecond: number;

  private readonly maxKeys: number;

  private readonly now: () => number;

  public constructor(options: RateLimiterOptions = {}) {
    this.perSecond = Math.max(options.perSecond ?? DEFAULT_PUSHES_PER_SECOND, 1);
    this.maxKeys = Math.max(options.maxKeys ?? RATE_LIMIT_MAX_KEYS, 1);
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * @param key - Limiter key, from {@link rateLimitKey}.
   * @returns Whether the message is within budget. A rejected message consumes no
   *   token, so the caller can retry after a backoff.
   */
  public allow(key: string): boolean {
    const at = this.now();
    const existing = this.buckets.get(key);

    if (!existing) {
      this.evictIfFull();
      this.buckets.set(key, {tokens: this.perSecond - 1, updatedAt: at});

      return true;
    }

    const refill = ((at - existing.updatedAt) / 1000) * this.perSecond;
    const tokens = Math.min(existing.tokens + Math.max(refill, 0), this.perSecond);

    if (tokens < 1) {
      // Keep `updatedAt` moving so the bucket still refills while being hammered.
      this.buckets.set(key, {tokens, updatedAt: at});

      return false;
    }

    // Re-insert to refresh LRU position.
    this.buckets.delete(key);
    this.buckets.set(key, {tokens: tokens - 1, updatedAt: at});

    return true;
  }

  public reset(): void {
    this.buckets.clear();
  }

  public get size(): number {
    return this.buckets.size;
  }

  private evictIfFull(): void {
    while (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next();

      if (oldest.done) {
        return;
      }

      this.buckets.delete(oldest.value);
    }
  }
}

/**
 * @param tabId - Tab the message came from, when known.
 * @param topic - Message topic.
 * @returns A limiter key. Built by concatenation into a `Map` key, never used as an
 *   object property name.
 */
export function rateLimitKey(tabId: number | undefined, topic: string): string {
  return `${tabId ?? 'unknown'}\u0000${topic}`;
}

export interface InFlightLimiterOptions {
  max?: number;
}

/**
 * Per-tab cap on concurrent requests, held separately from
 * {@link RateLimiter} because rate and concurrency are different failure modes.
 */
export class InFlightLimiter {
  private readonly counts = new Map<number, number>();

  private readonly max: number;

  public constructor(options: InFlightLimiterOptions = {}) {
    this.max = Math.max(options.max ?? DEFAULT_MAX_IN_FLIGHT_PER_TAB, 1);
  }

  /**
   * @param tabId - Target tab.
   * @returns Whether a slot was taken. On `false` the caller must reject with
   *   `RATE_LIMITED`.
   */
  public acquire(tabId: number): boolean {
    const current = this.counts.get(tabId) ?? 0;

    if (current >= this.max) {
      return false;
    }

    this.counts.set(tabId, current + 1);

    return true;
  }

  public release(tabId: number): void {
    const current = this.counts.get(tabId) ?? 0;

    if (current <= 1) {
      this.counts.delete(tabId);

      return;
    }

    this.counts.set(tabId, current - 1);
  }

  public releaseAll(tabId: number): void {
    this.counts.delete(tabId);
  }

  public count(tabId: number): number {
    return this.counts.get(tabId) ?? 0;
  }
}
