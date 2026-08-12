import type {
  ChromeEvent,
  ChromeLike,
  ChromeSender,
  ChromeStorageArea,
  ChromeTabInfo,
  RuntimeMessageListener,
  SendResponse,
} from '../../../src/extension/platform';

/**
 * No-receiver rejection text, matching what Chrome produces when `sendMessage` finds
 * nobody listening. Several code paths depend on that being a rejection, not a
 * resolution with `undefined`.
 */
export const NO_RECEIVER = 'Could not establish connection. Receiving end does not exist.';

function createEvent<TListener>(): ChromeEvent<TListener> & {
  listeners: Set<TListener>;
} {
  const listeners = new Set<TListener>();

  return {
    listeners,
    addListener(listener: TListener): void {
      listeners.add(listener);
    },
    removeListener(listener: TListener): void {
      listeners.delete(listener);
    },
  };
}

/**
 * Dispatch a runtime message the way Chrome does: listeners run in order, the first
 * `sendResponse` wins, and a listener returning `true` keeps the channel open for an
 * asynchronous reply.
 *
 * @param listeners - Registered listeners.
 * @param message - Message to deliver.
 * @param sender - Sender Chrome would report.
 * @returns The response, or a rejection when nothing is listening.
 */
function dispatch(
  listeners: Set<RuntimeMessageListener>,
  message: unknown,
  sender: ChromeSender
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let responded = false;
    let keepAlive = false;

    const sendResponse: SendResponse = (response?: unknown) => {
      if (!responded) {
        responded = true;
        resolve(response);
      }
    };

    for (const listener of [...listeners]) {
      const result = listener(message, sender, sendResponse);

      if (result === true) {
        keepAlive = true;
      }

      if (responded) {
        return;
      }
    }

    if (!keepAlive) {
      reject(new Error(NO_RECEIVER));
    }
  });
}

function createStorageArea(data: Map<string, unknown>): ChromeStorageArea {
  return {
    async get(keys: string | string[] | null): Promise<Record<string, unknown>> {
      const wanted = keys === null ? [...data.keys()] : [...(Array.isArray(keys) ? keys : [keys])];
      const out: Record<string, unknown> = {};

      for (const key of wanted) {
        if (data.has(key)) {
          out[key] = data.get(key);
        }
      }

      return out;
    },

    async set(items: Record<string, unknown>): Promise<void> {
      for (const [key, value] of Object.entries(items)) {
        // Storage round-trips through structured clone, so stored values must not
        // alias what the caller still holds.
        data.set(key, JSON.parse(JSON.stringify(value)));
      }
    },

    async remove(keys: string | string[]): Promise<void> {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        data.delete(key);
      }
    },
  };
}

export interface FakeExtensionWorldOptions {
  extensionId?: string;
  tabId?: number;
  url?: string;
  origin?: string;
}

export interface FakeExtensionWorld {
  extensionId: string;
  tabId: number;
  /** Platform object as seen by a content script: no `tabs`, no `storage`. */
  contentChrome: ChromeLike;
  /** Platform object as seen by the service worker. */
  backgroundChrome: ChromeLike;
  /** Platform object as seen by a popup or options page. */
  uiChrome: ChromeLike;
  storageData: Map<string, unknown>;
  /** Messages the worker sent to a tab, in order. */
  tabMessages: {tabId: number; message: unknown}[];
  /** Messages broadcast by the worker to extension pages. */
  broadcasts: unknown[];
  activeTabs: ChromeTabInfo[];
  fireTabRemoved(tabId: number): void;
  fireTabUpdated(tabId: number, changeInfo: {status?: string; url?: string}): void;
  /** Send as if from a content script in an arbitrary tab, for sender-spoofing tests. */
  sendAsContentScript(message: unknown, sender?: Partial<ChromeSender>): Promise<unknown>;
  sendAsExtensionPage(message: unknown, sender?: Partial<ChromeSender>): Promise<unknown>;
  sendAsForeignExtension(message: unknown): Promise<unknown>;
  /**
   * Deliver to the content script's runtime listeners as an arbitrary sender, which is
   * how a relay's own sender checks get exercised. Defaults to the service worker.
   */
  sendToContent(message: unknown, sender?: Partial<ChromeSender>): Promise<unknown>;
  /** The same, for extension pages, so a spoofed broadcast can be delivered. */
  sendToUi(message: unknown, sender?: Partial<ChromeSender>): Promise<unknown>;
}

/**
 * Build the three platform objects a real extension sees, wired to each other in
 * memory, plus a shared session store.
 *
 * This is what lets the request path be tested end to end — page, relay, worker and
 * popup — without a browser, while still forcing every sender check to run against a
 * sender the test controls.
 *
 * @param options - Identity of the extension and the tab.
 * @returns The wired world.
 */
export function createFakeExtensionWorld(
  options: FakeExtensionWorldOptions = {}
): FakeExtensionWorld {
  const extensionId = options.extensionId ?? 'abcdefghijklmnopabcdefghijklmnop';
  const tabId = options.tabId ?? 7;
  const url = options.url ?? 'https://app.example.com/index.html';
  const origin = options.origin ?? 'https://app.example.com';

  const contentListeners = createEvent<RuntimeMessageListener>();
  const backgroundListeners = createEvent<RuntimeMessageListener>();
  const uiListeners = createEvent<RuntimeMessageListener>();
  const onRemoved = createEvent<(tab: number) => void>();
  const onUpdated = createEvent<(tab: number, changeInfo: {status?: string; url?: string}) => void>();

  const storageData = new Map<string, unknown>();
  const tabMessages: {tabId: number; message: unknown}[] = [];
  const broadcasts: unknown[] = [];
  const activeTabs: ChromeTabInfo[] = [{id: tabId, url}];

  const contentSender: ChromeSender = {id: extensionId, origin, url, tab: {id: tabId, url}};
  const workerSender: ChromeSender = {id: extensionId, origin: `chrome-extension://${extensionId}`};

  const world: FakeExtensionWorld = {
    extensionId,
    tabId,
    storageData,
    tabMessages,
    broadcasts,
    activeTabs,

    contentChrome: {
      runtime: {
        id: extensionId,
        onMessage: contentListeners,
        sendMessage: (message: unknown) => dispatch(backgroundListeners.listeners, message, contentSender),
      },
    },

    backgroundChrome: {
      runtime: {
        id: extensionId,
        onMessage: backgroundListeners,
        sendMessage: (message: unknown) => {
          broadcasts.push(message);

          return dispatch(uiListeners.listeners, message, workerSender);
        },
      },
      tabs: {
        sendMessage: (target: number, message: unknown) => {
          tabMessages.push({tabId: target, message});

          if (target !== tabId) {
            return Promise.reject(new Error(NO_RECEIVER));
          }

          return dispatch(contentListeners.listeners, message, workerSender);
        },
        query: async () => [...activeTabs],
        onRemoved,
        onUpdated,
      },
      storage: {session: createStorageArea(storageData)},
    },

    uiChrome: {
      runtime: {
        id: extensionId,
        onMessage: uiListeners,
        sendMessage: (message: unknown) =>
          dispatch(backgroundListeners.listeners, message, workerSender),
      },
    },

    fireTabRemoved(target: number): void {
      for (const listener of [...onRemoved.listeners]) {
        listener(target);
      }
    },

    fireTabUpdated(target: number, changeInfo: {status?: string; url?: string}): void {
      for (const listener of [...onUpdated.listeners]) {
        listener(target, changeInfo);
      }
    },

    sendAsContentScript(message: unknown, sender: Partial<ChromeSender> = {}): Promise<unknown> {
      return dispatch(backgroundListeners.listeners, message, {...contentSender, ...sender});
    },

    sendAsExtensionPage(message: unknown, sender: Partial<ChromeSender> = {}): Promise<unknown> {
      return dispatch(backgroundListeners.listeners, message, {...workerSender, ...sender});
    },

    sendAsForeignExtension(message: unknown): Promise<unknown> {
      return dispatch(backgroundListeners.listeners, message, {id: 'a-different-extension-id'});
    },

    sendToContent(message: unknown, sender: Partial<ChromeSender> = {}): Promise<unknown> {
      return dispatch(contentListeners.listeners, message, {...workerSender, ...sender});
    },

    sendToUi(message: unknown, sender: Partial<ChromeSender> = {}): Promise<unknown> {
      return dispatch(uiListeners.listeners, message, {...workerSender, ...sender});
    },
  };

  return world;
}
