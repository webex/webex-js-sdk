import {BridgeError} from '../core/errors';

/**
 * The parts of a `MessageEvent` the bridge reads. Every field is optional because the
 * event arrives from an untrusted source and may be anything at all.
 */
export interface PageMessageEvent {
  readonly data?: unknown;
  readonly origin?: string;
  readonly source?: unknown;
}

/**
 * The narrow window surface the page adapter uses.
 *
 * Declaring it structurally keeps `src/core` free of DOM references, lets the unit
 * tests drive a simulated window with exact control over `origin` and `source`, and
 * makes it impossible for the adapter to reach for a DOM API that was not reviewed.
 */
export interface PageWindowLike {
  addEventListener(type: string, listener: (event: PageMessageEvent) => void): void;
  removeEventListener(type: string, listener: (event: PageMessageEvent) => void): void;
  postMessage(message: unknown, targetOrigin: string): void;
  readonly location: {readonly origin: string};
}

/**
 * @returns The ambient page window.
 * @throws BridgeError `INSECURE_CONFIG` when there is no window, which means the web
 *   bridge was imported into a context it cannot secure (a service worker, Node).
 */
export function resolvePageWindow(): PageWindowLike {
  const candidate = typeof window === 'undefined' ? undefined : window;

  if (!candidate) {
    throw new BridgeError(
      'INSECURE_CONFIG',
      'createWebBridge requires a browser window. Use the extension entry points instead.'
    );
  }

  return candidate as unknown as PageWindowLike;
}
