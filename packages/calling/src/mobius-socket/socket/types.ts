export type BrowserWebSocketConstructor = typeof WebSocket;

export type ShimGlobalScope = {
  MozWebSocket?: BrowserWebSocketConstructor;
  WebSocket?: BrowserWebSocketConstructor;
};

export type SocketCloseEvent = {
  code?: number;
  reason?: string;
};

export type SocketMessageEvent<T = unknown> = {
  data: T;
};

export type SocketLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

export type SocketResponse = {
  trackingId?: string;
  type?: string;
  subtype?: string;
  statusCode?: number;
  statusMessage?: string;
  reason?: string;
  eventId?: string;
  [key: string]: unknown;
};

export type PendingResponseEntry = {
  request: SocketResponse;
  matchesResponse: (response: SocketResponse, request: SocketResponse) => boolean;
  getStatusCode: (response: SocketResponse) => number | undefined;
  getStatusMessage: (response: SocketResponse) => string | undefined;
  createError: (response: SocketResponse, statusCode?: number, statusMessage?: string) => unknown;
  resolve: (response: SocketResponse) => void;
  reject: (error: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export type SendRequestOptions = {
  matchesResponse?: (response: SocketResponse, request: SocketResponse) => boolean;
  createError?: (response: SocketResponse, statusCode?: number, statusMessage?: string) => unknown;
  createTimeoutError?: (request: SocketResponse) => unknown;
  getStatusCode?: (response: SocketResponse) => number | undefined;
  getStatusMessage?: (response: SocketResponse) => string | undefined;
  timeout?: number;
};

export type SocketOpenOptions = {
  forceCloseDelay: number;
  token: string;
  trackingId: string;
  logger: SocketLogger;
  wssResponseTimeout?: number;
  refreshToken?: (response: SocketResponse) => unknown;
  [key: string]: unknown;
};

export type SocketTransport = {
  binaryType: string;
  bufferedAmount: number;
  extensions: string;
  protocol: string;
  readyState: number;
  url: string;
  onmessage: ((event: SocketMessageEvent<string>) => void) | null;
  onclose: ((event: SocketCloseEvent) => void) | null;
  onopen: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  close: (code?: number, reason?: string) => void;
  send: (data: string) => void;
};

export type SocketTransportConstructor = new (...args: unknown[]) => SocketTransport;
