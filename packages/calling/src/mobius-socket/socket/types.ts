/**
 * Type for the browser WebSocket constructor.
 */
export type BrowserWebSocketConstructor = typeof WebSocket;

/**
 * Global scope interface for accessing WebSocket constructors across environments.
 */
export type ShimGlobalScope = {
  /** Firefox's WebSocket constructor */
  MozWebSocket?: BrowserWebSocketConstructor;
  /** Standard WebSocket constructor */
  WebSocket?: BrowserWebSocketConstructor;
};

/**
 * Socket close event data.
 */
export type SocketCloseEvent = {
  /** WebSocket close code */
  code?: number;
  /** Human-readable close reason */
  reason?: string;
};

/**
 * Socket message event wrapper.
 */
export type SocketMessageEvent<T = unknown> = {
  /** Message data payload */
  data: T;
};

/**
 * Logger interface for socket operations.
 */
export type SocketLogger = {
  /** Log informational messages */
  info: (...args: unknown[]) => void;
  /** Log warning messages */
  warn: (...args: unknown[]) => void;
};

/**
 * Socket response/request message structure.
 */
export type SocketResponse = {
  /** Unique tracking ID for request/response correlation */
  trackingId?: string;
  /** Message type identifier */
  type?: string;
  /** Message subtype identifier */
  subtype?: string;
  /** HTTP-style status code */
  statusCode?: number;
  /** Human-readable status message */
  statusMessage?: string;
  /** Reason for error or closure */
  reason?: string;
  /** Event ID for async events */
  eventId?: string;
  /** Additional properties */
  [key: string]: unknown;
};

/**
 * Entry for tracking pending request/response pairs.
 */
export type PendingResponseEntry = {
  /** Original request data */
  request: SocketResponse;
  /** Resolve function for the pending promise */
  resolve: (response: SocketResponse) => void;
  /** Reject function for the pending promise */
  reject: (error: unknown) => void;
  /** Timeout handle for the request */
  timeoutId: ReturnType<typeof setTimeout>;
};

/**
 * Options for configuring socket requests.
 */
export type SendRequestOptions = {
  /** Optional custom timeout error factory */
  createTimeoutError?: (request: SocketResponse) => unknown;
  /** Request timeout in milliseconds */
  timeout?: number;
};

/**
 * Options required for opening a socket connection.
 */
export type SocketOpenOptions = {
  /** Milliseconds to wait for close frame before forcing closure */
  forceCloseDelay: number;
  /** Authentication token */
  token: string;
  /** Tracking ID for this connection */
  trackingId: string;
  /** Logger instance for socket operations */
  logger: SocketLogger;
  /** Optional timeout for websocket responses */
  wssResponseTimeout?: number;
  /** Optional token refresh callback */
  refreshToken?: (response: SocketResponse) => unknown;
  /** Additional options */
  [key: string]: unknown;
};

/**
 * Interface for the underlying WebSocket transport.
 */
export type SocketTransport = {
  /** Binary data type */
  binaryType: string;
  /** Number of bytes queued but not sent */
  bufferedAmount: number;
  /** Extensions negotiated with server */
  extensions: string;
  /** Sub-protocol negotiated with server */
  protocol: string;
  /** Current connection state */
  readyState: number;
  /** WebSocket URL */
  url: string;
  /** Message event handler */
  onmessage: ((event: SocketMessageEvent<string>) => void) | null;
  /** Close event handler */
  onclose: ((event: SocketCloseEvent) => void) | null;
  /** Open event handler */
  onopen: (() => void) | null;
  /** Error event handler */
  onerror: ((event: unknown) => void) | null;
  /** Close the connection */
  close: (code?: number, reason?: string) => void;
  /** Send data through the socket */
  send: (data: string) => void;
};

/**
 * Constructor type for creating socket transports.
 */
export type SocketTransportConstructor = new (...args: unknown[]) => SocketTransport;
