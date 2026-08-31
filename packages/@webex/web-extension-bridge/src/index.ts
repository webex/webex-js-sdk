/*!
 * `@webex/web-extension-bridge`
 *
 * The root entry is the **page** API: the surface a web application uses, reached by
 * importing `createWebBridge` from the bare package name.
 *
 * That is the product concept most consumers import, so it gets the bare specifier.
 * The extension side — service worker, popup, content script — is a different
 * deployment target, and lives behind two facades named for what they are rather than
 * for the directory the source happens to sit in:
 *
 * - `@webex/web-extension-bridge/extension` — `createExtensionBridge`,
 *   `createExtensionClient`, `startContentRelay`
 * - `@webex/web-extension-bridge/content-script` — the manifest wiring entry, whose
 *   only job is to start the relay as a side effect
 *
 * Importing this module runs no platform code: `createWebBridge` reaches for `window`
 * when it is *called*, not when it is loaded, so the module graph stays safe to pull
 * into a service worker or into Node for type-checking.
 *
 * The earlier layout-shaped specifiers — `/web`, `/extension/background`,
 * `/extension/client`, `/extension/content` — still resolve, and are documented as
 * deprecated aliases of the surfaces above.
 */

export {createWebBridge} from './web/webBridge';

export {BridgeError, BRIDGE_ERROR_CODES, isBridgeError} from './core/errors';
export {PROTOCOL_VERSION, DEFAULT_CHANNEL} from './core/constants';
export {EnvelopeKind, EnvelopeSource} from './core/protocol';

export type {BridgeErrorCode, WireError} from './core/errors';
export type {JsonValue} from './core/json';
export type {LogContext, LogSink} from './core/logger';
export type {
  BufferedMessage,
  Connection,
  ExtensionBridge,
  ExtensionBridgeOptions,
  HandlerOptions,
  PushListener,
  PushMeta,
  RequestHandler,
  RequestMeta,
  RequestOptions,
  TopicPushListener,
  WebBridge,
  WebBridgeOptions,
} from './types';
