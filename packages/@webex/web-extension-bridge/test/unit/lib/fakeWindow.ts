import type {PageMessageEvent, PageWindowLike} from '../../../src/web/pageWindow';

export interface QueuedPost {
  message: unknown;
  targetOrigin: string;
}

export interface FakeWindow extends PageWindowLike {
  /** Every `postMessage` call, including ones that were never delivered. */
  readonly posted: QueuedPost[];
  /** Deliver queued posts to the message listeners. Returns whether anything moved. */
  flush(): boolean;
  /** Inject a raw event, bypassing `postMessage`, to simulate a hostile sender. */
  inject(event: PageMessageEvent): void;
  /** Fire a non-message event such as `pagehide`. */
  fire(type: string): void;
  listenerCount(type: string): number;
}

/**
 * A window stand-in with exact control over `origin` and `source`.
 *
 * Real `postMessage` is asynchronous, so delivery is queued rather than immediate;
 * tests drive it with `flush`, which keeps ordering deterministic and makes it
 * possible to inspect what was sent before it is received.
 *
 * @param origin - The document origin this window reports.
 * @returns The fake window.
 */
export function createFakeWindow(origin = 'https://app.example.com'): FakeWindow {
  const listeners = new Map<string, Set<(event: PageMessageEvent) => void>>();
  const posted: QueuedPost[] = [];
  let queue: QueuedPost[] = [];

  const deliver = (event: PageMessageEvent): void => {
    for (const listener of [...(listeners.get('message') ?? [])]) {
      listener(event);
    }
  };

  const win: FakeWindow = {
    location: {origin},
    posted,

    addEventListener(type: string, listener: (event: PageMessageEvent) => void): void {
      const set = listeners.get(type) ?? new Set();

      set.add(listener);
      listeners.set(type, set);
    },

    removeEventListener(type: string, listener: (event: PageMessageEvent) => void): void {
      listeners.get(type)?.delete(listener);
    },

    postMessage(message: unknown, targetOrigin: string): void {
      const post = {message, targetOrigin};

      posted.push(post);
      queue.push(post);
    },

    flush(): boolean {
      if (queue.length === 0) {
        return false;
      }

      const batch = queue;

      queue = [];

      for (const post of batch) {
        // Same-window posts arrive tagged with this window as the source and this
        // document's origin, exactly as the browser reports them.
        deliver({data: post.message, origin, source: win});
      }

      return true;
    },

    inject(event: PageMessageEvent): void {
      deliver(event);
    },

    fire(type: string): void {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener({});
      }
    },

    listenerCount(type: string): number {
      return listeners.get(type)?.size ?? 0;
    },
  };

  return win;
}
