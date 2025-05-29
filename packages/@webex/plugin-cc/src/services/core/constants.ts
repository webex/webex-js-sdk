export const KEEPALIVE_WORKER_INTERVAL = 4000;
export const NOTIFS_RESOLVE_DELAY = 1200;
export const CLOSE_SOCKET_TIMEOUT_DURATION = 16000;
export const PING_API_URL = '/health';
export const WELCOME_TIMEOUT = 30000;
export const RTD_PING_EVENT = 'rtd-online-status';
export const TIMEOUT_REQ = 20000;
export const LOST_CONNECTION_RECOVERY_TIMEOUT = 50000;
export const WS_DISCONNECT_ALLOWED = 8000;
export const CONNECTIVITY_CHECK_INTERVAL = 5000;
export const CLOSE_SOCKET_TIMEOUT = 16000;

// Method names for core services
export const METHODS = {
  // WebexRequest methods
  REQUEST: 'request',
  UPLOAD_LOGS: 'uploadLogs',

  // Utils methods
  GET_ERROR_DETAILS: 'getErrorDetails',
  GET_COMMON_ERROR_DETAILS: 'getCommonErrorDetails',
  CREATE_ERR_DETAILS_OBJECT: 'createErrDetailsObject',

  // AqmReqs methods
  REQ: 'req',
  REQ_EMPTY: 'reqEmpty',
  MAKE_API_REQUEST: 'makeAPIRequest',
  CREATE_PROMISE: 'createPromise',
  BIND_PRINT: 'bindPrint',
  BIND_CHECK: 'bindCheck',
  ON_MESSAGE: 'onMessage',

  // WebSocketManager methods
  INIT_WEB_SOCKET: 'initWebSocket',
  CLOSE: 'close',
  HANDLE_CONNECTION_LOST: 'handleConnectionLost',
  REGISTER: 'register',
  CONNECT: 'connect',
  WEB_SOCKET_ON_CLOSE_HANDLER: 'webSocketOnCloseHandler',

  // ConnectionService methods
  SETUP_EVENT_LISTENERS: 'setupEventListeners',
  DISPATCH_CONNECTION_EVENT: 'dispatchConnectionEvent',
  CS_HANDLE_CONNECTION_LOST: 'handleConnectionLost',
  CLEAR_TIMER_ON_RESTORE_FAILED: 'clearTimerOnRestoreFailed',
  HANDLE_RESTORE_FAILED: 'handleRestoreFailed',
  UPDATE_CONNECTION_DATA: 'updateConnectionData',
  SET_CONNECTION_PROP: 'setConnectionProp',
  ON_PING: 'onPing',
  HANDLE_SOCKET_CLOSE: 'handleSocketClose',
  ON_SOCKET_CLOSE: 'onSocketClose',
};
