/*!
 * `@webex/web-extension-bridge/extension`
 *
 * The single facade for everything that runs inside the extension: import
 * `createExtensionBridge` in the service worker, `createExtensionClient` in a popup,
 * options page or side panel, and `startContentRelay` in a content script that needs a
 * non-default channel — all from this one specifier, rather than three subpaths named
 * after this package's own source layout. Bundlers tree-shake what isn't called, so a
 * single entry costs nothing in a built extension.
 *
 * The manifest wiring entry is deliberately *not* re-exported here: importing an API
 * should never be the thing that starts a relay, which is what
 * `@webex/web-extension-bridge/content-script` does as a side effect.
 *
 * Test seams (`createExtensionBridgeWith`, `createExtensionClientWith`,
 * `createContentRelay`) are absent by design too — they accept an injected platform
 * object in place of the real `chrome`, which is exactly what the sender-verification
 * rules are built on, so a consumer able to reach them could construct a bridge that
 * trusts whatever it's handed.
 */

export {createExtensionBridge} from './background';
export {createExtensionClient} from './client';
export {startContentRelay} from './content';

export type {ExtensionClientOptions} from './client';
export type {ContentRelay, ContentRelayOptions} from './content';
export type {RelayResult} from './messages';
export type {
  BufferedMessage,
  Connection,
  ExtensionBridge,
  ExtensionBridgeOptions,
  PushListener,
  PushMeta,
  RequestOptions,
  TopicPushListener,
} from '../types';
