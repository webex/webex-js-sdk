import {MAX_LISTENERS} from './constants';

export interface ListenerSetOptions {
  maxListeners?: number;
  /** Called with whatever a listener threw. Never re-thrown into the emit loop. */
  onError?: (error: unknown) => void;
}

/**
 * Bounded set of listeners with isolated invocation.
 *
 * A listener that throws must not stop delivery to the others, so each call is
 * wrapped individually. The size cap exists because a leaking consumer must not be
 * able to grow a long-lived service worker without limit.
 */
export class ListenerSet<TListener extends (...args: never[]) => void> {
  private readonly listeners = new Set<TListener>();

  private readonly maxListeners: number;

  private readonly onError?: (error: unknown) => void;

  public constructor(options: ListenerSetOptions = {}) {
    this.maxListeners = options.maxListeners ?? MAX_LISTENERS;
    if (options.onError) {
      this.onError = options.onError;
    }
  }

  /**
   * @param listener - Listener to add. Adding the same function twice is a no-op.
   * @returns An unsubscribe function, safe to call more than once.
   */
  public add(listener: TListener): () => void {
    if (this.listeners.size >= this.maxListeners && !this.listeners.has(listener)) {
      throw new RangeError(`Refusing to add more than ${this.maxListeners} listeners`);
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @param args - Arguments passed to every listener.
   */
  public emit(...args: Parameters<TListener>): void {
    // Snapshot first: a listener may unsubscribe itself or others during delivery.
    for (const listener of [...this.listeners]) {
      try {
        listener(...args);
      } catch (error) {
        this.onError?.(error);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }

  public get size(): number {
    return this.listeners.size;
  }
}
