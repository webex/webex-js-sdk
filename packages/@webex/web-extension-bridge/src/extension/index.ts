/*!
 * `@webex/web-extension-bridge/extension`
 *
 * The single facade for everything that runs inside the extension. Import
 * `createExtensionBridge` in the service worker, `createExtensionClient` in a popup,
 * options page or side panel, and `startContentRelay` in a content script that needs a
 * non-default channel — all from this one specifier.
 *
 * One facade rather than three subpaths named after execution directories. Which of
 * these a consumer calls is already determined by where their code runs, and a
 * `/background` or `/client` specifier only restates that in the import while coupling
 * them to this package's source layout. Bundlers tree-shake what is not called, so the
 * cost of a single entry is nothing that reaches a built extension.
 *
 * The manifest wiring entry is deliberately *not* re-exported here:
 * `@webex/web-extension-bridge/content-script` starts a relay as a side effect of
 * being loaded, and importing an API should never be the thing that starts one.
 *
 * Test seams (`createExtensionBridgeWith`, `createExtensionClientWith`,
 * `createContentRelay`) are also absent by design. They accept an injected platform
 * object in place of the real `chrome`, which is exactly what the sender-verification
 * rules are built on — so a consumer able to reach them is a consumer able to
 * construct a bridge that trusts whatever they hand it.
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
