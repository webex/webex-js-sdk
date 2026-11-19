import {BridgeError} from './errors';
import type {BridgeErrorCode} from './errors';
import type {JsonValue} from './json';

export interface PendingOptions {
  /** Already-clamped timeout. There is no unbounded option. */
  timeoutMs: number;
  topic: string;
  signal?: AbortSignal;
  /** Called once when the local timer fires, so the caller can tell its peer to stop. */
  onTimeout?: () => void;
}

interface PendingEntry {
  topic: string;
  tabId?: number;
  resolve: (value: JsonValue) => void;
  reject: (error: BridgeError) => void;
  timer: ReturnType<typeof setTimeout>;
  detachAbort?: () => void;
}

export interface PendingRequestsOptions {
  /** Cap on concurrent in-flight requests. Excess is rejected, never queued. */
  maxInFlight?: number;
}

/**
 * Registry of in-flight requests, keyed by envelope id (AC9: every entry is created
 * with a timer already armed, every settle path deletes before resolving, and
 * `settleAll` ensures a disconnect can't leave a promise pending). A `Map` is used
 * rather than an object so a forged correlation id can't collide with a prototype member.
 */
export class PendingRequests {
  private readonly entries = new Map<string, PendingEntry>();

  private readonly maxInFlight: number;

  /**
   * @param options - Registry options. Concurrency is unbounded when omitted.
   */
  constructor(options: PendingRequestsOptions = {}) {
    this.maxInFlight = options.maxInFlight ?? Number.POSITIVE_INFINITY;
  }

  /**
   * Register a request and return its promise, which always settles.
   *
   * @param id - Envelope id, which the peer must echo as `correlationId`.
   * @param options - Timeout, topic and optional abort signal for the request.
   * @param tabId - Tab the request was sent to, for disconnect filtering.
   * @returns A promise settling on response, timeout, abort or disconnect.
   * @throws BridgeError `RATE_LIMITED` when `maxInFlight` is reached, or when `id` is
   *   already in flight.
   */
  public create(id: string, options: PendingOptions, tabId?: number): Promise<JsonValue> {
    if (this.entries.size >= this.maxInFlight) {
      throw new BridgeError('RATE_LIMITED', 'Too many concurrent requests', options.topic);
    }

    if (this.entries.has(id)) {
      throw new BridgeError('RATE_LIMITED', 'Duplicate request id', options.topic);
    }

    return new Promise<JsonValue>((resolve, reject) => {
      const {signal} = options;

      if (signal?.aborted) {
        reject(new BridgeError('ABORTED', undefined, options.topic));

        return;
      }

      const timer = setTimeout(() => {
        options.onTimeout?.();
        this.reject(id, new BridgeError('TIMEOUT', undefined, options.topic));
      }, options.timeoutMs);

      const entry: PendingEntry = {topic: options.topic, resolve, reject, timer};

      if (tabId !== undefined) {
        entry.tabId = tabId;
      }

      if (signal) {
        const onAbort = () => this.reject(id, new BridgeError('ABORTED', undefined, options.topic));

        signal.addEventListener('abort', onAbort);
        entry.detachAbort = () => signal.removeEventListener('abort', onAbort);
      }

      this.entries.set(id, entry);
    });
  }

  /**
   * @param id - Envelope id to settle.
   * @param value - Value to resolve the request with.
   * @returns Whether a live request was settled — `false` means the id was unknown
   *   or already settled, so a stale or forged response is a no-op.
   */
  public resolve(id: string, value: JsonValue): boolean {
    const entry = this.take(id);

    if (!entry) {
      return false;
    }

    entry.resolve(value);

    return true;
  }

  /**
   * @param id - Envelope id to settle.
   * @param error - Error to reject the request with.
   * @returns Whether a live request was settled.
   */
  public reject(id: string, error: BridgeError): boolean {
    const entry = this.take(id);

    if (!entry) {
      return false;
    }

    entry.reject(error);

    return true;
  }

  /**
   * Settle every matching in-flight request, used on disconnect and teardown.
   *
   * @param code - Error code every settled request is rejected with.
   * @param tabId - When given, only requests sent to that tab are settled.
   * @returns How many requests were settled.
   */
  public settleAll(code: BridgeErrorCode, tabId?: number): number {
    let settled = 0;

    for (const [id, entry] of [...this.entries]) {
      if (tabId === undefined || entry.tabId === tabId) {
        this.take(id);
        entry.reject(new BridgeError(code, undefined, entry.topic));
        settled += 1;
      }
    }

    return settled;
  }

  /**
   * @param id - Envelope id.
   * @returns Whether `id` is a live, unsettled request.
   */
  public has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Number of in-flight requests. */
  public get size(): number {
    return this.entries.size;
  }

  /**
   * @param tabId - Tab to count for.
   * @returns How many in-flight requests were sent to `tabId`.
   */
  public countForTab(tabId: number): number {
    let count = 0;

    for (const entry of this.entries.values()) {
      if (entry.tabId === tabId) {
        count += 1;
      }
    }

    return count;
  }

  /**
   * @param id - Envelope id.
   * @returns The entry, removed from the map with its timer and abort listener cleared.
   */
  private take(id: string): PendingEntry | undefined {
    const entry = this.entries.get(id);

    if (!entry) {
      return undefined;
    }

    // Delete before settling, so re-entrant code cannot settle the same id twice.
    this.entries.delete(id);
    clearTimeout(entry.timer);
    entry.detachAbort?.();

    return entry;
  }
}
