/*!
 * `@webex/web-extension-bridge`
 *
 * The root entry deliberately carries no platform code, so importing it from a page,
 * a service worker or Node is always safe. The adapters live behind subpath exports:
 *
 * - `@webex/web-extension-bridge/web` — `createWebBridge`
 * - `@webex/web-extension-bridge/extension/content` — the relay
 * - `@webex/web-extension-bridge/extension/background` — `createExtensionBridge`
 * - `@webex/web-extension-bridge/extension/client` — `createExtensionClient`
 */

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
