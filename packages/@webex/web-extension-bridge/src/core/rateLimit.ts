import {
  DEFAULT_MAX_IN_FLIGHT_PER_TAB,
  DEFAULT_PUSHES_PER_SECOND,
  MAX_IN_FLIGHT_PER_TAB,
  MAX_RATE_PER_SECOND,
  MIN_IN_FLIGHT_PER_TAB,
  MIN_RATE_PER_SECOND,
  RATE_LIMIT_AGGREGATE_MAX_KEYS,
  RATE_LIMIT_AGGREGATE_MULTIPLIER,
  RATE_LIMIT_MAX_KEYS,
} from './constants';
import {requireBoundedInteger} from './limits';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * Separator between the scope and the topic half of a limiter key. `NUL` is outside
 * `TOPIC_PATTERN`, so a topic can never contain one and forge a different scope.
 */
const KEY_SEPARATOR = '\u0000';

export interface RateLimiterOptions {
  /** Sustained per-topic rate. Burst capacity equals this value. */
  perSecond?: number;
  /**
   * Sustained rate for the whole scope (tab), across all topics. Defaults to
   * `perSecond * RATE_LIMIT_AGGREGATE_MULTIPLIER`.
   */
  aggregatePerSecond?: number;
  /** Cap on tracked per-topic keys, so a topic-cycling flood cannot grow the map. */
  maxKeys?: number;
  /** Cap on tracked scopes. */
  aggregateMaxKeys?: number;
  now?: () => number;
}

/**
 * LRU-bounded map of token buckets, with the refill arithmetic in one place.
 *
 * Split out from {@link RateLimiter} so the per-topic and aggregate limits are the
 * same mechanism applied at two granularities, rather than two hand-rolled variants
 * that can drift apart.
 */
class BucketMap {
  private readonly buckets = new Map<string, Bucket>();

  private readonly perSecond: number;

  private readonly maxKeys: number;

  /**
   * @param perSecond - Sustained refill rate, which is also the burst capacity.
   * @param maxKeys - Cap on tracked keys, beyond which the least recently used is evicted.
   */
  constructor(perSecond: number, maxKeys: number) {
    this.perSecond = perSecond;
    this.maxKeys = maxKeys;
  }

  /**
   * @param key - Bucket key.
   * @param at - Current time.
   * @returns Tokens available after refill, without consuming any.
   */
  public peek(key: string, at: number): number {
    const existing = this.buckets.get(key);

    if (!existing) {
      return this.perSecond;
    }

    const refill = ((at - existing.updatedAt) / 1000) * this.perSecond;

    return Math.min(existing.tokens + Math.max(refill, 0), this.perSecond);
  }

  /**
   * Write a bucket's state back, refreshing its LRU position and evicting if needed.
   *
   * @param key - Bucket key.
   * @param tokens - Token count to store.
   * @param at - Current time.
   */
  public commit(key: string, tokens: number, at: number): void {
    // Deleting first both refreshes LRU position for an existing key and tells us
    // whether this is a new key that may need to make room.
    if (!this.buckets.delete(key)) {
      this.evictIfFull();
    }

    this.buckets.set(key, {tokens, updatedAt: at});
  }

  public clear(): void {
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
 * Two-level token-bucket limiter: one bucket per `(tabId, topic)`, and one aggregate
 * bucket per `tabId` across every topic.
 *
 * The aggregate level exists because the per-topic map must be bounded, and a bounded
 * map alone can be walked straight past: a page that emits every push under a fresh
 * topic name evicts somebody else's bucket and starts again on a full budget each
 * time, so the per-topic limit alone constrains nothing. The aggregate bucket is keyed
 * on the tab, which the sender can't vary at will, making it a real bound.
 *
 * Excess is rejected outright rather than queued — queueing a flood just moves the
 * denial of service from the CPU to memory (T4).
 */
export class RateLimiter {
  private readonly perTopic: BucketMap;

  private readonly aggregate: BucketMap;

  private readonly now: () => number;

  /**
   * @param options - Limiter options.
   * @throws BridgeError `INSECURE_CONFIG` when any rate or key bound is out of range.
   */
  constructor(options: RateLimiterOptions = {}) {
    const perSecond = requireBoundedInteger(options.perSecond, 'rateLimit.pushesPerSecond', {
      min: MIN_RATE_PER_SECOND,
      max: MAX_RATE_PER_SECOND,
      fallback: DEFAULT_PUSHES_PER_SECOND,
    });
    const aggregatePerSecond = requireBoundedInteger(
      options.aggregatePerSecond,
      'rateLimit.aggregatePushesPerSecond',
      {
        min: MIN_RATE_PER_SECOND,
        max: MAX_RATE_PER_SECOND,
        fallback: Math.min(perSecond * RATE_LIMIT_AGGREGATE_MULTIPLIER, MAX_RATE_PER_SECOND),
      }
    );
    const maxKeys = requireBoundedInteger(options.maxKeys, 'rateLimit.maxKeys', {
      min: 1,
      max: 100000,
      fallback: RATE_LIMIT_MAX_KEYS,
    });
    const aggregateMaxKeys = requireBoundedInteger(
      options.aggregateMaxKeys,
      'rateLimit.aggregateMaxKeys',
      {min: 1, max: 100000, fallback: RATE_LIMIT_AGGREGATE_MAX_KEYS}
    );

    this.perTopic = new BucketMap(perSecond, maxKeys);
    this.aggregate = new BucketMap(aggregatePerSecond, aggregateMaxKeys);
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * @param key - Limiter key, from {@link rateLimitKey}.
   * @returns Whether the message is within both the per-topic and aggregate budget. A
   *   rejected message consumes no token at either level, so a push refused by its own
   *   topic bucket cannot drain the tab's aggregate allowance on its way out.
   */
  public allow(key: string): boolean {
    const at = this.now();
    const scope = scopeOf(key);
    const topicTokens = this.perTopic.peek(key, at);
    const scopeTokens = this.aggregate.peek(scope, at);

    if (topicTokens < 1 || scopeTokens < 1) {
      // Keep `updatedAt` moving on both buckets so they still refill while being
      // hammered, but never spend a token on a message that was refused.
      this.perTopic.commit(key, topicTokens, at);
      this.aggregate.commit(scope, scopeTokens, at);

      return false;
    }

    this.perTopic.commit(key, topicTokens - 1, at);
    this.aggregate.commit(scope, scopeTokens - 1, at);

    return true;
  }

  /** Forget every tracked bucket, at both levels. */
  public reset(): void {
    this.perTopic.clear();
    this.aggregate.clear();
  }

  /** Tracked per-topic buckets. */
  public get size(): number {
    return this.perTopic.size;
  }

  /** Tracked aggregate (per-scope) buckets. */
  public get aggregateSize(): number {
    return this.aggregate.size;
  }
}

/**
 * @param tabId - Tab the message came from, when known.
 * @param topic - Message topic.
 * @returns A limiter key. Built by concatenation into a `Map` key, never used as an
 *   object property name.
 */
export function rateLimitKey(tabId: number | undefined, topic: string): string {
  return `${tabId ?? 'unknown'}${KEY_SEPARATOR}${topic}`;
}

/**
 * @param key - Limiter key.
 * @returns The scope half — the part of the key the sender cannot choose, and
 *   therefore the only part it is safe to aggregate on.
 */
function scopeOf(key: string): string {
  const separator = key.indexOf(KEY_SEPARATOR);

  return separator === -1 ? key : key.slice(0, separator);
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

  /**
   * @param options - Concurrency options.
   * @throws BridgeError `INSECURE_CONFIG` when `max` is out of range.
   */
  constructor(options: InFlightLimiterOptions = {}) {
    this.max = requireBoundedInteger(options.max, 'rateLimit.maxInFlightPerTab', {
      min: MIN_IN_FLIGHT_PER_TAB,
      max: MAX_IN_FLIGHT_PER_TAB,
      fallback: DEFAULT_MAX_IN_FLIGHT_PER_TAB,
    });
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

  /**
   * Release one slot previously taken by {@link acquire}.
   *
   * @param tabId - Target tab.
   */
  public release(tabId: number): void {
    const current = this.counts.get(tabId) ?? 0;

    if (current <= 1) {
      this.counts.delete(tabId);

      return;
    }

    this.counts.set(tabId, current - 1);
  }

  /**
   * Release every slot held for a tab, for disconnect/teardown.
   *
   * @param tabId - Target tab.
   */
  public releaseAll(tabId: number): void {
    this.counts.delete(tabId);
  }

  /**
   * @param tabId - Target tab.
   * @returns Slots currently held for `tabId`.
   */
  public count(tabId: number): number {
    return this.counts.get(tabId) ?? 0;
  }
}
