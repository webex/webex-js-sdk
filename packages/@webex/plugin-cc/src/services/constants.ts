/**
 * Post-authentication event name.
 * @type {string}
 * @public
 * @example
 * if (event === POST_AUTH) { ... }
 */
export const POST_AUTH = 'postauth';

/**
 * API gateway identifier for Webex Contact Center.
 * @type {string}
 * @public
 */
export const WCC_API_GATEWAY = 'wcc-api-gateway';

/**
 * Domain identifier for WCC Calling RTMS.
 * @type {string}
 * @public
 */
export const WCC_CALLING_RTMS_DOMAIN = 'wcc-calling-rtms-domain';

/**
 * Default RTMS domain for production use.
 * @type {string}
 * @public
 */
export const DEFAULT_RTMS_DOMAIN = 'rtw.prod-us1.rtmsprod.net';

/**
 * Timeout in milliseconds for WebSocket events.
 * @type {number}
 * @public
 * @example
 * setTimeout(() => { ... }, WEBSOCKET_EVENT_TIMEOUT);
 */
export const WEBSOCKET_EVENT_TIMEOUT = 20000;

/**
 * Agent role identifier.
 * @type {string}
 * @public
 */
export const AGENT = 'agent';

// CC GATEWAY API URL PATHS
/**
 * API path for notification subscription.
 * @type {string}
 * @public
 */
export const SUBSCRIBE_API = 'v1/notification/subscribe';

/**
 * API path for agent login.
 * @type {string}
 * @public
 */
export const LOGIN_API = 'v1/agents/login';

/**
 * Prefix for WebRTC-related API endpoints.
 * @type {string}
 * @public
 */
export const WEB_RTC_PREFIX = 'webrtc-';

/**
 * API path for agent session state changes.
 * @type {string}
 * @public
 */
export const STATE_CHANGE_API = 'v1/agents/session/state';

/**
 * Message for deregistering WebCalling line and cleaning up resources.
 * @type {string}
 * @public
 */
export const DEREGISTER_WEBCALLING_LINE_MSG =
  'Deregistering WebCalling line and cleaning up resources';
