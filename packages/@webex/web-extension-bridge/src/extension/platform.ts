import {BridgeError} from '../core/errors';

/**
 * What Chrome tells us about the sender of a runtime message. Every field is
 * optional: `sender` is the only evidence of provenance we get, so it is treated as
 * data to be checked rather than facts to be trusted.
 */
export interface ChromeSender {
  id?: string;
  origin?: string;
  url?: string;
  tab?: {id?: number; url?: string};
}

export type SendResponse = (response?: unknown) => void;

export type RuntimeMessageListener = (
  message: unknown,
  sender: ChromeSender,
  sendResponse: SendResponse
) => boolean | void;

export interface ChromeEvent<TListener> {
  addListener(listener: TListener): void;
  removeListener(listener: TListener): void;
}

export interface ChromeStorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface ChromeTabInfo {
  id?: number;
  url?: string;
}

export interface ChromeRuntimeLike {
  id: string;
  onMessage: ChromeEvent<RuntimeMessageListener>;
  sendMessage(message: unknown): Promise<unknown>;
}

export interface ChromeTabsLike {
  sendMessage(tabId: number, message: unknown): Promise<unknown>;
  query(queryInfo: {active?: boolean; currentWindow?: boolean}): Promise<ChromeTabInfo[]>;
  onRemoved: ChromeEvent<(tabId: number) => void>;
  onUpdated: ChromeEvent<(tabId: number, changeInfo: {status?: string; url?: string}) => void>;
}

/**
 * The complete extension platform surface this package uses.
 *
 * Written by hand rather than pulled from `@types/chrome` for two reasons: it keeps
 * the dependency count at zero, and it makes least privilege checkable — reaching for
 * an API outside this interface is a compile error, so the manifest's
 * `permissions: ["storage"]` cannot silently drift.
 */
export interface ChromeLike {
  runtime: ChromeRuntimeLike;
  tabs?: ChromeTabsLike;
  storage?: {session?: ChromeStorageArea};
}

/**
 * @returns The ambient `chrome` object.
 * @throws BridgeError `INSECURE_CONFIG` when absent, meaning an extension entry point
 *   was loaded outside an extension context.
 */
export function resolveChrome(): ChromeLike {
  const candidate = (globalThis as {chrome?: unknown}).chrome;

  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    typeof (candidate as ChromeLike).runtime !== 'object'
  ) {
    throw new BridgeError(
      'INSECURE_CONFIG',
      'No chrome.runtime available. This entry point only runs inside a Chrome extension.'
    );
  }

  return candidate as ChromeLike;
}

/**
 * @param chromeApi - Platform object.
 * @returns The tabs API.
 * @throws BridgeError `INSECURE_CONFIG` when unavailable, which means the background
 *   bridge was created somewhere other than the service worker.
 */
export function requireTabs(chromeApi: ChromeLike): ChromeTabsLike {
  if (!chromeApi.tabs) {
    throw new BridgeError(
      'INSECURE_CONFIG',
      'chrome.tabs is unavailable. createExtensionBridge must run in the service worker.'
    );
  }

  return chromeApi.tabs;
}

/**
 * @param chromeApi - Platform object.
 * @returns The session storage area. Never `sync`: the buffer is per-browser-session
 *   state and must not be replicated to other devices.
 */
export function requireSessionStorage(chromeApi: ChromeLike): ChromeStorageArea {
  const area = chromeApi.storage?.session;

  if (!area) {
    throw new BridgeError(
      'INSECURE_CONFIG',
      'chrome.storage.session is unavailable. Add "storage" to the manifest permissions.'
    );
  }

  return area;
}
