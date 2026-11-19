import type {ChromeStorageArea} from './platform';

/**
 * Serialised accessor for one `chrome.storage.session` key.
 *
 * MV3 service workers are evicted between events, so anything that must outlive an
 * event lives here rather than in a module variable. Writes are chained because two
 * events can be handled concurrently and a read-modify-write pair is not atomic.
 *
 * `T` must be structured-cloneable; everything stored here is built from validated
 * envelope data, so it always is.
 */
export class SessionStore<T> {
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * @param area - Storage area to read and write through.
   * @param key - The single `chrome.storage.session` key this instance owns.
   * @param fallback - Value returned when the key is absent or unreadable.
   * @param onWriteError - Called when a write is refused (quota exceeded, area
   *   unavailable, shutting down). A write failure must not break message handling, but
   *   must not be invisible either — without this hook, a full session quota just
   *   silently stops buffering.
   */
  constructor(
    private readonly area: ChromeStorageArea,
    private readonly key: string,
    private readonly fallback: T,
    private readonly onWriteError?: (error: unknown) => void
  ) {}

  /**
   * Read the stored value, ordered behind any write already accepted.
   *
   * Reads join the write chain, so a caller can never observe state that an already
   * accepted update is still writing — without this, a `CONNECT` immediately followed
   * by a `PUSH` looks like a push from an unknown tab and is dropped.
   *
   * @returns The stored value, or the fallback when absent or unreadable.
   */
  public read(): Promise<T> {
    const next = this.queue.then(() => this.load());

    this.queue = next.catch(() => undefined);

    return next;
  }

  /**
   * Read, transform and write back, with no interleaving.
   *
   * @param mutate - Pure transform over the current value.
   * @returns The written value.
   */
  public update(mutate: (current: T) => T): Promise<T> {
    const next = this.queue.then(async () => {
      // `load`, not `read`: this task is already at the head of the queue, so joining
      // the queue again here would wait on itself.
      const current = await this.load();
      const updated = mutate(current);

      try {
        await this.area.set({[this.key]: updated});
      } catch (error) {
        // Reported rather than swallowed: the buffer is a convenience (FR8), not a
        // delivery guarantee, but "buffering silently stopped" must stay diagnosable.
        this.onWriteError?.(error);
      }

      return updated;
    });

    // Keep the chain alive even if a caller ignores a rejection.
    this.queue = next.catch(() => undefined);

    return next;
  }

  /**
   * @returns The raw stored value, without ordering against pending writes.
   */
  private async load(): Promise<T> {
    try {
      const record = await this.area.get(this.key);
      const value = record?.[this.key];

      return value === undefined ? this.fallback : (value as T);
    } catch {
      return this.fallback;
    }
  }
}

/**
 * @param channel - Bridge channel.
 * @param name - Logical state name.
 * @returns A namespaced storage key, so two channels never share state.
 */
export function storageKey(channel: string, name: string): string {
  return `webex-bridge:${channel}:${name}`;
}
