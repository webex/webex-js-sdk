/*!
 * `@webex/web-extension-bridge/content-script`
 *
 * The manifest wiring entry. Importing this module — or listing the built file under
 * `content_scripts[].js` — starts the relay for the default channel and nothing else.
 *
 * ```json
 * {
 *   "content_scripts": [
 *     {
 *       "matches": ["https://app.example.com/*"],
 *       "js": ["vendor/web-extension-bridge/content-script.js"],
 *       "run_at": "document_start"
 *     }
 *   ]
 * }
 * ```
 *
 * The side effect lives here rather than in `extension/content`, so that importing
 * the relay's *API* is not the same act as starting one. A popup or service worker
 * that pulls in `startContentRelay` — directly, or transitively through the
 * `./extension` facade — should not acquire hidden startup behaviour along with it;
 * only a module whose entire purpose is to be named in a manifest should do that.
 *
 * For a non-default channel, or any other option, import `startContentRelay` out of
 * the `/extension` facade and call it yourself instead of loading this file.
 */

import {startContentRelay} from './extension/content';

// Guarded so the module stays importable outside a page-plus-extension context — a
// unit test, a bundler's module graph, a service worker — where it does nothing.
if (
  typeof window !== 'undefined' &&
  typeof (globalThis as {chrome?: unknown}).chrome === 'object' &&
  (globalThis as {chrome?: unknown}).chrome !== null
) {
  startContentRelay();
}

export {startContentRelay};
export type {ContentRelay, ContentRelayOptions} from './extension/content';
