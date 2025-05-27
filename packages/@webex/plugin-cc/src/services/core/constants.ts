/**
 * Interval in milliseconds for sending keepalive pings to the worker.
 */
export const KEEPALIVE_WORKER_INTERVAL = 4000;

/**
 * Delay in milliseconds before resolving notification handlers.
 */
export const NOTIFS_RESOLVE_DELAY = 1200;

/**
 * Timeout duration in milliseconds before forcefully closing a WebSocket connection.
 */
export const CLOSE_SOCKET_TIMEOUT_DURATION = 16000;

/**
 * API endpoint used for connectivity or health checks.
 */
export const PING_API_URL = '/health';

/**
 * Timeout in milliseconds to wait for a welcome message after socket connection.
 */
export const WELCOME_TIMEOUT = 30000;

/**
 * Event name used for real-time device (RTD) ping status.
 */
export const RTD_PING_EVENT = 'rtd-online-status';

/**
 * Timeout in milliseconds for individual HTTP requests.
 */
export const TIMEOUT_REQ = 20000;

/**
 * Duration in milliseconds to wait before attempting lost connection recovery.
 */
export const LOST_CONNECTION_RECOVERY_TIMEOUT = 50000;

/**
 * Duration in milliseconds after which a WebSocket disconnect is considered allowed or expected.
 */
export const WS_DISCONNECT_ALLOWED = 8000;

/**
 * Interval in milliseconds to check for connectivity status.
 */
export const CONNECTIVITY_CHECK_INTERVAL = 5000;

/**
 * Timeout in milliseconds for cleanly closing the WebSocket.
 */
export const CLOSE_SOCKET_TIMEOUT = 16000;
