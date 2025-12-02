export const EVENT = 'event';
export const READY = 'ready';
export const TIMEOUT_DURATION = 20000; // 20 seconds timeout duration for webrtc registration
export const EMPTY_STRING = '';
export const PRODUCT_NAME = 'wxcc_sdk';
// FILE NAMES
export const LOG_PREFIX = 'PLUGIN_CC';
export const WEB_CALLING_SERVICE_FILE = 'WebCallingService';
export const CONFIG_FILE_NAME = 'config-index';
export const CC_FILE = 'cc';
export const CONNECTION_SERVICE_FILE = 'connection-service';
export const WEB_SOCKET_MANAGER_FILE = 'WebSocketManager';
export const AQM_REQS_FILE = 'aqm-reqs';
export const WEBEX_REQUEST_FILE = 'WebexRequest';
export const TASK_MANAGER_FILE = 'TaskManager';
export const TASK_FILE = 'Task';
// AGENT OUTDIAL CONSTANTS
export const OUTDIAL_DIRECTION = 'OUTBOUND';
export const ATTRIBUTES = {};
export const OUTDIAL_MEDIA_TYPE = 'telephony';
export const OUTBOUND_TYPE = 'OUTDIAL';

// Log related constants
export const UNKNOWN_ERROR = 'Unknown error';
export const MERCURY_DISCONNECTED_SUCCESS = 'Mercury disconnected successfully';

// METHOD NAMES
export const METHODS = {
  REGISTER: 'register',
  DEREGISTER: 'deregister',
  GET_BUDDY_AGENTS: 'getBuddyAgents',
  CONNECT_WEBSOCKET: 'connectWebsocket',
  STATION_LOGIN: 'stationLogin',
  STATION_LOGOUT: 'stationLogout',
  STATION_RELOGIN: 'stationReLogin',
  SET_AGENT_STATE: 'setAgentState',
  HANDLE_WEBSOCKET_MESSAGE: 'handleWebsocketMessage',
  SETUP_EVENT_LISTENERS: 'setupEventListeners',
  GET_CONNECTION_CONFIG: 'getConnectionConfig',
  HANDLE_CONNECTION_LOST: 'handleConnectionLost',
  SILENT_RELOGIN: 'silentRelogin',
  HANDLE_DEVICE_TYPE: 'handleDeviceType',
  START_OUTDIAL: 'startOutdial',
  GET_QUEUES: 'getQueues',
  GET_OUTDIAL_ANI_ENTRIES: 'getOutdialAniEntries',
  UPLOAD_LOGS: 'uploadLogs',
  UPDATE_AGENT_PROFILE: 'updateAgentProfile',
  GET_DEVICE_ID: 'getDeviceId',
  HANDLE_INCOMING_TASK: 'handleIncomingTask',
  HANDLE_TASK_HYDRATE: 'handleTaskHydrate',
  INCOMING_TASK_LISTENER: 'incomingTaskListener',
};
