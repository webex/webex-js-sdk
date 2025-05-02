type Enum<T extends Record<string, unknown>> = T[keyof T];

export const METRIC_EVENT_NAMES = {
  STATION_LOGIN_SUCCESS: 'Station Login Success',
  STATION_LOGIN_FAILED: 'Station Login Failed',
  STATION_LOGOUT_SUCCESS: 'Station Logout Success',
  STATION_LOGOUT_FAILED: 'Station Logout Failed',
  STATION_RELOGIN_SUCCESS: 'Station Relogin Success',
  STATION_RELOGIN_FAILED: 'Station Relogin Failed',
  AGENT_STATE_CHANGE_SUCCESS: 'Agent State Change Success',
  AGENT_STATE_CHANGE_FAILED: 'Agent State Change Failed',
  FETCH_BUDDY_AGENTS_SUCCESS: 'Fetch Buddy Agents Success',
  FETCH_BUDDY_AGENTS_FAILED: 'Fetch Buddy Agents Failed',
  WEBSOCKET_REGISTER_SUCCESS: 'Websocket Register Success',
  WEBSOCKET_REGISTER_FAILED: 'Websocket Register Failed',
  AGENT_RONA: 'Agent RONA',

  // Basic Tasks
  TASK_ACCEPT_SUCCESS: 'Task Accept Success',
  TASK_ACCEPT_FAILED: 'Task Accept Failed',
  TASK_DECLINE_SUCCESS: 'Task Decline Success',
  TASK_DECLINE_FAILED: 'Task Decline Failed',
  TASK_END_SUCCESS: 'Task End Success',
  TASK_END_FAILED: 'Task End Failed',
  TASK_WRAPUP_SUCCESS: 'Task Wrapup Success',
  TASK_WRAPUP_FAILED: 'Task Wrapup Failed',
  TASK_HOLD_SUCCESS: 'Task Hold Success',
  TASK_HOLD_FAILED: 'Task Hold Failed',
  TASK_RESUME_SUCCESS: 'Task Resume Success',
  TASK_RESUME_FAILED: 'Task Resume Failed',

  // Advanced Tasks
  TASK_CONSULT_START_SUCCESS: 'Task Consult Start Success',
  TASK_CONSULT_START_FAILED: 'Task Consult Start Failed',
  TASK_CONSULT_END_SUCCESS: 'Task Consult End Success',
  TASK_CONSULT_END_FAILED: 'Task Consult End Failed',
  TASK_TRANSFER_SUCCESS: 'Task Transfer Success',
  TASK_TRANSFER_FAILED: 'Task Transfer Failed',
  TASK_RESUME_RECORDING_SUCCESS: 'Task Resume Recording Success',
  TASK_RESUME_RECORDING_FAILED: 'Task Resume Recording Failed',
  TASK_PAUSE_RECORDING_SUCCESS: 'Task Pause Recording Success',
  TASK_PAUSE_RECORDING_FAILED: 'Task Pause Recording Failed',
  TASK_ACCEPT_CONSULT_SUCCESS: 'Task Accept Consult Success',
  TASK_ACCEPT_CONSULT_FAILED: 'Task Accept Consult Failed',

  TASK_OUTDIAL_SUCCESS: 'Task Outdial Success',
  TASK_OUTDIAL_FAILED: 'Task Outdial Failed',

  UPLOAD_LOGS_SUCCESS: 'Upload Logs Success',
  UPLOAD_LOGS_FAILED: 'Upload Logs Failed',
  WEBSOCKET_DEREGISTER_SUCCESS: 'Websocket Deregister Success',
  WEBSOCKET_DEREGISTER_FAIL: 'Websocket Deregister Failed',
} as const;

// Derive the type using the utility type
export type METRIC_EVENT_NAMES = Enum<typeof METRIC_EVENT_NAMES>;
